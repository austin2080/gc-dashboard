import { createClient } from "@/lib/supabase/client";
import { getBidProjectDetail } from "@/lib/bidding/store";
import type { BidTradeBid } from "@/lib/bidding/types";
import type {
  BidLevelingProjectData,
  LevelingBid,
  LevelingBidStatus,
  LevelingSnapshot,
  LevelingSnapshotItem,
  ProjectTradeBudget,
  TradeBidAlternate,
  TradeBidItem,
} from "@/lib/bidding/leveling-types";

function mapLegacyStatusToLeveling(status: BidTradeBid["status"]): LevelingBidStatus {
  if (status === "ghosted") return "no_response";
  return status;
}

function mapLevelingStatusToLegacy(status: LevelingBidStatus): BidTradeBid["status"] {
  if (status === "no_response") return "ghosted";
  return status;
}

function isMissingTableError(error: { code?: string | null } | null): boolean {
  return error?.code === "42P01";
}

function isOptionalLevelingTableError(
  error:
    | {
        code?: string | null;
        message?: string | null;
        details?: string | null;
        hint?: string | null;
      }
    | null
    | undefined
): boolean {
  if (!error) return false;
  if (!error.code && !error.message && !error.details && !error.hint) return true;
  if (isMissingTableError(error)) return true;
  const text = [error.message, error.details, error.hint]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
  return (
    text.includes("does not exist") ||
    text.includes("could not find the table") ||
    text.includes("schema cache")
  );
}

export async function getBidLevelingProjectData(projectId: string): Promise<BidLevelingProjectData | null> {
  if (!projectId) return null;
  const detail = await getBidProjectDetail(projectId);
  if (!detail) return null;

  const supabase = createClient();
  const [budgetResult, tradeBidResult, snapshotsResult] = await Promise.all([
    supabase
      .from("project_trade_budget")
      .select("id, project_id, trade_id, budget_amount, budget_notes")
      .eq("project_id", projectId),
    supabase
      .from("trade_bid")
      .select("id, project_id, trade_id, sub_id, status, base_bid_amount, received_at, is_low, notes")
      .eq("project_id", projectId),
    supabase
      .from("leveling_snapshot")
      .select("id, project_id, created_by, created_at, title, locked")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
  ]);

  if (budgetResult.error && !isOptionalLevelingTableError(budgetResult.error)) {
    console.error("Failed to load project_trade_budget", budgetResult.error);
  }
  if (tradeBidResult.error && !isOptionalLevelingTableError(tradeBidResult.error)) {
    console.error("Failed to load trade_bid", tradeBidResult.error);
  }
  if (snapshotsResult.error && !isOptionalLevelingTableError(snapshotsResult.error)) {
    console.error("Failed to load leveling_snapshot", snapshotsResult.error);
  }

  const legacyRows = detail.tradeBids.map((row): LevelingBid => ({
    id: row.id,
    legacy_bid_id: row.id,
    project_id: row.project_id,
    trade_id: row.trade_id,
    sub_id: row.project_sub_id,
    status: mapLegacyStatusToLeveling(row.status),
    base_bid_amount: row.bid_amount,
    received_at: null,
    is_low: false,
    notes: row.notes,
  }));

  const byTradeSub = new Map<string, LevelingBid>();
  for (const row of legacyRows) {
    byTradeSub.set(`${row.trade_id}:${row.sub_id}`, row);
  }

  const tradeBidRows = (tradeBidResult.data ?? []) as Array<{
    id: string;
    project_id: string;
    trade_id: string;
    sub_id: string;
    status: LevelingBidStatus;
    base_bid_amount: number | null;
    received_at: string | null;
    is_low: boolean | null;
    notes: string | null;
  }>;

  for (const row of tradeBidRows) {
    const key = `${row.trade_id}:${row.sub_id}`;
    const existing = byTradeSub.get(key);
    byTradeSub.set(key, {
      id: row.id,
      legacy_bid_id: existing?.legacy_bid_id ?? null,
      project_id: row.project_id,
      trade_id: row.trade_id,
      sub_id: row.sub_id,
      status: row.status,
      base_bid_amount: row.base_bid_amount,
      received_at: row.received_at,
      is_low: row.is_low ?? false,
      notes: row.notes,
    });
  }

  return {
    project: detail.project,
    trades: detail.trades,
    projectSubs: detail.projectSubs,
    bids: Array.from(byTradeSub.values()),
    budgets: (budgetResult.data ?? []) as ProjectTradeBudget[],
    snapshots: (snapshotsResult.data ?? []) as LevelingSnapshot[],
  };
}

