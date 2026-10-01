-- KutchPharmaConnect controlled company identity normalization - batch 2
-- Parent/group names remain separate from the Indian legal entity name.

update public.companies
set company_name = 'Tripada Lifecare Private Limited',
    verification_note = 'Normalized from "Tripada Lifecare Pvt. Ltd."; active Indian private company, CIN U24233GJ2012PTC069375.'
where company_name = 'Tripada Lifecare Pvt. Ltd.';

update public.companies
set company_name = 'Trion Pharma India LLP',
    verification_note = 'Normalized from "Trion"; active LLP, LLPIN AAK-8439, incorporated in Ahmedabad in 2017.'
where company_name = 'Trion';

update public.companies
set company_name = 'Amneal Healthcare Private Limited',
    verification_note = 'Normalized from "Amneal Pharmaceuticals / Amneal Healthcare Private Limited"; current Indian legal entity is Amneal Healthcare Private Limited, CIN U24239GJ2021PTC123168.'
where company_name = 'Amneal Pharmaceuticals';

update public.companies
set company_name = 'Nutricia International Private Limited',
    short_name = 'Danone',
    verification_note = 'Normalized from "Nutricia International Pvt. Ltd. / Danone". Nutricia International Private Limited is the Indian legal entity; Danone is the parent/group identity.'
where company_name = 'Nutricia International Pvt. Ltd. / Danone';
