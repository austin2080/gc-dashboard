-- RLS fixes for Supabase linter 0013_rls_disabled_in_public.
-- Applies to public tables exposed through PostgREST.

create extension if not exists pgcrypto;

create or replace function app_is_company_member(p_user_id uuid, p_company_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.user_id = p_user_id
      and cm.company_id = p_company_id
      and cm.is_active = true
  );
$$;

create or replace function app_is_manager_or_admin(p_user_id uuid, p_company_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.user_id = p_user_id
      and cm.company_id = p_company_id
      and cm.is_active = true
      and lower(coalesce(cm.role, '')) in ('manager', 'admin', 'owner')
  );
$$;

create or replace function app_user_can_access_project(
  p_user_id uuid,
  p_company_id uuid,
  p_project_id uuid
)
returns boolean
language sql
stable
as $$
  with member as (
    select cm.can_view_all_projects
    from public.company_members cm
    where cm.user_id = p_user_id
      and cm.company_id = p_company_id
      and cm.is_active = true
    limit 1
  )
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.company_id = p_company_id
      and (
        p.created_by = p_user_id
        or coalesce((select m.can_view_all_projects from member m), false) = true
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = p_project_id
            and pm.user_id = p_user_id
        )
      )
  );
$$;

alter table public.cost_codes enable row level security;
alter table public.budget_transfers enable row level security;
alter table public.prime_contracts enable row level security;
alter table public.pay_apps enable row level security;
alter table public.tasks enable row level security;
alter table public.task_activity enable row level security;

drop policy if exists cost_codes_select_company_member on public.cost_codes;
create policy cost_codes_select_company_member on public.cost_codes
for select to authenticated
using (app_is_company_member(auth.uid(), company_id));

drop policy if exists cost_codes_insert_company_member on public.cost_codes;
create policy cost_codes_insert_company_member on public.cost_codes
for insert to authenticated
with check (app_is_company_member(auth.uid(), company_id));

drop policy if exists cost_codes_update_company_member on public.cost_codes;
create policy cost_codes_update_company_member on public.cost_codes
for update to authenticated
using (app_is_company_member(auth.uid(), company_id))
with check (app_is_company_member(auth.uid(), company_id));

drop policy if exists cost_codes_delete_manager_only on public.cost_codes;
create policy cost_codes_delete_manager_only on public.cost_codes
for delete to authenticated
using (app_is_manager_or_admin(auth.uid(), company_id));

drop policy if exists budget_transfers_select_project_member on public.budget_transfers;
create policy budget_transfers_select_project_member on public.budget_transfers
for select to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = budget_transfers.project_id
      and app_user_can_access_project(auth.uid(), p.company_id, p.id)
  )
);

drop policy if exists budget_transfers_insert_project_member on public.budget_transfers;
create policy budget_transfers_insert_project_member on public.budget_transfers
for insert to authenticated
with check (
  exists (
    select 1
    from public.projects p
    where p.id = budget_transfers.project_id
      and app_user_can_access_project(auth.uid(), p.company_id, p.id)
  )
);

drop policy if exists budget_transfers_update_project_member on public.budget_transfers;
create policy budget_transfers_update_project_member on public.budget_transfers
for update to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = budget_transfers.project_id
      and app_user_can_access_project(auth.uid(), p.company_id, p.id)
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = budget_transfers.project_id
      and app_user_can_access_project(auth.uid(), p.company_id, p.id)
  )
);

drop policy if exists budget_transfers_delete_manager_only on public.budget_transfers;
create policy budget_transfers_delete_manager_only on public.budget_transfers
for delete to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = budget_transfers.project_id
      and app_user_can_access_project(auth.uid(), p.company_id, p.id)
      and app_is_manager_or_admin(auth.uid(), p.company_id)
  )
);

drop policy if exists prime_contracts_select_project_member on public.prime_contracts;
create policy prime_contracts_select_project_member on public.prime_contracts
for select to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = prime_contracts.project_id
      and app_user_can_access_project(auth.uid(), p.company_id, p.id)
  )
);

