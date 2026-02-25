import { NextResponse } from "next/server";
import { findTaskById, getTenantTaskContext, logTaskActivity } from "@/lib/db/tasks";

type RouteContext = {
  params: { taskId: string } | Promise<{ taskId: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  try {
    const { taskId } = await context.params;
    const { supabase, companyId, userId } = await getTenantTaskContext();

    const task = await findTaskById(supabase, companyId, taskId);
    if (!task || task.deleted_at) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => null)) as { body?: string } | null;
    const commentBody = String(body?.body ?? "").trim();

    if (!commentBody) {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("task_comments")
      .insert({
        task_id: taskId,
        project_id: task.project_id,
        company_id: companyId,
        body: commentBody,
        author_id: userId,
      })
      .select("id,task_id,project_id,body,author_id,created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logTaskActivity(supabase, {
      taskId,
      companyId,
      projectId: task.project_id,
      actorId: userId,
      action: "commented",
      details: { comment_id: data.id },
    });

    return NextResponse.json({ comment: data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 500 });
  }
}
