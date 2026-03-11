import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type UpdateUserPayload = {
  role?: string;
  status?: "Active" | "Deactivated";
  firstName?: string;
  lastName?: string;
  company?: string;
  address?: string;
  cityStateZip?: string;
  phone?: string;
  email?: string;
};

function normalizeRole(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseCityStateZip(value: string): { city: string; state: string; zip: string } {
  const trimmed = value.trim();
  if (!trimmed) return { city: "", state: "", zip: "" };
  const commaIndex = trimmed.indexOf(",");
  if (commaIndex < 0) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const state = parts[parts.length - 2] ?? "";
      const zip = parts[parts.length - 1] ?? "";
      const city = parts.slice(0, Math.max(0, parts.length - 2)).join(" ");
      return { city, state, zip };
    }
    return { city: trimmed, state: "", zip: "" };
  }
  const city = trimmed.slice(0, commaIndex).trim();
  const rest = trimmed.slice(commaIndex + 1).trim();
  const restParts = rest.split(/\s+/).filter(Boolean);
  const state = restParts[0] ?? "";
  const zip = restParts.slice(1).join(" ");
  return { city, state, zip };
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
    const nextFirstName = typeof payload.firstName === "string" ? payload.firstName.trim() : "";
    const nextLastName = typeof payload.lastName === "string" ? payload.lastName.trim() : "";
    const nextCompany = typeof payload.company === "string" ? payload.company.trim() : "";
    const nextAddress = typeof payload.address === "string" ? payload.address.trim() : "";
    const nextCityStateZip =
      typeof payload.cityStateZip === "string" ? payload.cityStateZip.trim() : "";
    const nextPhone = typeof payload.phone === "string" ? payload.phone.trim() : "";
    const nextEmail = typeof payload.email === "string" ? payload.email.trim() : "";
    const hasNameChange = Boolean(nextFirstName || nextLastName);
    const hasProfileChange = Boolean(nextCompany || nextAddress || nextCityStateZip || nextPhone);
    const hasEmailChange = Boolean(nextEmail);

    if (!nextRole && !nextStatus && !hasNameChange && !hasProfileChange && !hasEmailChange) {
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

    if (Object.keys(updatePayload).length) {
      const { error: updateError } = await admin
        .from("company_members")
        .update(updatePayload)
        .eq("company_id", currentCompanyId)
        .eq("user_id", userId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    if (hasNameChange || hasProfileChange || hasEmailChange) {
      const authLookup = await admin.auth.admin.getUserById(userId);
      const authUser = authLookup.data.user;
      if (!authUser) {
        return NextResponse.json({ error: "User not found in auth" }, { status: 404 });
      }
      const existingMetadata = (authUser.user_metadata ?? {}) as Record<string, unknown>;
      const parsedCityStateZip = parseCityStateZip(nextCityStateZip);
      const mergedMetadata: Record<string, unknown> = {
        ...existingMetadata,
        first_name: nextFirstName,
        last_name: nextLastName,
        given_name: nextFirstName,
        family_name: nextLastName,
        full_name: [nextFirstName, nextLastName].filter(Boolean).join(" ").trim(),
        company: nextCompany,
        address: nextAddress,
        city_state_zip: nextCityStateZip,
        city: parsedCityStateZip.city,
        state: parsedCityStateZip.state,
        zip: parsedCityStateZip.zip,
        phone: nextPhone,
        phone_number: nextPhone,
      };
      const authUpdatePayload: {
        user_metadata: Record<string, unknown>;
        email?: string;
      } = {
        user_metadata: mergedMetadata,
      };
      if (nextEmail && nextEmail !== authUser.email) {
        authUpdatePayload.email = nextEmail;
      }
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(
        userId,
        authUpdatePayload
      );
      if (authUpdateError) {
        return NextResponse.json({ error: authUpdateError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
