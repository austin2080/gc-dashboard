import { NextResponse } from "next/server";
import {
  coercePositiveInt,
  ensureProjectAccess,
  getTenantTaskContext,
  logTaskActivity,
  toIsoDate,
} from "@/lib/db/tasks";

type RouteContext = {
  params: { projectId: string } | Promise<{ projectId: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const { supabase, companyId } = await getTenantTaskContext();

    const hasAccess = await ensureProjectAccess(supabase, companyId, projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const assignee = url.searchParams.get("assignee");
    const priority = url.searchParams.get("priority");
    const dueBefore = toIsoDate(url.searchParams.get("due_before"));
    const dueAfter = toIsoDate(url.searchParams.get("due_after"));
    const page = coercePositiveInt(url.searchParams.get("page"), 1);
    const limit = Math.min(coercePositiveInt(url.searchParams.get("limit"), 25), 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("tasks")
      .select(
        "id,project_id,title,description,status,assignee_id,assignee_name,priority,due_date,created_by,created_at,updated_at",
        { count: "exact" }
      )
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .is("deleted_at", null);

    if (status) query = query.eq("status", status);
    if (assignee) query = query.eq("assignee_id", assignee);
    if (priority) query = query.eq("priority", priority);
    if (dueBefore) query = query.lte("due_date", dueBefore);
    if (dueAfter) query = query.gte("due_date", dueAfter);

    const { data: tasks, error, count } = await query
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
    endOfWeek.setHours(23, 59, 59, 999);

    let metricQuery = supabase
      .from("tasks")
      .select("id,due_date,status", { count: "exact" })
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .is("deleted_at", null);

    if (status) metricQuery = metricQuery.eq("status", status);
    if (assignee) metricQuery = metricQuery.eq("assignee_id", assignee);
    if (priority) metricQuery = metricQuery.eq("priority", priority);

    const { data: metricsData, count: totalCount } = await metricQuery;

    const overdue = (metricsData ?? []).filter((task) => {
      if (!task.due_date || task.status === "done") return false;
      return new Date(task.due_date) < now;
    }).length;

    const dueThisWeek = (metricsData ?? []).filter((task) => {
      if (!task.due_date || task.status === "done") return false;
      const due = new Date(task.due_date);
      return due >= now && due <= endOfWeek;
    }).length;

    return NextResponse.json({
      tasks: tasks ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
      counts: {
        total: totalCount ?? 0,
        overdue,
        due_this_week: dueThisWeek,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 500 });
  }
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const { supabase, companyId, userId } = await getTenantTaskContext();

    const hasAccess = await ensureProjectAccess(supabase, companyId, projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => null)) as {
      title?: string;
      description?: string;
      status?: string;
      assignee?: string;
      assignee_name?: string | null;
      priority?: string;
      due_date?: string;
    } | null;

    const title = String(body?.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const insertPayload = {
      project_id: projectId,
      company_id: companyId,
      title,
      description: body?.description?.trim() || null,
      status: body?.status ?? "todo",
      assignee_id: body?.assignee ?? null,
      assignee_name: body?.assignee_name?.trim() || null,
      priority: body?.priority ?? "medium",
      due_date: toIsoDate(body?.due_date) ?? null,
      created_by: userId,
      updated_by: userId,
    };

    const { data, error } = await supabase
      .from("tasks")
      .insert(insertPayload)
      .select("id,project_id,title,description,status,assignee_id,assignee_name,priority,due_date,created_by,created_at,updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logTaskActivity(supabase, {
      taskId: data.id,
      companyId,
      projectId,
      actorId: userId,
      action: "created",
      details: { title },
    });

    return NextResponse.json({ task: data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 500 });
  }
}
