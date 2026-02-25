import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/db/tenant";
import { assertAssigneeWithinProject, getMembership, hasProjectAccess, isManagerRole } from "@/lib/tasks/permissions";

type BulkPatchPayload = {
  task_ids?: string[];
  patch?: Record<string, unknown>;
};

type BulkDeletePayload = {
  task_ids?: string[];
};

function clean(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function PATCH(req: Request) {
  try {
    const { supabase, userId } = await getTenantContext();
    const membership = await getMembership(supabase, userId);
    if (!membership) return NextResponse.json({ error: "No company membership" }, { status: 403 });

    if (!isManagerRole(membership.role)) {
      return NextResponse.json({ error: "Only manager/admin roles can bulk edit tasks." }, { status: 403 });
    }

    const payload = (await req.json().catch(() => null)) as BulkPatchPayload | null;
    const taskIds = (payload?.task_ids ?? []).map(clean).filter((id): id is string => Boolean(id));
    const patch = payload?.patch ?? {};

    if (taskIds.length === 0) return NextResponse.json({ error: "task_ids are required." }, { status: 400 });
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "patch is required." }, { status: 400 });

    const { data: tasks, error: taskError } = await supabase
      .from("tasks")
      .select("id,project_id")
      .eq("company_id", membership.companyId)
      .in("id", taskIds);

    if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 });
    if (!tasks || tasks.length !== taskIds.length) {
      return NextResponse.json({ error: "One or more tasks are not in your workspace." }, { status: 400 });
    }

    for (const task of tasks) {
      const canAccess = await hasProjectAccess(
        supabase,
        userId,
        membership.companyId,
        task.project_id,
        membership.canViewAllProjects
      );
      if (!canAccess) {
        return NextResponse.json({ error: `No access to project ${task.project_id}.` }, { status: 403 });
      }
    }

    const requestedProjectId = clean(patch.project_id);
    const requestedAssigneeUserId = Object.prototype.hasOwnProperty.call(patch, "assignee_user_id")
      ? clean(patch.assignee_user_id)
      : null;

    if (requestedProjectId) {
      const canUseProject = await hasProjectAccess(
        supabase,
        userId,
        membership.companyId,
        requestedProjectId,
        membership.canViewAllProjects
      );
      if (!canUseProject) {
        return NextResponse.json({ error: "Invalid project_id for your workspace." }, { status: 400 });
      }
    }

    if (requestedAssigneeUserId) {
      const targetProjects = requestedProjectId ? [requestedProjectId] : Array.from(new Set(tasks.map((t) => t.project_id)));
      for (const projectId of targetProjects) {
        const validAssignee = await assertAssigneeWithinProject(
          supabase,
          membership.companyId,
          projectId,
          requestedAssigneeUserId
        );
        if (!validAssignee) {
          return NextResponse.json(
            { error: "assignee_user_id must belong to your company and have access to all affected projects." },
            { status: 400 }
          );
        }
      }
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("company_id", membership.companyId)
      .in("id", taskIds)
      .select("*");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tasks: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    const status = message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabase, userId } = await getTenantContext();
    const membership = await getMembership(supabase, userId);
    if (!membership) return NextResponse.json({ error: "No company membership" }, { status: 403 });

    if (!isManagerRole(membership.role)) {
      return NextResponse.json({ error: "Only manager/admin roles can bulk delete tasks." }, { status: 403 });
    }

    const payload = (await req.json().catch(() => null)) as BulkDeletePayload | null;
    const taskIds = (payload?.task_ids ?? []).map(clean).filter((id): id is string => Boolean(id));
    if (taskIds.length === 0) return NextResponse.json({ error: "task_ids are required." }, { status: 400 });

    const { data: tasks, error: taskError } = await supabase
      .from("tasks")
      .select("id,project_id")
      .eq("company_id", membership.companyId)
      .in("id", taskIds);

    if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 });

    for (const task of tasks ?? []) {
      const canAccess = await hasProjectAccess(
        supabase,
        userId,
        membership.companyId,
        task.project_id,
        membership.canViewAllProjects
      );
      if (!canAccess) {
        return NextResponse.json({ error: `No access to project ${task.project_id}.` }, { status: 403 });
      }
    }

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("company_id", membership.companyId)
      .in("id", taskIds);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    const status = message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
