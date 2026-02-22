"use client";

import type { LevelingBid } from "@/lib/bidding/leveling-types";
import { formatCurrency } from "@/components/bid-leveling/utils";
import BidCardActionBar from "@/components/bid-leveling/BidCardActionBar";

type BidCardProps = {
  bid: LevelingBid;
  subName: string;
  cardId?: string;
  lowBidAmount: number | null;
  readOnly: boolean;
  onOpen: () => void;
  onStatusChange: (status: LevelingBid["status"]) => void;
  onRemove: () => void;
};

function statusPill(status: LevelingBid["status"]): string {
  if (status === "submitted") return "bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-300";
  if (status === "bidding") return "bg-blue-100 text-blue-900 ring-1 ring-inset ring-blue-300";
  if (status === "declined") return "bg-rose-100 text-rose-900 ring-1 ring-inset ring-rose-300";
  if (status === "no_response") return "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300";
  return "bg-slate-100 text-slate-900 ring-1 ring-inset ring-slate-300";
}

function statusIcon(status: LevelingBid["status"]): string {
  if (status === "submitted") return "●";
  if (status === "bidding") return "◔";
  if (status === "declined") return "✕";
  if (status === "no_response") return "◌";
  return "○";
}

function comparisonLabel(bid: LevelingBid, lowBidAmount: number | null): string {
  if (bid.base_bid_amount === null) {
    if (bid.status === "invited") return "Waiting on proposal";
    if (bid.status === "bidding") return "Pricing in progress";
    return "No amount submitted";
  }
  if (lowBidAmount === null || lowBidAmount <= 0) return "Benchmark unavailable";

  const pct = ((bid.base_bid_amount - lowBidAmount) / lowBidAmount) * 100;
  if (pct <= 0) return "Best price";
  return `+${pct.toFixed(1)}% vs low`;
}

function cardStyle(bid: LevelingBid, lowBidAmount: number | null): string {
  if (
    bid.base_bid_amount === null ||
    bid.status !== "submitted" ||
    lowBidAmount === null
  ) {
    return "border-slate-200 bg-white";
  }
  const pct =
    lowBidAmount > 0
      ? ((bid.base_bid_amount - lowBidAmount) / lowBidAmount) * 100
      : 0;
  if (pct <= 0) return "border-emerald-300 bg-emerald-50";
  if (pct <= 5) return "border-amber-300 bg-amber-50";
  if (pct > 10) return "border-rose-300 bg-rose-50";
  return "border-slate-200 bg-white";
}

export default function BidCard({
  bid,
  subName,
  cardId,
  lowBidAmount,
  readOnly,
  onOpen,
  onStatusChange,
  onRemove,
}: BidCardProps) {
  const isLow =
    bid.status === "submitted" &&
    bid.base_bid_amount !== null &&
    lowBidAmount !== null &&
    Number(bid.base_bid_amount) === lowBidAmount;

  return (
    <article
      data-bid-card-id={cardId}
      tabIndex={-1}
      className={`w-[210px] flex-none rounded-xl border p-3 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${cardStyle(bid, lowBidAmount)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-950">{subName}</p>
          <span
            className={`mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusPill(bid.status)}`}
          >
            <span aria-hidden="true" className="text-[11px] leading-none">
              {statusIcon(bid.status)}
            </span>
            {bid.status.replace("_", " ")}
          </span>
        </div>
        {isLow ? (
          <span className="rounded bg-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-900">
            LOW
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-base font-extrabold text-slate-950">
        {formatCurrency(bid.base_bid_amount)}
      </p>
      <p className="mt-0.5 text-xs font-medium text-slate-700">
        {comparisonLabel(bid, lowBidAmount)}
      </p>

      <BidCardActionBar
        status={bid.status}
        readOnly={readOnly}
        onOpen={onOpen}
        onStatusChange={onStatusChange}
        onRemove={onRemove}
      />
    </article>
  );
}
