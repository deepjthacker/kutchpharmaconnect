-- V1: allow a brand to belong directly to a company or to a specific division.
-- Division remains owned by the same company as the brand.

ALTER TABLE public.divisions
  ADD CONSTRAINT divisions_id_company_unique UNIQUE (id, company_id);

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS division_id uuid;

ALTER TABLE public.brands
  ADD CONSTRAINT brands_division_company_fkey
  FOREIGN KEY (division_id, company_id)
  REFERENCES public.divisions(id, company_id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_brands_division_id
  ON public.brands(division_id);
