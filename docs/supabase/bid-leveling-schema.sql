-- Bid leveling extensions for BuilderOS / WaiverDesk bidding.
-- Run this after docs/supabase/bidding-schema.sql.

create extension if not exists pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leveling_bid_status') THEN
    CREATE TYPE leveling_bid_status AS ENUM ('invited', 'bidding', 'submitted', 'declined', 'no_response');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trade_bid_line_item_type') THEN
    CREATE TYPE trade_bid_line_item_type AS ENUM ('allowance', 'alternate', 'unit_price', 'clarifications');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trade_scope_state') THEN
    CREATE TYPE trade_scope_state AS ENUM ('included', 'excluded', 'unclear');
  END IF;
END$$;

create table if not exists project_trade_budget (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references bid_projects(id) on delete cascade,
  trade_id uuid not null references bid_trades(id) on delete cascade,
  budget_amount numeric,
  budget_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, trade_id)
);

create table if not exists trade_bid (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references bid_projects(id) on delete cascade,
  trade_id uuid not null references bid_trades(id) on delete cascade,
  sub_id uuid not null references bid_project_subs(id) on delete cascade,
  status leveling_bid_status not null default 'invited',
  base_bid_amount numeric,
  received_at timestamptz,
  is_low boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, trade_id, sub_id)
);

