alter table public.distributor_contact_events
  add column if not exists is_internal boolean not null default false;

alter table public.kpc_search_events
  add column if not exists is_internal boolean not null default false;

create index if not exists distributor_contact_events_external_time_idx
  on public.distributor_contact_events(is_internal, occurred_at desc);
create index if not exists kpc_search_events_external_time_idx
  on public.kpc_search_events(is_internal, created_at desc);
