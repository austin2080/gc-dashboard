"use client";

import { useMemo } from "react";
import type { BidTradeStatus } from "@/lib/bidding/types";

export type TradeSubBid = {
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

export type TradeRowData = {
  tradeId: string;
  trade: string;
  bidsBySubId: Record<string, TradeSubBid | null>;
};

export type TradeSlot = {
  key: string;
  bid: TradeSubBid | null;
};

type TradeRowProps = {
  row: TradeRowData;
  visibleSlots: TradeSlot[];
  extraBids: TradeSubBid[];
  expanded: boolean;
  onToggle: (tradeId: string) => void;
  onAddSubForTrade: (payload: { tradeId: string; tradeName: string }) => void;
  onEditBid: (bid: TradeSubBid) => void;
};

const STATUS_STYLES: Record<BidTradeStatus, string> = {
  submitted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  bidding: "bg-blue-50 text-blue-700 border-blue-200",
  invited: "bg-slate-100 text-slate-700 border-slate-200",
  declined: "bg-rose-50 text-rose-700 border-rose-200",
  ghosted: "bg-amber-50 text-amber-700 border-amber-200",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizeTradeLabel(value: string) {
  const match = value.match(/^(\d{2}(?:\.\d{2})?)\s+(.+)/);
  if (!match) {
    return { csi: null as string | null, tradeName: value };
  }
  return { csi: match[1], tradeName: match[2] };
}

function bidPriority(status: BidTradeStatus) {
  if (status === "submitted") return 0;
  if (status === "bidding") return 1;
  if (status === "invited") return 2;
  if (status === "ghosted") return 3;
  return 4;
}

function computeCounts(row: TradeRowData) {
  let submitted = 0;
  let bidding = 0;
  let invited = 0;
  let active = 0;

  Object.values(row.bidsBySubId).forEach((bid) => {
    if (!bid || bid.status === "declined") return;
    active += 1;
    if (bid.status === "submitted") submitted += 1;
    else if (bid.status === "bidding") bidding += 1;
    else if (bid.status === "invited") invited += 1;
  });

  return { submitted, bidding, invited, active };
}

function getCoverageBadge(active: number) {
  if (active >= 3) return { label: "Healthy", style: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (active === 2) return { label: "Thin", style: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "Critical", style: "bg-rose-50 text-rose-700 border-rose-200" };
}

function getLevelingMetrics(row: TradeRowData) {
  const amounts = Object.values(row.bidsBySubId)
    .map((bid) => bid?.bidAmount)
    .filter((amount): amount is number => typeof amount === "number" && Number.isFinite(amount));

  if (!amounts.length) return null;

  const low = Math.min(...amounts);
  const high = Math.max(...amounts);
  const spreadPct = low > 0 && amounts.length > 1 ? Math.round(((high - low) / low) * 100) : null;

  return {
    low,
    spreadPct,
  };
}

function sortBids(bids: TradeSubBid[]) {
  return [...bids].sort((a, b) => {
    const byStatus = bidPriority(a.status) - bidPriority(b.status);
    if (byStatus !== 0) return byStatus;

    const aAmount = a.bidAmount ?? Number.MAX_SAFE_INTEGER;
    const bAmount = b.bidAmount ?? Number.MAX_SAFE_INTEGER;
    if (aAmount !== bAmount) return aAmount - bAmount;

    return a.company.localeCompare(b.company);
  });
}

export default function TradeRow({ row, visibleSlots, extraBids, expanded, onToggle, onAddSubForTrade, onEditBid }: TradeRowProps) {
  const { csi, tradeName } = normalizeTradeLabel(row.trade);
  const counts = useMemo(() => computeCounts(row), [row]);
  const coveragePct = Math.min(100, Math.round((counts.active / 3) * 100));
  const coverageBadge = getCoverageBadge(counts.active);
  const leveling = getLevelingMetrics(row);
  const sortedExtra = useMemo(() => sortBids(extraBids), [extraBids]);

  return (
    <>
      <tr className="align-top">
        <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-2 text-left">
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => onToggle(row.tradeId)}
              className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
              aria-label={`${expanded ? "Collapse" : "Expand"} ${tradeName}`}
              aria-expanded={expanded}
            >
              <svg className={`h-3.5 w-3.5 transition ${expanded ? "rotate-90" : ""}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M7.5 5.5L12.5 10L7.5 14.5V5.5Z" />
              </svg>
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{csi ?? "Trade"}</p>
              <p className="truncate text-sm font-semibold text-slate-900">{tradeName}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-slate-500">Coverage: {counts.active}/3</span>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-1.5 rounded-full bg-slate-700" style={{ width: `${coveragePct}%` }} />
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${coverageBadge.style}`}>{coverageBadge.label}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {counts.submitted} submitted • {counts.bidding} bidding • {counts.invited} invited
              </p>
              {leveling ? (
                <p className="mt-1 text-[11px] text-slate-500">
                  Low {formatCurrency(leveling.low)}
                  {typeof leveling.spreadPct === "number" ? ` • Spread ${leveling.spreadPct}%` : ""}
                </p>
              ) : null}
            </div>
          </div>
        </th>

        {visibleSlots.map((slot) => (
          <td key={slot.key} className="border-b border-r border-slate-200 p-2 align-top">
            {slot.bid ? (
              <button
                type="button"
                onClick={() => onEditBid(slot.bid as TradeSubBid)}
                className="group w-full rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:border-slate-300 hover:bg-slate-50"
              >
                <p className="truncate text-sm font-semibold text-slate-900">{slot.bid.company}</p>
                <p className="truncate text-xs text-slate-500">{slot.bid.contact}</p>
                <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[slot.bid.status]}`}>
                  {slot.bid.status}
                </span>
                {slot.bid.bidAmount ? <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(slot.bid.bidAmount)}</p> : null}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onAddSubForTrade({ tradeId: row.tradeId, tradeName: row.trade })}
                title="Invite a sub"
                className="inline-flex h-16 w-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              >
                + Add
              </button>
            )}
          </td>
        ))}

        <td className="border-b border-slate-200 p-2 text-center align-middle">
          <button
            type="button"
            onClick={() => onAddSubForTrade({ tradeId: row.tradeId, tradeName: row.trade })}
            aria-label={`Invite sub to ${tradeName}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-base text-slate-500 transition hover:bg-slate-50"
          >
            +
          </button>
        </td>
      </tr>

      {expanded ? (
        <tr>
          <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500" colSpan={visibleSlots.length + 2}>
            {sortedExtra.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-600">More bidders:</span>
                {sortedExtra.map((bid) => (
                  <button
                    key={bid.bidId}
                    type="button"
                    onClick={() => onEditBid(bid)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:border-slate-300"
                  >
                    {bid.company}
                    {bid.bidAmount ? ` ${formatCurrency(bid.bidAmount)}` : ""}
                  </button>
                ))}
              </div>
            ) : (
              "No additional bidders."
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}
