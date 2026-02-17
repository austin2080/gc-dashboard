-- Add first/last name fields to profiles and backfill existing users.
-- Safe to run multiple times.

alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name text;

with source as (
  select
    coalesce(
      nullif(to_jsonb(p) ->> 'id', '')::uuid,
      nullif(to_jsonb(p) ->> 'user_id', '')::uuid
    ) as profile_user_id,
    nullif(trim(p.first_name), '') as existing_first,
    nullif(trim(p.last_name), '') as existing_last,
    nullif(trim(p.full_name), '') as existing_full,
    nullif(trim(u.raw_user_meta_data ->> 'first_name'), '') as meta_first_name,
    nullif(trim(u.raw_user_meta_data ->> 'given_name'), '') as meta_given_name,
    nullif(trim(u.raw_user_meta_data ->> 'last_name'), '') as meta_last_name,
    nullif(trim(u.raw_user_meta_data ->> 'family_name'), '') as meta_family_name,
    nullif(trim(u.raw_user_meta_data ->> 'name'), '') as meta_name,
    nullif(trim(u.email), '') as email
  from profiles p
  left join auth.users u
    on u.id = coalesce(
      nullif(to_jsonb(p) ->> 'id', '')::uuid,
      nullif(to_jsonb(p) ->> 'user_id', '')::uuid
    )
),
normalized as (
  select
    profile_user_id,
    existing_first,
    existing_last,
    existing_full,
    coalesce(meta_first_name, meta_given_name) as meta_first,
    coalesce(meta_last_name, meta_family_name) as meta_last,
    meta_name,
    email,
    split_part(coalesce(email, ''), '@', 1) as email_local
  from source
),
derived as (
  select
    profile_user_id,
    existing_first,
    existing_last,
    existing_full,
    meta_first,
    meta_last,
    nullif(split_part(meta_name, ' ', 1), '') as meta_name_first,
    nullif(
      regexp_replace(meta_name, '^[^ ]+\s*', ''),
      ''
    ) as meta_name_last,
    nullif(split_part(existing_full, ' ', 1), '') as full_name_first,
    nullif(
      regexp_replace(existing_full, '^[^ ]+\s*', ''),
      ''
    ) as full_name_last,
    nullif(
      initcap(
        split_part(
          regexp_replace(email_local, '[^a-zA-Z0-9]+', ' ', 'g'),
          ' ',
          1
        )
      ),
      ''
    ) as email_first,
    nullif(
      initcap(
        regexp_replace(
          regexp_replace(email_local, '[^a-zA-Z0-9]+', ' ', 'g'),
          '^[^ ]+\s*',
          ''
        )
      ),
      ''
    ) as email_last
  from normalized
),
resolved as (
  select
    profile_user_id,
    coalesce(
      existing_first,
      meta_first,
      meta_name_first,
      case when existing_full !~* '@' then full_name_first end,
      email_first,
      'Member'
    ) as next_first_name,
    coalesce(
      existing_last,
      meta_last,
      meta_name_last,
      case when existing_full !~* '@' then full_name_last end,
      email_last
    ) as next_last_name
  from derived
)
update profiles p
set
  first_name = r.next_first_name,
  last_name = r.next_last_name,
  full_name = trim(concat_ws(' ', r.next_first_name, r.next_last_name))
from resolved r
where coalesce(
    nullif(to_jsonb(p) ->> 'id', '')::uuid,
    nullif(to_jsonb(p) ->> 'user_id', '')::uuid
  ) = r.profile_user_id
  and (
    coalesce(p.first_name, '') is distinct from coalesce(r.next_first_name, '')
    or coalesce(p.last_name, '') is distinct from coalesce(r.next_last_name, '')
    or coalesce(p.full_name, '') is distinct from trim(concat_ws(' ', r.next_first_name, r.next_last_name))
  );
