import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/db/tenant";
import {
  assertAssigneeWithinProject,
  getMembership,
  hasProjectAccess,
} from "@/lib/tasks/permissions";

type CreateTaskPayload = {
  project_id?: string;
  title?: string;
  description?: string | null;
  assignee_user_id?: string | null;
  [key: string]: unknown;
};

function clean(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET(req: Request) {
  try {
    const { supabase, userId } = await getTenantContext();
    const membership = await getMembership(supabase, userId);
    if (!membership) return NextResponse.json({ error: "No company membership" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const projectId = clean(searchParams.get("project_id"));
    if (!projectId) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 });
    }

    const canView = await hasProjectAccess(
      supabase,
      userId,
      membership.companyId,
      projectId,
      membership.canViewAllProjects
    );
    if (!canView) {
      return NextResponse.json({ error: "You do not have access to this project." }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("company_id", membership.companyId)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tasks: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    const status = message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, userId } = await getTenantContext();
    const membership = await getMembership(supabase, userId);
    if (!membership) return NextResponse.json({ error: "No company membership" }, { status: 403 });

    const payload = (await req.json().catch(() => null)) as CreateTaskPayload | null;
    const projectId = clean(payload?.project_id);
    const title = clean(payload?.title);
    const assigneeUserId = clean(payload?.assignee_user_id);

    if (!projectId || !title) {
      return NextResponse.json({ error: "project_id and title are required." }, { status: 400 });
    }

    const canCreate = await hasProjectAccess(
      supabase,
      userId,
      membership.companyId,
      projectId,
      membership.canViewAllProjects
    );
    if (!canCreate) {
      return NextResponse.json({ error: "You do not have access to this project." }, { status: 403 });
    }

    if (assigneeUserId) {
      const validAssignee = await assertAssigneeWithinProject(
        supabase,
        membership.companyId,
        projectId,
        assigneeUserId
      );
      if (!validAssignee) {
        return NextResponse.json(
          { error: "assignee_user_id must belong to your company and have access to this project." },
          { status: 400 }
        );
      }
    }

    const insertPayload: Record<string, unknown> = {
      ...payload,
      project_id: projectId,
      title,
      company_id: membership.companyId,
      created_by: userId,
      assignee_user_id: assigneeUserId,
    };

    const { data, error } = await supabase.from("tasks").insert(insertPayload).select("*").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ task: data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    const status = message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
