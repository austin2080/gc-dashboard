import { createClient } from "@/lib/supabase/client";
import type { NewOwnerBidInput, OwnerBid } from "./owner-bids-types";

type OwnerBidRow = {
  id: string;
  name: string;
  client: string;
  project_type: string;
  address: string | null;
  square_feet: number | null;
  due_date: string | null;
  bid_type: string;
  status: string;
  assigned_to: string | null;
  probability: number | null;
  est_cost: number | null;
  ohp_amount: number | null;
  markup_pct: number | null;
  bid_amount: number | null;
  expected_profit: number | null;
  margin_pct: number | null;
  lost_reason: string | null;
  lost_notes: string | null;
  convert_to_project: boolean | null;
  created_at: string;
  updated_at: string;
};

const selectColumns = `
  id,
  name,
  client,
  project_type,
  address,
  square_feet,
  due_date,
  bid_type,
  status,
  assigned_to,
  probability,
  est_cost,
  ohp_amount,
  markup_pct,
  bid_amount,
  expected_profit,
  margin_pct,
  lost_reason,
  lost_notes,
  convert_to_project,
  created_at,
  updated_at
`;

function mapRowToBid(row: OwnerBidRow): OwnerBid {
  return {
    id: row.id,
    name: row.name,
    client: row.client,
    projectType: row.project_type as OwnerBid["projectType"],
    address: row.address ?? "",
    squareFeet: row.square_feet ?? null,
    dueDate: row.due_date ?? null,
    bidType: row.bid_type as OwnerBid["bidType"],
    status: row.status as OwnerBid["status"],
    assignedTo: row.assigned_to ?? "",
    probability: row.probability ?? 50,
    estCost: row.est_cost ?? null,
    ohpAmount: row.ohp_amount ?? null,
    markupPct: row.markup_pct ?? null,
    bidAmount: row.bid_amount ?? null,
    expectedProfit: row.expected_profit ?? null,
    marginPct: row.margin_pct ?? null,
    lostReason: row.lost_reason as OwnerBid["lostReason"],
    lostNotes: row.lost_notes ?? "",
    convertToProject: row.convert_to_project ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInputToRow(payload: NewOwnerBidInput) {
  return {
    name: payload.name.trim(),
    client: payload.client.trim(),
    project_type: payload.projectType,
    address: payload.address.trim() || null,
    square_feet: payload.squareFeet ?? null,
    due_date: payload.dueDate ?? null,
    bid_type: payload.bidType,
    status: payload.status,
    assigned_to: payload.assignedTo.trim() || null,
    probability: payload.probability,
    est_cost: payload.estCost ?? null,
    ohp_amount: payload.ohpAmount ?? null,
    markup_pct: payload.markupPct ?? null,
    bid_amount: payload.bidAmount ?? null,
    expected_profit: payload.expectedProfit ?? null,
    margin_pct: payload.marginPct ?? null,
    lost_reason: payload.status === "Lost" ? payload.lostReason : null,
    lost_notes: payload.status === "Lost" ? payload.lostNotes : "",
    convert_to_project: payload.status === "Awarded" ? payload.convertToProject : false,
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function titleFromEmail(email: string | null | undefined): string {
  const local = (email ?? "").split("@")[0] ?? "";
  const cleaned = local.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function hasLikelyFullName(value: string | null | undefined): boolean {
  if (!value) return false;
  return /\s+/.test(value.trim());
}

export async function listOwnerBids(): Promise<OwnerBid[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bid_owner_bids")
    .select(selectColumns)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (error || !data) {
    console.error("Failed to load owner bids", error);
    return [];
  }

  return (data as OwnerBidRow[]).map(mapRowToBid);
}

export async function createOwnerBid(payload: NewOwnerBidInput): Promise<OwnerBid | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bid_owner_bids")
    .insert(mapInputToRow(payload))
    .select(selectColumns)
    .single();

  if (error || !data) {
    console.error("Failed to create owner bid", error);
    return null;
  }

  return mapRowToBid(data as OwnerBidRow);
}

export async function updateOwnerBid(id: string, payload: NewOwnerBidInput): Promise<OwnerBid | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bid_owner_bids")
    .update(mapInputToRow(payload))
    .eq("id", id)
    .select(selectColumns)
    .single();

  if (error || !data) {
    console.error("Failed to update owner bid", error);
    return null;
  }

  return mapRowToBid(data as OwnerBidRow);
}

export async function listOwnerBidAssignees(): Promise<string[]> {
  const supabase = createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    console.error("Failed to resolve authenticated user for owner-bid assignees", authError);
    return [];
  }

  const { data: member, error: memberError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", authData.user.id)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (memberError || !member?.company_id) {
    console.error("Failed to resolve company for owner-bid assignees", memberError);
    return [];
  }

  const { data: members, error: membersError } = await supabase
    .from("company_members")
    .select("user_id")
    .eq("company_id", member.company_id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (membersError || !members) {
    console.error("Failed to load owner-bid assignees", membersError);
    return [];
  }

  const memberRows = members as Array<{ user_id: string }>;
  const userIds = memberRows.map((row) => row.user_id).filter(Boolean);
  if (!userIds.length) return [];

  const byId = await supabase
    .from("profiles")
    .select("id,first_name,last_name,full_name")
    .in("id", userIds);

  let profiles: Array<{
    id?: string | null;
    user_id?: string | null;
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
  }> | null = null;

  if (!byId.error) {
    profiles = (byId.data as Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
    }> | null)?.map((row) => ({ ...row, user_id: null })) ?? null;
  } else {
    // Fallback for schemas that key profiles by user_id instead of id.
    const byUserId = await supabase
      .from("profiles")
      .select("user_id,first_name,last_name,full_name")
      .in("user_id", userIds);
    if (!byUserId.error) {
      profiles = (byUserId.data as Array<{
        user_id: string;
        first_name: string | null;
        last_name: string | null;
        full_name: string | null;
      }> | null)?.map((row) => ({ ...row, id: null })) ?? null;
    } else {
      console.warn("Failed to load profile names for owner-bid assignees", byUserId.error);
    }
  }

  const profileNameById = new Map<string, string>();
  (
    profiles as Array<{
      id?: string | null;
      user_id?: string | null;
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
    }> | null
  )?.forEach((profile) => {
    const composed = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
    const name = composed || profile.full_name?.trim() || "";
    const key = profile.id ?? profile.user_id ?? "";
    if (!key) return;
    if (!name) return;
    profileNameById.set(key, name);
  });

  const names: string[] = [];
  const seen = new Set<string>();
  const userMeta = authData.user.user_metadata ?? {};
  const metaFirst = String(userMeta.first_name ?? userMeta.given_name ?? "").trim();
  const metaLast = String(userMeta.last_name ?? userMeta.family_name ?? "").trim();
  const metaFirstLast = [metaFirst, metaLast].filter(Boolean).join(" ").trim();
  const currentUserMetaName = String(userMeta.full_name ?? userMeta.name ?? metaFirstLast).trim();
  const currentUserEmailName = titleFromEmail(authData.user.email);
  const currentUserFallbackName = currentUserMetaName || currentUserEmailName;

  memberRows.forEach((row) => {
    const profileName = profileNameById.get(row.user_id);
    const fallbackForAnyUser = isUuid(row.user_id) ? `Member ${row.user_id.slice(0, 8)}` : row.user_id;
    const value =
      row.user_id === authData.user.id
        ? (
            (hasLikelyFullName(profileName) ? profileName : null) ??
            (hasLikelyFullName(currentUserFallbackName) ? currentUserFallbackName : null) ??
            profileName ??
            currentUserFallbackName ??
            fallbackForAnyUser
          ).trim()
        : (profileName ?? fallbackForAnyUser).trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    names.push(value);
  });

  return names;
}
