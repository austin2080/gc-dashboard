"use client";

import type { LevelingBid } from "@/lib/bidding/leveling-types";
import { formatCurrency } from "@/components/bid-leveling/utils";

type BidCardProps = {
  bid: LevelingBid;
  subName: string;
  lowBidAmount: number | null;
  readOnly: boolean;
  onOpen: () => void;
  onStatusChange: (status: LevelingBid["status"]) => void;
  onRemove: () => void;
};

function statusPill(status: LevelingBid["status"]): string {
  if (status === "submitted") return "bg-emerald-100 text-emerald-800";
  if (status === "bidding") return "bg-blue-100 text-blue-800";
  if (status === "declined") return "bg-rose-100 text-rose-800";
  if (status === "no_response") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

function cardStyle(bid: LevelingBid, lowBidAmount: number | null): string {
  if (bid.base_bid_amount === null || bid.status !== "submitted" || lowBidAmount === null) {
    return "border-slate-200 bg-white";
  }
  const pct = lowBidAmount > 0 ? ((bid.base_bid_amount - lowBidAmount) / lowBidAmount) * 100 : 0;
  if (pct <= 0) return "border-emerald-300 bg-emerald-50";
  if (pct <= 5) return "border-amber-300 bg-amber-50";
  if (pct > 10) return "border-rose-300 bg-rose-50";
  return "border-slate-200 bg-white";
}

export default function BidCard({ bid, subName, lowBidAmount, readOnly, onOpen, onStatusChange, onRemove }: BidCardProps) {
  const isLow =
    bid.status === "submitted" && bid.base_bid_amount !== null && lowBidAmount !== null && Number(bid.base_bid_amount) === lowBidAmount;

  return (
    <article className={`w-[210px] flex-none rounded-xl border p-3 ${cardStyle(bid, lowBidAmount)}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{subName}</p>
          <span className={`mt-1 inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusPill(bid.status)}`}>
            {bid.status.replace("_", " ")}
          </span>
        </div>
        {isLow ? <span className="rounded bg-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-900">LOW</span> : null}
      </div>

      <p className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(bid.base_bid_amount)}</p>

      <div className="mt-3 space-y-2">
        <button
          type="button"
          onClick={onOpen}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"
        >
          Open
        </button>

        <select
          value={bid.status}
          onChange={(event) => onStatusChange(event.target.value as LevelingBid["status"])}
          disabled={readOnly}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 disabled:bg-slate-100"
        >
          <option value="invited">Invited</option>
          <option value="bidding">Bidding</option>
          <option value="submitted">Submitted</option>
          <option value="declined">Declined</option>
          <option value="no_response">No response</option>
        </select>

        <button
          type="button"
          onClick={onRemove}
          disabled={readOnly}
          className="w-full rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-xs font-semibold text-rose-700 disabled:bg-slate-100"
        >
          Remove from trade
        </button>
      </div>
    </article>
  );
}
