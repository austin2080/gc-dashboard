-- Admin utility snippets for toggling company modules.
-- Replace <company_uuid> with a real id.

-- Enable WaiverDesk
update public.companies
set enabled_modules = array(
  select distinct unnest(coalesce(enabled_modules, array['bidding']::text[]) || array['waiverdesk']::text[])
)
where id = '<company_uuid>'::uuid;

-- Enable PM
update public.companies
set enabled_modules = array(
  select distinct unnest(coalesce(enabled_modules, array['bidding']::text[]) || array['pm']::text[])
)
where id = '<company_uuid>'::uuid;

-- Disable WaiverDesk
update public.companies
set enabled_modules = array_remove(coalesce(enabled_modules, array['bidding']::text[]), 'waiverdesk')
where id = '<company_uuid>'::uuid;

-- Disable PM
update public.companies
set enabled_modules = array_remove(coalesce(enabled_modules, array['bidding']::text[]), 'pm')
where id = '<company_uuid>'::uuid;