export async function upsertProjectTradeBudget(payload: {
  projectId: string;
  tradeId: string;
  budgetAmount: number | null;
  budgetNotes: string | null;
}): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("project_trade_budget").upsert(
    {
      project_id: payload.projectId,
      trade_id: payload.tradeId,
      budget_amount: payload.budgetAmount,
      budget_notes: payload.budgetNotes,
    },
    { onConflict: "project_id,trade_id" }
  );

  if (error) {
    console.error("Failed to upsert project_trade_budget", error);
    return false;
  }
  return true;
}

async function recalcTradeLowFlags(projectId: string, tradeId: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("trade_bid")
    .select("id, base_bid_amount, status")
    .eq("project_id", projectId)
    .eq("trade_id", tradeId);

  if (error) {
    if (!isOptionalLevelingTableError(error)) {
      console.error("Failed to calculate low bid flags", error);
    }
    return;
  }

  const submitted = ((data ?? []) as Array<{ id: string; base_bid_amount: number | null; status: LevelingBidStatus }>)
    .filter((row) => row.status === "submitted" && row.base_bid_amount !== null)
    .map((row) => ({ id: row.id, amount: row.base_bid_amount as number }));
  const lowAmount = submitted.length ? Math.min(...submitted.map((row) => row.amount)) : null;

  const updates = (data ?? []) as Array<{ id: string; base_bid_amount: number | null; status: LevelingBidStatus }>;
  await Promise.all(
    updates.map((row) =>
      supabase
        .from("trade_bid")
        .update({
          is_low:
            lowAmount !== null &&
            row.status === "submitted" &&
            row.base_bid_amount !== null &&
            Number(row.base_bid_amount) === lowAmount,
        })
        .eq("id", row.id)
    )
  );
}

export async function upsertTradeBid(payload: {
  projectId: string;
  tradeId: string;
  subId: string;
  legacyBidId?: string | null;
  status: LevelingBidStatus;
  baseBidAmount: number | null;
  notes: string | null;
  receivedAt: string | null;
}): Promise<boolean> {
  const supabase = createClient();

  const { error: enhancedError } = await supabase.from("trade_bid").upsert(
    {
      project_id: payload.projectId,
      trade_id: payload.tradeId,
      sub_id: payload.subId,
      status: payload.status,
      base_bid_amount: payload.baseBidAmount,
      notes: payload.notes,
      received_at: payload.receivedAt,
    },
    { onConflict: "project_id,trade_id,sub_id" }
  );

  if (enhancedError && !isOptionalLevelingTableError(enhancedError)) {
    console.error("Failed to upsert trade_bid", enhancedError);
    return false;
  }

  const legacyPayload = {
    status: mapLevelingStatusToLegacy(payload.status),
    bid_amount: payload.baseBidAmount,
    notes: payload.notes,
  };

  if (payload.legacyBidId) {
    const { error } = await supabase.from("bid_trade_bids").update(legacyPayload).eq("id", payload.legacyBidId);
    if (error) {
      console.error("Failed to update bid_trade_bids", error);
      return false;
    }
  } else {
    const { error } = await supabase.from("bid_trade_bids").insert({
      project_id: payload.projectId,
      trade_id: payload.tradeId,
      project_sub_id: payload.subId,
      ...legacyPayload,
    });
    if (error) {
      console.error("Failed to insert bid_trade_bids", error);
      return false;
    }
  }

  await recalcTradeLowFlags(payload.projectId, payload.tradeId);
  return true;
}

