-- KutchPharmaConnect controlled Zydus identity normalization
-- Preserve Zydus Healthcare Limited as a separate subsidiary.
-- Normalize the former Cadila Healthcare Limited entity to its current legal name.

update public.companies
set company_name = 'Zydus Lifesciences Limited',
    verification_note = 'Normalized current legal name from historical "Cadila Healthcare Limited". Zydus Healthcare Limited remains a separate subsidiary/company entity.'
where company_name = 'Cadila Healthcare Limited';

insert into public.search_aliases (company_id, alias_name, alias_type)
select c.id, 'Cadila Healthcare Limited', 'former_name'
from public.companies c
where c.company_name = 'Zydus Lifesciences Limited'
  and not exists (
    select 1 from public.search_aliases a
    where a.company_id = c.id and lower(a.alias_name) = lower('Cadila Healthcare Limited')
  );

insert into public.search_aliases (company_id, alias_name, alias_type)
select c.id, 'Cadila Healthcare', 'former_name'
from public.companies c
where c.company_name = 'Zydus Lifesciences Limited'
  and not exists (
    select 1 from public.search_aliases a
    where a.company_id = c.id and lower(a.alias_name) = lower('Cadila Healthcare')
  );
