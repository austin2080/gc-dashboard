-- Bidding tables (isolated from existing schemas)
create extension if not exists pgcrypto;

-- Status enum for trade bids
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bid_trade_status') THEN
    CREATE TYPE bid_trade_status AS ENUM ('submitted', 'bidding', 'declined', 'ghosted', 'invited');
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bid_trade_status') THEN
    ALTER TYPE bid_trade_status ADD VALUE IF NOT EXISTS 'invited';
  END IF;
END$$;

create table if not exists bid_projects (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  owner text,
  location text,
  budget numeric,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists bid_trades (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references bid_projects(id) on delete cascade,
  trade_name text not null,
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, trade_name)
);

create table if not exists bid_subcontractors (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  primary_contact text,
  email text,
  phone text,
  approved_vendor boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists bid_project_subs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references bid_projects(id) on delete cascade,
  subcontractor_id uuid not null references bid_subcontractors(id) on delete cascade,
  sort_order integer,
  invited_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, subcontractor_id)
);

create table if not exists bid_trade_bids (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references bid_projects(id) on delete cascade,
  trade_id uuid not null references bid_trades(id) on delete cascade,
  project_sub_id uuid not null references bid_project_subs(id) on delete cascade,
  status bid_trade_status not null default 'bidding',
  bid_amount numeric,
  contact_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trade_id, project_sub_id)
);

create index if not exists bid_trades_project_id_idx on bid_trades(project_id);
create index if not exists bid_project_subs_project_id_idx on bid_project_subs(project_id);
create index if not exists bid_project_subs_subcontractor_id_idx on bid_project_subs(subcontractor_id);
create index if not exists bid_trade_bids_project_id_idx on bid_trade_bids(project_id);
create index if not exists bid_trade_bids_trade_id_idx on bid_trade_bids(trade_id);
create index if not exists bid_trade_bids_project_sub_id_idx on bid_trade_bids(project_sub_id);

create or replace function set_bid_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists bid_projects_set_updated_at on bid_projects;
create trigger bid_projects_set_updated_at
before update on bid_projects
for each row execute procedure set_bid_updated_at();

drop trigger if exists bid_trades_set_updated_at on bid_trades;
create trigger bid_trades_set_updated_at
before update on bid_trades
for each row execute procedure set_bid_updated_at();

drop trigger if exists bid_subcontractors_set_updated_at on bid_subcontractors;
create trigger bid_subcontractors_set_updated_at
before update on bid_subcontractors
for each row execute procedure set_bid_updated_at();

drop trigger if exists bid_project_subs_set_updated_at on bid_project_subs;
create trigger bid_project_subs_set_updated_at
before update on bid_project_subs
for each row execute procedure set_bid_updated_at();

drop trigger if exists bid_trade_bids_set_updated_at on bid_trade_bids;
create trigger bid_trade_bids_set_updated_at
before update on bid_trade_bids
for each row execute procedure set_bid_updated_at();

alter table bid_projects enable row level security;
alter table bid_trades enable row level security;
alter table bid_subcontractors enable row level security;
alter table bid_project_subs enable row level security;
alter table bid_trade_bids enable row level security;

-- Basic policies (adjust to your project-level access model)
drop policy if exists "bid_projects_select" on bid_projects;
drop policy if exists "bid_projects_insert" on bid_projects;
drop policy if exists "bid_projects_update" on bid_projects;

create policy "bid_projects_select" on bid_projects
  for select to authenticated using (true);
create policy "bid_projects_insert" on bid_projects
  for insert to authenticated with check (true);
create policy "bid_projects_update" on bid_projects
  for update to authenticated using (true);

drop policy if exists "bid_trades_select" on bid_trades;
drop policy if exists "bid_trades_insert" on bid_trades;
drop policy if exists "bid_trades_update" on bid_trades;

create policy "bid_trades_select" on bid_trades
  for select to authenticated using (true);
create policy "bid_trades_insert" on bid_trades
  for insert to authenticated with check (true);
create policy "bid_trades_update" on bid_trades
  for update to authenticated using (true);

drop policy if exists "bid_subcontractors_select" on bid_subcontractors;
drop policy if exists "bid_subcontractors_insert" on bid_subcontractors;
drop policy if exists "bid_subcontractors_update" on bid_subcontractors;

create policy "bid_subcontractors_select" on bid_subcontractors
  for select to authenticated using (true);
create policy "bid_subcontractors_insert" on bid_subcontractors
  for insert to authenticated with check (true);
create policy "bid_subcontractors_update" on bid_subcontractors
  for update to authenticated using (true);

drop policy if exists "bid_project_subs_select" on bid_project_subs;
drop policy if exists "bid_project_subs_insert" on bid_project_subs;
drop policy if exists "bid_project_subs_update" on bid_project_subs;

create policy "bid_project_subs_select" on bid_project_subs
  for select to authenticated using (true);
create policy "bid_project_subs_insert" on bid_project_subs
  for insert to authenticated with check (true);
create policy "bid_project_subs_update" on bid_project_subs
  for update to authenticated using (true);

drop policy if exists "bid_trade_bids_select" on bid_trade_bids;
drop policy if exists "bid_trade_bids_insert" on bid_trade_bids;
drop policy if exists "bid_trade_bids_update" on bid_trade_bids;

create policy "bid_trade_bids_select" on bid_trade_bids
  for select to authenticated using (true);
create policy "bid_trade_bids_insert" on bid_trade_bids
  for insert to authenticated with check (true);
create policy "bid_trade_bids_update" on bid_trade_bids
  for update to authenticated using (true);

-- Owner bid opportunities
create table if not exists bid_owner_bids (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client text not null,
  project_type text not null,
  address text,
  square_feet integer,
  due_date date,
  bid_type text not null,
  status text not null check (status in ('Draft', 'Submitted', 'Awarded', 'Lost')),
  assigned_to text,
  probability numeric not null default 50,
  est_cost numeric,
  ohp_amount numeric,
  markup_pct numeric,
  bid_amount numeric,
  expected_profit numeric,
  margin_pct numeric,
  lost_reason text,
  lost_notes text,
  convert_to_project boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists bid_owner_bids_status_idx on bid_owner_bids(status);
create index if not exists bid_owner_bids_due_date_idx on bid_owner_bids(due_date);
create index if not exists bid_owner_bids_updated_at_idx on bid_owner_bids(updated_at desc);

drop trigger if exists bid_owner_bids_set_updated_at on bid_owner_bids;
create trigger bid_owner_bids_set_updated_at
before update on bid_owner_bids
for each row execute procedure set_bid_updated_at();

alter table bid_owner_bids enable row level security;

drop policy if exists "bid_owner_bids_select" on bid_owner_bids;
drop policy if exists "bid_owner_bids_insert" on bid_owner_bids;
drop policy if exists "bid_owner_bids_update" on bid_owner_bids;

create policy "bid_owner_bids_select" on bid_owner_bids
  for select to authenticated using (true);
create policy "bid_owner_bids_insert" on bid_owner_bids
  for insert to authenticated with check (true);
create policy "bid_owner_bids_update" on bid_owner_bids
  for update to authenticated using (true);
