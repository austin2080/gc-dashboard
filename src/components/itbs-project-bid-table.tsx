"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { BidProjectDetail, BidTradeStatus } from "@/lib/bidding/types";
import {
  createProjectCustomTrade,
  createProjectTradeFromCostCode,
  createBidTrades,
  createTradeBid,
  getBidProjectDetail,
  listCompanyCostCodesForCurrentCompany,
  listProjectTrades,
  type CompanyCostCode,
  type ProjectTrade,
  updateBidSubcontractor,
  updateBidTrades,
  updateTradeBid,
} from "@/lib/bidding/store";
import { getBidProjectIdForProject } from "@/lib/bidding/project-links";
import EditTradesModal, { type TradeEditDraft } from "@/components/EditTradesModal";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatDueDate(value: string | null): string {
  if (!value) return "No due date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string | null): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusPill({ status }: { status: BidTradeStatus }) {
  const styles: Record<BidTradeStatus, string> = {
    submitted: "bg-emerald-100 text-emerald-800",
    bidding: "bg-blue-100 text-blue-800",
    declined: "bg-rose-100 text-rose-800",
    ghosted: "bg-amber-100 text-amber-800",
    invited: "bg-slate-100 text-slate-700",
  };

  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold tracking-[0.08em] ${styles[status]}`}>
      {status.toUpperCase()}
    </span>
  );
}

type DrawerBidState = {
  bidId: string | null;
  tradeId: string;
  tradeName: string;
  projectSubId: string;
  subCompany: string;
  subContact: string;
};

type DirectoryCompanyMeta = {
  city: string;
  state: string;
  trade: string;
};

function normalizeCompanyName(value: string): string {
  return value.trim().toLowerCase();
}

function hasTradeMatch(tradeName: string, companyTrade: string): boolean {
  const trade = tradeName.trim().toLowerCase();
  const company = companyTrade.trim().toLowerCase();
  if (!trade || !company) return false;
  return trade.includes(company) || company.includes(trade);
}

const PROPOSAL_DUE_STORAGE_KEY = "bidProposalDueDatesByCell";

function readProposalDueMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PROPOSAL_DUE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.entries(parsed).reduce<Record<string, string>>((acc, [key, value]) => {
      if (typeof key === "string" && typeof value === "string") acc[key] = value;
      return acc;
    }, {});
  } catch {
    return {};
  }
}

function writeProposalDueMap(map: Record<string, string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROPOSAL_DUE_STORAGE_KEY, JSON.stringify(map));
}

function compareTradeNamesByCode(a: string, b: string): number {
  const aParts = a.split(/\D+/).filter(Boolean).map(Number);
  const bParts = b.split(/\D+/).filter(Boolean).map(Number);
  const maxLen = Math.max(aParts.length, bParts.length);
  for (let index = 0; index < maxLen; index += 1) {
    const aValue = aParts[index] ?? -1;
    const bValue = bParts[index] ?? -1;
    if (aValue !== bValue) return aValue - bValue;
  }
  return a.localeCompare(b);
}

function sortTradeDraftsByCode(trades: TradeEditDraft[]): TradeEditDraft[] {
  return [...trades].sort((a, b) => compareTradeNamesByCode(a.trade_name, b.trade_name));
}

export default function ItbsProjectBidTable() {
  const DEFAULT_VISIBLE_SUB_COLUMNS = 3;
  const TRADE_COLUMN_WIDTH_PX = 260;
  const SUB_COLUMN_WIDTH_PX = 220;
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("project");
  const projectTradeProjectId = queryProjectId ?? "";
  const [mappedBidProjectId, setMappedBidProjectId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BidProjectDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [resolvedBidProjectId, setResolvedBidProjectId] = useState<string | null>(null);
  const [hasResolvedLookup, setHasResolvedLookup] = useState(false);
  const [visibleSubColumns, setVisibleSubColumns] = useState(DEFAULT_VISIBLE_SUB_COLUMNS);
  const [drawerState, setDrawerState] = useState<DrawerBidState | null>(null);
  const [statusDraft, setStatusDraft] = useState<BidTradeStatus>("invited");
  const [bidAmountDraft, setBidAmountDraft] = useState("");
  const [contactDraft, setContactDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [proposalDueDateDraft, setProposalDueDateDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [subSearch, setSubSearch] = useState("");
  const [selectedProjectSubId, setSelectedProjectSubId] = useState("");
  const [directoryByCompany, setDirectoryByCompany] = useState<Record<string, DirectoryCompanyMeta>>({});
  const [savingDrawer, setSavingDrawer] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [expandedTrades, setExpandedTrades] = useState<Record<string, boolean>>({});
  const [editTradesModalOpen, setEditTradesModalOpen] = useState(false);
  const [tradeDrafts, setTradeDrafts] = useState<TradeEditDraft[]>([]);
  const [companyCostCodes, setCompanyCostCodes] = useState<CompanyCostCode[]>([]);
  const [projectTrades, setProjectTrades] = useState<ProjectTrade[]>([]);
  const [loadingCompanyCostCodes, setLoadingCompanyCostCodes] = useState(false);
  const [companyCostCodeError, setCompanyCostCodeError] = useState<string | null>(null);
  const [tradeEditError, setTradeEditError] = useState<string | null>(null);
  const [savingTrades, setSavingTrades] = useState(false);

  useEffect(() => {
    const refreshMappedProject = () => {
      setMappedBidProjectId(getBidProjectIdForProject(queryProjectId));
    };
    refreshMappedProject();
    window.addEventListener("storage", refreshMappedProject);
    return () => {
      window.removeEventListener("storage", refreshMappedProject);
    };
  }, [queryProjectId]);

  useEffect(() => {
    let active = true;
    async function loadDetail() {
      if (!queryProjectId) {
        setDetail(null);
        setResolvedBidProjectId(null);
        setHasResolvedLookup(true);
        return;
      }
      setHasResolvedLookup(false);
      setLoadingDetail(true);
      const candidates = [mappedBidProjectId, queryProjectId].filter(
        (id, index, arr): id is string => Boolean(id) && arr.indexOf(id) === index
      );
      let loadedDetail: BidProjectDetail | null = null;
      let loadedId: string | null = null;
      for (const candidateId of candidates) {
        const row = await getBidProjectDetail(candidateId);
        if (row) {
          loadedDetail = row;
          loadedId = candidateId;
          break;
        }
      }
      if (!active) return;
      setDetail(loadedDetail);
      setResolvedBidProjectId(loadedId);
      setLoadingDetail(false);
      setHasResolvedLookup(true);
    }
    loadDetail();
    return () => {
      active = false;
    };
  }, [mappedBidProjectId, queryProjectId]);

  useEffect(() => {
    setVisibleSubColumns(DEFAULT_VISIBLE_SUB_COLUMNS);
  }, [resolvedBidProjectId]);

  useEffect(() => {
    let active = true;
    async function loadDirectoryMeta() {
      try {
        const response = await fetch("/api/directory/overview", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          companies?: Array<{ name?: string; city?: string; state?: string; trade?: string }>;
        };
        if (!active) return;
        const next: Record<string, DirectoryCompanyMeta> = {};
        for (const company of payload.companies ?? []) {
          if (!company?.name) continue;
          const key = normalizeCompanyName(company.name);
          next[key] = {
            city: company.city ?? "",
            state: company.state ?? "",
            trade: company.trade ?? "",
          };
        }
        setDirectoryByCompany(next);
      } catch {
        if (!active) return;
        setDirectoryByCompany({});
      }
    }
    loadDirectoryMeta();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadTradeSources() {
      if (!editTradesModalOpen || !projectTradeProjectId) return;
      setLoadingCompanyCostCodes(true);
      setCompanyCostCodeError(null);
      const [codes, projectTradeRows] = await Promise.all([
        listCompanyCostCodesForCurrentCompany(),
        listProjectTrades(projectTradeProjectId),
      ]);
      if (!active) return;
      setCompanyCostCodes(codes);
      setProjectTrades(projectTradeRows);
      if (!codes.length) {
        setCompanyCostCodeError("No active company cost codes found. You can still create custom trades.");
      }
      setLoadingCompanyCostCodes(false);
    }

    void loadTradeSources();
    return () => {
      active = false;
    };
  }, [editTradesModalOpen, projectTradeProjectId]);

  const tradeNamesLower = useMemo(
    () => new Set(tradeDrafts.map((trade) => trade.trade_name.trim().toLowerCase()).filter(Boolean)),
    [tradeDrafts]
  );
  const assignedCompanyCostCodeIds = useMemo(
    () =>
      projectTrades
        .map((trade) => trade.company_cost_code_id)
        .filter((value): value is string => Boolean(value)),
    [projectTrades]
  );

  if (!queryProjectId) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-6 text-sm text-slate-500 shadow-sm">
        Select a project to view invites.
      </section>
    );
  }

  if (hasResolvedLookup && !loadingDetail && !resolvedBidProjectId) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-600 shadow-sm">
        No bid package is linked to this selected project yet.
      </section>
    );
  }

  if (loadingDetail || !hasResolvedLookup || !detail) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-500 shadow-sm">
        Loading bid details...
      </section>
    );
  }

  const bidsByTrade = new Map<string, Map<string, (typeof detail.tradeBids)[number]>>();
  detail.tradeBids.forEach((bid) => {
    const tradeMap = bidsByTrade.get(bid.trade_id) ?? new Map<string, (typeof detail.tradeBids)[number]>();
    tradeMap.set(bid.project_sub_id, bid);
    bidsByTrade.set(bid.trade_id, tradeMap);
  });

  const subs = [...detail.projectSubs]
    .sort((a, b) => {
      const aOrder = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.id.localeCompare(b.id);
    })
    .map((sub) => ({
      id: sub.id,
      subcontractorId: sub.subcontractor_id,
      invitedAt: sub.invited_at,
      company: sub.subcontractor?.company_name ?? "Unknown subcontractor",
      contact: sub.subcontractor?.primary_contact ?? "-",
      email: sub.subcontractor?.email ?? "",
      phone: sub.subcontractor?.phone ?? "",
    }));
  const totalSubColumns = Math.max(DEFAULT_VISIBLE_SUB_COLUMNS, visibleSubColumns);
  const hiddenSubColumns = Math.max(0, subs.length - totalSubColumns);
  const sortedTrades = [...detail.trades].sort((a, b) =>
    compareTradeNamesByCode(a.trade_name ?? "", b.trade_name ?? "")
  );
  const selectedSub = subs.find((sub) => sub.id === selectedProjectSubId) ?? null;
  const filteredSubs = subs.filter((sub) => sub.company.toLowerCase().includes(subSearch.trim().toLowerCase()));

  const openDrawer = (payload: {
    tradeId: string;
    tradeName: string;
    projectSubId: string;
    subCompany: string;
    subContact: string;
    bid: (typeof detail.tradeBids)[number] | null;
  }) => {
    setDrawerState({
      bidId: payload.bid?.id ?? null,
      tradeId: payload.tradeId,
      tradeName: payload.tradeName,
      projectSubId: payload.projectSubId,
      subCompany: payload.subCompany,
      subContact: payload.subContact,
    });
    setStatusDraft(payload.bid?.status ?? "invited");
    setBidAmountDraft(payload.bid?.bid_amount !== null && payload.bid?.bid_amount !== undefined ? String(payload.bid.bid_amount) : "");
    setContactDraft(payload.bid?.contact_name ?? payload.subContact ?? "");
    setEmailDraft(subs.find((sub) => sub.id === payload.projectSubId)?.email ?? "");
    setPhoneDraft(subs.find((sub) => sub.id === payload.projectSubId)?.phone ?? "");
    const proposalDueMap = readProposalDueMap();
    const proposalDueKey = `${detail.project.id}:${payload.tradeId}:${payload.projectSubId}`;
    setProposalDueDateDraft(proposalDueMap[proposalDueKey] ?? detail.project.due_date ?? "");
    setNotesDraft(payload.bid?.notes ?? "");
    setSelectedProjectSubId(payload.projectSubId);
    setSubSearch(payload.subCompany);
    setDrawerError(null);
  };

  const closeDrawer = () => {
    setDrawerState(null);
    setDrawerError(null);
    setSavingDrawer(false);
  };

  const toggleTradeExpanded = (tradeId: string) => {
    setExpandedTrades((prev) => ({ ...prev, [tradeId]: !prev[tradeId] }));
  };

  const openEditTradesModal = () => {
    setTradeDrafts(
      sortTradeDraftsByCode(
        detail.trades.map((trade, index) => ({
          id: trade.id,
          trade_name: trade.trade_name ?? "",
          sort_order: trade.sort_order ?? index + 1,
        }))
      ).map((trade, index) => ({
        id: trade.id,
        trade_name: trade.trade_name ?? "",
        sort_order: index + 1,
      }))
    );
    setCompanyCostCodeError(null);
    setTradeEditError(null);
    setEditTradesModalOpen(true);
  };

  const addTradeDraftIfMissing = (tradeLabel: string): boolean => {
    const normalized = tradeLabel.trim();
    if (!normalized) return false;
    if (tradeNamesLower.has(normalized.toLowerCase())) return false;
    setTradeDrafts((prev) =>
      sortTradeDraftsByCode([
        ...prev,
        { id: null, trade_name: normalized, sort_order: prev.length + 1 },
      ]).map((trade, index) => ({ ...trade, sort_order: index + 1 }))
    );
    return true;
  };

  const syncTradeDraftsFromDetail = (nextDetail: BidProjectDetail) => {
    setTradeDrafts(
      sortTradeDraftsByCode(
        nextDetail.trades.map((trade, index) => ({
          id: trade.id,
          trade_name: trade.trade_name ?? "",
          sort_order: trade.sort_order ?? index + 1,
        }))
      ).map((trade, index) => ({
        id: trade.id,
        trade_name: trade.trade_name ?? "",
        sort_order: index + 1,
      }))
    );
  };

  const persistBidTradeForInvites = async (tradeLabel: string) => {
    const nextSortOrder =
      detail.trades.reduce((maxOrder, trade) => Math.max(maxOrder, trade.sort_order ?? 0), 0) + 1;
    const optimisticId = `temp-bid-trade-${Date.now()}`;
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            trades: [
              ...prev.trades,
              {
                id: optimisticId,
                project_id: prev.project.id,
                trade_name: tradeLabel,
                sort_order: nextSortOrder,
              },
            ],
          }
        : prev
    );

    const persisted = await createBidTrades(detail.project.id, [
      {
        trade_name: tradeLabel,
        sort_order: nextSortOrder,
      },
    ]);
    if (!persisted) {
      setTradeEditError("Trade added to draft only. Click Save Trades to persist.");
      return;
    }

    const refreshed = await getBidProjectDetail(detail.project.id);
    if (refreshed) {
      setDetail(refreshed);
      syncTradeDraftsFromDetail(refreshed);
    }
  };

  const handleSelectCompanyCostCode = async (costCode: CompanyCostCode) => {
    const tradeLabel = `${costCode.code} - ${costCode.title ?? "Untitled"}`.trim();
    if (tradeNamesLower.has(tradeLabel.toLowerCase())) {
      setTradeEditError("This trade already exists in the project list.");
      return;
    }

    const optimisticId = `temp-${Date.now()}`;
    const optimisticTrade: ProjectTrade = {
      id: optimisticId,
      project_id: projectTradeProjectId,
      company_cost_code_id: costCode.id,
      custom_code: null,
      custom_title: null,
      is_custom: false,
      company_cost_code: costCode,
    };

    setTradeEditError(null);
    setProjectTrades((prev) => [...prev, optimisticTrade]);
    const addedDraft = addTradeDraftIfMissing(tradeLabel);
    if (addedDraft) {
      await persistBidTradeForInvites(tradeLabel);
    }
    const created = await createProjectTradeFromCostCode(projectTradeProjectId, costCode.id);
    if (!created) {
      // Keep optimistic state so users can continue working even if project_trades persistence is unavailable.
      console.warn("project_trades insert failed; keeping optimistic trade in modal state");
      return;
    }

    setProjectTrades((prev) => prev.map((row) => (row.id === optimisticId ? created : row)));
  };

  const handleCreateCustomTrade = async (payload: { customCode: string; customTitle: string }) => {
    const normalizedTitle = payload.customTitle.trim();
    const normalizedCode = payload.customCode.trim();
    const tradeLabel = normalizedCode ? `${normalizedCode} - ${normalizedTitle}` : normalizedTitle;
    if (!normalizedTitle) {
      setTradeEditError("Custom trade title is required.");
      return;
    }
    if (tradeNamesLower.has(tradeLabel.toLowerCase())) {
      setTradeEditError("This trade already exists in the project list.");
      return;
    }

    const optimisticId = `temp-${Date.now()}`;
    const optimisticTrade: ProjectTrade = {
      id: optimisticId,
      project_id: projectTradeProjectId,
      company_cost_code_id: null,
      custom_code: normalizedCode || null,
      custom_title: normalizedTitle,
      is_custom: true,
      company_cost_code: null,
    };

    setTradeEditError(null);
    setProjectTrades((prev) => [...prev, optimisticTrade]);
    const addedDraft = addTradeDraftIfMissing(tradeLabel);
    if (addedDraft) {
      await persistBidTradeForInvites(tradeLabel);
    }
    const created = await createProjectCustomTrade({
      projectId: projectTradeProjectId,
      customCode: normalizedCode || null,
      customTitle: normalizedTitle,
    });
    if (!created) {
      // Keep optimistic state so users can continue working even if project_trades persistence is unavailable.
      console.warn("project_trades custom insert failed; keeping optimistic trade in modal state");
      return;
    }

    setProjectTrades((prev) => prev.map((row) => (row.id === optimisticId ? created : row)));
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{detail.project.project_name}</h2>
            <p className="mt-1 text-sm text-slate-600">Invitation and bid status by trade.</p>
          </div>
          <button
            type="button"
            onClick={openEditTradesModal}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Edit Trades
          </button>
        </div>
      </div>

      {hiddenSubColumns > 0 || visibleSubColumns > DEFAULT_VISIBLE_SUB_COLUMNS ? (
        <div className="border-b border-slate-200 bg-white px-4 py-2">
          <div className="flex justify-end gap-2">
            {visibleSubColumns > DEFAULT_VISIBLE_SUB_COLUMNS ? (
              <button
                type="button"
                onClick={() => setVisibleSubColumns((prev) => Math.max(DEFAULT_VISIBLE_SUB_COLUMNS, prev - 1))}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Remove Sub Column
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setVisibleSubColumns((prev) => prev + 1)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Add Sub Column
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table
          className="w-full table-fixed border-separate border-spacing-0"
          style={{ minWidth: `${TRADE_COLUMN_WIDTH_PX + totalSubColumns * SUB_COLUMN_WIDTH_PX}px` }}
        >
          <colgroup>
            <col style={{ width: `${TRADE_COLUMN_WIDTH_PX}px` }} />
            {Array.from({ length: totalSubColumns }, (_, index) => (
              <col key={`sub-col-${index + 1}`} style={{ width: `${SUB_COLUMN_WIDTH_PX}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700">
                Trade
              </th>
              {Array.from({ length: totalSubColumns }, (_, index) => (
                <th
                  key={`sub-header-${index + 1}`}
                  className="sticky top-0 z-10 border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700"
                >
                  Sub {index + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedTrades.map((trade) => {
              const tradeMap = bidsByTrade.get(trade.id) ?? new Map<string, (typeof detail.tradeBids)[number]>();
              const tradeSlots = subs
                .map((sub) => ({ sub, bid: tradeMap.get(sub.id) ?? null }))
                .filter(
                  (
                    entry
                  ): entry is {
                    sub: (typeof subs)[number];
                    bid: (typeof detail.tradeBids)[number];
                  } => Boolean(entry.bid)
                );
              const isExpanded = Boolean(expandedTrades[trade.id]);
              const panelId = `trade-panel-${trade.id}`;
              return (
                <Fragment key={trade.id}>
                  <tr
                    className={`cursor-pointer ${isExpanded ? "bg-slate-50" : ""}`}
                    tabIndex={0}
                    role="button"
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} ${trade.trade_name}`}
                    onClick={() => toggleTradeExpanded(trade.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleTradeExpanded(trade.id);
                      }
                    }}
                  >
                    <th
                      className={`sticky left-0 z-10 border-r border-slate-200 px-4 py-4 text-left text-sm font-semibold text-slate-900 ${
                        isExpanded ? "rounded-tl-lg border-b-0 bg-slate-50" : "border-b bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex text-slate-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : "rotate-0"}`}>
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                            <path
                              fillRule="evenodd"
                              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.939a.75.75 0 111.08 1.04l-4.25 4.512a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
                        <span>{trade.trade_name}</span>
                      </div>
                    </th>
                    {Array.from({ length: totalSubColumns }, (_, columnIndex) => {
                      const entry = tradeSlots[columnIndex] ?? null;
                      if (!entry) {
                        return (
                          <td
                            key={`${trade.id}-sub-slot-${columnIndex + 1}`}
                            className={`border-r border-slate-200 px-4 py-4 align-top ${
                              isExpanded ? "border-b-0 bg-slate-50" : "border-b"
                            } ${columnIndex === totalSubColumns - 1 && isExpanded ? "rounded-tr-lg" : ""}`}
                          >
                            <span className="text-sm text-slate-400">No sub assigned</span>
                          </td>
                        );
                      }
                      const { sub, bid } = entry;
                      return (
                        <td
                          key={`${trade.id}-${sub.id}`}
                          className={`border-r border-slate-200 px-4 py-4 align-top ${
                            isExpanded ? "border-b-0 bg-slate-50" : "border-b"
                          } ${columnIndex === totalSubColumns - 1 && isExpanded ? "rounded-tr-lg" : ""}`}
                        >
                          <div className="space-y-2">
                            <p className="text-sm font-semibold text-slate-900">{sub.company}</p>
                            <StatusPill status={bid.status} />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td colSpan={totalSubColumns + 1} className={`border-b border-slate-200 ${isExpanded ? "pb-3 pt-0" : "py-0"}`}>
                      <div
                        id={panelId}
                        aria-hidden={!isExpanded}
                        className={`overflow-hidden transition-all duration-300 ease-out ${isExpanded ? "visible max-h-[760px] opacity-100" : "invisible max-h-0 opacity-0"}`}
                      >
                        <div className="rounded-b-lg border border-t-0 border-slate-200 bg-white">
                          <table className="w-full table-fixed border-separate border-spacing-0">
                            <colgroup>
                              <col style={{ width: `${TRADE_COLUMN_WIDTH_PX}px` }} />
                              {Array.from({ length: totalSubColumns }, (_, index) => (
                                <col key={`detail-sub-col-${trade.id}-${index + 1}`} style={{ width: `${SUB_COLUMN_WIDTH_PX}px` }} />
                              ))}
                            </colgroup>
                            <tbody>
                              <tr>
                                <td className="border-r border-slate-200 p-4 align-top">
                                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Trade</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">{trade.trade_name}</p>
                                  <p className="mt-2 text-xs text-slate-500">Expanded details per subcontractor.</p>
                                </td>
                                {Array.from({ length: totalSubColumns }, (_, columnIndex) => {
                                  const entry = tradeSlots[columnIndex] ?? null;
                                  if (!entry) {
                                    return (
                                      <td
                                        key={`${trade.id}-detail-empty-${columnIndex + 1}`}
                                        className={`p-4 align-top ${columnIndex < totalSubColumns - 1 ? "border-r border-slate-200" : ""}`}
                                      >
                                        <p className="text-sm text-slate-400">No sub assigned</p>
                                      </td>
                                    );
                                  }
                                  const { sub, bid } = entry;
                                  return (
                                    <td
                                      key={`${trade.id}-detail-${sub.id}`}
                                      className={`p-4 align-top ${columnIndex < totalSubColumns - 1 ? "border-r border-slate-200" : ""}`}
                                    >
                                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Contact</p>
                                      <p className="mt-1 text-xs text-slate-500">{bid.contact_name ?? sub.contact}</p>
                                      {bid.bid_amount !== null && bid.bid_amount !== undefined ? (
                                        <p className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(bid.bid_amount)}</p>
                                      ) : (
                                        <p className="mt-2 text-xs text-slate-500">Bid amount: Not submitted</p>
                                      )}
                                      {bid.notes ? <p className="mt-2 text-xs text-slate-500">{bid.notes}</p> : <p className="mt-2 text-xs text-slate-500">No notes</p>}
                                      <div className="mt-3">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openDrawer({
                                              tradeId: trade.id,
                                              tradeName: trade.trade_name,
                                              projectSubId: sub.id,
                                              subCompany: sub.company,
                                              subContact: sub.contact,
                                              bid,
                                            })
                                          }
                                          className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                                        >
                                          Follow-up / Actions
                                        </button>
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <EditTradesModal
        open={editTradesModalOpen}
        tradeDrafts={tradeDrafts}
        tradeEditError={tradeEditError}
        savingTrades={savingTrades}
        loadingCompanyCostCodes={loadingCompanyCostCodes}
        companyCostCodeError={companyCostCodeError}
        companyCostCodes={companyCostCodes}
        assignedCompanyCostCodeIds={assignedCompanyCostCodeIds}
        onClose={() => setEditTradesModalOpen(false)}
        onSubmit={async (event) => {
          event.preventDefault();
          const normalizedDrafts = tradeDrafts.map((trade) => ({
            ...trade,
            trade_name: trade.trade_name.trim(),
          }));
          if (normalizedDrafts.some((trade) => trade.id && !trade.trade_name)) {
            setTradeEditError("Existing trades cannot be blank.");
            return;
          }
          const persistedDrafts = normalizedDrafts.filter((trade) => trade.id || trade.trade_name);
          if (!persistedDrafts.length) {
            setTradeEditError("Add at least one trade.");
            return;
          }
          const sortedPersistedDrafts = sortTradeDraftsByCode(persistedDrafts);
          const draftNames = sortedPersistedDrafts.map((trade) => trade.trade_name.toLowerCase());
          if (new Set(draftNames).size !== draftNames.length) {
            setTradeEditError("Trade names must be unique.");
            return;
          }

          const indexedDrafts = sortedPersistedDrafts.map((trade, index) => ({
            ...trade,
            sort_order: index + 1,
          }));
          const existingPayload = indexedDrafts
            .filter((trade): trade is TradeEditDraft & { id: string } => Boolean(trade.id))
            .map((trade) => ({
              id: trade.id,
              trade_name: trade.trade_name,
              sort_order: trade.sort_order,
            }));
          const newPayload = indexedDrafts
            .filter((trade) => !trade.id)
            .map((trade) => ({
              trade_name: trade.trade_name,
              sort_order: trade.sort_order,
            }));

          setSavingTrades(true);
          setTradeEditError(null);
          const updated = await updateBidTrades(detail.project.id, existingPayload);
          if (!updated) {
            setTradeEditError("Unable to update existing trades.");
            setSavingTrades(false);
            return;
          }
          const created = await createBidTrades(detail.project.id, newPayload);
          if (!created) {
            setTradeEditError("Unable to add new trades.");
            setSavingTrades(false);
            return;
          }

          const refreshed = await getBidProjectDetail(detail.project.id);
          if (refreshed) setDetail(refreshed);
          setEditTradesModalOpen(false);
          setSavingTrades(false);
        }}
        onTradeNameChange={(index, value) =>
          setTradeDrafts((prev) => {
            const next = prev.map((item, itemIndex) =>
              itemIndex === index ? { ...item, trade_name: value } : item
            );
            return sortTradeDraftsByCode(next).map((trade, itemIndex) => ({
              ...trade,
              sort_order: itemIndex + 1,
            }));
          })
        }
        onRemoveTrade={(index) =>
          setTradeDrafts((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
        }
        onSelectCostCode={handleSelectCompanyCostCode}
        onCreateCustomTrade={handleCreateCustomTrade}
      />
      {drawerState ? (
        <div className="fixed inset-0 z-50">
          <button type="button" className="absolute inset-0 bg-slate-950/40" onClick={closeDrawer} aria-label="Close bid details drawer" />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-2xl font-semibold text-slate-900">Invite Subcontractor</h2>
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <div>
                  <span className="font-semibold">Trade:</span> {drawerState.tradeName}
                </div>
                <div>
                  <span className="font-semibold">Project:</span> {detail.project.project_name}
                </div>
                <div>
                  <span className="font-semibold">Due:</span> {formatDueDate(detail.project.due_date)}
                </div>
              </div>
            </div>
            <form
              className="space-y-4 px-6 py-5"
              onSubmit={async (event) => {
                event.preventDefault();
                setSavingDrawer(true);
                setDrawerError(null);
                if (!selectedProjectSubId) {
                  setDrawerError("Select a subcontractor.");
                  setSavingDrawer(false);
                  return;
                }
                if (!emailDraft.trim()) {
                  setDrawerError("Email is required.");
                  setSavingDrawer(false);
                  return;
                }
                if (drawerState.bidId && selectedProjectSubId !== drawerState.projectSubId) {
                  setDrawerError("To change subcontractor, open an empty cell for the desired sub.");
                  setSavingDrawer(false);
                  return;
                }
                if (selectedSub?.subcontractorId) {
                  const synced = await updateBidSubcontractor({
                    id: selectedSub.subcontractorId,
                    company_name: selectedSub.company,
                    primary_contact: contactDraft.trim() || null,
                    email: emailDraft.trim() || null,
                    phone: phoneDraft.trim() || null,
                  });
                  if (!synced) {
                    setDrawerError("Unable to save contact info.");
                    setSavingDrawer(false);
                    return;
                  }
                }
                const bidAmount = bidAmountDraft.trim() ? Number(bidAmountDraft) : null;
                const payload = {
                  status: statusDraft,
                  bid_amount: Number.isFinite(bidAmount) ? bidAmount : null,
                  contact_name: contactDraft.trim() || null,
                  notes: notesDraft.trim() || null,
                };
                const ok = drawerState.bidId
                  ? await updateTradeBid({ id: drawerState.bidId, ...payload })
                  : await createTradeBid({
                      project_id: detail.project.id,
                      trade_id: drawerState.tradeId,
                      project_sub_id: selectedProjectSubId,
                      ...payload,
                    });
                if (!ok) {
                  setDrawerError("Unable to save bid details.");
                  setSavingDrawer(false);
                  return;
                }
                const proposalDueMap = readProposalDueMap();
                const proposalDueKey = `${detail.project.id}:${drawerState.tradeId}:${selectedProjectSubId}`;
                if (proposalDueDateDraft.trim()) {
                  proposalDueMap[proposalDueKey] = proposalDueDateDraft.trim();
                } else {
                  delete proposalDueMap[proposalDueKey];
                }
                writeProposalDueMap(proposalDueMap);
                const refreshed = await getBidProjectDetail(detail.project.id);
                if (refreshed) setDetail(refreshed);
                closeDrawer();
              }}
            >
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <div>
                  <span className="font-semibold">Sub:</span> {selectedSub?.company ?? drawerState.subCompany}
                </div>
                <div>
                  <span className="font-semibold">Trade:</span> {drawerState.tradeName}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Subcontractor</label>
                <input
                  value={subSearch}
                  onChange={(event) => {
                    setSubSearch(event.target.value);
                    if (selectedSub && event.target.value !== selectedSub.company) {
                      setSelectedProjectSubId("");
                    }
                  }}
                  placeholder="Search subcontractors"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                />
                <div className="max-h-48 overflow-auto rounded-lg border border-slate-200">
                  {filteredSubs.length ? (
                    filteredSubs.map((sub) => {
                      const meta = directoryByCompany[normalizeCompanyName(sub.company)];
                      const cityLabel = meta ? [meta.city, meta.state].filter(Boolean).join(", ") : "";
                      const isMatch = hasTradeMatch(drawerState.tradeName, meta?.trade ?? "");
                      const isSelected = sub.id === selectedProjectSubId;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            setSelectedProjectSubId(sub.id);
                            setSubSearch(sub.company);
                            setContactDraft(sub.contact === "-" ? "" : sub.contact);
                            setEmailDraft(sub.email ?? "");
                            setPhoneDraft(sub.phone ?? "");
                          }}
                          className={`w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50 ${
                            isSelected ? "bg-slate-100" : ""
                          }`}
                        >
                          <div className="text-sm font-semibold text-slate-900">{sub.company}</div>
                          <div className="mt-0.5 text-xs text-slate-500">{cityLabel || "City unavailable"}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] ${
                                isMatch ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {isMatch ? "TRADE MATCH" : "NO TRADE MATCH"}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-3 py-2 text-sm text-slate-500">No subcontractors found.</div>
                  )}
                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-sm font-semibold text-slate-800">Contact Info</div>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Contact Name
                  <input
                    value={contactDraft}
                    onChange={(event) => setContactDraft(event.target.value)}
                    placeholder="Estimator name"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Email
                  <input
                    type="email"
                    required
                    value={emailDraft}
                    onChange={(event) => setEmailDraft(event.target.value)}
                    placeholder="estimator@company.com"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Phone
                  <input
                    value={phoneDraft}
                    onChange={(event) => setPhoneDraft(event.target.value)}
                    placeholder="(555) 555-5555"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Proposal Due Date
                <input
                  type="date"
                  value={proposalDueDateDraft}
                  onChange={(event) => setProposalDueDateDraft(event.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Status
                <select
                  value={statusDraft}
                  onChange={(event) => setStatusDraft(event.target.value as BidTradeStatus)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                >
                  <option value="invited">Invited</option>
                  <option value="bidding">Bidding</option>
                  <option value="submitted">Submitted</option>
                  <option value="ghosted">Ghosted</option>
                  <option value="declined">Declined</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Quote Amount
                <input
                  value={bidAmountDraft}
                  onChange={(event) => setBidAmountDraft(event.target.value)}
                  placeholder="55000"
                  inputMode="decimal"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Notes
                <textarea
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value)}
                  rows={5}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                />
              </label>
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-sm font-semibold text-slate-800">Future Actions</div>
                <div className="text-sm text-slate-700">
                  <span className="font-semibold">Last invited date:</span> {formatDateTime(selectedSub?.invitedAt ?? null)}
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Invite history timeline</div>
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                    Timeline tracking coming soon.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDrawerError("Remind workflow is coming soon.")}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Remind
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerError("Mark Declined shortcut is coming soon.")}
                    className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    Mark Declined
                  </button>
                </div>
                <div className="text-xs text-slate-500">
                  Auto-track opened email: planned for future integration.
                </div>
              </div>
              {drawerError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{drawerError}</p>
              ) : null}
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDrawer}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingDrawer ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
