-- KutchPharmaConnect controlled company identity normalization - batch 4
-- These are identity normalizations only; the underlying distributorships remain at their existing verification status.

update public.companies
set company_name = 'Healvia Drugs Private Limited',
    verification_note = 'Normalized from raw distributor entry "Healvia". Active Indian company corroborated; CIN U46497DL2025PTC447098, incorporated 24 Apr 2025.'
where company_name = 'Healvia';

update public.companies
set company_name = 'Alteus Biogenics Private Limited',
    verification_note = 'Normalized from raw entry "Alteus Biegenics Pvt. Ltd."; exact company identity corroborated as Alteus Biogenics Private Limited, CIN U24100WB2008PTC125979.'
where company_name = 'Alteus Biegenics Pvt. Ltd.';
