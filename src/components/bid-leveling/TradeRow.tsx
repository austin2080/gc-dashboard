"use client";

import BudgetCell from "@/components/bid-leveling/BudgetCell";
import BidLane from "@/components/bid-leveling/BidLane";
import {
  computeTradeStats,
  formatCurrency,
  formatPercent,
} from "@/components/bid-leveling/utils";
import type { BidTrade, BidProjectSub } from "@/lib/bidding/types";
import type { LevelingBid } from "@/lib/bidding/leveling-types";

type RecommendationRiskLevel = "Low" | "Med" | "High";

type TradeRecommendation = {
  bid: LevelingBid;
  amount: number;
  subName: string;
  rationales: string[];
  riskLevel: RecommendationRiskLevel;
  ruleExplanation: string;
};

function getTradeRecommendation(
  bids: LevelingBid[],
  allSubs: BidProjectSub[],
  budgetAmount: number | null,
): TradeRecommendation | null {
  const submittedBids = bids.filter(
    (bid) => bid.status === "submitted" && bid.base_bid_amount !== null,
  );
  if (!submittedBids.length) return null;

  const rankedBids = [...submittedBids].sort(
    (a, b) => (a.base_bid_amount as number) - (b.base_bid_amount as number),
  );
  const recommendedBid = rankedBids[0];
  const amount = recommendedBid.base_bid_amount as number;
  const subName =
    allSubs.find((sub) => sub.id === recommendedBid.sub_id)?.subcontractor
      ?.company_name ?? "Unknown sub";

  const lowBid = rankedBids[0].base_bid_amount as number;
  const secondBid = rankedBids[1]?.base_bid_amount ?? null;
  const spreadFromSecond =
    secondBid !== null && lowBid > 0 ? ((secondBid - lowBid) / lowBid) * 100 : null;
  const overBudgetPct =
    budgetAmount !== null && budgetAmount > 0
      ? ((amount - budgetAmount) / budgetAmount) * 100
      : null;

  const rationales: string[] = ["Lowest qualified"];
  if (budgetAmount !== null) {
    rationales.push(amount <= budgetAmount ? "Within budget" : "Over budget");
  } else {
    rationales.push("Budget pending");
  }

  let riskLevel: RecommendationRiskLevel = "Med";
  if (
    (overBudgetPct !== null && overBudgetPct > 5) ||
    (spreadFromSecond !== null && spreadFromSecond > 12)
  ) {
    riskLevel = "High";
  } else if (
    (overBudgetPct !== null && overBudgetPct <= 0) ||
    (spreadFromSecond !== null && spreadFromSecond <= 5) ||
    secondBid === null
  ) {
    riskLevel = "Low";
  }

  const ruleExplanationParts = [
    "Recommendation selects the lowest submitted base bid.",
    budgetAmount !== null
      ? `Budget check: ${amount <= budgetAmount ? "within" : "above"} budget by ${formatPercent(overBudgetPct)}.`
      : "Budget check: unavailable.",
    secondBid !== null
      ? `Gap check: ${formatPercent(spreadFromSecond)} vs next-lowest submitted bid.`
      : "Gap check: only one submitted bid available.",
  ];

  return {
    bid: recommendedBid,
    amount,
    subName,
    rationales,
    riskLevel,
    ruleExplanation: ruleExplanationParts.join(" "),
  };
}

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
  onCreateAndAddSub: (payload: {
    companyName: string;
    contact: string;
    email: string;
    phone: string;
  }) => Promise<void>;
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
  onCreateAndAddSub,
}: TradeRowProps) {
  const stats = computeTradeStats(bids, budget.amount);
  const submittedBids = bids.filter(
    (bid) => bid.status === "submitted" && bid.base_bid_amount !== null,
  );
  const selectedBidAmount = submittedBids.length
    ? Math.min(...submittedBids.map((bid) => bid.base_bid_amount as number))
    : null;
  const recommendedBidAmount = submittedBids.length
    ? submittedBids.reduce(
        (sum, bid) => sum + (bid.base_bid_amount as number),
        0,
      ) / submittedBids.length
    : null;
  const recommendation = getTradeRecommendation(bids, allSubs, budget.amount);

  const handleRecommendationClick = () => {
    if (!recommendation) return;
    const bidCardId = `${recommendation.bid.trade_id}:${recommendation.bid.sub_id}`;
    const el = document.querySelector<HTMLElement>(
      `[data-bid-card-id="${bidCardId}"]`,
    );
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    el.focus();
  };

  return (
    <>
      <tr className="border-b border-slate-200 align-top">
        <th className="sticky left-0 z-20 border-r border-slate-200 bg-white px-3 py-3 text-left align-top">
          <button
            type="button"
            onClick={onToggleExpand}
            className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500"
          >
            <span className={`inline-block transition ${expanded ? "rotate-90" : ""}`}>
              ▶
            </span>
            Details
          </button>
          <div className="text-sm font-semibold text-slate-900">{trade.trade_name}</div>

          {recommendation ? (
            <button
              type="button"
              onClick={handleRecommendationClick}
              className="mt-2 w-full rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-left transition hover:border-blue-300 hover:bg-blue-100"
            >
              <div className="text-xs font-semibold text-blue-900">
                Recommended: {recommendation.subName} at {formatCurrency(recommendation.amount)}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {recommendation.rationales.map((reason) => (
                  <span
                    key={reason}
                    className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-200"
                  >
                    {reason}
                  </span>
                ))}
                <span
                  title={recommendation.ruleExplanation}
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${
                    recommendation.riskLevel === "Low"
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : recommendation.riskLevel === "Med"
                        ? "bg-amber-50 text-amber-700 ring-amber-200"
                        : "bg-rose-50 text-rose-700 ring-rose-200"
                  }`}
                >
                  Risk: {recommendation.riskLevel}
                </span>
              </div>
            </button>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
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
          <BudgetCell
            key={`${trade.id}:${budget.amount ?? "null"}:${budget.notes ?? ""}`}
            value={budget.amount}
            selectedBidAmount={selectedBidAmount}
            recommendedBidAmount={recommendedBidAmount}
            notes={budget.notes}
            readOnly={readOnly}
            onChange={onBudgetChange}
          />
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
            onCreateAndAddSub={onCreateAndAddSub}
            getBidCardId={(bid) => `${bid.trade_id}:${bid.sub_id}`}
          />
        </td>
      </tr>

      {expanded ? (
        <tr className="border-b border-slate-200 bg-slate-50/50">
          <td
            className="sticky left-0 z-20 border-r border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-600"
            colSpan={2}
          >
            Trade details
          </td>
          <td className="px-3 py-2 text-xs text-slate-600">
            {bids.length
              ? `${bids.length} invited/submitted subs in this trade.`
              : "No subs in this trade yet."}
          </td>
        </tr>
      ) : null}
    </>
  );
}
