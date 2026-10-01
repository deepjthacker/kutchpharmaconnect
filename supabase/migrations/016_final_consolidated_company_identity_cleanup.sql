-- KutchPharmaConnect FINAL CONSOLIDATED COMPANY IDENTITY CLEANUP
-- Idempotent: safe to run after migrations 011-015 or by itself.
-- Scope: current legal/company identity normalization + searchable former/raw aliases.
-- Deliberately does NOT merge ambiguous entities or infer distributor/division relationships.

-- 1. Current legal identities already externally corroborated.
update public.companies
set company_name = '3 Cube Bio-Med Services Private Limited',
    verification_note = 'Normalized from raw distributor entry "3 Cube"; corporate identity corroborated (CIN U74999MH2003PTC141655).'
where company_name = '3 Cube';

update public.companies
set company_name = 'Blue Cross Laboratories Private Limited',
    verification_note = 'Normalized from "Blue Cross Laboratories Ltd."; current legal entity corroborated (CIN U24230MH1980PTC022825).'
where company_name = 'Blue Cross Laboratories Ltd.';

update public.companies
set company_name = 'Gladstone Pharma India Pvt. Ltd.',
    verification_note = 'Normalized from raw entry "Glasstone Pharmaceuticals"; corrected spelling/entity identity.'
where company_name = 'Glasstone Pharmaceuticals';

update public.companies
set company_name = 'Roche Products (India) Private Limited',
    verification_note = 'Normalized from "La Roche Ltd."; current Indian legal entity corroborated.'
where company_name = 'La Roche Ltd.';

update public.companies
set company_name = 'West-Coast Pharmaceutical Works Limited',
    verification_note = 'Normalized legal presentation from "West-Coast Pharmaceutical Works Ltd.".'
where company_name = 'West-Coast Pharmaceutical Works Ltd.';

update public.companies
set company_name = 'Tripada Lifecare Private Limited',
    verification_note = 'Normalized from "Tripada Lifecare Pvt. Ltd.".'
where company_name = 'Tripada Lifecare Pvt. Ltd.';

update public.companies
set company_name = 'Trion Pharma India LLP',
    verification_note = 'Normalized from distributor entry "Trion"; current Indian LLP identity corroborated.'
where company_name = 'Trion';

update public.companies
set company_name = 'Amneal Healthcare Private Limited',
    verification_note = 'Normalized from "Amneal Pharmaceuticals"; current Indian legal entity corroborated.'
where company_name = 'Amneal Pharmaceuticals';

update public.companies
set company_name = 'Nutricia International Private Limited',
    short_name = 'Danone',
    verification_note = 'Nutricia International Private Limited is the Indian legal entity; Danone is retained as parent/group/search identity.'
where company_name = 'Nutricia International Pvt. Ltd. / Danone';

update public.companies
set company_name = 'Wings Pharmaceuticals Private Limited',
    verification_note = 'Normalized from distributor entries "Wings Pharma / Wings Pharmaceuticals Pvt. Ltd.".'
where company_name in ('Wings Pharma','Wings Pharmaceuticals Pvt. Ltd.');

update public.companies
set company_name = 'German Remedies Pharmaceuticals Private Limited',
    verification_note = 'Normalized from "German Remedies"; retained as legal entity while Zydus Healthcare remains the separate group/business context.'
where company_name = 'German Remedies';

update public.companies
set company_name = 'Healvia Drugs Private Limited',
    verification_note = 'Normalized from "Healvia"; current Indian company identity corroborated.'
where company_name = 'Healvia';

update public.companies
set company_name = 'Alteus Biogenics Private Limited',
    verification_note = 'Normalized from "Alteus Biegenics Pvt. Ltd."; exact company identity corroborated.'
where company_name = 'Alteus Biegenics Pvt. Ltd.';

update public.companies
set company_name = 'Zydus Lifesciences Limited',
    verification_note = 'Normalized current legal name from historical "Cadila Healthcare Limited". Zydus Healthcare Limited remains a separate subsidiary/entity.'
