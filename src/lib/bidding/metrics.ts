import type { BidProjectDetail, BidTradeStatus } from "@/lib/bidding/types";

export const TARGET_BIDS_PER_TRADE = 3;

export type CoverageSnapshot = {
  coveragePct: number;
  coverageNumerator: number;
  coverageDenominator: number;
  targetBidsPerTrade: number;
  tradesThin: string[];
  awaitingResponsesCount: number;
  submittedCount: number;
};

function isAwaiting(status: BidTradeStatus) {
  return status === "invited" || status === "bidding" || status === "ghosted";
}

export function computeCoverageSnapshot(detail: BidProjectDetail, targetBidsPerTrade = TARGET_BIDS_PER_TRADE): CoverageSnapshot {
  const tradesTotal = detail.trades.length;
  const denominator = Math.max(tradesTotal * targetBidsPerTrade, 1);

  const bidsByTrade = new Map<string, { active: number; submitted: number }>();
  detail.tradeBids.forEach((bid) => {
    if (bid.status === "declined") return;
    const entry = bidsByTrade.get(bid.trade_id) ?? { active: 0, submitted: 0 };
    entry.active += 1;
    if (bid.status === "submitted") {
      entry.submitted += 1;
    }
    bidsByTrade.set(bid.trade_id, entry);
  });

  const submittedCount = detail.tradeBids.filter((bid) => bid.status === "submitted").length;
  const coverageNumerator = submittedCount;
  const coveragePct = Math.max(0, Math.min(100, Math.round((coverageNumerator / denominator) * 100)));

  const tradesThin = detail.trades
    .filter((trade) => (bidsByTrade.get(trade.id)?.active ?? 0) < 2)
    .map((trade) => trade.trade_name);

  const awaitingResponsesCount = detail.tradeBids.filter((bid) => isAwaiting(bid.status)).length;

  return {
    coveragePct,
    coverageNumerator,
    coverageDenominator: denominator,
    targetBidsPerTrade,
    tradesThin,
    awaitingResponsesCount,
    submittedCount,
  };
}
