"use client";

import { useState } from "react";
import TradeRow from "@/components/bid-leveling/TradeRow";
import type { BidTrade, BidProjectSub } from "@/lib/bidding/types";
import type { LevelingBid } from "@/lib/bidding/leveling-types";

type LevelingGridProps = {
  trades: BidTrade[];
  allSubs: BidProjectSub[];
  bidsByTradeId: Map<string, LevelingBid[]>;
  budgetsByTrade: Map<string, { amount: number | null; notes: string | null }>;
  readOnly: boolean;
  onBudgetChange: (payload: { tradeId: string; value: number | null; notes: string | null }) => void;
  onOpenBid: (payload: { tradeId: string; subId: string }) => void;
  onStatusChange: (payload: { tradeId: string; bid: LevelingBid; status: LevelingBid["status"] }) => void;
  onRemoveBid: (payload: { tradeId: string; bid: LevelingBid }) => void;
  onAddSub: (payload: { tradeId: string; subId: string }) => void;
  onCreateAndAddSub: (payload: {
    tradeId: string;
    companyName: string;
    contact: string;
    email: string;
    phone: string;
  }) => Promise<void>;
};

export default function LevelingGrid({
  trades,
  allSubs,
  bidsByTradeId,
  budgetsByTrade,
  readOnly,
  onBudgetChange,
  onOpenBid,
  onStatusChange,
  onRemoveBid,
  onAddSub,
  onCreateAndAddSub,
}: LevelingGridProps) {
  const [expandedByTrade, setExpandedByTrade] = useState<Record<string, boolean>>({});

  const tradeWidth = 280;
  const budgetWidth = 220;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="max-h-[72vh] overflow-auto">
        <table
          className="w-full table-fixed border-separate border-spacing-0"
          style={{ minWidth: `${tradeWidth + budgetWidth + 760}px` }}
        >
          <colgroup>
            <col style={{ width: `${tradeWidth}px` }} />
            <col style={{ width: `${budgetWidth}px` }} />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 border-b border-r border-slate-200 bg-slate-100 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Trade
              </th>
              <th className="sticky left-[280px] top-0 z-20 border-b border-r border-slate-200 bg-slate-100 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Budget
              </th>
              <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Bids
              </th>
            </tr>
          </thead>

          <tbody>
            {trades.map((trade) => (
              <TradeRow
                key={trade.id}
                trade={trade}
                allSubs={allSubs}
                bids={bidsByTradeId.get(trade.id) ?? []}
                budget={budgetsByTrade.get(trade.id) ?? { amount: null, notes: null }}
                readOnly={readOnly}
                expanded={Boolean(expandedByTrade[trade.id])}
                onToggleExpand={() =>
                  setExpandedByTrade((prev) => ({
                    ...prev,
                    [trade.id]: !prev[trade.id],
                  }))
                }
                onBudgetChange={(payload) => onBudgetChange({ tradeId: trade.id, ...payload })}
                onOpenBid={(subId) => onOpenBid({ tradeId: trade.id, subId })}
                onStatusChange={(bid, status) => onStatusChange({ tradeId: trade.id, bid, status })}
                onRemoveBid={(bid) => onRemoveBid({ tradeId: trade.id, bid })}
                onAddSub={(subId) => onAddSub({ tradeId: trade.id, subId })}
                onCreateAndAddSub={(payload) =>
                  onCreateAndAddSub({
                    tradeId: trade.id,
                    ...payload,
                  })
                }
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
