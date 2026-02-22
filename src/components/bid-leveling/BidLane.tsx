"use client";

import BidCard from "@/components/bid-leveling/BidCard";
import AddSubCard from "@/components/bid-leveling/AddSubCard";
import { computeTradeStats } from "@/components/bid-leveling/utils";
import type { BidProjectSub } from "@/lib/bidding/types";
import type { LevelingBid } from "@/lib/bidding/leveling-types";

type BidLaneProps = {
  bids: LevelingBid[];
  allSubs: BidProjectSub[];
  readOnly: boolean;
  budgetAmount: number | null;
  onOpenBid: (subId: string) => void;
  onStatusChange: (bid: LevelingBid, status: LevelingBid["status"]) => void;
  onRemoveBid: (bid: LevelingBid) => void;
  onAddSub: (subId: string) => void;
  getBidCardId?: (bid: LevelingBid) => string;
};

export default function BidLane({
  bids,
  allSubs,
  readOnly,
  budgetAmount,
  onOpenBid,
  onStatusChange,
  onRemoveBid,
  onAddSub,
  getBidCardId,
}: BidLaneProps) {
  const stats = computeTradeStats(bids, budgetAmount);

  const bySub = new Set(bids.map((bid) => bid.sub_id));
  const availableSubs = allSubs.filter((sub) => !bySub.has(sub.id));

  if (!bids.length) {
    return (
      <div className="flex min-h-[132px] items-stretch gap-3 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex min-w-[220px] items-center rounded-xl border border-dashed border-slate-300 px-3 text-sm text-slate-500">
          No bids yet
        </div>
        <AddSubCard availableSubs={availableSubs} readOnly={readOnly} onAdd={onAddSub} />
      </div>
    );
  }

  return (
    <div className="flex min-h-[132px] items-stretch gap-3 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
      {bids.map((bid) => {
        const sub = allSubs.find((row) => row.id === bid.sub_id) ?? null;
        return (
          <BidCard
            key={`${bid.trade_id}:${bid.sub_id}`}
            bid={bid}
            cardId={getBidCardId?.(bid)}
            subName={sub?.subcontractor?.company_name ?? "Unknown sub"}
            lowBidAmount={stats.low}
            readOnly={readOnly}
            onOpen={() => onOpenBid(bid.sub_id)}
            onStatusChange={(status) => onStatusChange(bid, status)}
            onRemove={() => onRemoveBid(bid)}
          />
        );
      })}
      <AddSubCard availableSubs={availableSubs} readOnly={readOnly} onAdd={onAddSub} />
    </div>
  );
}