where company_name = 'Cadila Healthcare Limited';

update public.companies
set company_name = 'Johnson & Johnson Private Limited',
    verification_note = 'Normalized legal presentation from "Johnson & Johnson Pvt. Ltd. / J&J". Do not merge with Johnson & Johnson Vision India Private Limited or other J&J India entities.'
where company_name = 'Johnson & Johnson Pvt. Ltd. / J&J';

-- 2. Search aliases for identities where old/raw names are important.
insert into public.search_aliases (company_id, alias_name, alias_type)
select c.id, v.alias_name, v.alias_type
from public.companies c
cross join (values
  ('Cadila Healthcare Limited','former_name'),
  ('Cadila Healthcare','former_name'),
  ('3 Cube','raw_name'),
  ('Glasstone Pharmaceuticals','raw_name'),
  ('La Roche Ltd.','raw_name'),
  ('Blue Cross Laboratories Ltd.','raw_name'),
  ('West-Coast Pharmaceutical Works Ltd.','raw_name'),
  ('Tripada Lifecare Pvt. Ltd.','raw_name'),
  ('Wings Pharma','raw_name'),
  ('Wings Pharmaceuticals Pvt. Ltd.','raw_name'),
  ('German Remedies','raw_name'),
  ('Healvia','raw_name'),
  ('Alteus Biegenics Pvt. Ltd.','raw_name'),
  ('Johnson & Johnson Pvt. Ltd. / J&J','raw_name')
) as v(alias_name,alias_type)
where
  ((c.company_name = 'Zydus Lifesciences Limited' and v.alias_name in ('Cadila Healthcare Limited','Cadila Healthcare'))
   or (c.company_name = '3 Cube Bio-Med Services Private Limited' and v.alias_name = '3 Cube')
   or (c.company_name = 'Gladstone Pharma India Pvt. Ltd.' and v.alias_name = 'Glasstone Pharmaceuticals')
   or (c.company_name = 'Roche Products (India) Private Limited' and v.alias_name = 'La Roche Ltd.')
   or (c.company_name = 'Blue Cross Laboratories Private Limited' and v.alias_name = 'Blue Cross Laboratories Ltd.')
   or (c.company_name = 'West-Coast Pharmaceutical Works Limited' and v.alias_name = 'West-Coast Pharmaceutical Works Ltd.')
   or (c.company_name = 'Tripada Lifecare Private Limited' and v.alias_name = 'Tripada Lifecare Pvt. Ltd.')
   or (c.company_name = 'Wings Pharmaceuticals Private Limited' and v.alias_name in ('Wings Pharma','Wings Pharmaceuticals Pvt. Ltd.'))
   or (c.company_name = 'German Remedies Pharmaceuticals Private Limited' and v.alias_name = 'German Remedies')
   or (c.company_name = 'Healvia Drugs Private Limited' and v.alias_name = 'Healvia')
   or (c.company_name = 'Alteus Biogenics Private Limited' and v.alias_name = 'Alteus Biegenics Pvt. Ltd.')
   or (c.company_name = 'Johnson & Johnson Private Limited' and v.alias_name = 'Johnson & Johnson Pvt. Ltd. / J&J'))
  and not exists (
    select 1 from public.search_aliases a
    where a.company_id = c.id
      and lower(a.alias_name) = lower(v.alias_name)
  );

-- 3. INTENTIONALLY UNCHANGED:
-- US Healthcare: insufficient identity evidence.
-- Briony Lifesciences: insufficient identity evidence.
-- Sanzyme / Sanzyme Biologics: two distinct active legal entities; do not merge.
-- Johnson & Johnson Vision India Private Limited: separate entity; do not merge into J&J Private Limited.
-- Abbott India Limited / Abbott Healthcare Private Limited: separate entities.
-- Pfizer Limited / Pfizer Products India Private Limited / Pfizer Healthcare India Private Limited: separate entities.
-- Zydus Lifesciences Limited / Zydus Healthcare Limited: separate entities.
-- Novartis India Limited: current legal identity retained; ownership/group changes do not justify renaming.
