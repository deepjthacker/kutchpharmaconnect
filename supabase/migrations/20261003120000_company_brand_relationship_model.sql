create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  brand_name text not null,
  normalized_brand_name text generated always as (lower(regexp_replace(trim(brand_name), '\\s+', ' ', 'g'))) stored,
  description text,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brands_name_nonblank check (length(trim(brand_name)) > 0)
);
create unique index if not exists brands_company_name_unique on public.brands(company_id, normalized_brand_name);
create index if not exists brands_company_id_idx on public.brands(company_id);
alter table public.distributorships add column if not exists brand_id uuid references public.brands(id) on delete set null;
alter table public.distributorships add column if not exists handled_as text not null default 'company';
alter table public.distributorships drop constraint if exists distributorships_handled_as_check;
alter table public.distributorships add constraint distributorships_handled_as_check check (handled_as in ('company','brand','division','unclear'));
drop index if exists public.unique_active_distributorship;
create unique index unique_active_distributorship on public.distributorships(company_id,coalesce(brand_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(division_id,'00000000-0000-0000-0000-000000000000'::uuid),distributor_id,coalesce(category_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(location_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(territory,'')) where status='active';
alter table public.brands enable row level security;
drop policy if exists "brands_public_read_active" on public.brands;
create policy "brands_public_read_active" on public.brands for select using (status='active');
drop policy if exists "brands_admin_all" on public.brands;
create policy "brands_admin_all" on public.brands for all using (public.is_admin()) with check (public.is_admin());
drop trigger if exists trg_brands_updated_at on public.brands;
create trigger trg_brands_updated_at before update on public.brands for each row execute function public.set_updated_at();
