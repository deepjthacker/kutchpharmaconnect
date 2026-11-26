alter table public.distributor_contact_events
  alter column distributor_id drop not null;

alter table public.distributor_contact_events
  add column if not exists profile_type text,
  add column if not exists profile_id uuid;

update public.distributor_contact_events
set profile_type = 'distributor',
    profile_id = distributor_id
where profile_type is null and distributor_id is not null;

alter table public.distributor_contact_events
  add constraint distributor_contact_events_profile_type_check
  check (profile_type is null or profile_type in ('company','distributor','division','brand','product'));

create table if not exists public.kpc_visitor_sessions (
  session_id uuid primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  landing_page text,
  landing_referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  is_internal boolean not null default false,
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.kpc_visitor_sessions
  (session_id, first_seen_at, last_seen_at, landing_page, landing_referrer, utm_source, utm_medium, utm_campaign)
select
  session_id,
  min(created_at),
  max(created_at),
  (array_agg(source_page order by created_at))[1],
  (array_agg(referrer order by created_at) filter (where referrer is not null))[1],
  (array_agg(utm_source order by created_at) filter (where utm_source is not null))[1],
  (array_agg(utm_medium order by created_at) filter (where utm_medium is not null))[1],
  (array_agg(utm_campaign order by created_at) filter (where utm_campaign is not null))[1]
from public.distributor_contact_events
where session_id is not null
group by session_id
on conflict (session_id) do nothing;

alter table public.distributor_contact_events
  add constraint distributor_contact_events_session_id_fkey
  foreign key (session_id) references public.kpc_visitor_sessions(session_id) on delete set null;

create index if not exists distributor_contact_events_profile_idx
  on public.distributor_contact_events(profile_type, profile_id, occurred_at desc);
create index if not exists distributor_contact_events_session_idx
  on public.distributor_contact_events(session_id, occurred_at desc);
create index if not exists kpc_visitor_sessions_last_seen_idx
  on public.kpc_visitor_sessions(last_seen_at desc);

alter table public.kpc_visitor_sessions enable row level security;
grant select, update on public.kpc_visitor_sessions to authenticated;

drop policy if exists "Admins can view KPC visitor sessions" on public.kpc_visitor_sessions;
create policy "Admins can view KPC visitor sessions"
  on public.kpc_visitor_sessions for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can update KPC visitor sessions" on public.kpc_visitor_sessions;
create policy "Admins can update KPC visitor sessions"
  on public.kpc_visitor_sessions for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
