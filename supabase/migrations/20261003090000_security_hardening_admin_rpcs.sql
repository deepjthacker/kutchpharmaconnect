-- Security hardening for admin-only RPCs.
revoke execute on function public.admin_delete_company(uuid) from public, anon;
revoke execute on function public.admin_delete_distributor(uuid) from public, anon;
revoke execute on function public.admin_delete_distributorship(uuid) from public, anon;
grant execute on function public.admin_delete_company(uuid) to authenticated;
grant execute on function public.admin_delete_distributor(uuid) to authenticated;
grant execute on function public.admin_delete_distributorship(uuid) to authenticated;

revoke execute on function public.publish_distributor_submission(uuid,jsonb,text,uuid,uuid) from public, anon;
grant execute on function public.publish_distributor_submission(uuid,jsonb,text,uuid,uuid) to authenticated;

revoke execute on function public.publish_product_submission(uuid,uuid,boolean,jsonb,jsonb,text) from public, anon;
grant execute on function public.publish_product_submission(uuid,uuid,boolean,jsonb,jsonb,text) to authenticated;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;