-- Admin-only permanent cleanup functions.
-- Normal directory maintenance should use status = inactive.
create or replace function public.admin_delete_distributor(p_distributor_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_city_id uuid; v_rel_count integer; v_product_rel_count integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select city_id into v_city_id from public.distributors where id=p_distributor_id for update;
  if not found then raise exception 'Distributor not found'; end if;
  select count(*) into v_rel_count from public.distributorships where distributor_id=p_distributor_id;
  select count(*) into v_product_rel_count from public.product_distributors where distributor_id=p_distributor_id;
  delete from public.product_distributors where distributor_id=p_distributor_id;
  delete from public.product_submissions where distributor_id=p_distributor_id;
  delete from public.distributorships where distributor_id=p_distributor_id;
  delete from public.distributors where id=p_distributor_id;
  if v_city_id is not null
     and not exists (select 1 from public.distributors where city_id=v_city_id)
     and not exists (select 1 from public.distributorships where location_id=v_city_id)
     and not exists (select 1 from public.product_distributors where location_id=v_city_id)
  then delete from public.locations where id=v_city_id; end if;
  return jsonb_build_object('success',true,'deleted_relationships',v_rel_count,'deleted_product_relationships',v_product_rel_count);
end $$;

create or replace function public.admin_delete_company(p_company_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_rel_count integer; v_div_count integer; v_product_count integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  perform 1 from public.companies where id=p_company_id for update;
  if not found then raise exception 'Company not found'; end if;
  select count(*) into v_rel_count from public.distributorships where company_id=p_company_id;
  select count(*) into v_div_count from public.divisions where company_id=p_company_id;
  select count(*) into v_product_count from public.products where company_id=p_company_id;
  delete from public.product_distributors where product_id in (select id from public.products where company_id=p_company_id);
  delete from public.products where company_id=p_company_id;
  delete from public.distributorships where company_id=p_company_id;
  delete from public.company_categories where company_id=p_company_id;
  delete from public.divisions where company_id=p_company_id;
  delete from public.search_aliases where entity_type='company' and entity_id=p_company_id;
  delete from public.companies where id=p_company_id;
  return jsonb_build_object('success',true,'deleted_relationships',v_rel_count,'deleted_divisions',v_div_count,'deleted_products',v_product_count);
end $$;

create or replace function public.admin_delete_distributorship(p_distributorship_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  delete from public.distributorships where id=p_distributorship_id;
  if not found then raise exception 'Distributorship not found'; end if;
  return jsonb_build_object('success',true);
end $$;

grant execute on function public.admin_delete_distributor(uuid) to authenticated;
grant execute on function public.admin_delete_company(uuid) to authenticated;
grant execute on function public.admin_delete_distributorship(uuid) to authenticated;
revoke execute on function public.admin_delete_distributor(uuid) from anon;
revoke execute on function public.admin_delete_company(uuid) from anon;
revoke execute on function public.admin_delete_distributorship(uuid) from anon;