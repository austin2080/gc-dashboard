import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type UpdateUserPayload = {
  role?: string;
  status?: "Active" | "Deactivated";
};

function normalizeRole(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

async function resolveCompanyIdForUser(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: activeMember } = await admin
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activeMember?.company_id) return activeMember.company_id as string;

  const { data: fallbackMember } = await admin
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (fallbackMember?.company_id as string | undefined) ?? null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const currentUserId = authData.user.id;
    const currentCompanyId = await resolveCompanyIdForUser(currentUserId);
    if (!currentCompanyId) {
      return NextResponse.json({ error: "No company membership" }, { status: 403 });
    }

    const { userId } = await context.params;
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const payload = (await request.json().catch(() => null)) as UpdateUserPayload | null;
    if (!payload) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const nextRole = typeof payload.role === "string" ? payload.role.trim() : "";
    const nextStatus = payload.status;

    if (!nextRole && !nextStatus) {
      return NextResponse.json({ error: "No changes provided" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: targetMembership, error: targetError } = await admin
      .from("company_members")
      .select("company_id,user_id")
      .eq("company_id", currentCompanyId)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (targetError || !targetMembership?.user_id) {
      return NextResponse.json({ error: "User not found in company" }, { status: 404 });
    }

    const updatePayload: { role?: string; is_active?: boolean } = {};
    if (nextRole) updatePayload.role = normalizeRole(nextRole);
    if (nextStatus) updatePayload.is_active = nextStatus === "Active";

    const { error: updateError } = await admin
      .from("company_members")
      .update(updatePayload)
      .eq("company_id", currentCompanyId)
      .eq("user_id", userId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

