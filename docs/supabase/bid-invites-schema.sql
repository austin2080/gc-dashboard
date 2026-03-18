create extension if not exists pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mailbox_connection_status') THEN
    CREATE TYPE mailbox_connection_status AS ENUM ('active', 'inactive', 'error');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bid_invite_status') THEN
    CREATE TYPE bid_invite_status AS ENUM (
      'draft',
      'queued',
      'sent',
      'opened',
      'portal_viewed',
      'reminder_sent',
      'submitted',
      'declined',
      'failed'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bid_invite_event_type') THEN
    CREATE TYPE bid_invite_event_type AS ENUM (
      'created',
      'send_requested',
      'sent',
      'failed',
      'opened',
      'portal_viewed',
      'reminder_sent',
      'submitted',
      'declined'
    );
  END IF;
END$$;

create table if not exists mailbox_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  email_address text not null,
  display_name text,
  tenant_id uuid references companies(id) on delete cascade,
  refresh_token_encrypted text,
  access_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}'::text[],
  status mailbox_connection_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, tenant_id)
);

create table if not exists bid_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  bid_package_id uuid not null references bid_projects(id) on delete cascade,
  subcontractor_id uuid references bid_subcontractors(id) on delete set null,
  contact_name text not null,
  company_name text not null,
  email text not null,
  trade_name text,
  invite_token text not null unique,
  status bid_invite_status not null default 'draft',
  subject text not null,
  body_snapshot text not null,
  mailbox_connection_id uuid not null references mailbox_connections(id) on delete restrict,
  provider_message_id text,
  sent_at timestamptz,
  opened_at timestamptz,
  last_viewed_at timestamptz,
  submitted_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bid_invite_events (
  id uuid primary key default gen_random_uuid(),
  bid_invite_id uuid not null references bid_invites(id) on delete cascade,
  event_type bid_invite_event_type not null,
  event_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists mailbox_connections_user_provider_idx
  on mailbox_connections(user_id, provider);

create index if not exists mailbox_connections_tenant_provider_idx
  on mailbox_connections(tenant_id, provider);

create index if not exists bid_invites_project_status_idx
  on bid_invites(project_id, status);

create index if not exists bid_invites_bid_package_status_idx
  on bid_invites(bid_package_id, status);

create index if not exists bid_invites_email_idx
  on bid_invites(email);

create index if not exists bid_invites_mailbox_connection_idx
  on bid_invites(mailbox_connection_id);

create index if not exists bid_invite_events_invite_event_at_idx
  on bid_invite_events(bid_invite_id, event_at desc);

create or replace function set_mailbox_connections_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function set_bid_invites_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists mailbox_connections_set_updated_at on mailbox_connections;
create trigger mailbox_connections_set_updated_at
before update on mailbox_connections
for each row execute procedure set_mailbox_connections_updated_at();

drop trigger if exists bid_invites_set_updated_at on bid_invites;
create trigger bid_invites_set_updated_at
before update on bid_invites
for each row execute procedure set_bid_invites_updated_at();

alter table mailbox_connections enable row level security;
alter table bid_invites enable row level security;
alter table bid_invite_events enable row level security;

create policy "mailbox_connections_select_own" on mailbox_connections
  for select to authenticated
  using (auth.uid() = user_id);

create policy "mailbox_connections_insert_own" on mailbox_connections
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "mailbox_connections_update_own" on mailbox_connections
  for update to authenticated
  using (auth.uid() = user_id);

create policy "bid_invites_select_company_member" on bid_invites
  for select to authenticated
  using (
    exists (
      select 1
      from mailbox_connections mc
      where mc.id = bid_invites.mailbox_connection_id
        and mc.user_id = auth.uid()
    )
    or created_by = auth.uid()
  );

create policy "bid_invites_insert_creator" on bid_invites
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "bid_invites_update_creator" on bid_invites
  for update to authenticated
  using (created_by = auth.uid());

create policy "bid_invite_events_select_related" on bid_invite_events
  for select to authenticated
  using (
    exists (
      select 1
      from bid_invites bi
      where bi.id = bid_invite_events.bid_invite_id
        and (
          bi.created_by = auth.uid()
          or exists (
            select 1
            from mailbox_connections mc
            where mc.id = bi.mailbox_connection_id
              and mc.user_id = auth.uid()
          )
        )
    )
  );

create policy "bid_invite_events_insert_related" on bid_invite_events
  for insert to authenticated
  with check (
    exists (
      select 1
      from bid_invites bi
      where bi.id = bid_invite_events.bid_invite_id
        and bi.created_by = auth.uid()
    )
  );
