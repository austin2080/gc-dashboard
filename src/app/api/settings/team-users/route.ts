import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatLastActive(value: string | null | undefined): string {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleDateString();
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = authData.user.id;
    const currentUserEmail = authData.user.email ?? "";
    const admin = createAdminClient();

    const { data: activeMember } = await admin
      .from("company_members")
      .select("company_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: fallbackMember } = activeMember?.company_id
      ? { data: null }
      : await admin
          .from("company_members")
          .select("company_id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

    const companyId =
      (activeMember?.company_id as string | null | undefined) ??
      (fallbackMember?.company_id as string | null | undefined);

    if (!companyId) {
      return NextResponse.json({ error: "No company membership" }, { status: 403 });
    }

    const { data, error } = await admin
      .from("company_members")
      .select("user_id,role,is_active,created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const users = (data ?? []).map((row) => {
      const roleRaw = typeof row.role === "string" ? row.role.trim() : "";
      return {
        id: row.user_id,
        name: row.user_id === userId ? "You" : `User ${String(row.user_id).slice(0, 8)}`,
        email: row.user_id === userId ? currentUserEmail || "—" : "—",
        role: roleRaw ? toTitleCase(roleRaw) : "Member",
        status: row.is_active ? "Active" : "Deactivated",
        lastActive: formatLastActive(row.created_at ?? null),
      };
    });

    return NextResponse.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load users";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
