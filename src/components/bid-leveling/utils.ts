import type { LevelingBid } from "@/lib/bidding/leveling-types";

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return `${value.toFixed(1)}%`;
}

export type TradeStats = {
  low: number | null;
  high: number | null;
  spreadAmount: number | null;
  spreadPercent: number | null;
  average: number | null;
  budgetDeltaAmount: number | null;
  budgetDeltaPercent: number | null;
  coverageCount: number;
};

export function computeTradeStats(bids: LevelingBid[], budgetAmount: number | null): TradeStats {
  const submittedValues = bids
    .filter((bid) => bid.status === "submitted" && bid.base_bid_amount !== null)
    .map((bid) => bid.base_bid_amount as number);

  if (!submittedValues.length) {
    return {
      low: null,
      high: null,
      spreadAmount: null,
      spreadPercent: null,
      average: null,
      budgetDeltaAmount: null,
      budgetDeltaPercent: null,
      coverageCount: 0,
    };
  }

  const low = Math.min(...submittedValues);
  const high = Math.max(...submittedValues);
  const average = submittedValues.reduce((sum, value) => sum + value, 0) / submittedValues.length;
  const spreadAmount = high - low;
  const spreadPercent = low > 0 ? (spreadAmount / low) * 100 : null;
  const budgetDeltaAmount = budgetAmount !== null ? low - budgetAmount : null;
  const budgetDeltaPercent = budgetAmount && budgetAmount > 0 && budgetDeltaAmount !== null ? (budgetDeltaAmount / budgetAmount) * 100 : null;

  return {
    low,
    high,
    spreadAmount,
    spreadPercent,
    average,
    budgetDeltaAmount,
    budgetDeltaPercent,
    coverageCount: submittedValues.length,
  };
}

export function computeConditionalClasses(bid: LevelingBid | null, lowBidAmount: number | null): string {
  if (!bid || bid.base_bid_amount === null) return "bg-slate-50 text-slate-400";
  if (bid.status !== "submitted" || lowBidAmount === null) return "bg-white text-slate-900";

  const pctOverLow = lowBidAmount > 0 ? ((bid.base_bid_amount - lowBidAmount) / lowBidAmount) * 100 : 0;
  if (pctOverLow <= 0) return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200";
  if (pctOverLow <= 5) return "bg-amber-50 text-amber-900 ring-1 ring-amber-200";
  if (pctOverLow > 10) return "bg-rose-50 text-rose-900 ring-1 ring-rose-200";
  return "bg-white text-slate-900";
}

export function parseCurrencyInput(value: string): number | null {
  return parseMoney(value);
}

export function parseMoney(value: string): number | null {
  const normalized = value.replace(/[$,\s]/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
