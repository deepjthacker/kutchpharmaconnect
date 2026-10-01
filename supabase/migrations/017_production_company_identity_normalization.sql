-- KutchPharmaConnect: production-safe company identity normalization
-- Uses only columns confirmed in the live production schema.
-- Does not alter company IDs or distributorship foreign keys.
-- Safe to run once in Supabase SQL Editor.

BEGIN;

-- 1. Normalize only the exact production records confirmed from the live database.
UPDATE public.companies
SET company_name = '3 Cube Bio-Med Services Private Limited'
WHERE id = 'a99a10d7-cbaf-4339-91e6-5877bad61674'
  AND company_name = '3 Cube';

UPDATE public.companies
SET company_name = 'Blue Cross Laboratories Private Limited'
WHERE id = '30668e12-6136-406a-bcb1-30335774b754'
  AND company_name = 'Blue Cross Laboratories Ltd.';

UPDATE public.companies
SET company_name = 'Zydus Lifesciences Limited'
WHERE id = '4299e156-318f-4729-bdb6-34094e523015'
  AND company_name = 'Cadila Healthcare Limited';

UPDATE public.companies
SET company_name = 'German Remedies Pharmaceuticals Private Limited'
WHERE id = '8426801d-ea62-4299-8e40-49e988ff76e8'
  AND company_name = 'German Remedies';

UPDATE public.companies
SET company_name = 'Gladstone Pharma India Private Limited'
WHERE id = '7216897d-bfb0-4fbb-b6f0-c16a088fac9b'
  AND company_name = 'Glasstone Pharmaceuticals';

UPDATE public.companies
SET company_name = 'Healvia Drugs Private Limited'
WHERE id = '77663c13-973e-4780-87c4-59f22fa8d88e'
  AND company_name = 'Healvia';

UPDATE public.companies
SET company_name = 'Roche Products (India) Private Limited'
WHERE id = 'f2e34522-bdb0-4eba-936a-1a5f67632a8d'
  AND company_name = 'La Roche Ltd.';

UPDATE public.companies
SET company_name = 'Nutricia International Private Limited',
    short_name = 'Danone'
WHERE id = 'f300e61e-4d46-42aa-b85a-0c662a6b188f'
  AND company_name = 'Nutricia International Pvt. Ltd. / Danone';

UPDATE public.companies
SET company_name = 'Trion Pharma India LLP'
WHERE id = '6b52675b-8a8c-462f-872c-80c1deb94e0c'
  AND company_name = 'Trion';

UPDATE public.companies
SET company_name = 'Tripada Lifecare Private Limited'
WHERE id = '5af0579a-ba1a-43a6-934b-a212af0a851b'
  AND company_name = 'Tripada Lifecare Pvt. Ltd.';

UPDATE public.companies
SET company_name = 'West-Coast Pharmaceutical Works Limited'
WHERE id = '3555e673-2895-44d3-b51b-3a41be5c2462'
  AND company_name = 'West-Coast Pharmaceutical Works Ltd.';

-- 2. Preserve the old/raw names as searchable aliases.
-- Live schema uses alias + normalized_alias (not alias_name/alias_type).

INSERT INTO public.search_aliases (entity_type, entity_id, alias, normalized_alias)
SELECT 'company', v.company_id, v.alias, lower(trim(v.alias))
FROM (
    VALUES
      ('a99a10d7-cbaf-4339-91e6-5877bad61674'::uuid, '3 Cube'),
      ('30668e12-6136-406a-bcb1-30335774b754'::uuid, 'Blue Cross Laboratories Ltd.'),
      ('4299e156-318f-4729-bdb6-34094e523015'::uuid, 'Cadila Healthcare Limited'),
      ('4299e156-318f-4729-bdb6-34094e523015'::uuid, 'Cadila Healthcare'),
      ('8426801d-ea62-4299-8e40-49e988ff76e8'::uuid, 'German Remedies'),
      ('7216897d-bfb0-4fbb-b6f0-c16a088fac9b'::uuid, 'Glasstone Pharmaceuticals'),
      ('77663c13-973e-4780-87c4-59f22fa8d88e'::uuid, 'Healvia'),
      ('f2e34522-bdb0-4eba-936a-1a5f67632a8d'::uuid, 'La Roche Ltd.'),
      ('f300e61e-4d46-42aa-b85a-0c662a6b188f'::uuid, 'Nutricia International Pvt. Ltd. / Danone'),
      ('f300e61e-4d46-42aa-b85a-0c662a6b188f'::uuid, 'Nutricia International'),
      ('f300e61e-4d46-42aa-b85a-0c662a6b188f'::uuid, 'Danone'),
      ('6b52675b-8a8c-462f-872c-80c1deb94e0c'::uuid, 'Trion'),
      ('5af0579a-ba1a-43a6-934b-a212af0a851b'::uuid, 'Tripada Lifecare Pvt. Ltd.'),
      ('3555e673-2895-44d3-b51b-3a41be5c2462'::uuid, 'West-Coast Pharmaceutical Works Ltd.')
) AS v(company_id, alias)
WHERE NOT EXISTS (
    SELECT 1
    FROM public.search_aliases a
    WHERE a.entity_type = 'company'
      AND a.entity_id = v.company_id
      AND lower(trim(a.alias)) = lower(trim(v.alias))
);

COMMIT;

-- Intentionally not changed here:
-- Amneal Pharmaceuticals, Wings Pharma/Wings Pharmaceuticals, Alteus,
-- Johnson & Johnson, US Healthcare, Briony Lifesciences, Sanzyme entities,
-- Abbott entities, Pfizer entities, Zydus Healthcare, and other ambiguous
-- records require separate live-record confirmation before normalization.
