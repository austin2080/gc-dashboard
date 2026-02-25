import type { SupabaseClient } from "@supabase/supabase-js";

const MANAGER_ROLES = new Set(["manager", "admin", "owner"]);

export type Membership = {
  companyId: string;
  role: string | null;
  canViewAllProjects: boolean;
};

function normalizeRole(value: unknown): string | null {
  const trimmed = String(value ?? "").trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function clean(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function getMembership(supabase: SupabaseClient, userId: string): Promise<Membership | null> {
  const { data } = await supabase
    .from("company_members")
    .select("company_id,role,can_view_all_projects")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const companyId = clean(data?.company_id);
  if (!companyId) return null;

  return {
    companyId,
    role: normalizeRole(data?.role),
    canViewAllProjects: Boolean(data?.can_view_all_projects),
  };
}

export function isManagerRole(role: string | null): boolean {
  return role ? MANAGER_ROLES.has(role) : false;
}

export async function hasProjectAccess(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  projectId: string,
  canViewAllProjects: boolean
): Promise<boolean> {
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!project?.id) return false;
  if (canViewAllProjects) return true;

  const membershipTables = ["project_members", "project_memberships", "project_users"];
  for (const table of membershipTables) {
    const { data, error } = await supabase
      .from(table)
      .select("project_id")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (!error && data?.project_id) return true;
  }

  const { data: ownProject } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("created_by", userId)
    .maybeSingle();

  return Boolean(ownProject?.id);
}

export async function assertAssigneeWithinProject(
  supabase: SupabaseClient,
  companyId: string,
  projectId: string,
  assigneeUserId: string
): Promise<boolean> {
  const { data: assigneeMember } = await supabase
    .from("company_members")
    .select("company_id,can_view_all_projects")
    .eq("company_id", companyId)
    .eq("user_id", assigneeUserId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!assigneeMember?.company_id) return false;

  if (assigneeMember.can_view_all_projects) return true;

  const membershipTables = ["project_members", "project_memberships", "project_users"];
  for (const table of membershipTables) {
    const { data, error } = await supabase
      .from(table)
      .select("project_id")
      .eq("project_id", projectId)
      .eq("user_id", assigneeUserId)
      .limit(1)
      .maybeSingle();

    if (!error && data?.project_id) return true;
  }

  const { data: ownProject } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("created_by", assigneeUserId)
    .maybeSingle();

  return Boolean(ownProject?.id);
}

export function taskOwnedByUser(
  task: { created_by?: string | null; assignee_user_id?: string | null },
  userId: string
): boolean {
  return task.created_by === userId || task.assignee_user_id === userId;
}
