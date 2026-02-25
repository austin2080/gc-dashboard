-- Task backend guardrails for assignee/workspace/project validation.
-- Assumes:
--   tasks(id, company_id, project_id, created_by, assignee_user_id, ...)
--   projects(id, company_id, created_by)
--   company_members(company_id, user_id, role, is_active, can_view_all_projects)
--   project_members(project_id, user_id)

create extension if not exists pgcrypto;

alter table if exists tasks enable row level security;

create or replace function app_request_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function app_is_manager_or_admin(p_user_id uuid, p_company_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from company_members cm
    where cm.user_id = p_user_id
      and cm.company_id = p_company_id
      and cm.is_active = true
      and lower(coalesce(cm.role, '')) in ('manager', 'admin', 'owner')
  );
$$;

create or replace function app_user_can_access_project(p_user_id uuid, p_company_id uuid, p_project_id uuid)
returns boolean
language sql
stable
as $$
  with member as (
    select can_view_all_projects
    from company_members
    where user_id = p_user_id
      and company_id = p_company_id
      and is_active = true
    limit 1
  )
  select exists (
    select 1
    from projects p
    where p.id = p_project_id
      and p.company_id = p_company_id
      and (
        p.created_by = p_user_id
        or coalesce((select m.can_view_all_projects from member m), false) = true
        or exists (
          select 1 from project_members pm
          where pm.project_id = p_project_id
            and pm.user_id = p_user_id
        )
      )
  );
$$;

create or replace function app_validate_task_write()
returns trigger
language plpgsql
as $$
declare
  actor_id uuid;
  actor_is_manager boolean;
  assignee_in_company boolean;
  assignee_has_project_access boolean;
begin
  actor_id := app_request_user_id();
  actor_is_manager := app_is_manager_or_admin(actor_id, new.company_id);

  if new.assignee_user_id is not null then
    select exists (
      select 1
      from company_members cm
      where cm.user_id = new.assignee_user_id
        and cm.company_id = new.company_id
        and cm.is_active = true
    ) into assignee_in_company;

    if not assignee_in_company then
      raise exception 'assignee_user_id must belong to the same company';
    end if;

    assignee_has_project_access := app_user_can_access_project(new.assignee_user_id, new.company_id, new.project_id);
    if not assignee_has_project_access then
      raise exception 'assignee_user_id must have access to the task project';
    end if;
  end if;

  if tg_op = 'UPDATE' and not actor_is_manager then
    if new.assignee_user_id is distinct from old.assignee_user_id then
      raise exception 'Only manager/admin can reassign tasks';
    end if;

    if new.project_id is distinct from old.project_id then
      raise exception 'Only manager/admin can move tasks between projects';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_task_write on tasks;
create trigger trg_validate_task_write
before insert or update on tasks
for each row execute procedure app_validate_task_write();

drop policy if exists tasks_select_member on tasks;
create policy tasks_select_member on tasks
for select to authenticated
using (
  app_user_can_access_project(auth.uid(), company_id, project_id)
);

drop policy if exists tasks_insert_member on tasks;
create policy tasks_insert_member on tasks
for insert to authenticated
with check (
  app_user_can_access_project(auth.uid(), company_id, project_id)
);

drop policy if exists tasks_update_member_own_or_manager on tasks;
create policy tasks_update_member_own_or_manager on tasks
for update to authenticated
using (
  app_user_can_access_project(auth.uid(), company_id, project_id)
  and (
    app_is_manager_or_admin(auth.uid(), company_id)
    or created_by = auth.uid()
    or assignee_user_id = auth.uid()
  )
)
with check (
  app_user_can_access_project(auth.uid(), company_id, project_id)
);

drop policy if exists tasks_delete_manager_only on tasks;
create policy tasks_delete_manager_only on tasks
for delete to authenticated
using (
  app_user_can_access_project(auth.uid(), company_id, project_id)
  and app_is_manager_or_admin(auth.uid(), company_id)
);
