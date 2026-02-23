"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import LevelingFilterBar from "@/components/bid-leveling/LevelingFilterBar";
import LevelingGrid from "@/components/bid-leveling/LevelingGrid";
import BidDetailDrawer, {
  type BidDrawerDraft,
} from "@/components/bid-leveling/BidDetailDrawer";
import SnapshotModal from "@/components/bid-leveling/SnapshotModal";
import SnapshotBanner from "@/components/bid-leveling/SnapshotBanner";
import {
  createLevelingSnapshot,
  getBidLevelingProjectData,
  getCurrentUserId,
  getSnapshotItems,
  getTradeBidBreakdownByTradeSub,
  removeTradeBid,
  saveTradeBidBreakdownByTradeSub,
  upsertProjectTradeBudget,
  upsertTradeBid,
} from "@/lib/bidding/leveling-store";
import type { BidTrade, BidProjectSub } from "@/lib/bidding/types";
import type {
  BidAlternateDraft,
  BidBaseItemDraft,
  BidLevelingProjectData,
  LevelingBid,
  LevelingBidStatus,
  LevelingSnapshot,
  LevelingSnapshotItem,
  TradeBidAlternate,
  TradeBidItem,
} from "@/lib/bidding/leveling-types";
import { getBidProjectIdForProject } from "@/lib/bidding/project-links";
import {
  computeTradeStats,
  formatCurrency,
  formatPercent,
  parseMoney,
} from "@/components/bid-leveling/utils";
import { computeBaseItemsTotal } from "@/components/bid-leveling/BaseBidBuilder";

const EMPTY_DRAWER_DRAFT: BidDrawerDraft = {
  status: "invited",
  baseItems: [],
  alternates: [],
  inclusions: "",
  notes: "",
  receivedAt: "",
  recommended: false,
  compareSubId: "",
  scopeItems: [],
};

const INCLUSIONS_MARKER = "\n\n---INCLUSIONS---\n";

function splitBidNotes(raw: string | null): {
  notes: string;
  inclusions: string;
} {
  const value = raw ?? "";
  const inclusionsIndex = value.indexOf(INCLUSIONS_MARKER);
  if (inclusionsIndex === -1) {
    return { notes: value, inclusions: "" };
  }
  return {
    notes: value.slice(0, inclusionsIndex),
    inclusions: value.slice(inclusionsIndex + INCLUSIONS_MARKER.length),
  };
}

function mergeBidNotes(notes: string, inclusions: string): string | null {
  const notesTrimmed = notes.trim();
  const inclusionsTrimmed = inclusions.trim();
  const hasContent = notesTrimmed || inclusionsTrimmed;
  if (!hasContent) return null;
  if (!inclusionsTrimmed) return notesTrimmed || null;
  return `${notesTrimmed}${INCLUSIONS_MARKER}${inclusionsTrimmed}`.trim();
}

function toBaseItemDraft(row: TradeBidItem): BidBaseItemDraft {
  return {
    id: row.id,
    description: row.description ?? "",
    qty: row.qty !== null && row.qty !== undefined ? String(row.qty) : "",
    unit: row.unit,
    unitPrice:
      row.unit_price !== null && row.unit_price !== undefined
        ? String(row.unit_price)
        : "",
    amountOverride:
      row.amount_override !== null && row.amount_override !== undefined
        ? String(row.amount_override)
        : "",
    notes: row.notes ?? "",
    sortOrder: row.sort_order ?? 0,
  };
}

function toAlternateDraft(row: TradeBidAlternate): BidAlternateDraft {
  return {
    id: row.id,
    title: row.title ?? "",
    accepted: row.accepted,
    amount: String(row.amount ?? 0),
    notes: row.notes ?? "",
    sortOrder: row.sort_order ?? 0,
  };
}

function createFallbackBaseItem(baseBidAmount: number): BidBaseItemDraft {
  return {
    id: crypto.randomUUID(),
    description: "Base Bid",
    qty: "1",
    unit: "LS",
    unitPrice: String(baseBidAmount),
    amountOverride: "",
    notes: "",
    sortOrder: 1,
  };
}

type ActiveBidCell = {
  tradeId: string;
  subId: string;
};

type PendingRemoval = {
  bid: LevelingBid;
  subName: string;
};

type UndoToast = {
  bid: LevelingBid;
  subName: string;
};

function mapStatusForFilter(
  status: LevelingBidStatus,
): "missing" | "submitted" | "other" {
  if (status === "submitted") return "submitted";
  if (status === "invited" || status === "no_response") return "missing";
  return "other";
}

type QuickFilter =
  | "over_budget"
  | "no_bids"
  | "only_submitted"
  | "high_risk"
  | "two_plus_bids";

type LevelingFilterState = {
  search: string;
  statusFilter: "all" | "missing" | "lt2" | "submitted";
  riskOnly: boolean;
  sortBy: "division" | "alphabetic" | "risk" | "due_soon";
  quickFilters: QuickFilter[];
};

const DEFAULT_FILTER_STATE: LevelingFilterState = {
  search: "",
  statusFilter: "all",
  riskOnly: false,
  sortBy: "division",
  quickFilters: [],
};

const QUICK_FILTER_QUERY_KEY = "qf";
const FILTERS_QUERY_KEY = "filters";
const VIEW_NAME_QUERY_KEY = "view";
const LEVELING_VIEW_PRESETS_KEY = "bidLevelingViewPresets";
const LEVELING_LAST_FILTERS_KEY = "bidLevelingLastFilters";