export async function removeTradeBid(payload: {
  projectId: string;
  tradeId: string;
  subId: string;
  bidId?: string | null;
  relatedProjectSubIds?: string[];
  subcontractorId?: string | null;
  legacyBidId?: string | null;
}): Promise<boolean> {
  const supabase = createClient();
  let relatedProjectSubIds = Array.from(
    new Set((payload.relatedProjectSubIds ?? []).filter((value) => Boolean(value && value.trim())))
  );
  const candidateBidIds = new Set<string>();
  if (payload.bidId) candidateBidIds.add(payload.bidId);

  if (relatedProjectSubIds.length === 0 && payload.subcontractorId) {
    const { data: relatedRows, error: relatedRowsError } = await supabase
      .from("bid_project_subs")
      .select("id")
      .eq("project_id", payload.projectId)
      .eq("subcontractor_id", payload.subcontractorId);
    if (relatedRowsError) {
      console.error("Failed to load related project subs for delete", relatedRowsError);
      return false;
    }
    relatedProjectSubIds = Array.from(
      new Set((relatedRows ?? []).map((row) => String(row.id ?? "")).filter(Boolean))
    );
  }

  const candidateSubIds = Array.from(
    new Set(
      [payload.subId, payload.subcontractorId ?? null, ...relatedProjectSubIds]
        .filter((value): value is string => Boolean(value && value.trim()))
    )
  );

  if (candidateSubIds.length > 0) {
    const { data: matchedTradeBids, error: matchedTradeBidsError } = await supabase
      .from("trade_bid")
      .select("id")
      .eq("project_id", payload.projectId)
      .eq("trade_id", payload.tradeId)
      .in("sub_id", candidateSubIds);
    if (matchedTradeBidsError && !isOptionalLevelingTableError(matchedTradeBidsError)) {
      console.error("Failed to load trade_bid ids before delete", matchedTradeBidsError);
      return false;
    }
    for (const row of (matchedTradeBids ?? []) as Array<{ id: string }>) {
      candidateBidIds.add(row.id);
    }
  }

  const bidIds = Array.from(candidateBidIds);
  if (bidIds.length > 0) {
    const { error: deleteItemsError } = await supabase
      .from("trade_bid_items")
      .delete()
      .in("bid_id", bidIds);
    if (deleteItemsError && !isOptionalLevelingTableError(deleteItemsError)) {
      console.error("Failed to remove trade_bid_items", deleteItemsError);
      return false;
    }

    const { error: deleteAlternatesError } = await supabase
      .from("trade_bid_alternates")
      .delete()
      .in("bid_id", bidIds);
    if (deleteAlternatesError && !isOptionalLevelingTableError(deleteAlternatesError)) {
      console.error("Failed to remove trade_bid_alternates", deleteAlternatesError);
      return false;
    }

    const { error: deleteByIdsError } = await supabase
      .from("trade_bid")
      .delete()
      .in("id", bidIds);
    if (deleteByIdsError && !isOptionalLevelingTableError(deleteByIdsError)) {
      console.error("Failed to remove trade_bid rows by id", deleteByIdsError);
      return false;
    }
  }

  const { error: enhancedError } = await supabase
    .from("trade_bid")
    .delete()
    .eq("project_id", payload.projectId)
    .eq("trade_id", payload.tradeId)
    .eq("sub_id", payload.subId);

  if (enhancedError && !isOptionalLevelingTableError(enhancedError)) {
    console.error("Failed to remove trade_bid", enhancedError);
    return false;
  }

  if (relatedProjectSubIds.length > 0) {
    const { error: enhancedRelatedError } = await supabase
      .from("trade_bid")
      .delete()
      .eq("project_id", payload.projectId)
      .eq("trade_id", payload.tradeId)
      .in("sub_id", relatedProjectSubIds);
    if (enhancedRelatedError && !isOptionalLevelingTableError(enhancedRelatedError)) {
      console.error("Failed to remove related trade_bid rows", enhancedRelatedError);
      return false;
    }
  }

  if (payload.subcontractorId) {
    const { error: enhancedSubcontractorError } = await supabase
      .from("trade_bid")
      .delete()
      .eq("project_id", payload.projectId)
      .eq("trade_id", payload.tradeId)
      .eq("sub_id", payload.subcontractorId);
    if (enhancedSubcontractorError && !isOptionalLevelingTableError(enhancedSubcontractorError)) {
      console.error("Failed to remove subcontractor trade_bid rows", enhancedSubcontractorError);
      return false;
    }
  }

  if (payload.legacyBidId) {
    const { error } = await supabase.from("bid_trade_bids").delete().eq("id", payload.legacyBidId);
    if (error) {
      console.error("Failed to delete bid_trade_bids by id", error);
      return false;
    }
  } else {
    const { error } = await supabase
      .from("bid_trade_bids")
      .delete()
      .eq("project_id", payload.projectId)
      .eq("trade_id", payload.tradeId)
      .eq("project_sub_id", payload.subId);
    if (error) {
      console.error("Failed to delete bid_trade_bids by trade+sub", error);
      return false;
    }
  }

  if (relatedProjectSubIds.length > 0) {
    const { error: legacyRelatedError } = await supabase
      .from("bid_trade_bids")
      .delete()
      .eq("project_id", payload.projectId)
      .eq("trade_id", payload.tradeId)
      .in("project_sub_id", relatedProjectSubIds);
    if (legacyRelatedError) {
      console.error("Failed to delete related bid_trade_bids rows", legacyRelatedError);
      return false;
    }
  }

  await recalcTradeLowFlags(payload.projectId, payload.tradeId);
  return true;
}

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function createLevelingSnapshot(payload: {
  projectId: string;
  createdBy: string | null;
  title: string;
  items: Array<{
    trade_id: string;
    sub_id: string;
    base_bid_amount: number | null;
    notes: string | null;
    included_json: Record<string, unknown> | null;
    line_items_json: Record<string, unknown> | null;
  }>;
}): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("leveling_snapshot")
    .insert({
      project_id: payload.projectId,
      created_by: payload.createdBy,
      title: payload.title,
      locked: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to create leveling snapshot", error);
    return false;
  }

  const snapshotId = (data as { id: string }).id;
  if (payload.items.length) {
    const { error: itemsError } = await supabase.from("leveling_snapshot_items").insert(
      payload.items.map((item) => ({
        snapshot_id: snapshotId,
        trade_id: item.trade_id,
        sub_id: item.sub_id,
        base_bid_amount: item.base_bid_amount,
        notes: item.notes,
        included_json: item.included_json,
        line_items_json: item.line_items_json,
      }))
    );

    if (itemsError) {
      console.error("Failed to create leveling snapshot items", itemsError);
      return false;
    }
  }

  return true;
}

