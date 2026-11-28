alter table public.kpc_visitor_sessions
  add column if not exists visitor_id uuid;

create table if not exists public.kpc_internal_visitors (
  visitor_id uuid primary key,
  label text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.kpc_search_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid,
  session_id uuid references public.kpc_visitor_sessions(session_id) on delete set null,
  search_term text not null check (length(search_term) between 1 and 120),
  result_count integer not null check (result_count >= 0),
  is_zero_result boolean not null,
  source_page text not null default '/',
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now(),
  constraint kpc_search_events_source_page_length check (length(source_page) <= 500)
);

create index if not exists kpc_visitor_sessions_visitor_idx
  on public.kpc_visitor_sessions(visitor_id, first_seen_at desc);
create index if not exists kpc_search_events_created_idx
  on public.kpc_search_events(created_at desc);
create index if not exists kpc_search_events_zero_idx
  on public.kpc_search_events(is_zero_result, created_at desc);
create index if not exists kpc_search_events_term_idx
  on public.kpc_search_events(search_term, created_at desc);

alter table public.kpc_internal_visitors enable row level security;
alter table public.kpc_search_events enable row level security;

revoke all on table public.kpc_internal_visitors from public, anon, authenticated;
revoke all on table public.kpc_search_events from public, anon, authenticated;

grant select, insert, delete on table public.kpc_internal_visitors to authenticated;
grant select on table public.kpc_search_events to authenticated;
grant all on table public.kpc_internal_visitors to service_role;
grant all on table public.kpc_search_events to service_role;

drop policy if exists "Admins can manage KPC internal visitors" on public.kpc_internal_visitors;
create policy "Admins can manage KPC internal visitors"
  on public.kpc_internal_visitors for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins can view KPC search events" on public.kpc_search_events;
create policy "Admins can view KPC search events"
  on public.kpc_search_events for select to authenticated
  using ((select public.is_admin()));

comment on table public.kpc_search_events is
  'Admin-only search analytics. Search terms resembling email addresses or phone numbers are redacted before storage.';
comment on table public.kpc_internal_visitors is
  'Admin-managed browser visitor IDs excluded from KPC external usage reporting.';
