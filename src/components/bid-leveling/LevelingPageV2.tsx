"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getBidLevelingProjectData } from "@/lib/bidding/leveling-store";
import type { BidLevelingProjectData, LevelingBid } from "@/lib/bidding/leveling-types";
import { getBidProjectIdForProject } from "@/lib/bidding/project-links";

function formatCurrency(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(iso: string | null): string {
  if (!iso) return "No due date";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type BidColumn = {
  bid: LevelingBid;
  subName: string;
};

const SCOPE_ROWS = [
  { code: "03-100", label: "Concrete Reinforcement", weight: 0.14 },
  { code: "03-210", label: "Cast-In-Place Concrete", weight: 0.35 },
  { code: "03-300", label: "Footings", weight: 0.1 },
  { code: "03-320", label: "Slab Foundations", weight: 0.18 },
  { code: "03-330", label: "Poured Concrete Basement Walls", weight: 0.08 },
  { code: "03-220", label: "Precast Concrete", weight: 0.15 },
] as const;

const ADDITIONAL_INFO_ROWS = [
  { key: "inclusions", label: "Inclusions" },
  { key: "exclusions", label: "Exclusions" },
  { key: "comments", label: "Comments" },
  { key: "attachments", label: "Attachments" },
] as const;

function weightedLineAmount(base: number | null, weight: number): string {
  if (base === null || !Number.isFinite(base)) return "--";
  return formatCurrency(Math.round(base * weight));
}

export default function LevelingPageV2({
  hideCreateBidForm = false,
  leftNavItems,
}: {
  hideCreateBidForm?: boolean;
  leftNavItems?: string[];
}) {
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("project");
  const [data, setData] = useState<BidLevelingProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [selectedLeftNavItem, setSelectedLeftNavItem] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      if (!queryProjectId) {
        if (active) {
          setData(null);
          setLoading(false);
        }
        return;
      }

      const mappedBidProjectId = getBidProjectIdForProject(queryProjectId);
      const candidates = [mappedBidProjectId, queryProjectId].filter(
        (id, index, list): id is string => Boolean(id) && list.indexOf(id) === index
      );
      let nextData: BidLevelingProjectData | null = null;
      for (const candidate of candidates) {
        nextData = await getBidLevelingProjectData(candidate);
        if (nextData) break;
      }
      if (!active) return;
      setData(nextData);
      setSelectedTradeId(nextData?.trades?.[0]?.id ?? null);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [queryProjectId]);

  useEffect(() => {
    if (!leftNavItems?.length) {
      setSelectedLeftNavItem(null);
      return;
    }
    setSelectedLeftNavItem((prev) => (prev && leftNavItems.includes(prev) ? prev : leftNavItems[0]));
  }, [leftNavItems]);

  const selectedTrade = useMemo(
    () => data?.trades.find((trade) => trade.id === selectedTradeId) ?? null,
    [data?.trades, selectedTradeId]
  );

  const bidColumns = useMemo(() => {
    if (!data || !selectedTrade) return [] as BidColumn[];
    const subNameById = new Map(
      data.projectSubs.map((sub) => [sub.id, sub.subcontractor?.company_name ?? "Subcontractor"])
    );
    return data.bids
      .filter((bid) => bid.trade_id === selectedTrade.id)
      .sort((a, b) => {
        const aAmount = a.base_bid_amount ?? Number.POSITIVE_INFINITY;
        const bAmount = b.base_bid_amount ?? Number.POSITIVE_INFINITY;
        if (aAmount !== bAmount) return aAmount - bAmount;
        return (subNameById.get(a.sub_id) ?? "").localeCompare(subNameById.get(b.sub_id) ?? "");
      })
      .map((bid) => ({
        bid,
        subName: subNameById.get(bid.sub_id) ?? "Subcontractor",
      }));
  }, [data, selectedTrade]);

  const submittedCount = bidColumns.filter((col) => col.bid.status === "submitted").length;

  if (!queryProjectId) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-6 text-sm text-slate-500 shadow-sm">
        Select a project to view bid leveling.
      </section>
    );
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-sm text-slate-500 shadow-sm">
        Loading bid leveling layout...
      </section>
    );
  }

  if (!data) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-sm text-slate-600 shadow-sm">
        No bid package data found for this project.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid min-h-[720px] grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-r border-slate-200 bg-slate-50">
          {!hideCreateBidForm ? (
            <div className="border-b border-slate-200 px-4 py-3">
              <button
                type="button"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                + Create Bid Form
              </button>
            </div>
          ) : null}
          <nav className="space-y-1 p-2">
            {leftNavItems?.length
              ? leftNavItems.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setSelectedLeftNavItem(item)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                      selectedLeftNavItem === item
                        ? "border-l-4 border-blue-600 bg-white font-semibold text-blue-700"
                        : "text-slate-700 hover:bg-white"
                    }`}
                  >
                    {item}
                  </button>
                ))
              : data.trades.map((trade) => (
                  <button
                    key={trade.id}
                    type="button"
                    onClick={() => setSelectedTradeId(trade.id)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                      trade.id === selectedTradeId
                        ? "border-l-4 border-blue-600 bg-white font-semibold text-blue-700"
                        : "text-slate-700 hover:bg-white"
                    }`}
                  >
                    {trade.trade_name}
                  </button>
                ))}
          </nav>
        </aside>

        <div className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-0">
              <colgroup>
                <col style={{ width: "34%" }} />
                {bidColumns.map((col) => (
                  <col key={col.bid.id} style={{ width: `${66 / Math.max(1, bidColumns.length)}%` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th className="border-b border-r border-slate-200 bg-slate-50 p-4 text-left align-top">
                    <div className="text-sm text-slate-500">
                      Due: {formatDate(data.project.due_date)}
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">{submittedCount} Bids Submitted</div>
                  </th>
                  {bidColumns.map((col) => (
                    <th key={`head-${col.bid.id}`} className="border-b border-r border-slate-200 bg-slate-50 p-4 text-left align-top last:border-r-0">
                      <div className="text-2xl font-semibold text-slate-900">{col.subName}</div>
                      <div className="mt-2 text-3xl font-semibold text-slate-900">{formatCurrency(col.bid.base_bid_amount)}</div>
                      <div className="mt-1 text-sm text-slate-500">{col.bid.status}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SCOPE_ROWS.map((row) => (
                  <tr key={row.code}>
                    <td className="border-b border-r border-slate-200 px-4 py-2.5 text-base font-medium text-slate-700">
                      <div>{row.label}</div>
                      <div className="text-sm text-slate-500">{row.code}</div>
                    </td>
                    {bidColumns.map((col) => (
                      <td key={`${row.code}-${col.bid.id}`} className="border-b border-r border-slate-200 px-4 py-2.5 text-right text-base text-slate-700 last:border-r-0">
                        {weightedLineAmount(col.bid.base_bid_amount, row.weight)}
                      </td>
                    ))}
                  </tr>
                ))}

                <tr>
                  <td className="border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-lg font-semibold text-slate-900">
                    Additional Bid Information
                  </td>
                  {bidColumns.map((col) => (
                    <td key={`additional-head-${col.bid.id}`} className="border-b border-r border-slate-200 bg-slate-50 px-4 py-3 last:border-r-0" />
                  ))}
                </tr>

                {ADDITIONAL_INFO_ROWS.map((row) => (
                  <tr key={row.key}>
                    <td className="border-b border-r border-slate-200 px-4 py-3 text-base font-medium text-slate-700">
                      {row.label}
                    </td>
                    {bidColumns.map((col) => (
                      <td key={`${row.key}-${col.bid.id}`} className="border-b border-r border-slate-200 px-4 py-3 text-base text-slate-700 last:border-r-0">
                        {row.key === "comments" ? col.bid.notes || "--" : null}
                        {row.key === "inclusions" ? "Labor, material, and equipment per plans/specs." : null}
                        {row.key === "exclusions" ? "Overtime and out-of-sequence work excluded." : null}
                        {row.key === "attachments" ? "Download" : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