create table if not exists trade_bid_line_items (
  id uuid primary key default gen_random_uuid(),
  trade_bid_id uuid not null references trade_bid(id) on delete cascade,
  type trade_bid_line_item_type not null,
  label text not null,
  amount numeric,
  included boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Normalized bid build-up for Leveling Drawer (base items + alternates).
create table if not exists trade_bid_items (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references trade_bid(id) on delete cascade,
  kind text not null check (kind in ('base', 'alternate_item')),
  description text not null default '',
  qty numeric,
  unit text not null default 'EA',
  unit_price numeric,
  amount_override numeric,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists trade_bid_alternates (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references trade_bid(id) on delete cascade,
  title text not null default '',
  accepted boolean not null default false,
  amount numeric not null default 0,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists trade_scope_checklist (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  trade_id uuid not null references bid_trades(id) on delete cascade,
  scope_item text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists trade_bid_scope (
  id uuid primary key default gen_random_uuid(),
  trade_bid_id uuid not null references trade_bid(id) on delete cascade,
  scope_item_id uuid not null references trade_scope_checklist(id) on delete cascade,
  included trade_scope_state not null default 'unclear',
  notes text,
  unique (trade_bid_id, scope_item_id)
);

create table if not exists leveling_snapshot (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references bid_projects(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  title text not null,
  locked boolean not null default true
);

create table if not exists leveling_snapshot_items (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references leveling_snapshot(id) on delete cascade,
  trade_id uuid not null references bid_trades(id) on delete cascade,
  sub_id uuid not null references bid_project_subs(id) on delete cascade,
  base_bid_amount numeric,
  notes text,
  included_json jsonb,
  line_items_json jsonb
);

create index if not exists project_trade_budget_project_trade_idx on project_trade_budget(project_id, trade_id);
create index if not exists trade_bid_project_trade_idx on trade_bid(project_id, trade_id);
create index if not exists trade_bid_sub_idx on trade_bid(sub_id);
create index if not exists trade_bid_items_bid_id_idx on trade_bid_items(bid_id, sort_order);
create index if not exists trade_bid_alternates_bid_id_idx on trade_bid_alternates(bid_id, sort_order);
create index if not exists leveling_snapshot_project_idx on leveling_snapshot(project_id, created_at desc);
create index if not exists leveling_snapshot_items_snapshot_idx on leveling_snapshot_items(snapshot_id);

-- Apply the existing set_bid_updated_at trigger function if present.
drop trigger if exists project_trade_budget_set_updated_at on project_trade_budget;
create trigger project_trade_budget_set_updated_at
before update on project_trade_budget
for each row execute procedure set_bid_updated_at();

drop trigger if exists trade_bid_set_updated_at on trade_bid;
create trigger trade_bid_set_updated_at
before update on trade_bid
for each row execute procedure set_bid_updated_at();

drop trigger if exists trade_bid_line_items_set_updated_at on trade_bid_line_items;
create trigger trade_bid_line_items_set_updated_at
before update on trade_bid_line_items
for each row execute procedure set_bid_updated_at();

drop trigger if exists trade_bid_items_set_updated_at on trade_bid_items;
create trigger trade_bid_items_set_updated_at
before update on trade_bid_items
for each row execute procedure set_bid_updated_at();

drop trigger if exists trade_bid_alternates_set_updated_at on trade_bid_alternates;
create trigger trade_bid_alternates_set_updated_at
before update on trade_bid_alternates
for each row execute procedure set_bid_updated_at();

drop trigger if exists trade_scope_checklist_set_updated_at on trade_scope_checklist;
create trigger trade_scope_checklist_set_updated_at
before update on trade_scope_checklist
for each row execute procedure set_bid_updated_at();

alter table project_trade_budget enable row level security;
alter table trade_bid enable row level security;
alter table trade_bid_line_items enable row level security;
alter table trade_bid_items enable row level security;
alter table trade_bid_alternates enable row level security;
alter table trade_scope_checklist enable row level security;
alter table trade_bid_scope enable row level security;
alter table leveling_snapshot enable row level security;
alter table leveling_snapshot_items enable row level security;

create policy "project_trade_budget_select" on project_trade_budget for select to authenticated using (true);
create policy "project_trade_budget_insert" on project_trade_budget for insert to authenticated with check (true);
create policy "project_trade_budget_update" on project_trade_budget for update to authenticated using (true);

create policy "trade_bid_select" on trade_bid for select to authenticated using (true);
create policy "trade_bid_insert" on trade_bid for insert to authenticated with check (true);
create policy "trade_bid_update" on trade_bid for update to authenticated using (true);

create policy "trade_bid_line_items_select" on trade_bid_line_items for select to authenticated using (true);
create policy "trade_bid_line_items_insert" on trade_bid_line_items for insert to authenticated with check (true);
create policy "trade_bid_line_items_update" on trade_bid_line_items for update to authenticated using (true);

create policy "trade_bid_items_select" on trade_bid_items for select to authenticated using (true);
create policy "trade_bid_items_insert" on trade_bid_items for insert to authenticated with check (true);
create policy "trade_bid_items_update" on trade_bid_items for update to authenticated using (true);

create policy "trade_bid_alternates_select" on trade_bid_alternates for select to authenticated using (true);
create policy "trade_bid_alternates_insert" on trade_bid_alternates for insert to authenticated with check (true);
create policy "trade_bid_alternates_update" on trade_bid_alternates for update to authenticated using (true);

create policy "trade_scope_checklist_select" on trade_scope_checklist for select to authenticated using (true);
create policy "trade_scope_checklist_insert" on trade_scope_checklist for insert to authenticated with check (true);
create policy "trade_scope_checklist_update" on trade_scope_checklist for update to authenticated using (true);

create policy "trade_bid_scope_select" on trade_bid_scope for select to authenticated using (true);
create policy "trade_bid_scope_insert" on trade_bid_scope for insert to authenticated with check (true);
create policy "trade_bid_scope_update" on trade_bid_scope for update to authenticated using (true);

create policy "leveling_snapshot_select" on leveling_snapshot for select to authenticated using (true);
create policy "leveling_snapshot_insert" on leveling_snapshot for insert to authenticated with check (true);
create policy "leveling_snapshot_update" on leveling_snapshot for update to authenticated using (true);

create policy "leveling_snapshot_items_select" on leveling_snapshot_items for select to authenticated using (true);
create policy "leveling_snapshot_items_insert" on leveling_snapshot_items for insert to authenticated with check (true);
create policy "leveling_snapshot_items_update" on leveling_snapshot_items for update to authenticated using (true);
