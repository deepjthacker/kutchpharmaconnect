-- KutchPharmaConnect controlled company identity normalization - batch 3

update public.companies
set company_name = 'Wings Pharmaceuticals Private Limited',
    verification_note = 'Normalized from "Wings Pharma / Wings Pharmaceuticals Pvt. Ltd."; current Indian legal entity corroborated by Intellectual Property India records.'
where company_name in ('Wings Pharma', 'Wings Pharmaceuticals Pvt. Ltd.');

update public.companies
set company_name = 'German Remedies Pharmaceuticals Private Limited',
    verification_note = 'Normalized from "German Remedies". Current legal entity is German Remedies Pharmaceuticals Private Limited; Zydus identifies German Remedies as part of the Zydus Healthcare business, so group/business identity is not treated as the legal entity.'
where company_name = 'German Remedies';