function serializeFilterState(state: LevelingFilterState): string {
  return JSON.stringify(state);
}

function parseFilterState(raw: string | null): LevelingFilterState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LevelingFilterState>;
    return {
      search: typeof parsed.search === "string" ? parsed.search : DEFAULT_FILTER_STATE.search,
      statusFilter:
        parsed.statusFilter === "missing" ||
        parsed.statusFilter === "lt2" ||
        parsed.statusFilter === "submitted" ||
        parsed.statusFilter === "all"
          ? parsed.statusFilter
          : DEFAULT_FILTER_STATE.statusFilter,
      riskOnly: Boolean(parsed.riskOnly),
      sortBy:
        parsed.sortBy === "alphabetic" || parsed.sortBy === "risk" || parsed.sortBy === "due_soon" || parsed.sortBy === "division"
          ? parsed.sortBy
          : DEFAULT_FILTER_STATE.sortBy,
      quickFilters: Array.isArray(parsed.quickFilters)
        ? parsed.quickFilters.filter(
            (value): value is QuickFilter =>
              value === "over_budget" ||
              value === "no_bids" ||
              value === "only_submitted" ||
              value === "high_risk" ||
              value === "two_plus_bids",
          )
        : [],
    };
  } catch {
    return null;
  }
}

export default function LevelingPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const queryProjectId = searchParams.get("project");

  const [mappedBidProjectId, setMappedBidProjectId] = useState<string | null>(
    null,
  );
  const [resolvedBidProjectId, setResolvedBidProjectId] = useState<
    string | null
  >(null);
  const [data, setData] = useState<BidLevelingProjectData | null>(null);
  const [loading, setLoading] = useState(false);

  const [filterState, setFilterState] =
    useState<LevelingFilterState>(DEFAULT_FILTER_STATE);
  const [presetName, setPresetName] = useState("");
  const [savedViews, setSavedViews] = useState<Record<string, LevelingFilterState>>({});
  const [resolvedUserId, setResolvedUserId] = useState("anonymous");

  const [budgetsByTrade, setBudgetsByTrade] = useState<
    Map<string, { amount: number | null; notes: string | null }>
  >(new Map());
  const [dirtyBudgetTradeIds, setDirtyBudgetTradeIds] = useState<Set<string>>(
    new Set(),
  );
  const [savingBudgets, setSavingBudgets] = useState(false);

  const [activeBidCell, setActiveBidCell] = useState<ActiveBidCell | null>(
    null,
  );
  const [drawerDraft, setDrawerDraft] =
    useState<BidDrawerDraft>(EMPTY_DRAWER_DRAFT);
  const [drawerInitial, setDrawerInitial] = useState<string>(
    JSON.stringify(EMPTY_DRAWER_DRAFT),
  );
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [savingDrawer, setSavingDrawer] = useState(false);
  const drawerLoadKeyRef = useRef("");

  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [snapshotTitle, setSnapshotTitle] = useState("");
  const [snapshotNotes, setSnapshotNotes] = useState("");
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>("live");
  const [snapshotItems, setSnapshotItems] = useState<LevelingSnapshotItem[]>(
    [],
  );
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(
    null,
  );
  const [removingBid, setRemovingBid] = useState(false);
  const [undoToast, setUndoToast] = useState<UndoToast | null>(null);
  const [restoringBid, setRestoringBid] = useState(false);

  useEffect(() => {
    const refreshMappedProject = () => {
      setMappedBidProjectId(getBidProjectIdForProject(queryProjectId));
    };
    refreshMappedProject();
    window.addEventListener("storage", refreshMappedProject);
    return () => window.removeEventListener("storage", refreshMappedProject);
  }, [queryProjectId]);

  useEffect(() => {
    let active = true;
    async function loadUser() {
      const userId = await getCurrentUserId();
      if (!active) return;
      setResolvedUserId(userId || "anonymous");
    }
    void loadUser();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!queryProjectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilterState(DEFAULT_FILTER_STATE);
      return;
    }

    const fromQuery = parseFilterState(searchParams.get(FILTERS_QUERY_KEY));
    if (fromQuery) {
      setFilterState(fromQuery);
      return;
    }

    const storedRaw = localStorage.getItem(LEVELING_LAST_FILTERS_KEY);
    if (!storedRaw) {
      setFilterState(DEFAULT_FILTER_STATE);
      return;
    }

    try {
      const stored = JSON.parse(storedRaw) as Record<string, LevelingFilterState>;
      const key = `${queryProjectId}:${resolvedUserId}`;
      setFilterState(stored[key] ?? DEFAULT_FILTER_STATE);
    } catch {
      setFilterState(DEFAULT_FILTER_STATE);
    }
  }, [queryProjectId, resolvedUserId, searchParams]);

  useEffect(() => {
    const raw = localStorage.getItem(LEVELING_VIEW_PRESETS_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, LevelingFilterState>;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSavedViews(parsed);
    } catch {
      setSavedViews({});
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function loadData() {
      if (!queryProjectId) {
        setResolvedBidProjectId(null);
        setData(null);
        return;
      }
      setLoading(true);
      const candidates = [mappedBidProjectId, queryProjectId].filter(
        (id, index, all): id is string =>
          Boolean(id) && all.indexOf(id) === index,
      );
      let loaded: BidLevelingProjectData | null = null;
      let loadedId: string | null = null;
      for (const candidate of candidates) {
        const result = await getBidLevelingProjectData(candidate);
        if (result) {
          loaded = result;
          loadedId = candidate;
          break;
        }
      }
      if (!active) return;
      setData(loaded);
      setResolvedBidProjectId(loadedId);
      setLoading(false);
      setSelectedSnapshotId("live");
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [mappedBidProjectId, queryProjectId]);

  useEffect(() => {
    if (!data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBudgetsByTrade(new Map());
      return;
    }
    const next = new Map<
      string,
      { amount: number | null; notes: string | null }
    >();
    for (const trade of data.trades) {
      const row = data.budgets.find((budget) => budget.trade_id === trade.id);
      next.set(trade.id, {
        amount: row?.budget_amount ?? null,
        notes: row?.budget_notes ?? null,
      });
    }
    setBudgetsByTrade(next);
    setDirtyBudgetTradeIds(new Set());
  }, [data]);

  useEffect(() => {
    let active = true;
    async function loadSnapshotItems() {
      if (selectedSnapshotId === "live") {
        setSnapshotItems([]);
        return;
      }
      const rows = await getSnapshotItems(selectedSnapshotId);
      if (!active) return;
      setSnapshotItems(rows);
    }
    void loadSnapshotItems();
    return () => {
      active = false;
    };
  }, [selectedSnapshotId]);

  useEffect(() => {
    if (!undoToast) return;
    const timer = window.setTimeout(() => setUndoToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [undoToast]);

  const snapshotItemByTradeSub = useMemo(() => {
    const map = new Map<string, LevelingSnapshotItem>();
    for (const row of snapshotItems) {
      map.set(`${row.trade_id}:${row.sub_id}`, row);
    }
    return map;
  }, [snapshotItems]);

  const readOnlySnapshot = selectedSnapshotId !== "live";

  const bidsByTradeSub = useMemo(() => {
    const map = new Map<string, LevelingBid>();
    if (!data) return map;
    for (const row of data.bids) {
      map.set(`${row.trade_id}:${row.sub_id}`, row);
    }
    if (readOnlySnapshot) {
      for (const [key, item] of snapshotItemByTradeSub.entries()) {
        const live = map.get(key);
        if (live) {
          map.set(key, {
            ...live,
            base_bid_amount: item.base_bid_amount,
            notes: item.notes,
          });
        } else {
          const [tradeId, subId] = key.split(":");
          map.set(key, {
            id: `snapshot-${item.id}`,
            legacy_bid_id: null,
            project_id: data.project.id,
            trade_id: tradeId,
            sub_id: subId,
            status: "submitted",
            base_bid_amount: item.base_bid_amount,
            received_at: null,
            is_low: false,
            notes: item.notes,
          });
        }
      }
    }
    return map;
  }, [data, readOnlySnapshot, snapshotItemByTradeSub]);

  const subs = useMemo(() => {
    if (!data) return [];
    const bySubcontractor = new Set<string>();
    const deduped: BidProjectSub[] = [];
    for (const row of data.projectSubs) {
      const key = row.subcontractor_id;
      if (bySubcontractor.has(key)) continue;
      bySubcontractor.add(key);
      deduped.push(row);
    }
    return deduped;
  }, [data]);

  const bidsByTradeId = useMemo(() => {
    const map = new Map<string, LevelingBid[]>();
    if (!data) return map;
    for (const trade of data.trades) {
      map.set(trade.id, []);
    }
    for (const bid of bidsByTradeSub.values()) {
      const rows = map.get(bid.trade_id) ?? [];
      rows.push(bid);
      map.set(bid.trade_id, rows);
    }
    for (const [tradeId, rows] of map.entries()) {
      rows.sort((a, b) => {
        const aName =
          subs.find((sub) => sub.id === a.sub_id)?.subcontractor
            ?.company_name ?? "";
        const bName =
          subs.find((sub) => sub.id === b.sub_id)?.subcontractor
            ?.company_name ?? "";
        return aName.localeCompare(bName);
      });
      map.set(tradeId, rows);
    }
    return map;
  }, [bidsByTradeSub, data, subs]);

  const { search, statusFilter, riskOnly, sortBy, quickFilters } = filterState;

  const setPartialFilterState = (partial: Partial<LevelingFilterState>) => {
    setFilterState((prev) => ({ ...prev, ...partial }));
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count += 1;
    if (statusFilter !== "all") count += 1;
    if (riskOnly) count += 1;
    if (sortBy !== "division") count += 1;
    count += quickFilters.length;
    return count;
  }, [quickFilters, riskOnly, search, sortBy, statusFilter]);

  useEffect(() => {
    if (!queryProjectId) return;
    const key = `${queryProjectId}:${resolvedUserId}`;

    const existingRaw = localStorage.getItem(LEVELING_LAST_FILTERS_KEY);
    const existing = existingRaw ? (JSON.parse(existingRaw) as Record<string, LevelingFilterState>) : {};
    existing[key] = filterState;
    localStorage.setItem(LEVELING_LAST_FILTERS_KEY, JSON.stringify(existing));

    const currentSerialized = searchParams.get(FILTERS_QUERY_KEY);
    const nextSerialized = serializeFilterState(filterState);
    const currentQuick = searchParams.get(QUICK_FILTER_QUERY_KEY) ?? "";
    const nextQuick = quickFilters.join(",");
    if (currentSerialized === nextSerialized && currentQuick === nextQuick) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set(FILTERS_QUERY_KEY, nextSerialized);
    nextParams.set(QUICK_FILTER_QUERY_KEY, nextQuick);
    const nextUrl = `${pathname}?${nextParams.toString()}`;
    router.replace(nextUrl, { scroll: false });
  }, [filterState, pathname, queryProjectId, quickFilters, resolvedUserId, router, searchParams]);

  const filteredTrades = useMemo(() => {
    if (!data) return [];

    const tradeRiskScore = (trade: BidTrade): number => {
      const bids = bidsByTradeId.get(trade.id) ?? [];
      const stats = computeTradeStats(
        bids,
        budgetsByTrade.get(trade.id)?.amount ?? null,
      );
      const spreadRisk =
        stats.spreadPercent !== null && stats.spreadPercent > 10;
      const coverageRisk = stats.coverageCount < 2;
      return (spreadRisk ? 1 : 0) + (coverageRisk ? 1 : 0);
    };

    return [...data.trades]
      .filter((trade) =>
        trade.trade_name.toLowerCase().includes(search.trim().toLowerCase()),
      )
      .filter((trade) => {
        const bids = bidsByTradeId.get(trade.id) ?? [];

        if (statusFilter === "missing") {
          return (
            bids.some((bid) => mapStatusForFilter(bid.status) === "missing") ||
            bids.length === 0
          );
        }
        if (statusFilter === "submitted") {
          return bids.some(
            (bid) => mapStatusForFilter(bid.status) === "submitted",
          );
        }
        if (statusFilter === "lt2") {
          const submittedCount = bids.filter(
            (bid) => bid.status === "submitted" && bid.base_bid_amount !== null,
          ).length;
          return submittedCount < 2;
        }
        return true;
      })
      .filter((trade) => {
        if (!riskOnly) return true;
        return tradeRiskScore(trade) > 0;
      })
      .filter((trade) => {
        if (!quickFilters.length) return true;
        const bids = bidsByTradeId.get(trade.id) ?? [];
        const stats = computeTradeStats(
          bids,
          budgetsByTrade.get(trade.id)?.amount ?? null,
        );
        return quickFilters.every((filterKey) => {
          if (filterKey === "over_budget") {
            return stats.budgetDeltaAmount !== null && stats.budgetDeltaAmount > 0;
          }
          if (filterKey === "no_bids") {
            return stats.coverageCount === 0;
          }
          if (filterKey === "only_submitted") {
            return bids.length > 0 && bids.every((bid) => bid.status === "submitted");
          }
          if (filterKey === "high_risk") {
            return tradeRiskScore(trade) >= 2;
          }
          if (filterKey === "two_plus_bids") {
            return stats.coverageCount >= 2;
          }
          return true;
        });
      })
      .sort((a, b) => {
        if (sortBy === "alphabetic")
          return a.trade_name.localeCompare(b.trade_name);
        if (sortBy === "risk") return tradeRiskScore(b) - tradeRiskScore(a);
        return (
          (a.sort_order ?? Number.MAX_SAFE_INTEGER) -
          (b.sort_order ?? Number.MAX_SAFE_INTEGER)
        );
      });
  }, [
    bidsByTradeId,
    budgetsByTrade,
    data,
    riskOnly,
    search,
    sortBy,
    statusFilter,
    quickFilters,
  ]);

  const tradeSummaryMetrics = useMemo(() => {
    if (!data) {
      return {
        totalTrades: 0,
        tradesWithBids: 0,
        overBudgetTrades: 0,
        avgSpreadPercent: null as number | null,
        highRiskTrades: 0,
        exceptions: [] as Array<{
          tradeId: string;
          tradeName: string;
          reason: string;
          severity: number;
        }>,
      };
    }

    const spreads: number[] = [];
    let tradesWithBids = 0;
    let overBudgetTrades = 0;
    let highRiskTrades = 0;
    const exceptions: Array<{
      tradeId: string;
      tradeName: string;
      reason: string;
      severity: number;
    }> = [];

    for (const trade of filteredTrades) {
      const bids = bidsByTradeId.get(trade.id) ?? [];
      const stats = computeTradeStats(
        bids,
        budgetsByTrade.get(trade.id)?.amount ?? null,
      );
      const isOverBudget =
        stats.budgetDeltaAmount !== null && stats.budgetDeltaAmount > 0;
      const coverageRisk = stats.coverageCount < 2;
      const spreadRisk =
        stats.spreadPercent !== null && stats.spreadPercent > 10;
      const riskScore = Number(coverageRisk) + Number(spreadRisk);

      if (stats.coverageCount > 0) tradesWithBids += 1;
      if (isOverBudget) overBudgetTrades += 1;
      if (riskScore >= 2) highRiskTrades += 1;
      if (stats.spreadPercent !== null) spreads.push(stats.spreadPercent);

      if (riskScore === 0 && !isOverBudget) continue;

      const reason = isOverBudget
        ? `Over budget by ${formatCurrency(stats.budgetDeltaAmount)}`
        : spreadRisk
          ? `Wide spread (${formatPercent(stats.spreadPercent)})`
          : `Low coverage (${stats.coverageCount} bid${stats.coverageCount === 1 ? "" : "s"})`;
      const severity = (isOverBudget ? 2 : 0) + riskScore;
      exceptions.push({
        tradeId: trade.id,
        tradeName: trade.trade_name,
        reason,
        severity,
      });
    }

    const avgSpreadPercent =
      spreads.length > 0
        ? spreads.reduce((sum, value) => sum + value, 0) / spreads.length
        : null;

    return {
      totalTrades: filteredTrades.length,
      tradesWithBids,
      overBudgetTrades,
      avgSpreadPercent,
      highRiskTrades,
      exceptions: exceptions
        .sort((a, b) => b.severity - a.severity || a.tradeName.localeCompare(b.tradeName))
        .slice(0, 5),
    };
  }, [bidsByTradeId, budgetsByTrade, data, filteredTrades]);

  const applySummaryFilter = (key: "all" | "with_bids" | "over_budget" | "spread" | "high_risk") => {
    if (key === "all") {
      setFilterState((prev) => ({
        ...DEFAULT_FILTER_STATE,
        sortBy: prev.sortBy,
      }));
      return;
    }

    if (key === "with_bids") {
      setFilterState((prev) => ({
        ...prev,
        statusFilter: "submitted",
      }));
      return;
    }

    if (key === "over_budget") {
      setFilterState((prev) => ({
        ...prev,
        quickFilters: prev.quickFilters.includes("over_budget")
          ? prev.quickFilters
          : [...prev.quickFilters, "over_budget"],
      }));
      return;
    }

    if (key === "spread") {
      setFilterState((prev) => ({
        ...prev,
        sortBy: "risk",
      }));
      return;
    }

    setFilterState((prev) => ({
      ...prev,
      riskOnly: true,
      quickFilters: prev.quickFilters.includes("high_risk")
        ? prev.quickFilters
        : [...prev.quickFilters, "high_risk"],
      sortBy: "risk",
    }));
  };

  const activeSnapshot = useMemo<LevelingSnapshot | null>(() => {
    if (!data || selectedSnapshotId === "live") return null;
    return data.snapshots.find((row) => row.id === selectedSnapshotId) ?? null;
  }, [data, selectedSnapshotId]);

  const lastUpdatedAt = useMemo(() => {
    if (!data) return null;
    if (selectedSnapshotId !== "live") {
      return activeSnapshot?.created_at ?? null;
    }

    const latestReceived = data.bids
      .map((row) => row.received_at)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    return latestReceived ?? null;
  }, [activeSnapshot, data, selectedSnapshotId]);

  const activeBid = useMemo<LevelingBid | null>(() => {
    if (!activeBidCell) return null;
    return (
      bidsByTradeSub.get(`${activeBidCell.tradeId}:${activeBidCell.subId}`) ??
      null
    );
  }, [activeBidCell, bidsByTradeSub]);

  const activeTrade = useMemo<BidTrade | null>(() => {
    if (!activeBidCell || !data) return null;
    return data.trades.find((row) => row.id === activeBidCell.tradeId) ?? null;
  }, [activeBidCell, data]);

  const activeSub = useMemo<BidProjectSub | null>(() => {
    if (!activeBidCell || !data) return null;
    return (
      data.projectSubs.find((row) => row.id === activeBidCell.subId) ?? null
    );
  }, [activeBidCell, data]);

  const compareBid = useMemo(() => {
    if (!activeTrade || !drawerDraft.compareSubId) return null;
    return (
      bidsByTradeSub.get(`${activeTrade.id}:${drawerDraft.compareSubId}`) ??
      null
    );
  }, [activeTrade, bidsByTradeSub, drawerDraft.compareSubId]);

  const drawerDirty = JSON.stringify(drawerDraft) !== drawerInitial;
  const hasUnsavedChanges = drawerDirty || dirtyBudgetTradeIds.size > 0;

  const openBidDrawer = async (payload: { tradeId: string; subId: string }) => {
    if (!data) return;
    setActiveBidCell(payload);
    const loadKey = `${payload.tradeId}:${payload.subId}:${Date.now()}`;
    drawerLoadKeyRef.current = loadKey;
    const bid =
      bidsByTradeSub.get(`${payload.tradeId}:${payload.subId}`) ?? null;
    const parsedNotes = splitBidNotes(bid?.notes ?? null);
    const nextDraft: BidDrawerDraft = {
      status: bid?.status ?? "invited",
      baseItems:
        bid?.base_bid_amount !== null && bid?.base_bid_amount !== undefined
          ? [createFallbackBaseItem(bid.base_bid_amount)]
          : [],
      alternates: [],
      inclusions: parsedNotes.inclusions,
      notes: parsedNotes.notes,
      receivedAt: bid?.received_at ? bid.received_at.slice(0, 10) : "",
      recommended: false,
      compareSubId: "",
      scopeItems: [],
    };
    setDrawerDraft(nextDraft);
    setDrawerInitial(JSON.stringify(nextDraft));
    setDrawerError(null);

    const breakdown = await getTradeBidBreakdownByTradeSub({
      projectId: data.project.id,
      tradeId: payload.tradeId,
      subId: payload.subId,
    });
    if (drawerLoadKeyRef.current !== loadKey) return;

    const baseItems = breakdown.baseItems.map(toBaseItemDraft);
    const alternates = breakdown.alternates.map(toAlternateDraft);
    const mergedDraft: BidDrawerDraft = {
      ...nextDraft,
      baseItems:
        baseItems.length > 0
          ? baseItems
          : bid?.base_bid_amount !== null && bid?.base_bid_amount !== undefined
            ? [createFallbackBaseItem(bid.base_bid_amount)]
            : [],
      alternates,
    };
    setDrawerDraft(mergedDraft);
    setDrawerInitial(JSON.stringify(mergedDraft));
  };

  const saveDirtyBudgets = async (): Promise<boolean> => {
    if (!data || !dirtyBudgetTradeIds.size || readOnlySnapshot) return true;
    setSavingBudgets(true);
    for (const tradeId of dirtyBudgetTradeIds) {
      const budget = budgetsByTrade.get(tradeId) ?? {
        amount: null,
        notes: null,
      };
      const ok = await upsertProjectTradeBudget({
        projectId: data.project.id,
        tradeId,
        budgetAmount: budget.amount,
        budgetNotes: budget.notes,
      });
      if (!ok) {
        setSavingBudgets(false);
        return false;
      }
    }
    setDirtyBudgetTradeIds(new Set());
    setSavingBudgets(false);
    return true;
  };

  const saveDrawer = async (): Promise<boolean> => {
    if (!data || !activeBidCell || readOnlySnapshot || !drawerDirty)
      return true;
    setSavingDrawer(true);
    setDrawerError(null);
    const amount = computeBaseItemsTotal(drawerDraft.baseItems);

    const receivedAt =
      drawerDraft.receivedAt || drawerDraft.status === "submitted"
        ? drawerDraft.receivedAt || new Date().toISOString().slice(0, 10)
        : null;

    const ok = await upsertTradeBid({
      projectId: data.project.id,
      tradeId: activeBidCell.tradeId,
      subId: activeBidCell.subId,
      legacyBidId: activeBid?.legacy_bid_id ?? null,
      status: drawerDraft.status,
      baseBidAmount: amount,
      notes: mergeBidNotes(drawerDraft.notes, drawerDraft.inclusions),
      receivedAt,
    });

    if (!ok) {
      setDrawerError("Unable to save bid details.");
      setSavingDrawer(false);
      return false;
    }

    const breakdownSaved = await saveTradeBidBreakdownByTradeSub({
      projectId: data.project.id,
      tradeId: activeBidCell.tradeId,
      subId: activeBidCell.subId,
      baseItems: drawerDraft.baseItems.map((item, index) => ({
        id: item.id,
        description: item.description.trim(),
        qty: item.qty.trim() ? Number(item.qty) : null,
        unit: item.unit,
        unit_price: parseMoney(item.unitPrice),
        amount_override: parseMoney(item.amountOverride),
        notes: item.notes.trim() || null,
        sort_order: index + 1,
      })),
      alternates: drawerDraft.alternates.map((alternate, index) => ({
        id: alternate.id,
        title: alternate.title.trim(),
        accepted: alternate.accepted,
        amount: parseMoney(alternate.amount) ?? 0,
        notes: alternate.notes.trim() || null,
        sort_order: index + 1,
      })),
    });
    if (!breakdownSaved) {
      setDrawerError("Unable to save bid breakdown.");
      setSavingDrawer(false);
      return false;
    }

    const refreshed = await getBidLevelingProjectData(data.project.id);
    if (refreshed) {
      setData(refreshed);
    }
    setDrawerInitial(JSON.stringify(drawerDraft));
    setSavingDrawer(false);
    return true;
  };

  const exportCsv = () => {
    if (!data) return;
    const columns = [
      "Trade",
      "Budget",
      ...subs.map((sub) => sub.subcontractor?.company_name ?? "Sub"),
      "Low",
      "Spread",
      "Notes",
    ];
    const rows = filteredTrades.map((trade) => {
      const budget = budgetsByTrade.get(trade.id)?.amount ?? null;
      const bids = subs.map(
        (sub) => bidsByTradeSub.get(`${trade.id}:${sub.id}`) ?? null,
      );
      const stats = computeTradeStats(
        bids.filter((bid): bid is LevelingBid => Boolean(bid)),
        budget,
      );
      return [
        trade.trade_name,
        budget !== null ? String(budget) : "",
        ...bids.map((bid) =>
          bid?.base_bid_amount !== null && bid?.base_bid_amount !== undefined
            ? String(bid.base_bid_amount)
            : "",
        ),
        stats.low !== null ? String(stats.low) : "",
        stats.spreadAmount !== null ? String(stats.spreadAmount) : "",
        "",
      ];
    });
    const csv = [columns, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${data.project.project_name.replace(/\s+/g, "-").toLowerCase()}-leveling.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!queryProjectId) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-6 text-sm text-slate-500 shadow-sm">
        Select a project to view bid leveling.
      </section>
    );
  }

  if (!loading && resolvedBidProjectId === null) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-600 shadow-sm">
        No bid package is linked to this selected project yet.
      </section>
    );
  }

  if (loading || !data) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-500 shadow-sm">
        Loading leveling data...
      </section>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Bid Leveling
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {data.project.project_name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">
              Last updated {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : "--"}
            </span>
            <select
              value={selectedSnapshotId}
              onChange={(event) => setSelectedSnapshotId(event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              <option value="live">Live View</option>
              {data.snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  {snapshot.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={readOnlySnapshot}
              onClick={() => {
                setSnapshotTitle(
                  `Leveling Snapshot ${new Date().toLocaleDateString()}`,
                );
                setSnapshotNotes("");
                setSnapshotModalOpen(true);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              Create Snapshot
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() =>
                window.alert("Snapshot PDF export is planned for phase 2.")
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              Snapshot PDF (Soon)
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <button
            type="button"
            onClick={() => applySummaryFilter("all")}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:border-slate-300 hover:bg-slate-100"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total trades</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{tradeSummaryMetrics.totalTrades}</p>
          </button>
          <button
            type="button"
            onClick={() => applySummaryFilter("with_bids")}
            className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trades with bids</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{tradeSummaryMetrics.tradesWithBids}</p>
          </button>
          <button
            type="button"
            onClick={() => applySummaryFilter("over_budget")}
            className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trades over budget</p>
            <p className="mt-1 text-xl font-semibold text-rose-700">{tradeSummaryMetrics.overBudgetTrades}</p>
          </button>
          <button
            type="button"
            onClick={() => applySummaryFilter("spread")}
            className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avg spread</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatPercent(tradeSummaryMetrics.avgSpreadPercent)}</p>
          </button>
          <button
            type="button"
            onClick={() => applySummaryFilter("high_risk")}
            className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">High-risk trades</p>
            <p className="mt-1 text-xl font-semibold text-amber-700">{tradeSummaryMetrics.highRiskTrades}</p>
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <h2 className="text-sm font-semibold text-slate-800">Exceptions</h2>
          {tradeSummaryMetrics.exceptions.length ? (
            <ul className="mt-2 space-y-1.5 text-sm">
              {tradeSummaryMetrics.exceptions.map((item) => (
                <li key={item.tradeId}>
                  <button
                    type="button"
                    onClick={() => setPartialFilterState({ search: item.tradeName })}
                    className="text-left text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                  >
                    {item.tradeName} · {item.reason}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No exceptions for the current dataset selection.</p>
          )}
        </div>
      </section>

      {activeSnapshot ? (
        <SnapshotBanner
          title={activeSnapshot.title}
          createdAt={activeSnapshot.created_at}
          onExit={() => setSelectedSnapshotId("live")}
        />
      ) : null}

      <LevelingFilterBar
        search={search}
        statusFilter={statusFilter}
        riskOnly={riskOnly}
        sortBy={sortBy}
        quickFilters={quickFilters}
        activeFilterCount={activeFilterCount}
        presetName={presetName}
        savedViews={Object.keys(savedViews).sort((a, b) => a.localeCompare(b))}
        onSearchChange={(value) => setPartialFilterState({ search: value })}
        onStatusFilterChange={(value) =>
          setPartialFilterState({ statusFilter: value })
        }
        onRiskOnlyChange={(value) => setPartialFilterState({ riskOnly: value })}
        onSortByChange={(value) => setPartialFilterState({ sortBy: value })}
        onToggleQuickFilter={(value) =>
          setFilterState((prev) => ({
            ...prev,
            quickFilters: prev.quickFilters.includes(value)
              ? prev.quickFilters.filter((item) => item !== value)
              : [...prev.quickFilters, value],
          }))
        }
        onClearAll={() => setFilterState(DEFAULT_FILTER_STATE)}
        onPresetNameChange={setPresetName}
        onSaveView={() => {
          const trimmed = presetName.trim();
          if (!trimmed) return;
          setSavedViews((prev) => {
            const next = { ...prev, [trimmed]: filterState };
            localStorage.setItem(LEVELING_VIEW_PRESETS_KEY, JSON.stringify(next));
            return next;
          });
          const nextParams = new URLSearchParams(searchParams.toString());
          nextParams.set(VIEW_NAME_QUERY_KEY, trimmed);
          router.replace(`${pathname}?${nextParams.toString()}`, {
            scroll: false,
          });
          setPresetName("");
        }}
        onRestoreView={(name) => {
          const next = savedViews[name];
          if (!next) return;
          setFilterState(next);
          const nextParams = new URLSearchParams(searchParams.toString());
          nextParams.set(VIEW_NAME_QUERY_KEY, name);
          router.replace(`${pathname}?${nextParams.toString()}`, {
            scroll: false,
          });
        }}
      />

      <LevelingGrid
        trades={filteredTrades}
        allSubs={subs}
        bidsByTradeId={bidsByTradeId}
        budgetsByTrade={budgetsByTrade}
        readOnly={readOnlySnapshot}
        onBudgetChange={({ tradeId, value, notes }) => {
          if (readOnlySnapshot) return;
          setBudgetsByTrade((prev) => {
            const next = new Map(prev);
            next.set(tradeId, { amount: value, notes });
            return next;
          });
          setDirtyBudgetTradeIds((prev) => {
            const next = new Set(prev);
            next.add(tradeId);
            return next;
          });
        }}
        onOpenBid={openBidDrawer}
        onStatusChange={async ({ bid, status }) => {
          if (!data || readOnlySnapshot) return;
          const receivedAt =
            status === "submitted"
              ? bid.received_at || new Date().toISOString().slice(0, 10)
              : bid.received_at;
          const ok = await upsertTradeBid({
            projectId: data.project.id,
            tradeId: bid.trade_id,
            subId: bid.sub_id,
            legacyBidId: bid.legacy_bid_id ?? null,
            status,
            baseBidAmount: bid.base_bid_amount,
            notes: bid.notes ?? null,
            receivedAt,
          });
          if (!ok) return;
          const refreshed = await getBidLevelingProjectData(data.project.id);
          if (refreshed) setData(refreshed);
        }}
        onRemoveBid={({ bid }) => {
          if (readOnlySnapshot) return;
          const subName =
            subs.find((row) => row.id === bid.sub_id)?.subcontractor
              ?.company_name ?? "Unknown sub";
          setPendingRemoval({ bid, subName });
        }}
        onAddSub={async ({ tradeId, subId }) => {
          if (!data || readOnlySnapshot) return;
          const existing = bidsByTradeSub.get(`${tradeId}:${subId}`) ?? null;
          if (existing) return;
          const ok = await upsertTradeBid({
            projectId: data.project.id,
            tradeId,
            subId,
            legacyBidId: null,
            status: "invited",
            baseBidAmount: null,
            notes: null,
            receivedAt: null,
          });
          if (!ok) return;
          const refreshed = await getBidLevelingProjectData(data.project.id);
          if (refreshed) setData(refreshed);
        }}
      />

      <BidDetailDrawer
        open={Boolean(activeBidCell)}
        readOnly={readOnlySnapshot}
        trade={activeTrade}
        sub={activeSub}
        allSubs={subs}
        bid={activeBid}
        draft={drawerDraft}
        compareBid={compareBid}
        saving={savingDrawer}
        error={drawerError}
        onClose={() => {
          setActiveBidCell(null);
          setDrawerError(null);
          setDrawerDraft(EMPTY_DRAWER_DRAFT);
          setDrawerInitial(JSON.stringify(EMPTY_DRAWER_DRAFT));
        }}
        onChange={setDrawerDraft}
        onSave={async () => {
          const ok = await saveDrawer();
          if (ok) {
            setActiveBidCell(null);
          }
        }}
      />

      <SnapshotModal
        open={snapshotModalOpen}
        title={snapshotTitle}
        notes={snapshotNotes}
        saving={savingSnapshot}
        onClose={() => setSnapshotModalOpen(false)}
        onChangeTitle={setSnapshotTitle}
        onChangeNotes={setSnapshotNotes}
        onSave={async () => {
          if (!snapshotTitle.trim()) return;
          setSavingSnapshot(true);
          const createdBy = await getCurrentUserId();
          const items = data.trades.flatMap((trade) =>
            subs.map((sub) => {
              const bid = bidsByTradeSub.get(`${trade.id}:${sub.id}`) ?? null;
              return {
                trade_id: trade.id,
                sub_id: sub.id,
                base_bid_amount: bid?.base_bid_amount ?? null,
                notes:
                  [snapshotNotes.trim(), bid?.notes ?? ""]
                    .filter(Boolean)
                    .join("\n") || null,
                // TODO: replace with table-backed scope + line item entities after phase 2.
                included_json: null,
                line_items_json: null,
              };
            }),
          );

          const ok = await createLevelingSnapshot({
            projectId: data.project.id,
            createdBy,
            title: snapshotTitle.trim(),
            items,
          });

          setSavingSnapshot(false);
          if (!ok) return;

          const refreshed = await getBidLevelingProjectData(data.project.id);
          if (refreshed) {
            setData(refreshed);
            const newest = refreshed.snapshots[0];
            if (newest) setSelectedSnapshotId(newest.id);
          }
          setSnapshotModalOpen(false);
        }}
      />

      {pendingRemoval ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900">
              Remove from trade?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {pendingRemoval.subName} will be removed from this trade. You can
              undo this for a few seconds after removing.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={removingBid}
                onClick={() => setPendingRemoval(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removingBid}
                onClick={async () => {
                  if (!data) return;
                  setRemovingBid(true);
                  const bid = pendingRemoval.bid;
                  const ok = await removeTradeBid({
                    projectId: data.project.id,
                    tradeId: bid.trade_id,
                    subId: bid.sub_id,
                    legacyBidId: bid.legacy_bid_id ?? null,
                  });
                  setRemovingBid(false);
                  setPendingRemoval(null);
                  if (!ok) return;
                  const refreshed = await getBidLevelingProjectData(
                    data.project.id,
                  );
                  if (refreshed) setData(refreshed);
                  setUndoToast({ bid, subName: pendingRemoval.subName });
                }}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white disabled:bg-rose-300"
              >
                {removingBid ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {undoToast ? (
        <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <p className="text-sm text-slate-700">
            Removed {undoToast.subName} from trade.
          </p>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              disabled={restoringBid}
              onClick={async () => {
                if (!data) return;
                setRestoringBid(true);
                const bid = undoToast.bid;
                const ok = await upsertTradeBid({
                  projectId: data.project.id,
                  tradeId: bid.trade_id,
                  subId: bid.sub_id,
                  legacyBidId: bid.legacy_bid_id ?? null,
                  status: bid.status,
                  baseBidAmount: bid.base_bid_amount,
                  notes: bid.notes ?? null,
                  receivedAt: bid.received_at,
                });
                setRestoringBid(false);
                if (!ok) return;
                const refreshed = await getBidLevelingProjectData(
                  data.project.id,
                );
                if (refreshed) setData(refreshed);
                setUndoToast(null);
              }}
              className="text-sm font-semibold text-slate-900 underline underline-offset-2 disabled:text-slate-400"
            >
              {restoringBid ? "Undoing..." : "Undo"}
            </button>
          </div>
        </div>
      ) : null}

      {hasUnsavedChanges && !readOnlySnapshot ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
            <div className="text-sm text-slate-700">
              Unsaved changes: {dirtyBudgetTradeIds.size} budget{" "}
              {dirtyBudgetTradeIds.size === 1 ? "edit" : "edits"}
              {drawerDirty
                ? `, active bid ${formatCurrency(computeBaseItemsTotal(drawerDraft.baseItems))}`
                : ""}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!data) return;
                  const reset = new Map<
                    string,
                    { amount: number | null; notes: string | null }
                  >();
                  for (const trade of data.trades) {
                    const row = data.budgets.find(
                      (budget) => budget.trade_id === trade.id,
                    );
                    reset.set(trade.id, {
                      amount: row?.budget_amount ?? null,
                      notes: row?.budget_notes ?? null,
                    });
                  }
                  setBudgetsByTrade(reset);
                  setDirtyBudgetTradeIds(new Set());
                  setDrawerDraft(JSON.parse(drawerInitial) as BidDrawerDraft);
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700"
              >
                Discard
              </button>
              <button
                type="button"
                disabled={savingBudgets || savingDrawer}
                onClick={async () => {
                  const drawerOk = await saveDrawer();
                  if (!drawerOk) return;
                  await saveDirtyBudgets();
                }}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {savingBudgets || savingDrawer ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
