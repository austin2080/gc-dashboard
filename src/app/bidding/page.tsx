"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  BidProjectDetail,
  BidProjectSummary,
  BidTradeBid,
  BidTradeStatus,
} from "@/lib/bidding/types";
import {
  createBidProject,
  createBidTrades,
  createBidSubcontractor,
  listBidSubcontractors,
  inviteSubToProject,
  createTradeBid,
  updateTradeBid,
  updateBidSubcontractor,
  updateBidProject,
  updateBidTrades,
  archiveBidProject,
  getBidProjectDetail,
  listBidProjects,
} from "@/lib/bidding/store";
import BidManagementViewToggle from "@/components/bid-management-view-toggle";
import { getBidProjectIdForProject, getProjectIdForBidProject, setBidProjectLink } from "@/lib/bidding/project-links";

type TradeSubBid = {
  bidId: string;
  subId: string;
  company: string;
  contact: string;
  email?: string;
  phone?: string;
  status: BidTradeStatus;
  bidAmount?: number;
  notes?: string;
};

type TradeRow = {
  tradeId: string;
  trade: string;
  bidsBySubId: Record<string, TradeSubBid | null>;
};

type BidProjectView = {
  id: string;
  projectName: string;
  owner: string;
  location: string;
  budget: number | null;
  dueDate: string | null;
  subs: Array<{ id: string; company: string; contact: string }>;
  trades: TradeRow[];
};

type ProjectDraft = {
  project_name: string;
  owner: string;
  location: string;
  budget: string;
  due_date: string;
};

type CostCode = {
  id: string;
  code: string;
  description?: string | null;
  division?: string | null;
  is_active?: boolean | null;
};

type NewSubDraft = {
  company_name: string;
  primary_contact: string;
  email: string;
  phone: string;
  status: BidTradeStatus;
  bid_amount: string;
  contact_name: string;
};

type EditBidDraft = {
  bid_id: string;
  sub_id: string;
  company_name: string;
  primary_contact: string;
  email: string;
  phone: string;
  status: BidTradeStatus;
  bid_amount: string;
  contact_name: string;
  notes: string;
};

type InviteDraft = {
  status: BidTradeStatus;
  bid_amount: string;
  contact_name: string;
  notes: string;
  invitee_mode: "existing" | "new";
  selected_sub_id: string;
};

type TradeEditDraft = {
  id: string | null;
  trade_name: string;
  sort_order: number;
};

type SelectableProject = {
  id: string;
  name: string;
};

type ProjectInfoDraft = {
  estimator: string;
  projectCoordinator: string;
  projectType: string;
  squareFeet: string;
  bidDueDate: string;
  subsBidsDue: string;
  address: string;
};

type CalendarEntry = {
  id: string;
  date: string;
  title: string;
};

const BID_PROJECT_INFO_STORAGE_KEY = "bidProjectInfoByBidProjectId";
const BID_PROJECT_CALENDAR_STORAGE_KEY = "bidProjectCalendarByBidProjectId";
const DEFAULT_VISIBLE_SUB_COLUMNS = 3;

const emptyProjectInfoDraft: ProjectInfoDraft = {
  estimator: "",
  projectCoordinator: "",
  projectType: "",
  squareFeet: "",
  bidDueDate: "",
  subsBidsDue: "",
  address: "",
};

