-- Keep public brand lookup independent from admin authorization.
-- The public SELECT policy is intentionally separate from admin write policies.

drop policy if exists "brands_admin_all" on public.brands;

create policy "brands_admin_insert"
on public.brands
for insert
to authenticated
with check (public.is_admin());

create policy "brands_admin_update"
on public.brands
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "brands_admin_delete"
on public.brands
for delete
to authenticated
using (public.is_admin());
