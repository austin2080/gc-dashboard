import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type InviteUserPayload = {
  email?: string;
  role?: string;
};

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatNameFromEmailLocal(localPart: string): string {
  const withSpaces = localPart
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    .trim();
  return withSpaces
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractNameFromMetadata(metadata: Record<string, unknown>): string {
  const fullName =
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    "";
  if (fullName) return fullName;
  const givenName =
    (typeof metadata.given_name === "string" && metadata.given_name.trim()) ||
    (typeof metadata.first_name === "string" && metadata.first_name.trim()) ||
    "";
  const familyName =
    (typeof metadata.family_name === "string" && metadata.family_name.trim()) ||
    (typeof metadata.last_name === "string" && metadata.last_name.trim()) ||
    "";
  return [givenName, familyName].filter(Boolean).join(" ").trim();
}

function extractFirstLastFromMetadata(metadata: Record<string, unknown>): {
  firstName: string;
  lastName: string;
} {
  const firstName =
    (typeof metadata.given_name === "string" && metadata.given_name.trim()) ||
    (typeof metadata.first_name === "string" && metadata.first_name.trim()) ||
    "";
  const lastName =
    (typeof metadata.family_name === "string" && metadata.family_name.trim()) ||
    (typeof metadata.last_name === "string" && metadata.last_name.trim()) ||
    "";
  return { firstName, lastName };
}

function splitDisplayName(value: string): { firstName: string; lastName: string } {
  const trimmed = value.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function formatLastActive(value: string | null | undefined): string {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleDateString();
}

function normalizeRole(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
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
    const currentUserMetadata = (authData.user.user_metadata ?? {}) as Record<string, unknown>;
    const currentUserName = extractNameFromMetadata(currentUserMetadata);
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

    const membershipRows = data ?? [];
    const authUsersById = new Map<
      string,
      {
        email: string;
        fullName: string;
        firstName: string;
        lastName: string;
        company: string;
        address: string;
        phone: string;
        cityStateZip: string;
        isInvited: boolean;
      }
    >();
    await Promise.all(
      membershipRows.map(async (row) => {
        const authLookup = await admin.auth.admin.getUserById(row.user_id);
        const authUser = authLookup.data.user;
        const metadata = (authUser?.user_metadata ?? {}) as Record<string, unknown>;
        const fullNameRaw = extractNameFromMetadata(metadata);
        const { firstName, lastName } = extractFirstLastFromMetadata(metadata);
        const emailRaw = authUser?.email ?? "";
        const phoneRaw =
          (typeof metadata.phone === "string" && metadata.phone) ||
          (typeof metadata.phone_number === "string" && metadata.phone_number) ||
          "";
        const companyRaw = typeof metadata.company === "string" ? metadata.company.trim() : "";
        const addressRaw = typeof metadata.address === "string" ? metadata.address.trim() : "";
        const cityStateZipRaw =
          typeof metadata.city_state_zip === "string" ? metadata.city_state_zip.trim() : "";
        const cityRaw = typeof metadata.city === "string" ? metadata.city.trim() : "";
        const stateRaw = typeof metadata.state === "string" ? metadata.state.trim() : "";
        const zipRaw = typeof metadata.zip === "string" ? metadata.zip.trim() : "";
        const cityStateZip = [cityRaw, stateRaw].filter(Boolean).join(", ");
        const cityStateZipWithZip = cityStateZipRaw || [cityStateZip, zipRaw].filter(Boolean).join(" ");
        authUsersById.set(row.user_id, {
          email: emailRaw,
          fullName: fullNameRaw.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          company: companyRaw,
          address: addressRaw,
          phone: phoneRaw.trim(),
          cityStateZip: cityStateZipWithZip.trim(),
          isInvited: Boolean(authUser?.invited_at) && !authUser?.last_sign_in_at,
        });
      })
    );

    const users = membershipRows.map((row) => {
      const roleRaw = typeof row.role === "string" ? row.role.trim() : "";
      const authUser = authUsersById.get(row.user_id);
      const fallbackEmail = row.user_id === userId ? currentUserEmail : "";
      const email = authUser?.email || fallbackEmail || "—";
      const nameFromEmailLocal =
        email !== "—" && email.includes("@")
          ? email.split("@")[0]
          : "";
      const readableName =
        (row.user_id === userId ? currentUserName : "") ||
        authUser?.fullName ||
        (nameFromEmailLocal
          ? formatNameFromEmailLocal(nameFromEmailLocal)
          : "");
      const parsedName = splitDisplayName(readableName);
      const status =
        row.is_active
          ? authUser?.isInvited
            ? "Invited"
            : "Active"
          : "Deactivated";
      return {
        id: row.user_id,
        name: readableName || (row.user_id === userId ? "You" : `User ${String(row.user_id).slice(0, 8)}`),
        email,
        role: roleRaw ? toTitleCase(roleRaw) : "Member",
        status,
        lastActive: formatLastActive(row.created_at ?? null),
        company: authUser?.company || "Your Company",
        firstName: authUser?.firstName || parsedName.firstName,
        lastName: authUser?.lastName || parsedName.lastName,
        address: authUser?.address || "",
        cityStateZip: authUser?.cityStateZip ?? "",
        phone: authUser?.phone ?? "",
      };
    });

    return NextResponse.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load users";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const payload = (await request.json().catch(() => null)) as InviteUserPayload | null;
    const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
    const role = typeof payload?.role === "string" ? payload.role.trim() : "";

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    if (!role) {
      return NextResponse.json({ error: "Role is required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const inviterId = authData.user.id;
    const inviterEmail = authData.user.email ?? "";
    const inviterMetadata = (authData.user.user_metadata ?? {}) as Record<string, unknown>;
    const inviterName = extractNameFromMetadata(inviterMetadata) || inviterEmail;

    const { data: activeMember } = await admin
      .from("company_members")
      .select("company_id")
      .eq("user_id", inviterId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: fallbackMember } = activeMember?.company_id
      ? { data: null }
      : await admin
          .from("company_members")
          .select("company_id")
          .eq("user_id", inviterId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

    const companyId =
      (activeMember?.company_id as string | null | undefined) ??
      (fallbackMember?.company_id as string | null | undefined);

    if (!companyId) {
      return NextResponse.json({ error: "No company membership" }, { status: 403 });
    }

    const companyLookup = await admin
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .limit(1)
      .maybeSingle();
    const companyName =
      (typeof companyLookup.data?.name === "string" && companyLookup.data.name.trim()) || "";

    const normalizedRole = normalizeRole(role);
    const redirectTo = new URL("/create-account", request.url).toString();

    const inviteResult = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        company: companyName,
        invited_company_id: companyId,
        invited_role: normalizedRole,
        invited_by_email: inviterEmail,
        invited_by_name: inviterName,
      },
    });

    if (inviteResult.error || !inviteResult.data.user) {
      const message = inviteResult.error?.message ?? "Unable to invite user.";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const invitedUser = inviteResult.data.user;
    const existingMembership = await admin
      .from("company_members")
      .select("user_id")
      .eq("company_id", companyId)
      .eq("user_id", invitedUser.id)
      .limit(1)
      .maybeSingle();

    if (!existingMembership.data?.user_id) {
      const { error: membershipInsertError } = await admin.from("company_members").insert({
        company_id: companyId,
        user_id: invitedUser.id,
        role: normalizedRole,
        is_active: true,
      });

      if (membershipInsertError) {
        return NextResponse.json({ error: membershipInsertError.message }, { status: 500 });
      }
    } else {
      const { error: membershipUpdateError } = await admin
        .from("company_members")
        .update({
          role: normalizedRole,
          is_active: true,
        })
        .eq("company_id", companyId)
        .eq("user_id", invitedUser.id);

      if (membershipUpdateError) {
        return NextResponse.json({ error: membershipUpdateError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      user: {
        id: invitedUser.id,
        name: extractNameFromMetadata((invitedUser.user_metadata ?? {}) as Record<string, unknown>) || email.split("@")[0],
        email,
        role: toTitleCase(normalizedRole),
        status: "Invited",
        lastActive: "Never",
        company: companyName || "Your Company",
        firstName: "",
        lastName: "",
        address: "",
        cityStateZip: "",
        phone: "",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to invite user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
