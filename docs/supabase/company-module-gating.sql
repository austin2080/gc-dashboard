-- Company-level module gating for Bidding-first product.
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'bidding_core',
  enabled_modules text[] not null default array['bidding']::text[],
  created_at timestamptz not null default now()
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  is_active boolean not null default true,
  can_view_all_projects boolean not null default false,
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

alter table public.companies add column if not exists plan text;
alter table public.companies add column if not exists enabled_modules text[];
alter table public.companies add column if not exists created_at timestamptz not null default now();

update public.companies
set plan = 'bidding_core'
where plan is null;

update public.companies
set enabled_modules = array['bidding']::text[]
where enabled_modules is null or array_length(enabled_modules, 1) is null;

update public.companies
set enabled_modules = array_prepend('bidding', enabled_modules)
where enabled_modules is not null
  and not ('bidding' = any(enabled_modules));

alter table public.companies
  alter column plan set default 'bidding_core',
  alter column enabled_modules set default array['bidding']::text[],
  alter column enabled_modules set not null;

create index if not exists companies_plan_idx on public.companies(plan);
create index if not exists companies_enabled_modules_gin_idx on public.companies using gin(enabled_modules);
create index if not exists company_members_user_id_idx on public.company_members(user_id);
create index if not exists company_members_company_id_idx on public.company_members(company_id);
create unique index if not exists company_members_company_user_uidx on public.company_members(company_id, user_id);

alter table public.companies enable row level security;
alter table public.company_members enable row level security;

drop policy if exists "companies_select_member" on public.companies;
create policy "companies_select_member"
on public.companies
for select
to authenticated
using (
  exists (
    select 1
    from public.company_members cm
    where cm.company_id = companies.id
      and cm.user_id = auth.uid()
      and cm.is_active = true
  )
);

drop policy if exists "companies_update_admin_member" on public.companies;
create policy "companies_update_admin_member"
on public.companies
for update
to authenticated
using (
  exists (
    select 1
    from public.company_members cm
    where cm.company_id = companies.id
      and cm.user_id = auth.uid()
      and cm.is_active = true
      and cm.can_view_all_projects = true
  )
)
with check (
  exists (
    select 1
    from public.company_members cm
    where cm.company_id = companies.id
      and cm.user_id = auth.uid()
      and cm.is_active = true
      and cm.can_view_all_projects = true
  )
);

drop policy if exists "company_members_select_same_company" on public.company_members;
create policy "company_members_select_same_company"
on public.company_members
for select
to authenticated
using (
  exists (
    select 1
    from public.company_members me
    where me.company_id = company_members.company_id
      and me.user_id = auth.uid()
      and me.is_active = true
  )
);
