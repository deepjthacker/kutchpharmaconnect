do $outer$
declare def text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='publish_distributor_submission';
  def := replace(def,
$old$select id into rel_id
    from public.distributorships
    where company_id = c_id
      and distributor_id = d_id
      and coalesce(brand_id,'00000000-0000-0000-0000-000000000000'::uuid) =
          coalesce(brand_id,'00000000-0000-0000-0000-000000000000'::uuid)
      and coalesce(distributorships.division_id,'00000000-0000-0000-0000-000000000000'::uuid) =
          coalesce(div_id,'00000000-0000-0000-0000-000000000000'::uuid)
      and coalesce(distributorships.category_id,'00000000-0000-0000-0000-000000000000'::uuid) = cat_id
      and coalesce(distributorships.location_id,'00000000-0000-0000-0000-000000000000'::uuid) = loc_id
      and status='active'
      and coalesce(territory,'') = coalesce(nullif(trim(m->>'territory'),''),'')$old$,
$new$select ds.id into rel_id
    from public.distributorships ds
    where ds.company_id = c_id
      and ds.distributor_id = d_id
      and coalesce(ds.brand_id,'00000000-0000-0000-0000-000000000000'::uuid) =
          coalesce(brand_id,'00000000-0000-0000-0000-000000000000'::uuid)
      and coalesce(ds.division_id,'00000000-0000-0000-0000-000000000000'::uuid) =
          coalesce(div_id,'00000000-0000-0000-0000-000000000000'::uuid)
      and coalesce(ds.category_id,'00000000-0000-0000-0000-000000000000'::uuid) = cat_id
      and coalesce(ds.location_id,'00000000-0000-0000-0000-000000000000'::uuid) = loc_id
      and ds.status='active'
      and coalesce(ds.territory,'') = coalesce(nullif(trim(m->>'territory'),''),'')$new$);
  if position('from public.distributorships ds' in def)=0 then raise exception 'Expected publish lookup was not found'; end if;
  execute def;
end $outer$;
