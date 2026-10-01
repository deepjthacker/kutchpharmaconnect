create extension if not exists pgcrypto;

create table if not exists public.correction_reports (
  id uuid primary key default gen_random_uuid(),
  entity_type text,
  entity_id uuid,
  report_type text not null default 'incorrect_relationship',
  message text not null,
  contact text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.correction_reports enable row level security;

drop policy if exists "Public can submit correction reports" on public.correction_reports;
create policy "Public can submit correction reports"
on public.correction_reports
for insert
to anon, authenticated
with check (
  length(trim(message)) between 5 and 2000
  and report_type in ('incorrect_relationship','incorrect_contact','incorrect_company_name','other')
);

drop policy if exists "Admins can read correction reports" on public.correction_reports;
create policy "Admins can read correction reports"
on public.correction_reports
for select
to authenticated
using (exists (
  select 1 from public.admin_users au
  where au.user_id = auth.uid() and au.active = true
));

drop policy if exists "Admins can update correction reports" on public.correction_reports;
create policy "Admins can update correction reports"
on public.correction_reports
for update
to authenticated
using (exists (
  select 1 from public.admin_users au
  where au.user_id = auth.uid() and au.active = true
))
with check (exists (
  select 1 from public.admin_users au
  where au.user_id = auth.uid() and au.active = true
));

create index if not exists idx_correction_reports_status on public.correction_reports(status);
create index if not exists idx_correction_reports_created_at on public.correction_reports(created_at desc);
create index if not exists idx_correction_reports_entity on public.correction_reports(entity_type, entity_id);