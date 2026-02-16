"use client";

import { useMemo, useState } from "react";
import TradeRow, { type TradeRowData, type TradeSlot, type TradeSubBid } from "@/components/bidding/TradeRow";

export type BidProjectView = {
  id: string;
  projectName: string;
  owner: string;
  location: string;
  budget: number | null;
  dueDate: string | null;
  subs: Array<{ id: string; company: string; contact: string }>;
  trades: TradeRowData[];
};

type TradeLevelingGridProps = {
  project: BidProjectView;
  onAddSubForTrade: (payload: { tradeId: string; tradeName: string }) => void;
  onAddTrade: () => void;
  onEditBid: (bid: TradeSubBid) => void;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function buildVisibleSlots(row: TradeRowData) {
  const bids = Object.values(row.bidsBySubId).filter((bid): bid is TradeSubBid => Boolean(bid));
  const sorted = [...bids].sort((a, b) => {
    const orderA = a.status === "submitted" ? 0 : a.status === "bidding" ? 1 : a.status === "invited" ? 2 : a.status === "ghosted" ? 3 : 4;
    const orderB = b.status === "submitted" ? 0 : b.status === "bidding" ? 1 : b.status === "invited" ? 2 : b.status === "ghosted" ? 3 : 4;
    if (orderA !== orderB) return orderA - orderB;
    const amountA = a.bidAmount ?? Number.MAX_SAFE_INTEGER;
    const amountB = b.bidAmount ?? Number.MAX_SAFE_INTEGER;
    if (amountA !== amountB) return amountA - amountB;
    return a.company.localeCompare(b.company);
  });

  const visibleBids = sorted.slice(0, 3);
  const visibleIds = new Set(visibleBids.map((bid) => bid.bidId));

  const visibleSlots: TradeSlot[] = Array.from({ length: 3 }).map((_, index) => ({
    key: `${row.tradeId}-slot-${index + 1}`,
    bid: visibleBids[index] ?? null,
  }));

  const extraBids = sorted.filter((bid) => !visibleIds.has(bid.bidId));
  return { visibleSlots, extraBids };
}

export default function TradeLevelingGrid({ project, onAddSubForTrade, onAddTrade, onEditBid }: TradeLevelingGridProps) {
  const [openTrades, setOpenTrades] = useState<Record<string, boolean>>({});

  const tradeSlots = useMemo(() => {
    const map = new Map<string, { visibleSlots: TradeSlot[]; extraBids: TradeSubBid[] }>();
    project.trades.forEach((row) => {
      map.set(row.tradeId, buildVisibleSlots(row));
    });
    return map;
  }, [project.trades]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">Trade Leveling</h3>
          <button
            type="button"
            onClick={onAddTrade}
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
          >
            + Add Trade
          </button>
        </div>
      </div>

      <div className="space-y-2 p-3 md:hidden">
        {project.trades.map((row) => {
          const trade = tradeSlots.get(row.tradeId);
          const isOpen = openTrades[row.tradeId] ?? false;

          if (!trade) return null;

          return (
            <article key={`mobile-${row.tradeId}`} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-slate-900">{row.trade}</p>
                <button
                  type="button"
                  onClick={() => setOpenTrades((prev) => ({ ...prev, [row.tradeId]: !isOpen }))}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500"
                >
                  <svg className={`h-3.5 w-3.5 transition ${isOpen ? "rotate-90" : ""}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M7.5 5.5L12.5 10L7.5 14.5V5.5Z" />
                  </svg>
                </button>
              </div>

              {isOpen ? (
                <div className="mt-3 space-y-2">
                  {trade.visibleSlots.map((slot, index) => (
                    <div key={slot.key} className="rounded-lg border border-slate-200 p-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Sub {index + 1}</p>
                      {slot.bid ? (
                        <button type="button" onClick={() => onEditBid(slot.bid as TradeSubBid)} className="mt-1 w-full text-left">
                          <p className="text-sm font-semibold text-slate-900">{slot.bid.company}</p>
                          <p className="text-xs text-slate-500">{slot.bid.status}</p>
                          {slot.bid.bidAmount ? <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(slot.bid.bidAmount)}</p> : null}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAddSubForTrade({ tradeId: row.tradeId, tradeName: row.trade })}
                          className="mt-1 rounded-md border border-dashed border-slate-200 px-2 py-1 text-xs text-slate-500"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[980px] w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                Trade
              </th>
              <th className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                Sub 1
              </th>
              <th className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                Sub 2
              </th>
              <th className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                Sub 3
              </th>
              <th className="border-b border-slate-200 bg-slate-100 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {project.trades.map((row) => {
              const trade = tradeSlots.get(row.tradeId);
              if (!trade) return null;

              return (
                <TradeRow
                  key={row.tradeId}
                  row={row}
                  visibleSlots={trade.visibleSlots}
                  extraBids={trade.extraBids}
                  expanded={openTrades[row.tradeId] ?? false}
                  onToggle={(tradeId) => setOpenTrades((prev) => ({ ...prev, [tradeId]: !prev[tradeId] }))}
                  onAddSubForTrade={onAddSubForTrade}
                  onEditBid={onEditBid}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
