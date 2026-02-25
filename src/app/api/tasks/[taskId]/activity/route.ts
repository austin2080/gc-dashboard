import { NextResponse } from "next/server";
import {
  coercePositiveInt,
  findTaskById,
  getTenantTaskContext,
} from "@/lib/db/tasks";

type RouteContext = {
  params: { taskId: string } | Promise<{ taskId: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  try {
    const { taskId } = await context.params;
    const { supabase, companyId } = await getTenantTaskContext();

    const task = await findTaskById(supabase, companyId, taskId);
    if (!task || task.deleted_at) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const page = coercePositiveInt(url.searchParams.get("page"), 1);
    const limit = Math.min(coercePositiveInt(url.searchParams.get("limit"), 20), 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from("task_activity")
      .select("id,task_id,action,details,actor_id,created_at", { count: "exact" })
      .eq("task_id", taskId)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      activity: data ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 500 });
  }
}
