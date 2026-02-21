"use client";

import type { LevelingBid } from "@/lib/bidding/leveling-types";
import { computeConditionalClasses, formatCurrency } from "@/components/bid-leveling/utils";

type BidCellProps = {
  bid: LevelingBid | null;
  lowBidAmount: number | null;
  readOnly: boolean;
  onClick: () => void;
};

function StatusPill({ status }: { status: LevelingBid["status"] }) {
  const styles: Record<LevelingBid["status"], string> = {
    submitted: "bg-emerald-100 text-emerald-800",
    bidding: "bg-blue-100 text-blue-800",
    declined: "bg-rose-100 text-rose-800",
    no_response: "bg-amber-100 text-amber-800",
    invited: "bg-slate-100 text-slate-700",
  };

  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export default function BidCell({ bid, lowBidAmount, readOnly, onClick }: BidCellProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={readOnly}
      className={`w-full rounded-md p-2 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed ${computeConditionalClasses(
        bid,
        lowBidAmount
      )}`}
    >
      {bid ? (
        <div className="space-y-1">
          <StatusPill status={bid.status} />
          <div className="text-xs font-semibold">{formatCurrency(bid.base_bid_amount)}</div>
        </div>
      ) : (
        <div className="text-xs text-slate-400">No bid</div>
      )}
    </button>
  );
}
