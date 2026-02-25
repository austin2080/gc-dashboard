import { getTenantContext } from "@/lib/db/tenant";

type SupabaseClient = Awaited<ReturnType<typeof getTenantContext>>["supabase"];

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export type TaskRecord = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  assignee_id: string | null;
  assignee_name: string | null;
  priority: string;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type TenantTaskContext = {
  supabase: SupabaseClient;
  companyId: string;
  userId: string;
};

export async function getTenantTaskContext(): Promise<TenantTaskContext> {
  const tenant = await getTenantContext();
  return { supabase: tenant.supabase, companyId: tenant.companyId, userId: tenant.userId };
}

export async function ensureProjectAccess(
  supabase: SupabaseClient,
  companyId: string,
  projectId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("company_id", companyId)
    .maybeSingle();

  return !error && Boolean(data?.id);
}

export async function findTaskById(
  supabase: SupabaseClient,
  companyId: string,
  taskId: string
): Promise<TaskRecord | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select("id,project_id,title,description,status,assignee_id,assignee_name,priority,due_date,created_by,created_at,updated_at,deleted_at")
    .eq("id", taskId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) return null;
  return data as TaskRecord;
}

export async function logTaskActivity(
  supabase: SupabaseClient,
  activity: {
    taskId: string;
    companyId: string;
    projectId: string;
    actorId: string;
    action: string;
    details?: Record<string, unknown>;
  }
) {
  await supabase.from("task_activity").insert({
    task_id: activity.taskId,
    company_id: activity.companyId,
    project_id: activity.projectId,
    actor_id: activity.actorId,
    action: activity.action,
    details: activity.details ?? {},
  });
}

export function coercePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return null;
  return asDate.toISOString();
}
