-- KPC distributor activity and customer enquiry tracking (admin-only reporting).
create table if not exists public.distributor_contact_events (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references public.distributors(id) on delete cascade,
  event_type text not null check (event_type in ('profile_view','call_click','whatsapp_click','maps_click','email_click')),
  company_id uuid references public.companies(id) on delete set null,
  division_id uuid references public.divisions(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  distributorship_id uuid references public.distributorships(id) on delete set null,
  product_distributor_id uuid references public.product_distributors(id) on delete set null,
  session_id uuid,
  source_page text not null default '/',
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint distributor_contact_events_source_page_length check (length(source_page) <= 500),
  constraint distributor_contact_events_referrer_length check (referrer is null or length(referrer) <= 1000),
  constraint distributor_contact_events_utm_lengths check (
    (utm_source is null or length(utm_source) <= 200) and
    (utm_medium is null or length(utm_medium) <= 200) and
    (utm_campaign is null or length(utm_campaign) <= 200)
  )
);

create table if not exists public.distributor_enquiries (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid references public.distributors(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  division_id uuid references public.divisions(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  distributorship_id uuid references public.distributorships(id) on delete set null,
  product_distributor_id uuid references public.product_distributors(id) on delete set null,
  customer_name text not null check (length(trim(customer_name)) between 2 and 100),
  mobile text not null check (length(trim(mobile)) between 8 and 20),
  email text check (email is null or length(email) <= 254),
  message text not null check (length(trim(message)) between 5 and 1500),
  consent boolean not null default false check (consent = true),
  consent_at timestamptz not null default now(),
  routing_status text not null default 'needs_review'
    check (routing_status in ('routed','needs_review')),
  status text not null default 'new'
    check (status in ('new','contacted','converted','not_converted','invalid')),
  source_page text not null default '/',
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  admin_notes text,
  contacted_at timestamptz,
  follow_up_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint distributor_enquiries_source_page_length check (length(source_page) <= 500),
  constraint distributor_enquiries_referrer_length check (referrer is null or length(referrer) <= 1000),
  constraint distributor_enquiries_utm_lengths check (
    (utm_source is null or length(utm_source) <= 200) and
    (utm_medium is null or length(utm_medium) <= 200) and
    (utm_campaign is null or length(utm_campaign) <= 200)
  )
);

create index if not exists distributor_contact_events_distributor_time_idx
  on public.distributor_contact_events (distributor_id, occurred_at desc);
create index if not exists distributor_contact_events_type_time_idx
  on public.distributor_contact_events (event_type, occurred_at desc);
create index if not exists distributor_contact_events_company_time_idx
  on public.distributor_contact_events (company_id, occurred_at desc);
create index if not exists distributor_contact_events_product_time_idx
  on public.distributor_contact_events (product_id, occurred_at desc);

create index if not exists distributor_enquiries_distributor_created_idx
  on public.distributor_enquiries (distributor_id, created_at desc);
create index if not exists distributor_enquiries_status_created_idx
  on public.distributor_enquiries (status, created_at desc);
create index if not exists distributor_enquiries_follow_up_idx
  on public.distributor_enquiries (follow_up_at)
  where follow_up_at is not null;

alter table public.distributor_contact_events enable row level security;
alter table public.distributor_enquiries enable row level security;

revoke all on table public.distributor_contact_events from public, anon, authenticated;
revoke all on table public.distributor_enquiries from public, anon, authenticated;

grant select on table public.distributor_contact_events to authenticated;
grant select, update on table public.distributor_enquiries to authenticated;
grant all on table public.distributor_contact_events to service_role;
grant all on table public.distributor_enquiries to service_role;

drop policy if exists "Admins can view distributor contact events" on public.distributor_contact_events;
create policy "Admins can view distributor contact events"
  on public.distributor_contact_events
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can view distributor enquiries" on public.distributor_enquiries;
create policy "Admins can view distributor enquiries"
  on public.distributor_enquiries
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can update distributor enquiries" on public.distributor_enquiries;
create policy "Admins can update distributor enquiries"
  on public.distributor_enquiries
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

comment on table public.distributor_contact_events is
  'Admin-only distributor profile and contact activity. A click is not proof of a completed call or message.';
comment on table public.distributor_enquiries is
  'Customer-submitted distributor enquiries. Access is restricted to active KPC admins.';
