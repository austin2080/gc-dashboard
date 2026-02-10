-- Procurement tables
create extension if not exists pgcrypto;

create table if not exists procurement_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  item_name text not null,
  vendor_name text not null,
  status text not null,
  approved_date date,
  ordered_date date,
  lead_time_days integer,
  need_by_date date,
  expected_delivery_date date,
  actual_delivery_date date,
  po_number text,
  notes text,
  received_by text,
  received_date date,
  qc_status text,
  qc_match_submittals boolean,
  qc_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists procurement_notes (
  id uuid primary key default gen_random_uuid(),
  procurement_item_id uuid not null references procurement_items(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists procurement_qc_notes (
  id uuid primary key default gen_random_uuid(),
  procurement_item_id uuid not null references procurement_items(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists procurement_items_project_id_idx on procurement_items(project_id);
create index if not exists procurement_notes_item_id_idx on procurement_notes(procurement_item_id, created_at desc);
create index if not exists procurement_qc_notes_item_id_idx on procurement_qc_notes(procurement_item_id, created_at desc);

create or replace function set_procurement_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists procurement_items_set_updated_at on procurement_items;
create trigger procurement_items_set_updated_at
before update on procurement_items
for each row execute procedure set_procurement_updated_at();

alter table procurement_items enable row level security;
alter table procurement_notes enable row level security;
alter table procurement_qc_notes enable row level security;

-- Basic policies (adjust to your project-level access model)
create policy "procurement_items_select" on procurement_items
  for select to authenticated using (true);
create policy "procurement_items_insert" on procurement_items
  for insert to authenticated with check (true);
create policy "procurement_items_update" on procurement_items
  for update to authenticated using (true);

create policy "procurement_notes_select" on procurement_notes
  for select to authenticated using (true);
create policy "procurement_notes_insert" on procurement_notes
  for insert to authenticated with check (true);
create policy "procurement_notes_delete" on procurement_notes
  for delete to authenticated using (true);

create policy "procurement_qc_notes_select" on procurement_qc_notes
  for select to authenticated using (true);
create policy "procurement_qc_notes_insert" on procurement_qc_notes
  for insert to authenticated with check (true);
create policy "procurement_qc_notes_delete" on procurement_qc_notes
  for delete to authenticated using (true);
