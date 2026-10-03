-- Harden helper functions against search_path manipulation.
alter function public.set_updated_at() set search_path=public;
alter function public.validate_distributorship_division() set search_path=public;
alter function public.normalize_directory_text(text) set search_path=public;