-- Adds contact fields for Subs Directory company records.
ALTER TABLE public.directory_companies
  ADD COLUMN IF NOT EXISTS contact_title text,
  ADD COLUMN IF NOT EXISTS office_phone text;

