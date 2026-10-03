create or replace function public.publish_distributor_submission(
  p_submission_id uuid,
  p_mappings jsonb,
  p_admin_notes text default null,
  p_distributor_id uuid default null,
  p_location_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  s public.distributor_submissions%rowtype;
  m jsonb;
  d_id uuid;
  c_id uuid;
  div_id uuid;
  cat_id uuid;
  loc_id uuid;
  rel_id uuid;
  created_distributor boolean := false;
  created_location boolean := false;
  created_companies integer := 0;
  created_relationships integer := 0;
  skipped_relationships integer := 0;
  existing_dist public.distributors%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into s from public.distributor_submissions
  where id = p_submission_id for update;

  if not found then raise exception 'Submission not found'; end if;
  if s.status not in ('open','under_review','approved') then
    raise exception 'Submission is not publishable from status %',s.status;
  end if;

  -- Distributor location is resolved once and reused for every relationship.
  loc_id := p_location_id;

  if loc_id is not null then
    perform 1 from public.locations where id = loc_id and status = 'active';
    if not found then raise exception 'Selected distributor location not found or inactive'; end if;
  else
    if nullif(trim(s.city),'') is null then raise exception 'Distributor location is required'; end if;

    select id into loc_id
    from public.locations
    where status = 'active'
      and lower(trim(city)) = lower(trim(s.city))
      and lower(trim(coalesce(district,''))) = lower(trim(coalesce(s.district,'')))
      and lower(trim(coalesce(state,''))) = lower(trim(coalesce(s.state,'')))
    order by created_at
    limit 1;

    if loc_id is null then
      insert into public.locations(state,district,city,pincode,status)
      values(
        coalesce(nullif(trim(s.state),''),'Gujarat'),
        coalesce(nullif(trim(s.district),''),'Kutch'),
        trim(s.city),
        null,
        'active'
      )
      returning id into loc_id;
      created_location := true;
    end if;
  end if;

  d_id := p_distributor_id;
  if d_id is null then d_id := s.distributor_id; end if;

  if d_id is not null then
    perform 1 from public.distributors where id = d_id and status = 'active';
    if not found then raise exception 'Selected distributor not found or inactive'; end if;

    update public.distributors
    set city_id = coalesce(city_id,loc_id), updated_at = now()
    where id = d_id;
  else
    select * into existing_dist
    from public.distributors
    where status = 'active'
      and (
        lower(trim(distributor_name)) = lower(trim(s.distributor_name))
        or (
          s.mobile is not null
          and regexp_replace(coalesce(mobile,''),'\\D','','g') =
              regexp_replace(s.mobile,'\\D','','g')
        )
      )
    order by case
      when lower(trim(distributor_name)) = lower(trim(s.distributor_name)) then 0
      else 1
    end
    limit 1;

    if existing_dist.id is not null then
      d_id := existing_dist.id;
      update public.distributors
      set city_id = coalesce(city_id,loc_id), updated_at = now()
      where id = d_id;
    else
      insert into public.distributors(
        distributor_name,legal_name,contact_person,mobile,whatsapp,email,
        address,city_id,maps_url,website,notes,status
      )
      values(
        trim(s.distributor_name),
        nullif(trim(s.legal_name),''),
        nullif(trim(s.contact_person),''),
        trim(s.mobile),
        nullif(trim(s.whatsapp),''),
        nullif(trim(s.email),''),
        nullif(trim(s.address),''),
        loc_id,
        nullif(trim(s.maps_url),''),
        nullif(trim(s.website),''),
        nullif(trim(s.notes),''),
        'active'
      )
      returning id into d_id;
      created_distributor := true;
    end if;
  end if;

  for m in select * from jsonb_array_elements(coalesce(p_mappings,'[]'::jsonb))
  loop
    if coalesce(m->>'action','') not in ('match','create') then
      skipped_relationships := skipped_relationships + 1;
      continue;
    end if;

    if m->>'action' = 'match' then
      c_id := nullif(m->>'company_id','')::uuid;
      if c_id is null then raise exception 'Matched company id missing'; end if;

      perform 1 from public.companies where id = c_id and status = 'active';
      if not found then raise exception 'Matched company not found'; end if;
    else
      if nullif(trim(m->>'company_name'),'') is null then
        raise exception 'New company name is required';
      end if;

      insert into public.companies(company_name,legal_name,short_name,status)
      values(
        trim(m->>'company_name'),
        nullif(trim(m->>'legal_name'),''),
        nullif(trim(m->>'short_name'),''),
        'active'
      )
      returning id into c_id;
      created_companies := created_companies + 1;
    end if;

    div_id := nullif(m->>'division_id','')::uuid;
    if div_id is not null then
      perform 1 from public.divisions
      where id = div_id and company_id = c_id and status = 'active';

      if not found then raise exception 'Division does not belong to selected company'; end if;
    end if;

    cat_id := nullif(m->>'category_id','')::uuid;
    if cat_id is null then
      select id into cat_id
      from public.categories
      where status = 'active'
        and lower(name) = lower(coalesce(nullif(trim(m->>'category'),''),'Pharmaceutical'))
      limit 1;
    end if;

    if cat_id is null then raise exception 'Category not found'; end if;

    insert into public.company_categories(company_id,category_id)
    values(c_id,cat_id)
    on conflict do nothing;

    select id into rel_id
    from public.distributorships
    where company_id = c_id
      and distributor_id = d_id
      and coalesce(division_id,'00000000-0000-0000-0000-000000000000') =
          coalesce(div_id,'00000000-0000-0000-0000-000000000000')
      and category_id = cat_id
      and location_id = loc_id
      and status = 'active'
      and coalesce(territory,'') = coalesce(nullif(m->>'territory'),'','');

    if rel_id is null then
      insert into public.distributorships(
        company_id,division_id,distributor_id,category_id,location_id,
        territory,status,verification_status,source,verification_note
      )
      values(
        c_id,div_id,d_id,cat_id,loc_id,
        nullif(trim(m->>'territory'),''),
        'active','unverified','distributor_submission',
        'Submitted by distributor; published after admin review.'
      );
      created_relationships := created_relationships + 1;
    else
      skipped_relationships := skipped_relationships + 1;
    end if;
  end loop;

  update public.distributor_submissions
  set status = 'approved',
      distributor_id = d_id,
      admin_notes = coalesce(p_admin_notes,admin_notes),
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_submission_id;

  return jsonb_build_object(
    'success',true,
    'distributor_id',d_id,
    'location_id',loc_id,
    'created_distributor',created_distributor,
    'created_location',created_location,
    'created_companies',created_companies,
    'created_relationships',created_relationships,
    'skipped_relationships',skipped_relationships
  );
end;
$function$;

grant execute on function public.publish_distributor_submission(uuid,jsonb,text,uuid,uuid) to authenticated;
revoke execute on function public.publish_distributor_submission(uuid,jsonb,text,uuid,uuid) from anon;