function daysUntil(isoDate: string): number {
  if (!isoDate) return 0;
  const today = new Date();
  const due = new Date(`${isoDate}T00:00:00`);
  const msPerDay = 1000 * 60 * 60 * 24;
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.max(0, Math.ceil((due.getTime() - todayMidnight) / msPerDay));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function toYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getNextProjectSubSortOrder(
  projectSubs: Array<{ sort_order: number | null }> | undefined
): number {
  if (!projectSubs?.length) return 1;
  const used = new Set(
    projectSubs
      .map((sub) => sub.sort_order)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0)
  );
  let next = 1;
  while (used.has(next)) next += 1;
  return next;
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

function BidComparisonGrid({
  project,
  onInviteExisting,
  onAddSubForTrade,
  onAddTrade,
  onEditBid,
}: {
  project: BidProjectView;
  onInviteExisting: (payload: {
    tradeId: string;
    tradeName: string;
    projectSubId: string;
    company: string;
  }) => void;
  onAddSubForTrade: (payload: { tradeId: string; tradeName: string }) => void;
  onAddTrade: () => void;
  onEditBid: (bid: TradeSubBid) => void;
}) {
  const [openTrades, setOpenTrades] = useState<Record<string, boolean>>({});
  const [visibleSubColumns, setVisibleSubColumns] = useState(DEFAULT_VISIBLE_SUB_COLUMNS);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    const isDesktop = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
    project.trades.forEach((trade) => {
      next[trade.tradeId] = isDesktop;
    });
    setOpenTrades(next);
  }, [project.id, project.trades]);

  const toggleTrade = (tradeId: string) => {
    setOpenTrades((prev) => ({ ...prev, [tradeId]: !prev[tradeId] }));
  };

  useEffect(() => {
    setVisibleSubColumns(DEFAULT_VISIBLE_SUB_COLUMNS);
  }, [project.id]);

  const totalSubColumns = Math.max(DEFAULT_VISIBLE_SUB_COLUMNS, visibleSubColumns);
  const hiddenSubColumns = Math.max(0, project.subs.length - totalSubColumns);

  const getTradeCounts = (row: TradeRow) => {
    let received = 0;
    let invited = 0;
    let bidding = 0;
    Object.values(row.bidsBySubId).forEach((bid) => {
      if (!bid) return;
      if (bid.status === "submitted") {
        received += 1;
      } else if (bid.status === "bidding") {
        bidding += 1;
      } else if (bid.status === "invited") {
        invited += 1;
      }
    });
    return { received, invited, bidding };
  };

  const countClasses = (
    value: number,
    type: "received" | "bidding" | "invited",
    hasReceived: boolean,
    hasBidding: boolean
  ) => {
    if (type === "received") {
      return value > 0 ? "text-emerald-600" : "text-rose-600";
    }
    if (type === "bidding" && value > 0) {
      return "text-amber-600";
    }
    if (type === "invited" && (hasReceived || hasBidding)) {
      return "text-slate-500";
    }
    if (hasReceived) {
      return "text-slate-500";
    }
    return value > 0 ? "text-slate-500" : "text-rose-600";
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-3xl font-semibold text-slate-900">{project.projectName}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
          <span>🏢 {project.owner}</span>
          <span>📍 {project.location}</span>
          <span>💲 {project.budget !== null ? formatCurrency(project.budget) : "—"}</span>
          <span>🗓️ Due {project.dueDate ?? "—"}</span>
        </div>
      </div>

      <div className="space-y-4 p-4 md:hidden">
        {project.trades.map((row) => {
          const isOpen = openTrades[row.tradeId] ?? true;
          const tradeSubs = project.subs.filter((sub) => row.bidsBySubId[sub.id]);
          const tradeCounts = getTradeCounts(row);
          const hasReceived = tradeCounts.received > 0;
          const hasBidding = tradeCounts.bidding > 0;

          return (
            <article key={`mobile-${row.trade}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleTrade(row.tradeId)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? "Collapse" : "Expand"} ${row.trade}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                  >
                    <svg
                      className={`h-4 w-4 transition ${isOpen ? "rotate-90" : ""}`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M7.5 5.5L12.5 10L7.5 14.5V5.5Z" />
                    </svg>
                      </button>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{row.trade}</h3>
                    <p className="text-xs">
                      <span className={countClasses(tradeCounts.received, "received", hasReceived, hasBidding)}>
                        {tradeCounts.received} received
                      </span>
                      <span className="text-slate-400"> · </span>
                      <span className={countClasses(tradeCounts.bidding, "bidding", hasReceived, hasBidding)}>
                        {tradeCounts.bidding} bidding
                      </span>
                      <span className="text-slate-400"> · </span>
                      <span className={countClasses(tradeCounts.invited, "invited", hasReceived, hasBidding)}>
                        {tradeCounts.invited} invited
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-xl text-slate-600 transition hover:bg-slate-50"
                  aria-label={`Add subcontractor for ${row.trade}`}
                  onClick={() => onAddSubForTrade({ tradeId: row.tradeId, tradeName: row.trade })}
                >
                  +
                </button>
              </div>

              {isOpen ? (
                tradeSubs.length ? (
                  <div className="space-y-3">
                    {tradeSubs.map((sub, index) => {
                      const bid = row.bidsBySubId[sub.id]!;
                      return (
                        <div key={`${row.trade}-${sub.id}-mobile`} className="rounded-lg border border-slate-200 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sub {index + 1}</p>
                          <p className="text-sm font-semibold text-slate-900">{sub.company}</p>
                          <button
                            type="button"
                            onClick={() => onEditBid(bid)}
                            className="mt-2 flex w-full flex-col items-start rounded-lg bg-slate-50 p-3 text-left"
                          >
                            <p className="text-sm text-slate-500">Contact: {bid.contact}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <StatusPill status={bid.status} />
                              {bid.status === "submitted" && bid.bidAmount !== null && bid.bidAmount !== undefined ? (
                                <span className="text-sm font-semibold text-slate-900">{formatCurrency(bid.bidAmount)}</span>
                              ) : null}
                            </div>
                            {bid.notes ? <p className="mt-2 line-clamp-3 text-xs text-slate-500">{bid.notes}</p> : null}
                            <span className="mt-2 text-xs text-slate-400">Tap to edit</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAddSubForTrade({ tradeId: row.tradeId, tradeName: row.trade })}
                    className="flex min-h-24 w-full items-center rounded-lg border border-dashed border-slate-200 px-3 text-left text-sm text-slate-400"
                  >
                    No subs yet — tap to invite
                  </button>
                )
              ) : null}
            </article>
          );
        })}
        <button
          type="button"
          onClick={onAddTrade}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
        >
          <span aria-hidden>＋</span>
          Add Trade
        </button>
      </div>

      <div className="hidden overflow-x-auto md:block">
        {hiddenSubColumns > 0 ? (
          <div className="border-b border-slate-200 bg-white px-4 py-2">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setVisibleSubColumns((prev) => prev + 1)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Show next sub column
                <span className="text-slate-400">({hiddenSubColumns} hidden)</span>
              </button>
            </div>
          </div>
        ) : null}
        <table className="min-w-[920px] w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-left text-xl font-semibold text-slate-600">
                Trade
              </th>
              {Array.from({ length: totalSubColumns }, (_, index) => (
                <th
                  key={`sub-header-${index + 1}`}
                  className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-600"
                >
                  <div className="text-base font-semibold text-slate-700">Sub {index + 1}</div>
                </th>
              ))}
              <th className="border-b border-slate-200 bg-slate-100 px-3 py-3 text-center text-sm font-semibold text-slate-600">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {project.trades.map((row) => {
              const isOpen = openTrades[row.tradeId] ?? true;
              const tradeCounts = getTradeCounts(row);
              const hasReceived = tradeCounts.received > 0;
              const hasBidding = tradeCounts.bidding > 0;

              if (!isOpen) {
                return (
                  <tr key={row.trade} className="align-top">
                    <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-5 text-left text-lg font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleTrade(row.tradeId)}
                          aria-expanded={isOpen}
                          aria-label={`${isOpen ? "Collapse" : "Expand"} ${row.trade}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                        >
                          <svg
                            className={`h-4 w-4 transition ${isOpen ? "rotate-90" : ""}`}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M7.5 5.5L12.5 10L7.5 14.5V5.5Z" />
                          </svg>
                        </button>
                        <div>
                          <div>{row.trade}</div>
                          <div className="text-xs font-normal">
                            <span className={countClasses(tradeCounts.received, "received", hasReceived, hasBidding)}>
                              {tradeCounts.received} received
                            </span>
                            <span className="text-slate-400"> · </span>
                            <span className={countClasses(tradeCounts.bidding, "bidding", hasReceived, hasBidding)}>
                              {tradeCounts.bidding} bidding
                            </span>
                            <span className="text-slate-400"> · </span>
                            <span className={countClasses(tradeCounts.invited, "invited", hasReceived, hasBidding)}>
                              {tradeCounts.invited} invited
                            </span>
                          </div>
                        </div>
                      </div>
                    </th>
                    {Array.from({ length: totalSubColumns }, (_, columnIndex) => {
                      const sub = project.subs[columnIndex] ?? null;
                      if (!sub) {
                        return (
                          <td key={`${row.trade}-closed-sub-slot-${columnIndex + 1}`} className="border-b border-r border-slate-200 px-4 py-4">
                            <span className="text-sm text-slate-400">No sub assigned</span>
                          </td>
                        );
                      }
                      const bid = row.bidsBySubId[sub.id] ?? null;
                      if (!bid) {
                        return (
                          <td key={`${row.trade}-closed-${sub.id}`} className="border-b border-r border-slate-200 px-4 py-4">
                            <span className="text-sm text-slate-400">No bid</span>
                          </td>
                        );
                      }
                      return (
                        <td key={`${row.trade}-closed-bid-${sub.id}`} className="border-b border-r border-slate-200 px-4 py-4">
                          <button
                            type="button"
                            onClick={() => onEditBid(bid)}
                            className="group flex w-full flex-col items-start rounded-lg border border-transparent px-1 py-1 text-left transition hover:border-slate-200 hover:bg-slate-50"
                          >
                            <p className="text-sm font-semibold text-slate-900">{bid.company}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <StatusPill status={bid.status} />
                              {bid.status === "submitted" && bid.bidAmount !== null && bid.bidAmount !== undefined ? (
                                <span className="text-sm font-semibold text-slate-900">{formatCurrency(bid.bidAmount)}</span>
                              ) : null}
                            </div>
                          </button>
                        </td>
                      );
                    })}
                    <td className="border-b border-slate-200 px-2 text-right align-middle">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-xl text-slate-600 transition hover:bg-slate-50"
                        aria-label={`Add subcontractor for ${row.trade}`}
                        onClick={() => onAddSubForTrade({ tradeId: row.tradeId, tradeName: row.trade })}
                      >
                        +
                      </button>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={row.trade} className="align-top">
                  <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-5 text-left text-lg font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleTrade(row.tradeId)}
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? "Collapse" : "Expand"} ${row.trade}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                      >
                        <svg
                          className={`h-4 w-4 transition ${isOpen ? "rotate-90" : ""}`}
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M7.5 5.5L12.5 10L7.5 14.5V5.5Z" />
                        </svg>
                      </button>
                      <div>
                        <div>{row.trade}</div>
                        <div className="text-xs font-normal">
                        <span className={countClasses(tradeCounts.received, "received", hasReceived, hasBidding)}>
                          {tradeCounts.received} received
                        </span>
                        <span className="text-slate-400"> · </span>
                        <span className={countClasses(tradeCounts.bidding, "bidding", hasReceived, hasBidding)}>
                          {tradeCounts.bidding} bidding
                        </span>
                        <span className="text-slate-400"> · </span>
                        <span className={countClasses(tradeCounts.invited, "invited", hasReceived, hasBidding)}>
                          {tradeCounts.invited} invited
                        </span>
                        </div>
                      </div>
                    </div>
                  </th>
                  {Array.from({ length: totalSubColumns }, (_, columnIndex) => {
                    const sub = project.subs[columnIndex] ?? null;
                    if (!sub) {
                      return (
                        <td key={`${row.trade}-sub-slot-${columnIndex + 1}`} className="border-b border-r border-slate-200 px-4 py-4">
                          <button
                            type="button"
                            onClick={() => onAddSubForTrade({ tradeId: row.tradeId, tradeName: row.trade })}
                            className="flex h-full min-h-24 w-full items-center rounded-lg border border-dashed border-slate-200 px-3 text-left text-sm text-slate-400 hover:border-slate-300 hover:bg-slate-50"
                          >
                            Not invited yet — click to add
                          </button>
                        </td>
                      );
                    }

                      const bid = row.bidsBySubId[sub.id] ?? null;
                      return (
                        <td key={`${row.trade}-${sub.id}`} className="border-b border-r border-slate-200 px-4 py-4">
                          {bid ? (
                            <button
                              type="button"
                              onClick={() => onEditBid(bid)}
                              className="group flex w-full flex-col items-start rounded-lg border border-transparent px-1 py-1 text-left transition hover:border-slate-200 hover:bg-slate-50"
                            >
                              <p className="text-xl font-semibold text-slate-900">{bid.company}</p>
                              <p className="text-sm text-slate-500">{bid.contact}</p>
                              <div className="flex items-center gap-2">
                                <StatusPill status={bid.status} />
                                {bid.status === "submitted" && bid.bidAmount !== null && bid.bidAmount !== undefined ? (
                                  <span className="text-base font-semibold text-slate-900">{formatCurrency(bid.bidAmount)}</span>
                                ) : null}
                              </div>
                              {bid.notes ? <p className="mt-2 line-clamp-3 text-xs text-slate-500">{bid.notes}</p> : null}
                              <span className="mt-2 text-xs text-slate-400 opacity-0 transition group-hover:opacity-100">
                                Click to edit
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                onInviteExisting({
                                  tradeId: row.tradeId,
                                  tradeName: row.trade,
                                  projectSubId: sub.id,
                                  company: sub.company,
                                })
                              }
                              className="flex h-full min-h-24 w-full items-center rounded-lg border border-dashed border-slate-200 px-3 text-left text-sm text-slate-400 hover:border-slate-300 hover:bg-slate-50"
                            >
                              Not invited yet — click to add
                            </button>
                          )}
                        </td>
                      );
                    })}
                  <td className="border-b border-slate-200 px-2 text-center align-middle">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-xl text-slate-600 transition hover:bg-slate-50"
                      aria-label={`Add subcontractor for ${row.trade}`}
                      onClick={() => onAddSubForTrade({ tradeId: row.tradeId, tradeName: row.trade })}
                    >
                      +
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-slate-200 bg-white px-4 py-4">
          <button
            type="button"
            onClick={onAddTrade}
            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
          >
            <span aria-hidden>＋</span>
            Add Trade
          </button>
        </div>
      </div>
    </section>
  );
}

function buildProjectView(detail: BidProjectDetail | null): BidProjectView | null {
  if (!detail) return null;
  const subs = detail.projectSubs
    .map((sub) => ({
      id: sub.id,
      company: sub.subcontractor?.company_name ?? "Unknown subcontractor",
      contact: sub.subcontractor?.primary_contact ?? "—",
    }))
    .filter((sub) => sub.id);

  const bidsByTrade = new Map<string, Map<string, BidTradeBid>>();
  detail.tradeBids.forEach((bid) => {
    const tradeMap = bidsByTrade.get(bid.trade_id) ?? new Map<string, BidTradeBid>();
    tradeMap.set(bid.project_sub_id, bid);
    bidsByTrade.set(bid.trade_id, tradeMap);
  });

  const subByProjectSubId = new Map(detail.projectSubs.map((sub) => [sub.id, sub]));

  const trades: TradeRow[] = detail.trades.map((trade) => {
    const tradeMap = bidsByTrade.get(trade.id) ?? new Map<string, BidTradeBid>();
    const bidsBySubId: Record<string, TradeSubBid | null> = {};
    subs.forEach((sub) => {
      const bid = tradeMap.get(sub.id);
      if (!bid) {
        bidsBySubId[sub.id] = null;
        return;
      }
      const subRecord = subByProjectSubId.get(sub.id);
      bidsBySubId[sub.id] = {
        bidId: bid.id,
        subId: subRecord?.subcontractor_id ?? sub.id,
        company: sub.company,
        contact: bid.contact_name ?? sub.contact,
        email: subRecord?.subcontractor?.email ?? undefined,
        phone: subRecord?.subcontractor?.phone ?? undefined,
        status: bid.status,
        bidAmount: bid.bid_amount ?? undefined,
        notes: bid.notes ?? undefined,
      };
    });
    return {
      tradeId: trade.id,
      trade: trade.trade_name,
      bidsBySubId,
    };
  });

  return {
    id: detail.project.id,
    projectName: detail.project.project_name,
    owner: detail.project.owner ?? "—",
    location: detail.project.location ?? "—",
    budget: detail.project.budget ?? null,
    dueDate: detail.project.due_date ?? null,
    subs,
    trades,
  };
}

export default function BiddingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("project");
  const [projects, setProjects] = useState<BidProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [detail, setDetail] = useState<BidProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTradesModalOpen, setEditTradesModalOpen] = useState(false);
  const [draft, setDraft] = useState<ProjectDraft>({
    project_name: "",
    owner: "",
    location: "",
    budget: "",
    due_date: "",
  });
  const [editDraft, setEditDraft] = useState<ProjectDraft>({
    project_name: "",
    owner: "",
    location: "",
    budget: "",
    due_date: "",
  });
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [selectedCostCodes, setSelectedCostCodes] = useState<CostCode[]>([]);
  const [costCodeQuery, setCostCodeQuery] = useState("");
  const [tradeCostCodeQuery, setTradeCostCodeQuery] = useState("");
  const [manualTradeName, setManualTradeName] = useState("");
  const [loadingCostCodes, setLoadingCostCodes] = useState(false);
  const [costCodeLoadError, setCostCodeLoadError] = useState<string | null>(null);
  const [tradeDrafts, setTradeDrafts] = useState<TradeEditDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingTrades, setSavingTrades] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [tradeEditError, setTradeEditError] = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteDraft, setInviteDraft] = useState<InviteDraft>({
    status: "bidding",
    bid_amount: "",
    contact_name: "",
    notes: "",
    invitee_mode: "existing",
    selected_sub_id: "",
  });
  const [newSubDraft, setNewSubDraft] = useState<NewSubDraft>({
    company_name: "",
    primary_contact: "",
    email: "",
    phone: "",
    status: "bidding",
    bid_amount: "",
    contact_name: "",
  });
  const [inviteTarget, setInviteTarget] = useState<{
    tradeId: string;
    tradeName: string;
    projectSubId: string;
    company: string;
  } | null>(null);
  const [newSubTrade, setNewSubTrade] = useState<{ tradeId: string; tradeName: string } | null>(null);
  const [savingInvite, setSavingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [subList, setSubList] = useState<
    Array<{ id: string; company_name: string; primary_contact: string | null; email: string | null; phone: string | null }>
  >([]);
  const [subListLoading, setSubListLoading] = useState(false);
  const [subSearch, setSubSearch] = useState("");
  const [editBidModalOpen, setEditBidModalOpen] = useState(false);
  const [editBidDraft, setEditBidDraft] = useState<EditBidDraft | null>(null);
  const [savingBidEdit, setSavingBidEdit] = useState(false);
  const [editBidError, setEditBidError] = useState<string | null>(null);
  const [backfillComplete, setBackfillComplete] = useState(false);
  const [projectInfoDraft, setProjectInfoDraft] = useState<ProjectInfoDraft>(emptyProjectInfoDraft);
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [calendarDate, setCalendarDate] = useState("");
  const [calendarTitle, setCalendarTitle] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    let active = true;
    async function loadProjects() {
      setLoading(true);
      const projectData = await listBidProjects();
      if (!active) return;
      setProjects(projectData);
      setLoading(false);
    }

    loadProjects();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!projects.length) {
      if (selectedProjectId) setSelectedProjectId("");
      return;
    }

    if (queryProjectId) {
      const mappedBidProjectId = getBidProjectIdForProject(queryProjectId);
      if (mappedBidProjectId && projects.some((project) => project.id === mappedBidProjectId)) {
        if (selectedProjectId !== mappedBidProjectId) setSelectedProjectId(mappedBidProjectId);
        return;
      }
      if (projects.some((project) => project.id === queryProjectId)) {
        if (selectedProjectId !== queryProjectId) setSelectedProjectId(queryProjectId);
        return;
      }
      return;
    }

    if (selectedProjectId && projects.some((project) => project.id === selectedProjectId)) return;
    const fallbackProjectId = projects[0]?.id ?? "";
    if (selectedProjectId !== fallbackProjectId) setSelectedProjectId(fallbackProjectId);
  }, [projects, queryProjectId, selectedProjectId]);

  useEffect(() => {
    if (loading || !projects.length || backfillComplete) return;
    let active = true;
    async function backfillExistingBidPackages() {
      let selectableProjects: SelectableProject[] = [];
      try {
        const selectableResponse = await fetch("/api/projects/selectable", { cache: "no-store" });
        if (selectableResponse.ok) {
          const payload = (await selectableResponse.json()) as { projects?: SelectableProject[] };
          selectableProjects = Array.isArray(payload.projects) ? payload.projects : [];
        }
      } catch {
        selectableProjects = [];
      }

      let updatedAnyLinks = false;
      for (const bidProject of projects) {
        if (!active) return;
        const existingLinkedProjectId = getProjectIdForBidProject(bidProject.id);
        if (existingLinkedProjectId && selectableProjects.some((project) => project.id === existingLinkedProjectId)) {
          continue;
        }

        const matchedByName = selectableProjects.find(
          (project) => project.name.trim().toLowerCase() === bidProject.project_name.trim().toLowerCase()
        );
        if (matchedByName) {
          setBidProjectLink(matchedByName.id, bidProject.id);
          updatedAnyLinks = true;
          continue;
        }

        try {
          const createResponse = await fetch("/api/projects/from-bid-package", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: bidProject.project_name,
              city: bidProject.location ?? null,
            }),
          });
          if (!createResponse.ok) continue;
          const createPayload = (await createResponse.json()) as { project?: { id?: string; name?: string } };
          const createdProjectId = createPayload.project?.id;
          if (!createdProjectId) continue;
          setBidProjectLink(createdProjectId, bidProject.id);
          selectableProjects = [
            ...selectableProjects,
            { id: createdProjectId, name: createPayload.project?.name ?? bidProject.project_name },
          ];
          updatedAnyLinks = true;
        } catch {
          // Continue backfill loop even if one package fails.
        }
      }

      if (!active) return;
      if (updatedAnyLinks) {
        window.dispatchEvent(new Event("storage"));
        router.refresh();
      }
      setBackfillComplete(true);
    }

    backfillExistingBidPackages();
    return () => {
      active = false;
    };
  }, [backfillComplete, loading, projects, router]);

  useEffect(() => {
    let active = true;
    async function loadCostCodes() {
      if (!modalOpen && !editTradesModalOpen) return;
      setLoadingCostCodes(true);
      setCostCodeLoadError(null);
      try {
        const response = await fetch("/api/cost-codes");
        let payload: { costCodes?: unknown; error?: string } = {};
        try {
          payload = (await response.json()) as { costCodes?: unknown; error?: string };
        } catch {
          payload = {};
        }
        if (!response.ok) {
          if (!active) return;
          setCostCodes([]);
          const rawError = (payload.error ?? "").toLowerCase();
          if (rawError.includes("no active company membership")) {
            setCostCodeLoadError("Cost codes unavailable. You can still add manual trades.");
          } else {
            setCostCodeLoadError(payload.error ?? "Cost codes unavailable. You can still add manual trades.");
          }
          return;
        }
        if (!active) return;
        setCostCodes(Array.isArray(payload.costCodes) ? payload.costCodes : []);
      } catch (err) {
        console.warn("Unable to load cost codes", err);
        if (!active) return;
        setCostCodes([]);
        setCostCodeLoadError("Unable to load cost codes right now. You can still add manual trades.");
      } finally {
        if (active) setLoadingCostCodes(false);
      }
    }

    loadCostCodes();
    return () => {
      active = false;
    };
  }, [modalOpen, editTradesModalOpen]);

  useEffect(() => {
    let active = true;
    async function loadSubList() {
      if (!inviteModalOpen) return;
      setSubListLoading(true);
      const data = await listBidSubcontractors();
      if (!active) return;
      setSubList(data);
      setSubListLoading(false);
    }

    loadSubList();
    return () => {
      active = false;
    };
  }, [inviteModalOpen]);

  useEffect(() => {
    const shouldLock =
      modalOpen || editModalOpen || editTradesModalOpen || inviteModalOpen || editBidModalOpen;
    const body = document.body;
    const html = document.documentElement;
    const previousOverflow = body.style.overflow;
    const previousPosition = body.style.position;
    const previousTop = body.style.top;
    const previousWidth = body.style.width;
    const previousPaddingRight = body.style.paddingRight;
    const previousHtmlOverflow = html.style.overflow;
    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - html.clientWidth;
    if (shouldLock) {
      body.style.overflow = "hidden";
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.width = "100%";
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
      html.style.overflow = "hidden";
    } else {
      body.style.overflow = "";
      body.style.position = "";
      body.style.top = "";
      body.style.width = "";
      body.style.paddingRight = "";
      html.style.overflow = "";
      window.scrollTo(0, scrollY);
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.position = previousPosition;
      document.body.style.top = previousTop;
      document.body.style.width = previousWidth;
      document.body.style.paddingRight = previousPaddingRight;
      document.documentElement.style.overflow = previousHtmlOverflow;
      if (!shouldLock) return;
      const top = Number.parseInt(previousTop || "0", 10);
      if (!Number.isNaN(top) && top !== 0) {
        window.scrollTo(0, -top);
      }
    };
  }, [modalOpen, editModalOpen, editTradesModalOpen, inviteModalOpen, editBidModalOpen]);

  useEffect(() => {
    let active = true;
    async function loadDetail() {
      if (!selectedProjectId) {
        setDetail(null);
        return;
      }
      setLoadingDetail(true);
      const nextDetail = await getBidProjectDetail(selectedProjectId);
      if (!active) return;
      setDetail(nextDetail);
      setLoadingDetail(false);
    }

    loadDetail();
    return () => {
      active = false;
    };
  }, [selectedProjectId]);

  const projectView = useMemo(() => buildProjectView(detail), [detail]);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  useEffect(() => {
    if (!selectedProject?.id) {
      setProjectInfoDraft(emptyProjectInfoDraft);
      return;
    }
    try {
      const raw = localStorage.getItem(BID_PROJECT_INFO_STORAGE_KEY);
      if (!raw) {
        setProjectInfoDraft(emptyProjectInfoDraft);
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") {
        setProjectInfoDraft(emptyProjectInfoDraft);
        return;
      }
      const row = (parsed as Record<string, Partial<ProjectInfoDraft>>)[selectedProject.id];
      if (!row || typeof row !== "object") {
        setProjectInfoDraft(emptyProjectInfoDraft);
        return;
      }
      setProjectInfoDraft({
        estimator: row.estimator ?? "",
        projectCoordinator: row.projectCoordinator ?? "",
        projectType: row.projectType ?? "",
        squareFeet: row.squareFeet ?? "",
        bidDueDate: row.bidDueDate ?? "",
        subsBidsDue: row.subsBidsDue ?? "",
        address: row.address ?? "",
      });
    } catch {
      setProjectInfoDraft(emptyProjectInfoDraft);
    }
  }, [selectedProject?.id]);

  const updateProjectInfoField = (field: keyof ProjectInfoDraft, value: string) => {
    setProjectInfoDraft((prev) => {
      const next = { ...prev, [field]: value };
      if (!selectedProject?.id) return next;
      try {
        const raw = localStorage.getItem(BID_PROJECT_INFO_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as unknown) : {};
        const map = parsed && typeof parsed === "object" ? (parsed as Record<string, ProjectInfoDraft>) : {};
        map[selectedProject.id] = next;
        localStorage.setItem(BID_PROJECT_INFO_STORAGE_KEY, JSON.stringify(map));
      } catch {
        // Ignore local storage errors and keep UI responsive.
      }
      return next;
    });
  };

  useEffect(() => {
    if (!selectedProject?.id) {
      setCalendarEntries([]);
      return;
    }
    try {
      const raw = localStorage.getItem(BID_PROJECT_CALENDAR_STORAGE_KEY);
      if (!raw) {
        setCalendarEntries([]);
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") {
        setCalendarEntries([]);
        return;
      }
      const rows = (parsed as Record<string, CalendarEntry[]>)[selectedProject.id];
      setCalendarEntries(Array.isArray(rows) ? rows : []);
    } catch {
      setCalendarEntries([]);
    }
  }, [selectedProject?.id]);

  const saveCalendarEntries = (entries: CalendarEntry[]) => {
    if (!selectedProject?.id) return;
    try {
      const raw = localStorage.getItem(BID_PROJECT_CALENDAR_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : {};
      const map = parsed && typeof parsed === "object" ? (parsed as Record<string, CalendarEntry[]>) : {};
      map[selectedProject.id] = entries;
      localStorage.setItem(BID_PROJECT_CALENDAR_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // Ignore local storage errors and keep UI responsive.
    }
  };

  const upsertCalendarEntry = () => {
    const nextDate = calendarDate.trim();
    const nextTitle = calendarTitle.trim();
    if (!nextDate || !nextTitle) return;
    const nextEntries = [
      ...calendarEntries,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date: nextDate,
        title: nextTitle,
      },
    ].sort((a, b) => a.date.localeCompare(b.date));
    setCalendarEntries(nextEntries);
    saveCalendarEntries(nextEntries);
    setCalendarTitle("");
  };

  const updateCalendarEntry = (id: string, patch: Partial<Pick<CalendarEntry, "date" | "title">>) => {
    const nextEntries = calendarEntries.map((entry) =>
      entry.id === id ? { ...entry, ...patch } : entry
    );
    setCalendarEntries(nextEntries);
    saveCalendarEntries(nextEntries);
  };

  const removeCalendarEntry = (id: string) => {
    const nextEntries = calendarEntries.filter((entry) => entry.id !== id);
    setCalendarEntries(nextEntries);
    saveCalendarEntries(nextEntries);
  };

  const calendarEntriesByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of calendarEntries) {
      const key = entry.date;
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    map.forEach((list) => list.sort((a, b) => a.title.localeCompare(b.title)));
    return map;
  }, [calendarEntries]);

  const calendarMonthLabel = useMemo(
    () => calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    [calendarMonth]
  );

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = Array.from({ length: startOffset }, (_, index) => ({
      key: `blank-${year}-${month}-${index}`,
      date: null,
      day: null,
    }));
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(year, month, index + 1);
      return {
        key: toYmd(date),
        date,
        day: date.getDate(),
      };
    });
    return [...leadingBlanks, ...days];
  }, [calendarMonth]);
  const invitedSubIds = useMemo(
    () => new Set(detail?.projectSubs.map((item) => item.subcontractor_id) ?? []),
    [detail]
  );
  const availableSubs = useMemo(
    () =>
      subList.filter(
        (sub) =>
          !invitedSubIds.has(sub.id) &&
          `${sub.company_name} ${sub.primary_contact ?? ""}`.toLowerCase().includes(subSearch.toLowerCase())
      ),
    [subList, invitedSubIds, subSearch]
  );
  const tradeNamesLower = useMemo(
    () => new Set(tradeDrafts.map((trade) => trade.trade_name.trim().toLowerCase()).filter(Boolean)),
    [tradeDrafts]
  );

  const openEditModal = () => {
    if (!selectedProject) return;
    setEditDraft({
      project_name: selectedProject.project_name ?? "",
      owner: selectedProject.owner ?? "",
      location: selectedProject.location ?? "",
      budget: selectedProject.budget !== null && selectedProject.budget !== undefined ? String(selectedProject.budget) : "",
      due_date: selectedProject.due_date ?? "",
    });
    setEditError(null);
    setEditModalOpen(true);
  };

  return (
    <main className="space-y-6 bg-slate-50 p-4 sm:p-6">
      <header className="-mx-4 border-b border-slate-200 bg-white sm:-mx-6">
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-1">
          <div>
            <h1 className="text-4xl font-semibold text-slate-900">
              {selectedProject ? selectedProject.project_name : "Bid Management"}
            </h1>
            <p className="mt-1 text-lg text-slate-500">Track active bids, subcontractors &amp; due dates</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {selectedProject ? (
              <>
                <button
                  type="button"
                  onClick={openEditModal}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Edit Project
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <span aria-hidden>＋</span>
              New Bid Package
            </button>
          </div>
        </div>
      </header>
      <BidManagementViewToggle />

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-6 text-sm text-slate-500 shadow-sm">
          Loading bid projects...
        </section>
      ) : !projects.length ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500 shadow-sm">
          No bid projects yet. Create your first bid to start tracking coverage.
        </section>
      ) : queryProjectId && !selectedProject ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-slate-600 shadow-sm">
          No bid package is linked to this selected project yet. Click <span className="font-semibold">New Bid Package</span>.
        </section>
      ) : null}

      {selectedProject ? (
        <section className="grid items-start gap-4 lg:grid-cols-12">
          <div className="self-start rounded-2xl border border-slate-200 bg-white px-5 pb-4 pt-5 shadow-sm lg:col-span-6 lg:aspect-[1/1]">
            <div className="h-full overflow-y-auto pr-1">
              <h2 className="text-lg font-semibold text-slate-900">Project Info</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimator</div>
                <input
                  value={projectInfoDraft.estimator}
                  onChange={(event) => updateProjectInfoField("estimator", event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700"
                  placeholder="Enter estimator"
                />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project Coordinator</div>
                <input
                  value={projectInfoDraft.projectCoordinator}
                  onChange={(event) => updateProjectInfoField("projectCoordinator", event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700"
                  placeholder="Enter coordinator"
                />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project Type</div>
                <input
                  value={projectInfoDraft.projectType}
                  onChange={(event) => updateProjectInfoField("projectType", event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700"
                  placeholder="Enter project type"
                />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Square Feet</div>
                <input
                  value={projectInfoDraft.squareFeet}
                  onChange={(event) => updateProjectInfoField("squareFeet", event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700"
                  placeholder="Enter square feet"
                />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bid Due Date</div>
                <input
                  value={projectInfoDraft.bidDueDate}
                  onChange={(event) => updateProjectInfoField("bidDueDate", event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700"
                  placeholder="Enter bid due date"
                />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subs Bids Due</div>
                <input
                  value={projectInfoDraft.subsBidsDue}
                  onChange={(event) => updateProjectInfoField("subsBidsDue", event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700"
                  placeholder="Enter subs bids due"
                />
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</div>
                <input
                  value={projectInfoDraft.address}
                  onChange={(event) => updateProjectInfoField("address", event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700"
                  placeholder="Enter address"
                />
              </div>
              </div>
            </div>
          </div>
          <div className="self-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-6 lg:aspect-[1/1]">
            <div className="h-full overflow-y-auto pr-1">
              <h2 className="text-lg font-semibold text-slate-900">Calendar</h2>
              <div className="mt-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                  }
                  className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Prev
                </button>
                <div className="text-sm font-semibold text-slate-800">{calendarMonthLabel}</div>
                <button
                  type="button"
                  onClick={() =>
                    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                  }
                  className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="py-1">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarCells.map((cell) => {
                  if (!cell.date || !cell.day) {
                    return <div key={cell.key} className="min-h-[60px]" aria-hidden />;
                  }
                  const entriesForDay = calendarEntriesByDate.get(cell.key) ?? [];
                  const isSelected = calendarDate === cell.key;
                  const isToday = cell.key === toYmd(new Date());
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      onClick={() => {
                        setCalendarDate(cell.key);
                      }}
                      className={`min-h-[60px] rounded-md border p-1.5 text-left transition ${
                        isSelected
                          ? "border-slate-900 bg-slate-900/5"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className={`text-xs font-semibold ${isToday ? "text-blue-700" : ""}`}>{cell.day}</div>
                      {entriesForDay.slice(0, 2).map((entry) => (
                        <div key={entry.id} className="mt-1 truncate rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-700">
                          {entry.title}
                        </div>
                      ))}
                      {entriesForDay.length > 2 ? (
                        <div className="mt-1 text-[10px] text-slate-500">+{entriesForDay.length - 2} more</div>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">
                <input
                  type="date"
                  value={calendarDate}
                  onChange={(event) => setCalendarDate(event.target.value)}
                  className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700"
                />
                <input
                  value={calendarTitle}
                  onChange={(event) => setCalendarTitle(event.target.value)}
                  className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700"
                  placeholder="Add milestone or reminder"
                />
                <button
                  type="button"
                  onClick={upsertCalendarEntry}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Add
                </button>
              </div>

              {calendarEntries.length ? (
                <div className="max-h-36 space-y-2 overflow-auto pr-1">
                  {calendarEntries.map((entry) => (
                    <div key={entry.id} className="grid gap-2 rounded-md border border-slate-200 p-2 sm:grid-cols-[auto_1fr_auto]">
                      <input
                        type="date"
                        value={entry.date}
                        onChange={(event) => updateCalendarEntry(entry.id, { date: event.target.value })}
                        className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700"
                      />
                      <input
                        value={entry.title}
                        onChange={(event) => updateCalendarEntry(entry.id, { title: event.target.value })}
                        className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => removeCalendarEntry(entry.id)}
                        className="rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500">
                  No calendar items yet.
                </div>
              )}
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-12">
            <h2 className="text-lg font-semibold text-slate-900">Needs Attention</h2>
            <p className="mt-2 text-sm text-slate-500">Actionable alerts and blockers will go here.</p>
          </div>
        </section>
      ) : null}

      {selectedProject ? (
        <section className="flex justify-end">
          <button
            type="button"
            onClick={async () => {
              if (!selectedProject) return;
              const confirmed = window.confirm(`Archive “${selectedProject.project_name}”? This will remove it from active bids.`);
              if (!confirmed) return;
              const ok = await archiveBidProject(selectedProject.id);
              if (!ok) return;
              setProjects((prev) => prev.filter((project) => project.id !== selectedProject.id));
              setSelectedProjectId((prev) => {
                if (prev !== selectedProject.id) return prev;
                const next = projects.filter((project) => project.id !== selectedProject.id)[0]?.id ?? "";
                return next;
              });
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100"
          >
            Archive
          </button>
        </section>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-2xl font-semibold text-slate-900">New Bid Project</h2>
              <p className="mt-1 text-sm text-slate-500">Create a project to start inviting subs.</p>
            </div>
            <form
              className="space-y-6 px-6 py-5"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!draft.project_name.trim()) {
                  setFormError("Project name is required.");
                  return;
                }
                setSaving(true);
                setFormError(null);
                const budgetValue = draft.budget.trim() ? Number(draft.budget) : null;
                const created = await createBidProject({
                  project_name: draft.project_name,
                  owner: draft.owner.trim() || null,
                  location: draft.location.trim() || null,
                  budget: Number.isFinite(budgetValue) ? budgetValue : null,
                  due_date: draft.due_date.trim() || null,
                });
                if (!created) {
                  setFormError("Unable to create the project. Check your Supabase permissions.");
                  setSaving(false);
                  return;
                }
                if (selectedCostCodes.length) {
                  const tradePayload = selectedCostCodes.map((code, index) => ({
                    trade_name: `${code.code}${code.description ? ` ${code.description}` : ""}`.trim(),
                    sort_order: index + 1,
                  }));
                  await createBidTrades(created.id, tradePayload);
                }
                let linkedProjectId =
                  queryProjectId && queryProjectId !== "mock-project-nav-test" ? queryProjectId : null;
                if (linkedProjectId) {
                  const selectableResponse = await fetch("/api/projects/selectable", { cache: "no-store" });
                  if (selectableResponse.ok) {
                    const selectablePayload = (await selectableResponse.json()) as { projects?: Array<{ id: string }> };
                    const isRealProject = (selectablePayload.projects ?? []).some((project) => project.id === linkedProjectId);
                    if (!isRealProject) linkedProjectId = null;
                  }
                }
                if (!linkedProjectId) {
                  const linkedProjectResponse = await fetch("/api/projects/from-bid-package", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: draft.project_name,
                      city: draft.location.trim() || null,
                    }),
                  });
                  if (linkedProjectResponse.ok) {
                    const linkedPayload = (await linkedProjectResponse.json()) as { project?: { id?: string } };
                    linkedProjectId = linkedPayload?.project?.id ?? null;
                  }
                }

                if (linkedProjectId) {
                  setBidProjectLink(linkedProjectId, created.id);
                  localStorage.setItem("activeProjectId", linkedProjectId);
                  window.dispatchEvent(new Event("storage"));
                  const nextParams = new URLSearchParams(searchParams.toString());
                  nextParams.set("project", linkedProjectId);
                  router.replace(`/bidding?${nextParams.toString()}`, { scroll: false });
                  router.refresh();
                }
                setProjects((prev) => [created, ...prev]);
                setSelectedProjectId(created.id);
                setModalOpen(false);
                setSaving(false);
                setDraft({
                  project_name: "",
                  owner: "",
                  location: "",
                  budget: "",
                  due_date: "",
                });
                setSelectedCostCodes([]);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                  Project name
                  <input
                    value={draft.project_name}
                    onChange={(event) => setDraft((prev) => ({ ...prev, project_name: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    placeholder="Riverside Office Complex"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Owner / Client
                  <input
                    value={draft.owner}
                    onChange={(event) => setDraft((prev) => ({ ...prev, owner: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    placeholder="City of Houston"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Location
                  <input
                    value={draft.location}
                    onChange={(event) => setDraft((prev) => ({ ...prev, location: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    placeholder="Houston, TX"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Budget
                  <input
                    value={draft.budget}
                    onChange={(event) => setDraft((prev) => ({ ...prev, budget: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    placeholder="8200000"
                    inputMode="decimal"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Due date
                  <input
                    value={draft.due_date}
                    onChange={(event) => setDraft((prev) => ({ ...prev, due_date: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    type="date"
                  />
                </label>
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Cost Codes (Trades)</h3>
                    <p className="text-xs text-slate-500">Select cost codes to include as trades.</p>
                  </div>
                  <input
                    value={costCodeQuery}
                    onChange={(event) => setCostCodeQuery(event.target.value)}
                    className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    placeholder="Search cost codes"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50">
                    <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                      Available Cost Codes
                    </div>
                    <div className="max-h-56 overflow-auto p-2">
                      {loadingCostCodes ? (
                        <div className="px-3 py-4 text-sm text-slate-500">Loading cost codes...</div>
                      ) : costCodes.length ? (
                        costCodes
                          .filter((code) => {
                            const label = `${code.code} ${code.description ?? ""}`.toLowerCase();
                            return label.includes(costCodeQuery.toLowerCase());
                          })
                          .filter((code) => !selectedCostCodes.some((selected) => selected.id === code.id))
                          .map((code) => (
                            <button
                              key={code.id}
                              type="button"
                              onClick={() => setSelectedCostCodes((prev) => [...prev, code])}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-white"
                            >
                              <span className="font-medium">{code.code}</span>
                              <span className="ml-3 truncate text-xs text-slate-500">
                                {code.description ?? "No description"}
                              </span>
                            </button>
                          ))
                      ) : (
                        <div className="px-3 py-4 text-sm text-slate-500">No cost codes found.</div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                      Selected Trades
                    </div>
                    <div className="max-h-56 overflow-auto p-2">
                      {selectedCostCodes.length ? (
                        selectedCostCodes.map((code) => (
                          <button
                            key={code.id}
                            type="button"
                            onClick={() =>
                              setSelectedCostCodes((prev) => prev.filter((item) => item.id !== code.id))
                            }
                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <span className="font-medium">{code.code}</span>
                            <span className="ml-3 truncate text-xs text-slate-500">
                              {code.description ?? "No description"}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-4 text-sm text-slate-500">
                          Click cost codes on the left to add them here.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {formError ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p> : null}
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => {
                    setModalOpen(false);
                    setSelectedCostCodes([]);
                    setCostCodeQuery("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {editModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-2xl font-semibold text-slate-900">Edit Project</h2>
              <p className="mt-1 text-sm text-slate-500">Update project details.</p>
            </div>
            <form
              className="space-y-4 px-6 py-5"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!selectedProject) return;
                if (!editDraft.project_name.trim()) {
                  setEditError("Project name is required.");
                  return;
                }
                setSavingEdit(true);
                setEditError(null);
                const budgetValue = editDraft.budget.trim() ? Number(editDraft.budget) : null;
                const updated = await updateBidProject(selectedProject.id, {
                  project_name: editDraft.project_name,
                  owner: editDraft.owner.trim() || null,
                  location: editDraft.location.trim() || null,
                  budget: Number.isFinite(budgetValue) ? budgetValue : null,
                  due_date: editDraft.due_date.trim() || null,
                });
                if (!updated) {
                  setEditError("Unable to update the project. Check your Supabase permissions.");
                  setSavingEdit(false);
                  return;
                }
                setProjects((prev) => prev.map((project) => (project.id === updated.id ? updated : project)));
                setEditModalOpen(false);
                setSavingEdit(false);
              }}
            >
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <div>
                  <span className="font-semibold">Sub:</span>{" "}
                  {inviteTarget?.company || (inviteDraft.selected_sub_id ? "Selected subcontractor" : "Not selected")}
                </div>
                <div>
                  <span className="font-semibold">Status:</span> {inviteDraft.status}
                </div>
                <div>
                  <span className="font-semibold">Quote:</span>{" "}
                  {inviteDraft.bid_amount.trim() ? inviteDraft.bid_amount : "No quote entered"}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                  Project name
                  <input
                    value={editDraft.project_name}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, project_name: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Owner / Client
                  <input
                    value={editDraft.owner}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, owner: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Location
                  <input
                    value={editDraft.location}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, location: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Budget
                  <input
                    value={editDraft.budget}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, budget: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    inputMode="decimal"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Due date
                  <input
                    value={editDraft.due_date}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, due_date: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    type="date"
                  />
                </label>
              </div>
              {editError ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{editError}</p> : null}
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => setEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {editTradesModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
          <div className="flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-xl sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl">
            <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
              <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Edit Trades / Cost Codes</h2>
              <p className="mt-1 text-sm text-slate-500">Rename existing trades and add more trades to this project.</p>
            </div>
            <form
              className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:gap-5 sm:px-6 sm:py-5"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!selectedProject) return;
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
                const draftNames = persistedDrafts.map((trade) => trade.trade_name.toLowerCase());
                if (new Set(draftNames).size !== draftNames.length) {
                  setTradeEditError("Trade names must be unique.");
                  return;
                }

                const indexedDrafts = persistedDrafts.map((trade, index) => ({
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
                const updated = await updateBidTrades(selectedProject.id, existingPayload);
                if (!updated) {
                  setTradeEditError("Unable to update existing trades.");
                  setSavingTrades(false);
                  return;
                }
                const created = await createBidTrades(selectedProject.id, newPayload);
                if (!created) {
                  setTradeEditError("Unable to add new trades.");
                  setSavingTrades(false);
                  return;
                }

                const refreshed = await getBidProjectDetail(selectedProject.id);
                setDetail(refreshed);
                setTradeCostCodeQuery("");
                setManualTradeName("");
                setEditTradesModalOpen(false);
                setSavingTrades(false);
              }}
            >
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-900">
                <p className="font-semibold">Tip:</p>
                <p className="mt-1">Add new trades using the quick input or cost codes list. New entries appear immediately in Project Trades before saving.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 sm:gap-4">
                <div className="rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                    <div className="flex items-center justify-between gap-2">
                      <span>Project Trades</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{tradeDrafts.length}</span>
                    </div>
                  </div>
                  <div className="max-h-64 space-y-2 overflow-auto p-3 sm:max-h-80">
                    {tradeDrafts.length ? (
                      tradeDrafts.map((trade, index) => (
                        <div key={`${trade.id ?? "new"}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                              value={trade.trade_name}
                              onChange={(event) =>
                                setTradeDrafts((prev) =>
                                  prev.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, trade_name: event.target.value } : item
                                  )
                                )
                              }
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none sm:flex-1"
                              placeholder="Trade name"
                            />
                            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  setTradeDrafts((prev) => {
                                    if (index === 0) return prev;
                                    const next = [...prev];
                                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                    return next;
                                  })
                                }
                                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                aria-label="Move trade up"
                              >
                                Up
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setTradeDrafts((prev) => {
                                    if (index >= prev.length - 1) return prev;
                                    const next = [...prev];
                                    [next[index], next[index + 1]] = [next[index + 1], next[index]];
                                    return next;
                                  })
                                }
                                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                aria-label="Move trade down"
                              >
                                Down
                              </button>
                              {!trade.id ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTradeDrafts((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                                  }
                                  className="col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 sm:col-span-1"
                                  aria-label="Remove new trade"
                                >
                                  Remove
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                        No trades yet. Add from cost codes or create a manual trade.
                      </div>
                    )}
                  </div>
                  <div className="border-t border-slate-200 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={manualTradeName}
                        onChange={(event) => setManualTradeName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          const normalizedTrade = manualTradeName.trim();
                          if (!normalizedTrade) return;
                          if (tradeNamesLower.has(normalizedTrade.toLowerCase())) {
                            setTradeEditError("This trade already exists in the list.");
                            return;
                          }
                          setTradeDrafts((prev) => [
                            ...prev,
                            { id: null, trade_name: normalizedTrade, sort_order: prev.length + 1 },
                          ]);
                          setManualTradeName("");
                          setTradeEditError(null);
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                        placeholder="Type trade name and press Enter"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const normalizedTrade = manualTradeName.trim();
                          if (!normalizedTrade) {
                            setTradeEditError("Enter a trade name before adding.");
                            return;
                          }
                          if (tradeNamesLower.has(normalizedTrade.toLowerCase())) {
                            setTradeEditError("This trade already exists in the list.");
                            return;
                          }
                          setTradeDrafts((prev) => [
                            ...prev,
                            { id: null, trade_name: normalizedTrade, sort_order: prev.length + 1 },
                          ]);
                          setManualTradeName("");
                          setTradeEditError(null);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:whitespace-nowrap"
                      >
                        Add Manual Trade
                      </button>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50">
                  <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                    Add From Cost Codes
                  </div>
                  <div className="space-y-2 p-3">
                    {costCodeLoadError ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {costCodeLoadError}
                      </div>
                    ) : null}
                    <input
                      value={tradeCostCodeQuery}
                      onChange={(event) => setTradeCostCodeQuery(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                      placeholder="Search cost codes"
                    />
                    <div className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white sm:max-h-72">
                      {loadingCostCodes ? (
                        <div className="px-3 py-4 text-sm text-slate-500">Loading cost codes...</div>
                      ) : costCodes.length ? (
                        costCodes
                          .filter((code) => {
                            const label = `${code.code} ${code.description ?? ""}`.toLowerCase();
                            return label.includes(tradeCostCodeQuery.toLowerCase());
                          })
                          .filter((code) => {
                            const tradeLabel = `${code.code}${code.description ? ` ${code.description}` : ""}`.trim().toLowerCase();
                            return !tradeNamesLower.has(tradeLabel);
                          })
                          .map((code) => {
                            const tradeLabel = `${code.code}${code.description ? ` ${code.description}` : ""}`.trim();
                            return (
                              <button
                                key={code.id}
                                type="button"
                                onClick={() =>
                                  setTradeDrafts((prev) => {
                                    if (prev.some((trade) => trade.trade_name.trim().toLowerCase() === tradeLabel.toLowerCase())) {
                                      setTradeEditError("This trade already exists in the list.");
                                      return prev;
                                    }
                                    setTradeEditError(null);
                                    return [
                                      ...prev,
                                      {
                                        id: null,
                                        trade_name: tradeLabel,
                                        sort_order: prev.length + 1,
                                      },
                                    ];
                                  })
                                }
                                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <span className="font-medium">{code.code}</span>
                                <span className="ml-3 truncate text-xs text-slate-500">{code.description ?? "No description"}</span>
                              </button>
                            );
                          })
                      ) : (
                        <div className="px-3 py-4 text-sm text-slate-500">No cost codes found.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {tradeEditError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {tradeEditError}
                </p>
              ) : null}
              <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white pt-4">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => setEditTradesModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTrades}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingTrades ? "Saving..." : "Save Trades"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {inviteModalOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            aria-label="Close bid drawer"
            onClick={() => {
              setInviteModalOpen(false);
              setInviteTarget(null);
              setNewSubTrade(null);
            }}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-2xl font-semibold text-slate-900">Bid Details</h2>
              <p className="mt-1 text-sm text-slate-500">
                {inviteTarget ? `${inviteTarget.company} · ${inviteTarget.tradeName}` : newSubTrade ? `New invite · ${newSubTrade.tradeName}` : ""}
              </p>
            </div>
            <form
              className="space-y-4 px-6 py-5"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!selectedProject) return;
                setSavingInvite(true);
                setInviteError(null);
                const bidAmountValue = inviteDraft.bid_amount.trim() ? Number(inviteDraft.bid_amount) : null;
                const notesValue = inviteDraft.notes.trim() || null;
                if (inviteTarget) {
                  const ok = await createTradeBid({
                    project_id: selectedProject.id,
                    trade_id: inviteTarget.tradeId,
                    project_sub_id: inviteTarget.projectSubId,
                    status: inviteDraft.status,
                    bid_amount: Number.isFinite(bidAmountValue) ? bidAmountValue : null,
                    contact_name: inviteDraft.contact_name.trim() || null,
                    notes: notesValue,
                  });
                  if (!ok) {
                    setInviteError("Unable to add this sub to the trade.");
                    setSavingInvite(false);
                    return;
                  }
                } else if (inviteDraft.invitee_mode === "existing") {
                  if (!inviteDraft.selected_sub_id) {
                    setInviteError("Select a subcontractor.");
                    setSavingInvite(false);
                    return;
                  }
                  if (!newSubTrade) {
                    setInviteError("Select a trade to invite.");
                    setSavingInvite(false);
                    return;
                  }
                  const tradeId = newSubTrade.tradeId;
                  let resolvedProjectSubId = "";
                  if (!resolvedProjectSubId) {
                    const sortOrder = getNextProjectSubSortOrder(detail?.projectSubs);
                    const projectSub = await inviteSubToProject({
                      project_id: selectedProject.id,
                      subcontractor_id: inviteDraft.selected_sub_id,
                      sort_order: sortOrder,
                    });
                    if (!projectSub) {
                      setInviteError("Unable to invite subcontractor to project.");
                      setSavingInvite(false);
                      return;
                    }
                    resolvedProjectSubId = projectSub.id;
                  }
                  const ok = await createTradeBid({
                    project_id: selectedProject.id,
                    trade_id: tradeId,
                    project_sub_id: resolvedProjectSubId,
                    status: inviteDraft.status,
                    bid_amount: Number.isFinite(bidAmountValue) ? bidAmountValue : null,
                    contact_name: inviteDraft.contact_name.trim() || null,
                    notes: notesValue,
                  });
                  if (!ok) {
                    setInviteError("Unable to add this sub to the trade.");
                    setSavingInvite(false);
                    return;
                  }
                } else {
                  if (!newSubDraft.company_name.trim()) {
                    setInviteError("Company name is required.");
                    setSavingInvite(false);
                    return;
                  }
                  if (!newSubTrade) {
                    setInviteError("Select a trade to invite.");
                    setSavingInvite(false);
                    return;
                  }
                  const tradeId = newSubTrade.tradeId;
                  const sub = await createBidSubcontractor({
                    company_name: newSubDraft.company_name,
                    primary_contact: newSubDraft.primary_contact.trim() || null,
                    email: newSubDraft.email.trim() || null,
                    phone: newSubDraft.phone.trim() || null,
                  });
                  if (!sub) {
                    setInviteError("Unable to create subcontractor.");
                    setSavingInvite(false);
                    return;
                  }
                  const sortOrder = getNextProjectSubSortOrder(detail?.projectSubs);
                  const projectSub = await inviteSubToProject({
                    project_id: selectedProject.id,
                    subcontractor_id: sub.id,
                    sort_order: sortOrder,
                  });
                  if (!projectSub) {
                    setInviteError("Unable to invite subcontractor to project.");
                    setSavingInvite(false);
                    return;
                  }
                  const ok = await createTradeBid({
                    project_id: selectedProject.id,
                    trade_id: tradeId,
                    project_sub_id: projectSub.id,
                    status: inviteDraft.status,
                    bid_amount: Number.isFinite(bidAmountValue) ? bidAmountValue : null,
                    contact_name: inviteDraft.contact_name.trim() || null,
                    notes: notesValue,
                  });
                  if (!ok) {
                    setInviteError("Unable to add this sub to the trade.");
                    setSavingInvite(false);
                    return;
                  }
                }
                const refreshed = await getBidProjectDetail(selectedProject.id);
                setDetail(refreshed);
                setInviteModalOpen(false);
                setInviteTarget(null);
                setNewSubTrade(null);
                setInviteDraft({
                  status: "bidding",
                  bid_amount: "",
                  contact_name: "",
                  notes: "",
                  invitee_mode: "existing",
                  selected_sub_id: "",
                });
                setSubSearch("");
                setSavingInvite(false);
              }}
            >
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <div>
                  <span className="font-semibold">Sub:</span> {editBidDraft?.company_name ?? "Not selected"}
                </div>
                <div>
                  <span className="font-semibold">Status:</span> {editBidDraft?.status ?? "Not set"}
                </div>
                <div>
                  <span className="font-semibold">Quote:</span>{" "}
                  {editBidDraft?.bid_amount?.trim() ? editBidDraft.bid_amount : "No quote entered"}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {inviteTarget ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 sm:col-span-2">
                    Adding {inviteTarget.company} to {inviteTarget.tradeName}.
                  </div>
                ) : (
                  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                    Invitee
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setInviteDraft((prev) => ({ ...prev, invitee_mode: "existing" }))}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          inviteDraft.invitee_mode === "existing"
                            ? "border-slate-300 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        Existing Sub
                      </button>
                      <button
                        type="button"
                        onClick={() => setInviteDraft((prev) => ({ ...prev, invitee_mode: "new" }))}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          inviteDraft.invitee_mode === "new"
                            ? "border-slate-300 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        New Sub
                      </button>
                    </div>
                  </label>
                )}
                {!inviteTarget && inviteDraft.invitee_mode === "existing" ? (
                  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                    Subcontractor
                    <div className="flex flex-col gap-2">
                      <input
                        value={subSearch}
                        onChange={(event) => setSubSearch(event.target.value)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                        placeholder="Search subs"
                      />
                      <div className="max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white">
                        {subListLoading ? (
                          <div className="px-3 py-2 text-sm text-slate-500">Loading subs...</div>
                        ) : subList.length ? (
                          availableSubs.length ? (
                            availableSubs.map((sub) => (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => setInviteDraft((prev) => ({ ...prev, selected_sub_id: sub.id }))}
                                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                                  inviteDraft.selected_sub_id === sub.id ? "bg-slate-100 text-slate-900" : "hover:bg-slate-50"
                                }`}
                              >
                                <span className="font-medium">{sub.company_name}</span>
                                <span className="text-xs text-slate-500">{sub.primary_contact ?? "—"}</span>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-slate-500">All subs are already invited.</div>
                          )
                        ) : (
                          <div className="px-3 py-2 text-sm text-slate-500">No subs found.</div>
                        )}
                      </div>
                    </div>
                  </label>
                ) : !inviteTarget ? (
                  <>
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                      Company name
                      <input
                        value={newSubDraft.company_name}
                        onChange={(event) => setNewSubDraft((prev) => ({ ...prev, company_name: event.target.value }))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                      Primary contact
                      <input
                        value={newSubDraft.primary_contact}
                        onChange={(event) => setNewSubDraft((prev) => ({ ...prev, primary_contact: event.target.value }))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                      Email
                      <input
                        value={newSubDraft.email}
                        onChange={(event) => setNewSubDraft((prev) => ({ ...prev, email: event.target.value }))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                        type="email"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                      Phone
                      <input
                        value={newSubDraft.phone}
                        onChange={(event) => setNewSubDraft((prev) => ({ ...prev, phone: event.target.value }))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                      />
                    </label>
                  </>
                ) : null}
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Status
                  <select
                    value={inviteDraft.status}
                    onChange={(event) =>
                      setInviteDraft((prev) => ({ ...prev, status: event.target.value as BidTradeStatus }))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  >
                    <option value="invited">Invited</option>
                    <option value="bidding">Bidding</option>
                    <option value="submitted">Submitted</option>
                    <option value="declined">Declined</option>
                    <option value="ghosted">Ghosted</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Bid amount
                  <input
                    value={inviteDraft.bid_amount}
                    onChange={(event) => setInviteDraft((prev) => ({ ...prev, bid_amount: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    inputMode="decimal"
                    placeholder="e.g. 250000"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                  Contact name
                  <input
                    value={inviteDraft.contact_name}
                    onChange={(event) => setInviteDraft((prev) => ({ ...prev, contact_name: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    placeholder="Optional"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                  Inclusions / Exclusions Notes
                  <textarea
                    value={inviteDraft.notes}
                    onChange={(event) => setInviteDraft((prev) => ({ ...prev, notes: event.target.value }))}
                    className="min-h-[96px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    placeholder="Add bid notes, scope clarifications, or special terms."
                  />
                </label>
              </div>
              {inviteError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {inviteError}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => {
                    setInviteModalOpen(false);
                    setInviteTarget(null);
                    setNewSubTrade(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={() => setInviteDraft((prev) => ({ ...prev, status: "invited" }))}
                  disabled={savingInvite}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingInvite ? "Saving..." : "Invite"}
                </button>
                <button
                  type="submit"
                  onClick={() => setInviteDraft((prev) => ({ ...prev, status: "bidding" }))}
                  disabled={savingInvite}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Remind
                </button>
                <button
                  type="submit"
                  onClick={() => setInviteDraft((prev) => ({ ...prev, status: "declined" }))}
                  disabled={savingInvite}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Mark Declined
                </button>
                <button
                  type="button"
                  onClick={() => setInviteError("Upload proposal is coming soon.")}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Upload proposal
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
      {editBidModalOpen && editBidDraft ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            aria-label="Close bid drawer"
            onClick={() => setEditBidModalOpen(false)}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-2xl font-semibold text-slate-900">Bid Details</h2>
              <p className="mt-1 text-sm text-slate-500">Update status, quote, and scope notes.</p>
            </div>
            <form
              className="space-y-4 px-6 py-5"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!editBidDraft) return;
                if (!editBidDraft.company_name.trim()) {
                  setEditBidError("Company name is required.");
                  return;
                }
                setSavingBidEdit(true);
                setEditBidError(null);
                const bidAmountValue = editBidDraft.bid_amount.trim() ? Number(editBidDraft.bid_amount) : null;
                const [bidOk, subOk] = await Promise.all([
                  updateTradeBid({
                    id: editBidDraft.bid_id,
                    status: editBidDraft.status,
                    bid_amount: Number.isFinite(bidAmountValue) ? bidAmountValue : null,
                    contact_name: editBidDraft.contact_name.trim() || null,
                    notes: editBidDraft.notes.trim() || null,
                  }),
                  updateBidSubcontractor({
                    id: editBidDraft.sub_id,
                    company_name: editBidDraft.company_name,
                    primary_contact: editBidDraft.primary_contact.trim() || null,
                    email: editBidDraft.email.trim() || null,
                    phone: editBidDraft.phone.trim() || null,
                  }),
                ]);
                if (!bidOk || !subOk) {
                  setEditBidError("Unable to save changes.");
                  setSavingBidEdit(false);
                  return;
                }
                if (selectedProject) {
                  const refreshed = await getBidProjectDetail(selectedProject.id);
                  setDetail(refreshed);
                }
                setEditBidModalOpen(false);
                setSavingBidEdit(false);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                  Company name
                  <input
                    value={editBidDraft.company_name}
                    onChange={(event) =>
                      setEditBidDraft((prev) => (prev ? { ...prev, company_name: event.target.value } : prev))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Primary contact
                  <input
                    value={editBidDraft.primary_contact}
                    onChange={(event) =>
                      setEditBidDraft((prev) => (prev ? { ...prev, primary_contact: event.target.value } : prev))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Email
                  <input
                    value={editBidDraft.email}
                    onChange={(event) =>
                      setEditBidDraft((prev) => (prev ? { ...prev, email: event.target.value } : prev))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    type="email"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Phone
                  <input
                    value={editBidDraft.phone}
                    onChange={(event) =>
                      setEditBidDraft((prev) => (prev ? { ...prev, phone: event.target.value } : prev))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Status
                  <select
                    value={editBidDraft.status}
                    onChange={(event) =>
                      setEditBidDraft((prev) => (prev ? { ...prev, status: event.target.value as BidTradeStatus } : prev))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  >
                    <option value="invited">Invited</option>
                    <option value="bidding">Bidding</option>
                    <option value="submitted">Submitted</option>
                    <option value="declined">Declined</option>
                    <option value="ghosted">Ghosted</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Bid amount
                  <input
                    value={editBidDraft.bid_amount}
                    onChange={(event) =>
                      setEditBidDraft((prev) => (prev ? { ...prev, bid_amount: event.target.value } : prev))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    inputMode="decimal"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                  Bid contact name
                  <input
                    value={editBidDraft.contact_name}
                    onChange={(event) =>
                      setEditBidDraft((prev) => (prev ? { ...prev, contact_name: event.target.value } : prev))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                  Inclusions / Exclusions Notes
                  <textarea
                    value={editBidDraft.notes}
                    onChange={(event) =>
                      setEditBidDraft((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                    }
                    className="min-h-[96px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    placeholder="Add bid notes, scope clarifications, or special terms."
                  />
                </label>
              </div>
              {editBidError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {editBidError}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => setEditBidModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={() =>
                    setEditBidDraft((prev) => (prev ? { ...prev, status: "invited" } : prev))
                  }
                  disabled={savingBidEdit}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingBidEdit ? "Saving..." : "Invite"}
                </button>
                <button
                  type="submit"
                  onClick={() =>
                    setEditBidDraft((prev) => (prev ? { ...prev, status: "bidding" } : prev))
                  }
                  disabled={savingBidEdit}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Remind
                </button>
                <button
                  type="submit"
                  onClick={() =>
                    setEditBidDraft((prev) => (prev ? { ...prev, status: "declined" } : prev))
                  }
                  disabled={savingBidEdit}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Mark Declined
                </button>
                <button
                  type="button"
                  onClick={() => setEditBidError("Upload proposal is coming soon.")}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Upload proposal
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
