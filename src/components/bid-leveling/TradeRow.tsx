"use client";

import BudgetCell from "@/components/bid-leveling/BudgetCell";
import BidLane from "@/components/bid-leveling/BidLane";
import { computeTradeStats, formatCurrency, formatPercent } from "@/components/bid-leveling/utils";
import type { BidTrade, BidProjectSub } from "@/lib/bidding/types";
import type { LevelingBid } from "@/lib/bidding/leveling-types";

type TradeRowProps = {
  trade: BidTrade;
  allSubs: BidProjectSub[];
  bids: LevelingBid[];
  budget: { amount: number | null; notes: string | null };
  readOnly: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onBudgetChange: (payload: { value: number | null; notes: string | null }) => void;
  onOpenBid: (subId: string) => void;
  onStatusChange: (bid: LevelingBid, status: LevelingBid["status"]) => void;
  onRemoveBid: (bid: LevelingBid) => void;
  onAddSub: (subId: string) => void;
};

export default function TradeRow({
  trade,
  allSubs,
  bids,
  budget,
  readOnly,
  expanded,
  onToggleExpand,
  onBudgetChange,
  onOpenBid,
  onStatusChange,
  onRemoveBid,
  onAddSub,
}: TradeRowProps) {
  const stats = computeTradeStats(bids, budget.amount);

  return (
    <>
      <tr className="border-b border-slate-200 align-top">
        <th className="sticky left-0 z-20 border-r border-slate-200 bg-white px-3 py-3 text-left align-top">
          <button
            type="button"
            onClick={onToggleExpand}
            className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500"
          >
            <span className={`inline-block transition ${expanded ? "rotate-90" : ""}`}>▶</span>
            Details
          </button>
          <div className="text-sm font-semibold text-slate-900">{trade.trade_name}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
            <span>Low {formatCurrency(stats.low)}</span>
            <span>High {formatCurrency(stats.high)}</span>
            <span>
              Spread {formatCurrency(stats.spreadAmount)} ({formatPercent(stats.spreadPercent)})
            </span>
            <span>Avg {formatCurrency(stats.average)}</span>
            <span>
              Budget delta {formatCurrency(stats.budgetDeltaAmount)} ({formatPercent(stats.budgetDeltaPercent)})
            </span>
            <span>{stats.coverageCount} submitted</span>
          </div>
        </th>

        <td className="sticky left-[280px] z-10 border-r border-slate-200 bg-white px-3 py-3 align-top">
          <BudgetCell value={budget.amount} notes={budget.notes} readOnly={readOnly} onChange={onBudgetChange} />
        </td>

        <td className="px-3 py-3 align-top">
          <BidLane
            bids={bids}
            allSubs={allSubs}
            readOnly={readOnly}
            budgetAmount={budget.amount}
            onOpenBid={onOpenBid}
            onStatusChange={onStatusChange}
            onRemoveBid={onRemoveBid}
            onAddSub={onAddSub}
          />
        </td>
      </tr>

      {expanded ? (
        <tr className="border-b border-slate-200 bg-slate-50/50">
          <td className="sticky left-0 z-20 border-r border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-600" colSpan={2}>
            Trade details
          </td>
          <td className="px-3 py-2 text-xs text-slate-600">
            {bids.length ? `${bids.length} invited/submitted subs in this trade.` : "No subs in this trade yet."}
          </td>
        </tr>
      ) : null}
    </>
  );
}
