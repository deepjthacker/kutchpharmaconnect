alter table public.companies
  add column if not exists parent_company_id uuid references public.companies(id) on delete set null;

alter table public.companies
  drop constraint if exists companies_not_own_parent;
alter table public.companies
  add constraint companies_not_own_parent
  check (parent_company_id is null or parent_company_id <> id);

create index if not exists companies_parent_company_id_idx
  on public.companies(parent_company_id);

comment on column public.companies.parent_company_id is
  'Direct parent legal entity; subsidiaries remain separate company records.';

alter table public.products
  add column if not exists brand_id uuid references public.brands(id) on delete set null;

create index if not exists products_brand_id_idx
  on public.products(brand_id);

comment on column public.products.brand_id is
  'Optional parent brand for this product. Brand and product remain separate entities.';
