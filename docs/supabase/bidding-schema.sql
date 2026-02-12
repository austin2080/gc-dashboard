-- Bidding tables (isolated from existing schemas)
create extension if not exists pgcrypto;

-- Status enum for trade bids
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bid_trade_status') THEN
    CREATE TYPE bid_trade_status AS ENUM ('submitted', 'bidding', 'declined', 'ghosted');
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
create policy "bid_projects_select" on bid_projects
  for select to authenticated using (true);
create policy "bid_projects_insert" on bid_projects
  for insert to authenticated with check (true);
create policy "bid_projects_update" on bid_projects
  for update to authenticated using (true);

create policy "bid_trades_select" on bid_trades
  for select to authenticated using (true);
create policy "bid_trades_insert" on bid_trades
  for insert to authenticated with check (true);
create policy "bid_trades_update" on bid_trades
  for update to authenticated using (true);

create policy "bid_subcontractors_select" on bid_subcontractors
  for select to authenticated using (true);
create policy "bid_subcontractors_insert" on bid_subcontractors
  for insert to authenticated with check (true);
create policy "bid_subcontractors_update" on bid_subcontractors
  for update to authenticated using (true);

create policy "bid_project_subs_select" on bid_project_subs
  for select to authenticated using (true);
create policy "bid_project_subs_insert" on bid_project_subs
  for insert to authenticated with check (true);
create policy "bid_project_subs_update" on bid_project_subs
  for update to authenticated using (true);

create policy "bid_trade_bids_select" on bid_trade_bids
  for select to authenticated using (true);
create policy "bid_trade_bids_insert" on bid_trade_bids
  for insert to authenticated with check (true);
create policy "bid_trade_bids_update" on bid_trade_bids
  for update to authenticated using (true);
