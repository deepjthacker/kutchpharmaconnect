-- KutchPharmaConnect controlled identity normalization
-- Scope: only company identities already established and externally corroborated.
-- Do not use this migration for unresolved entities.

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
    verification_note = 'Normalized from raw entry "Glasstone Pharmaceuticals"; corrected to Gladstone Pharma India Pvt. Ltd.'
where company_name = 'Glasstone Pharmaceuticals';

update public.companies
set company_name = 'Roche Products (India) Private Limited',
    verification_note = 'Normalized from "La Roche Ltd."; current Indian legal entity corroborated.'
where company_name = 'La Roche Ltd.';

update public.companies
set company_name = 'West-Coast Pharmaceutical Works Limited',
    verification_note = 'Normalized legal presentation from "West-Coast Pharmaceutical Works Ltd.".'
where company_name = 'West-Coast Pharmaceutical Works Ltd.';
