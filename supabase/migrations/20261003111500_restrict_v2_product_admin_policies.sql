-- V2 product tables are not public intake surfaces in V1.
-- Keep admin policies restricted to authenticated admin users.
drop policy if exists product_distributors_admin_all on public.product_distributors;
create policy product_distributors_admin_all
on public.product_distributors
for all
to authenticated
using (is_admin())
with check (is_admin());

drop policy if exists product_submission_publish_audits_admin_all on public.product_submission_publish_audits;
create policy product_submission_publish_audits_admin_all
on public.product_submission_publish_audits
for all
to authenticated
using (is_admin())
with check (is_admin());

drop policy if exists product_submissions_admin_all on public.product_submissions;
create policy product_submissions_admin_all
on public.product_submissions
for all
to authenticated
using (is_admin())
with check (is_admin());

drop policy if exists product_submissions_public_insert on public.product_submissions;

drop policy if exists products_admin_all on public.products;
create policy products_admin_all
on public.products
for all
to authenticated
using (is_admin())
with check (is_admin());