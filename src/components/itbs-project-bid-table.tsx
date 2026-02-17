"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { BidProjectDetail, BidTradeStatus } from "@/lib/bidding/types";
import { getBidProjectDetail } from "@/lib/bidding/store";
import { getBidProjectIdForProject } from "@/lib/bidding/project-links";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function StatusPill({ status }: { status: BidTradeStatus }) {
  const styles: Record<BidTradeStatus, string> = {
    submitted: "bg-emerald-100 text-emerald-800",
    bidding: "bg-blue-100 text-blue-800",
    declined: "bg-rose-100 text-rose-800",
    ghosted: "bg-amber-100 text-amber-800",
    invited: "bg-slate-100 text-slate-700",
  };

  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold tracking-[0.08em] ${styles[status]}`}>
      {status.toUpperCase()}
    </span>
  );
}

export default function ItbsProjectBidTable() {
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("project");
  const [mappedBidProjectId, setMappedBidProjectId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BidProjectDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [resolvedBidProjectId, setResolvedBidProjectId] = useState<string | null>(null);
  const [hasResolvedLookup, setHasResolvedLookup] = useState(false);

  useEffect(() => {
    const refreshMappedProject = () => {
      setMappedBidProjectId(getBidProjectIdForProject(queryProjectId));
    };
    refreshMappedProject();
    window.addEventListener("storage", refreshMappedProject);
    return () => {
      window.removeEventListener("storage", refreshMappedProject);
    };
  }, [queryProjectId]);

  useEffect(() => {
    let active = true;
    async function loadDetail() {
      if (!queryProjectId) {
        setDetail(null);
        setResolvedBidProjectId(null);
        setHasResolvedLookup(true);
        return;
      }
      setHasResolvedLookup(false);
      setLoadingDetail(true);
      const candidates = [mappedBidProjectId, queryProjectId].filter(
        (id, index, arr): id is string => Boolean(id) && arr.indexOf(id) === index
      );
      let loadedDetail: BidProjectDetail | null = null;
      let loadedId: string | null = null;
      for (const candidateId of candidates) {
        const row = await getBidProjectDetail(candidateId);
        if (row) {
          loadedDetail = row;
          loadedId = candidateId;
          break;
        }
      }
      if (!active) return;
      setDetail(loadedDetail);
      setResolvedBidProjectId(loadedId);
      setLoadingDetail(false);
      setHasResolvedLookup(true);
    }
    loadDetail();
    return () => {
      active = false;
    };
  }, [mappedBidProjectId, queryProjectId]);

  if (!queryProjectId) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-6 text-sm text-slate-500 shadow-sm">
        Select a project to view invites.
      </section>
    );
  }

  if (hasResolvedLookup && !loadingDetail && !resolvedBidProjectId) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-600 shadow-sm">
        No bid package is linked to this selected project yet.
      </section>
    );
  }

  if (loadingDetail || !hasResolvedLookup || !detail) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-500 shadow-sm">
        Loading bid details...
      </section>
    );
  }

  const subs = detail.projectSubs.map((sub) => ({
    id: sub.id,
    company: sub.subcontractor?.company_name ?? "Unknown subcontractor",
    contact: sub.subcontractor?.primary_contact ?? "-",
  }));

  const bidsByTrade = new Map<string, Map<string, (typeof detail.tradeBids)[number]>>();
  detail.tradeBids.forEach((bid) => {
    const tradeMap = bidsByTrade.get(bid.trade_id) ?? new Map<string, (typeof detail.tradeBids)[number]>();
    tradeMap.set(bid.project_sub_id, bid);
    bidsByTrade.set(bid.trade_id, tradeMap);
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-2xl font-semibold text-slate-900">{detail.project.project_name}</h2>
        <p className="mt-1 text-sm text-slate-600">Invitation and bid status by trade.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700">
                Trade
              </th>
              {subs.length ? (
                subs.map((sub, index) => (
                  <th
                    key={`sub-header-${sub.id}`}
                    className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700"
                  >
                    Sub {index + 1}
                  </th>
                ))
              ) : (
                <th className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700">
                  Subs
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {detail.trades.map((trade) => {
              const tradeMap = bidsByTrade.get(trade.id) ?? new Map<string, (typeof detail.tradeBids)[number]>();
              return (
                <tr key={trade.id}>
                  <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-4 text-left text-sm font-semibold text-slate-900">
                    {trade.trade_name}
                  </th>
                  {subs.length ? (
                    subs.map((sub) => {
                      const bid = tradeMap.get(sub.id) ?? null;
                      return (
                        <td key={`${trade.id}-${sub.id}`} className="border-b border-r border-slate-200 px-4 py-4 align-top">
                          {bid ? (
                            <div className="space-y-2">
                              <p className="text-sm font-semibold text-slate-900">{sub.company}</p>
                              <p className="text-xs text-slate-500">{bid.contact_name ?? sub.contact}</p>
                              <StatusPill status={bid.status} />
                              {bid.bid_amount !== null ? (
                                <p className="text-sm font-semibold text-slate-900">{formatCurrency(bid.bid_amount)}</p>
                              ) : null}
                              {bid.notes ? <p className="text-xs text-slate-500">{bid.notes}</p> : null}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">Not invited yet</span>
                          )}
                        </td>
                      );
                    })
                  ) : (
                    <td className="border-b border-r border-slate-200 px-4 py-4 text-sm text-slate-400">No subs invited yet</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