export async function getSnapshotItems(snapshotId: string): Promise<LevelingSnapshotItem[]> {
  if (!snapshotId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("leveling_snapshot_items")
    .select("id, snapshot_id, trade_id, sub_id, base_bid_amount, notes, included_json, line_items_json")
    .eq("snapshot_id", snapshotId);

  if (error) {
    console.error("Failed to load leveling snapshot items", error);
    return [];
  }

  return (data ?? []) as LevelingSnapshotItem[];
}

export async function getTradeBidBreakdownByTradeSub(payload: {
  projectId: string;
  tradeId: string;
  subId: string;
}): Promise<{
  bidId: string | null;
  baseItems: TradeBidItem[];
  alternates: TradeBidAlternate[];
}> {
  const supabase = createClient();
  const { data: bidRow, error: bidError } = await supabase
    .from("trade_bid")
    .select("id")
    .eq("project_id", payload.projectId)
    .eq("trade_id", payload.tradeId)
    .eq("sub_id", payload.subId)
    .maybeSingle();

  if (bidError) {
    if (!isOptionalLevelingTableError(bidError)) {
      console.error("Failed to find trade_bid for breakdown", bidError);
    }
    return { bidId: null, baseItems: [], alternates: [] };
  }

  const bidId = (bidRow as { id: string } | null)?.id ?? null;
  if (!bidId) return { bidId: null, baseItems: [], alternates: [] };

  const [itemsResult, alternatesResult] = await Promise.all([
    supabase
      .from("trade_bid_items")
      .select("id, bid_id, kind, description, qty, unit, unit_price, amount_override, notes, sort_order")
      .eq("bid_id", bidId)
      .eq("kind", "base")
      .order("sort_order", { ascending: true }),
    supabase
      .from("trade_bid_alternates")
      .select("id, bid_id, title, accepted, amount, notes, sort_order")
      .eq("bid_id", bidId)
      .order("sort_order", { ascending: true }),
  ]);

  if (itemsResult.error && !isOptionalLevelingTableError(itemsResult.error)) {
    console.error("Failed to load trade_bid_items", itemsResult.error);
  }
  if (alternatesResult.error && !isOptionalLevelingTableError(alternatesResult.error)) {
    console.error("Failed to load trade_bid_alternates", alternatesResult.error);
  }

  return {
    bidId,
    baseItems: (itemsResult.data ?? []) as TradeBidItem[],
    alternates: (alternatesResult.data ?? []) as TradeBidAlternate[],
  };
}

export async function saveTradeBidBreakdownByTradeSub(payload: {
  projectId: string;
  tradeId: string;
  subId: string;
  baseItems: Array<Omit<TradeBidItem, "bid_id" | "kind">>;
  alternates: Array<Omit<TradeBidAlternate, "bid_id">>;
}): Promise<boolean> {
  const supabase = createClient();
  const { data: bidRow, error: bidError } = await supabase
    .from("trade_bid")
    .select("id")
    .eq("project_id", payload.projectId)
    .eq("trade_id", payload.tradeId)
    .eq("sub_id", payload.subId)
    .maybeSingle();

  if (bidError) {
    if (!isOptionalLevelingTableError(bidError)) {
      console.error("Failed to find trade_bid before saving breakdown", bidError);
    }
    return true;
  }

  const bidId = (bidRow as { id: string } | null)?.id ?? null;
  if (!bidId) return true;

  const { data: existingItems } = await supabase.from("trade_bid_items").select("id").eq("bid_id", bidId).eq("kind", "base");
  const { data: existingAlternates } = await supabase.from("trade_bid_alternates").select("id").eq("bid_id", bidId);
  const existingItemIds = new Set(((existingItems ?? []) as Array<{ id: string }>).map((row) => row.id));
  const existingAlternateIds = new Set(((existingAlternates ?? []) as Array<{ id: string }>).map((row) => row.id));
  const nextItemIds = new Set(payload.baseItems.map((row) => row.id));
  const nextAlternateIds = new Set(payload.alternates.map((row) => row.id));

  const deletedItemIds = Array.from(existingItemIds).filter((id) => !nextItemIds.has(id));
  const deletedAlternateIds = Array.from(existingAlternateIds).filter((id) => !nextAlternateIds.has(id));

  if (deletedItemIds.length) {
    const { error } = await supabase.from("trade_bid_items").delete().in("id", deletedItemIds);
    if (error && !isOptionalLevelingTableError(error)) {
      console.error("Failed to delete removed trade_bid_items", error);
      return false;
    }
  }
  if (deletedAlternateIds.length) {
    const { error } = await supabase.from("trade_bid_alternates").delete().in("id", deletedAlternateIds);
    if (error && !isOptionalLevelingTableError(error)) {
      console.error("Failed to delete removed trade_bid_alternates", error);
      return false;
    }
  }

  if (payload.baseItems.length) {
    const { error } = await supabase.from("trade_bid_items").upsert(
      payload.baseItems.map((item, index) => ({
        id: item.id,
        bid_id: bidId,
        kind: "base",
        description: item.description,
        qty: item.qty,
        unit: item.unit,
        unit_price: item.unit_price,
        amount_override: item.amount_override,
        notes: item.notes,
        sort_order: item.sort_order ?? index + 1,
      })),
      { onConflict: "id" }
    );
    if (error && !isOptionalLevelingTableError(error)) {
      console.error("Failed to upsert trade_bid_items", error);
      return false;
    }
  }

  if (payload.alternates.length) {
    const { error } = await supabase.from("trade_bid_alternates").upsert(
      payload.alternates.map((alternate, index) => ({
        id: alternate.id,
        bid_id: bidId,
        title: alternate.title,
        accepted: alternate.accepted,
        amount: alternate.amount,
        notes: alternate.notes,
        sort_order: alternate.sort_order ?? index + 1,
      })),
      { onConflict: "id" }
    );
    if (error && !isOptionalLevelingTableError(error)) {
      console.error("Failed to upsert trade_bid_alternates", error);
      return false;
    }
  }

  return true;
}