drop policy if exists prime_contracts_insert_project_member on public.prime_contracts;
create policy prime_contracts_insert_project_member on public.prime_contracts
for insert to authenticated
with check (
  exists (
    select 1
    from public.projects p
    where p.id = prime_contracts.project_id
      and app_user_can_access_project(auth.uid(), p.company_id, p.id)
  )
);

drop policy if exists prime_contracts_update_project_member on public.prime_contracts;
create policy prime_contracts_update_project_member on public.prime_contracts
for update to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = prime_contracts.project_id
      and app_user_can_access_project(auth.uid(), p.company_id, p.id)
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = prime_contracts.project_id
      and app_user_can_access_project(auth.uid(), p.company_id, p.id)
  )
);

drop policy if exists prime_contracts_delete_manager_only on public.prime_contracts;
create policy prime_contracts_delete_manager_only on public.prime_contracts
for delete to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = prime_contracts.project_id
      and app_user_can_access_project(auth.uid(), p.company_id, p.id)
      and app_is_manager_or_admin(auth.uid(), p.company_id)
  )
);

drop policy if exists pay_apps_select_project_member on public.pay_apps;
create policy pay_apps_select_project_member on public.pay_apps
for select to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = pay_apps.project_id
      and app_user_can_access_project(auth.uid(), p.company_id, p.id)
  )
);

drop policy if exists pay_apps_insert_project_member on public.pay_apps;
create policy pay_apps_insert_project_member on public.pay_apps
for insert to authenticated
with check (
  exists (
    select 1
    from public.projects p
    where p.id = pay_apps.project_id
      and app_user_can_access_project(auth.uid(), p.company_id, p.id)
  )
);

drop policy if exists pay_apps_update_project_member on public.pay_apps;
create policy pay_apps_update_project_member on public.pay_apps
for update to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = pay_apps.project_id
      and app_user_can_access_project(auth.uid(), p.company_id, p.id)
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = pay_apps.project_id
      and app_user_can_access_project(auth.uid(), p.company_id, p.id)
  )
);

drop policy if exists pay_apps_delete_manager_only on public.pay_apps;
create policy pay_apps_delete_manager_only on public.pay_apps
for delete to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = pay_apps.project_id
      and app_user_can_access_project(auth.uid(), p.company_id, p.id)
      and app_is_manager_or_admin(auth.uid(), p.company_id)
  )
);

drop policy if exists tasks_select_member on public.tasks;
create policy tasks_select_member on public.tasks
for select to authenticated
using (app_user_can_access_project(auth.uid(), company_id, project_id));

drop policy if exists tasks_insert_member on public.tasks;
create policy tasks_insert_member on public.tasks
for insert to authenticated
with check (app_user_can_access_project(auth.uid(), company_id, project_id));

drop policy if exists tasks_update_member_own_or_manager on public.tasks;
create policy tasks_update_member_own_or_manager on public.tasks
for update to authenticated
using (
  app_user_can_access_project(auth.uid(), company_id, project_id)
  and (
    app_is_manager_or_admin(auth.uid(), company_id)
    or created_by = auth.uid()
    or assignee_id = auth.uid()
  )
)
with check (app_user_can_access_project(auth.uid(), company_id, project_id));

drop policy if exists tasks_delete_manager_only on public.tasks;
create policy tasks_delete_manager_only on public.tasks
for delete to authenticated
using (
  app_user_can_access_project(auth.uid(), company_id, project_id)
  and app_is_manager_or_admin(auth.uid(), company_id)
);

drop policy if exists task_activity_select_project_member on public.task_activity;
create policy task_activity_select_project_member on public.task_activity
for select to authenticated
using (app_user_can_access_project(auth.uid(), company_id, project_id));

drop policy if exists task_activity_insert_project_member on public.task_activity;
create policy task_activity_insert_project_member on public.task_activity
for insert to authenticated
with check (app_user_can_access_project(auth.uid(), company_id, project_id));

drop policy if exists task_activity_delete_manager_only on public.task_activity;
create policy task_activity_delete_manager_only on public.task_activity
for delete to authenticated
using (
  app_user_can_access_project(auth.uid(), company_id, project_id)
  and app_is_manager_or_admin(auth.uid(), company_id)
);
