-- Kutch Pharma Connect V1 directory schema (design draft)
--
-- This is a standalone V1 schema proposal. It has NOT been applied to Supabase.
-- The existing production project already has tables and data; do not run this
-- file against that project as-is. Adapt it into a reviewed migration first.
--
-- V1 intentionally models only distributors, pharma companies, and their
-- many-to-many distributorship mappings. Product, brand, division, and
-- subsidiary concepts are deliberately out of scope.

begin;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (length(btrim(company_name)) between 2 and 200),
  legal_name text,
  website_url text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.distributors (
  id uuid primary key default gen_random_uuid(),
  distributor_name text not null check (length(btrim(distributor_name)) between 2 and 200),
  contact_person text,
  phone text,
  whatsapp text,
  email text,
  address_line text,
  town text not null check (length(btrim(town)) between 2 and 100),
  district text not null default 'Kutch',
  pincode text check (pincode is null or pincode ~ '^[0-9]{6}$'),
  maps_url text,
  drug_license_20b text,
  drug_license_21b text,
  emergency_24x7 boolean not null default false,
  cold_chain_available boolean not null default false,
  is_active boolean not null default false,
  is_verified boolean not null default false,
  profile_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.distributorships (
  id uuid primary key default gen_random_uuid(),
  -- Restrict parent deletion; archive records via is_active instead.
  distributor_id uuid not null references public.distributors(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  authorized_from date,
  authorized_until date,
  verified_at timestamptz,
  verification_note text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint distributorships_unique_pair unique (distributor_id, company_id),
  constraint distributorships_valid_period
    check (authorized_until is null or authorized_from is null or authorized_until >= authorized_from),
  constraint distributorships_verified_timestamp
    check (verification_status <> 'verified' or verified_at is not null)
);

-- Search and filter indexes for the V1 directory and relationship lookups.
create index if not exists companies_name_lower_idx
  on public.companies (lower(company_name));
create index if not exists companies_active_name_idx
  on public.companies (company_name, id) where is_active;

create index if not exists distributors_town_name_idx
  on public.distributors (lower(town), lower(distributor_name));
create index if not exists distributors_directory_filters_idx
  on public.distributors (lower(town), emergency_24x7, cold_chain_available)
  where is_active and is_verified;

create index if not exists distributorships_company_lookup_idx
  on public.distributorships (company_id, distributor_id)
  where is_active and verification_status = 'verified';
create index if not exists distributorships_distributor_lookup_idx
  on public.distributorships (distributor_id, company_id)
  where is_active and verification_status = 'verified';

alter table public.companies enable row level security;
alter table public.distributors enable row level security;
alter table public.distributorships enable row level security;

grant select on public.companies, public.distributors, public.distributorships to anon, authenticated;
grant insert, update, delete on public.companies, public.distributors, public.distributorships to authenticated;

-- Only active companies and verified active distributor profiles appear in the directory.
create policy "V1 directory can read active companies"
  on public.companies for select to anon, authenticated
  using (is_active);
create policy "V1 directory can read verified active distributors"
  on public.distributors for select to anon, authenticated
  using (is_active and is_verified);
create policy "V1 directory can read verified active mappings"
  on public.distributorships for select to anon, authenticated
  using (
    is_active
    and verification_status = 'verified'
    and exists (
      select 1 from public.distributors d
      where d.id = distributor_id and d.is_active and d.is_verified
    )
    and exists (
      select 1 from public.companies c
      where c.id = company_id and c.is_active
    )
  );

-- Reuse the current project's vetted public.is_admin() authorization helper.
-- A fresh Supabase project must add an equivalent trusted admin check before
-- applying the management policies below; never authorize from user_metadata.
create policy "V1 admins manage companies"
  on public.companies for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "V1 admins manage distributors"
  on public.distributors for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "V1 admins manage distributorships"
  on public.distributorships for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Demo records are intentionally inactive and unverified. They are not real
-- businesses, licenses, or endorsements and will not appear in public search.
insert into public.companies (id, company_name, legal_name, is_active)
values (
  '00000000-0000-4000-8000-000000000001',
  'Sample Pharma Company (Demo Only)',
  'Sample Pharma Company (Demo Only)',
  false
)
on conflict (id) do nothing;

insert into public.distributors (id, distributor_name, town, district, is_active, is_verified)
values
  ('00000000-0000-4000-8000-000000000101', 'Sample Distributor — Bhuj (Demo Only)', 'Bhuj', 'Kutch', false, false),
  ('00000000-0000-4000-8000-000000000102', 'Sample Distributor — Gandhidham (Demo Only)', 'Gandhidham', 'Kutch', false, false),
  ('00000000-0000-4000-8000-000000000103', 'Sample Distributor — Anjar (Demo Only)', 'Anjar', 'Kutch', false, false),
  ('00000000-0000-4000-8000-000000000104', 'Sample Distributor — Mandvi (Demo Only)', 'Mandvi', 'Kutch', false, false),
  ('00000000-0000-4000-8000-000000000105', 'Sample Distributor — Mundra (Demo Only)', 'Mundra', 'Kutch', false, false),
  ('00000000-0000-4000-8000-000000000106', 'Sample Distributor — Bhachau (Demo Only)', 'Bhachau', 'Kutch', false, false),
  ('00000000-0000-4000-8000-000000000107', 'Sample Distributor — Rapar (Demo Only)', 'Rapar', 'Kutch', false, false),
  ('00000000-0000-4000-8000-000000000108', 'Sample Distributor — Nakhatrana (Demo Only)', 'Nakhatrana', 'Kutch', false, false)
on conflict (id) do nothing;

insert into public.distributorships (
  id, distributor_id, company_id, verification_status, is_active
)
values (
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000001',
  'pending',
  false
)
on conflict (id) do nothing;

commit;
