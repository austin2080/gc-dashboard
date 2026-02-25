import { NextResponse } from "next/server";
import {
  findTaskById,
  getTenantTaskContext,
  logTaskActivity,
  toIsoDate,
} from "@/lib/db/tasks";

type RouteContext = {
  params: { taskId: string } | Promise<{ taskId: string }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { taskId } = await context.params;
    const { supabase, companyId, userId } = await getTenantTaskContext();

    const existing = await findTaskById(supabase, companyId, taskId);
    if (!existing || existing.deleted_at) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => null)) as {
      title?: string;
      description?: string;
      status?: string;
      assignee?: string | null;
      priority?: string;
      due_date?: string | null;
    } | null;

    const updates: Record<string, string | null> = {
      updated_by: userId,
    };

    if (body?.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) {
        return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
      }
      updates.title = title;
    }

    if (body?.description !== undefined) updates.description = body.description?.trim() || null;
    if (body?.status !== undefined) updates.status = body.status;
    if (body?.assignee !== undefined) updates.assignee_id = body.assignee || null;
    if (body?.priority !== undefined) updates.priority = body.priority;
    if (body?.due_date !== undefined) updates.due_date = toIsoDate(body.due_date) ?? null;

    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", taskId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .select("id,project_id,title,description,status,assignee_id,priority,due_date,created_by,created_at,updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logTaskActivity(supabase, {
      taskId,
      companyId,
      projectId: data.project_id,
      actorId: userId,
      action: "updated",
      details: {
        before: {
          title: existing.title,
          description: existing.description,
          status: existing.status,
          assignee_id: existing.assignee_id,
          priority: existing.priority,
          due_date: existing.due_date,
        },
        after: {
          title: data.title,
          description: data.description,
          status: data.status,
          assignee_id: data.assignee_id,
          priority: data.priority,
          due_date: data.due_date,
        },
      },
    });

    return NextResponse.json({ task: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const { taskId } = await context.params;
    const { supabase, companyId, userId } = await getTenantTaskContext();

    const existing = await findTaskById(supabase, companyId, taskId);
    if (!existing || existing.deleted_at) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const deletedAt = new Date().toISOString();

    const { error } = await supabase
      .from("tasks")
      .update({ deleted_at: deletedAt, updated_by: userId })
      .eq("id", taskId)
      .eq("company_id", companyId)
      .is("deleted_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logTaskActivity(supabase, {
      taskId,
      companyId,
      projectId: existing.project_id,
      actorId: userId,
      action: "deleted",
      details: { deleted_at: deletedAt },
    });

    return NextResponse.json({ success: true, deleted_at: deletedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 500 });
  }
}
