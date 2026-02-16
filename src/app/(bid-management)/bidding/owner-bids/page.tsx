"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBidManagementToolbar } from "@/components/bidding/bid-management-toolbar";
import { NewOwnerBidOverlay } from "@/components/owner-bids/NewOwnerBidOverlay";
import {
  createOwnerBid,
  listOwnerBids,
  updateOwnerBid,
} from "@/lib/bidding/owner-bids-store";
import type {
  NewOwnerBidInput,
  OwnerBid,
  OwnerBidStatus,
} from "@/lib/bidding/owner-bids-types";

const statusOptions: OwnerBidStatus[] = ["Draft", "Submitted", "Awarded", "Lost"];

function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSquareFeet(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  return `${new Intl.NumberFormat("en-US").format(value)} SF`;
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

export default function OwnerBidsPage() {
  const { setActions } = useBidManagementToolbar();
  const [bids, setBids] = useState<OwnerBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OwnerBidStatus>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedBidId, setSelectedBidId] = useState<string | null>(null);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [overlayMode, setOverlayMode] = useState<"create" | "edit">("create");
  const [editingBidId, setEditingBidId] = useState<string | null>(null);
  const [overlaySessionKey, setOverlaySessionKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const visibleBids = useMemo(() => {
    return bids.filter((bid) => {
      if (search) {
        const text = `${bid.name} ${bid.client} ${bid.assignedTo}`.toLowerCase();
        if (!text.includes(search.toLowerCase())) return false;
      }
      if (statusFilter !== "all" && bid.status !== statusFilter) return false;
      if (bid.dueDate && dateFrom && bid.dueDate < dateFrom) return false;
      if (bid.dueDate && dateTo && bid.dueDate > dateTo) return false;
      return true;
    });
  }, [bids, dateFrom, dateTo, search, statusFilter]);

  const selectedBid = bids.find((bid) => bid.id === selectedBidId) ?? null;
  const editingBid = bids.find((bid) => bid.id === editingBidId) ?? null;

  const handleCreateBid = useCallback(async (payload: NewOwnerBidInput) => {
    const created = await createOwnerBid(payload);
    if (!created) {
      throw new Error("Unable to create owner bid. Confirm the Supabase table and RLS policies are installed.");
    }
    setBids((prev) => [created, ...prev]);
    setSelectedBidId(created.id);
    setToast("Owner bid created");
  }, []);

  const handleEditBid = useCallback(async (payload: NewOwnerBidInput) => {
    if (!editingBidId) return;
    const updated = await updateOwnerBid(editingBidId, payload);
    if (!updated) {
      throw new Error("Unable to update owner bid. Confirm the Supabase table and RLS policies are installed.");
    }
    setBids((prev) => prev.map((bid) => (bid.id === editingBidId ? updated : bid)));
    setSelectedBidId(editingBidId);
    setToast("Owner bid updated");
  }, [editingBidId]);

  useEffect(() => {
    let active = true;
    async function loadBids() {
      setLoading(true);
      const rows = await listOwnerBids();
      if (!active) return;
      setBids(rows);
      setLoadError(
        rows.length === 0
          ? "No owner bids found yet. Create one to get started."
          : null
      );
      setLoading(false);
    }

    loadBids();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setActions(
      <button
        type="button"
        onClick={() => {
          setOverlayMode("create");
          setEditingBidId(null);
          setOverlaySessionKey((prev) => prev + 1);
          setIsOverlayOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
      >
        <span aria-hidden>＋</span>
        New Owner Bid
      </button>
    );
    return () => setActions(null);
  }, [setActions]);

  return (
    <main className="space-y-6 bg-slate-50 p-4 sm:p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search owner bids..."
            className="h-11 min-w-[220px] flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-700"
          />
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>Date range</span>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3" />
            <span>to</span>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3" />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | OwnerBidStatus)}
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
          >
            <option value="all">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-3">Bid/Project</th>
                <th className="px-3 py-3">Client</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Square Feet</th>
                <th className="px-3 py-3">Due Date</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Bid Amount</th>
                <th className="px-3 py-3">OH&amp;P %</th>
                <th className="px-3 py-3">Assigned To</th>
                <th className="px-3 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-sm text-slate-500">
                    Loading owner bids...
                  </td>
                </tr>
              ) : visibleBids.length ? (
                visibleBids.map((bid) => (
                  <tr
                    key={bid.id}
                    onClick={() => setSelectedBidId(bid.id)}
                    className="cursor-pointer border-t border-slate-200 text-slate-700 transition hover:bg-slate-50"
                  >
                    <td className="px-3 py-3 font-semibold text-slate-900">{bid.name}</td>
                    <td className="px-3 py-3">{bid.client}</td>
                    <td className="px-3 py-3">{bid.projectType}</td>
                    <td className="px-3 py-3">{formatSquareFeet(bid.squareFeet)}</td>
                    <td className="px-3 py-3">{bid.dueDate ?? "—"}</td>
                    <td className="px-3 py-3">{bid.status}</td>
                    <td className="px-3 py-3">{formatCurrency(bid.bidAmount)}</td>
                    <td className="px-3 py-3">{formatPercent(bid.markupPct)}</td>
                    <td className="px-3 py-3">{bid.assignedTo || "—"}</td>
                    <td className="px-3 py-3">{dateOnly(bid.updatedAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-sm text-slate-500">
                    {loadError ?? "No owner bids match current filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedBid ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{selectedBid.name}</h2>
              <p className="text-sm text-slate-500">{selectedBid.client}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setOverlayMode("edit");
                  setEditingBidId(selectedBid.id);
                  setOverlaySessionKey((prev) => prev + 1);
                  setIsOverlayOpen(true);
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Edit Bid
              </button>
              <button type="button" onClick={() => setSelectedBidId(null)} className="text-sm font-semibold text-slate-500 hover:text-slate-700">
                Close
              </button>
            </div>
          </div>

          <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
            <p><span className="font-semibold text-slate-900">Project Type:</span> {selectedBid.projectType}</p>
            <p><span className="font-semibold text-slate-900">Bid Type:</span> {selectedBid.bidType}</p>
            <p><span className="font-semibold text-slate-900">Status:</span> {selectedBid.status}</p>
            <p><span className="font-semibold text-slate-900">Address:</span> {selectedBid.address || "—"}</p>
            <p><span className="font-semibold text-slate-900">Square Feet:</span> {formatSquareFeet(selectedBid.squareFeet)}</p>
            <p><span className="font-semibold text-slate-900">Due Date:</span> {selectedBid.dueDate ?? "—"}</p>
            <p><span className="font-semibold text-slate-900">Assigned To:</span> {selectedBid.assignedTo || "—"}</p>
            <p><span className="font-semibold text-slate-900">Probability:</span> {selectedBid.probability}%</p>
            <p><span className="font-semibold text-slate-900">Updated:</span> {dateOnly(selectedBid.updatedAt)}</p>
            <p><span className="font-semibold text-slate-900">Estimated Buyout:</span> {formatCurrency(selectedBid.estCost)}</p>
            <p><span className="font-semibold text-slate-900">Bid Amount:</span> {formatCurrency(selectedBid.bidAmount)}</p>
            <p><span className="font-semibold text-slate-900">Total Estimated Profit:</span> {formatCurrency(selectedBid.expectedProfit)}</p>
            <p><span className="font-semibold text-slate-900">Estimated Profit %:</span> {formatPercent(selectedBid.marginPct)}</p>
            <p><span className="font-semibold text-slate-900">OH&amp;P $:</span> {formatCurrency(selectedBid.ohpAmount)}</p>
            <p><span className="font-semibold text-slate-900">OH&amp;P %:</span> {formatPercent(selectedBid.markupPct)}</p>
            <p><span className="font-semibold text-slate-900">Convert to Project:</span> {selectedBid.convertToProject ? "Yes" : "No"}</p>
          </div>

          {selectedBid.status === "Lost" ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p><span className="font-semibold">Lost Reason:</span> {selectedBid.lostReason ?? "—"}</p>
              <p><span className="font-semibold">Notes:</span> {selectedBid.lostNotes || "—"}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      <NewOwnerBidOverlay
        key={`${overlayMode}-${editingBidId ?? "new"}-${overlaySessionKey}`}
        open={isOverlayOpen}
        onOpenChange={setIsOverlayOpen}
        mode={overlayMode}
        initialValues={overlayMode === "edit" ? editingBid ?? null : null}
        onSubmit={overlayMode === "edit" ? handleEditBid : handleCreateBid}
      />

      {toast ? (
        <div className="fixed right-4 top-4 z-[60] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-lg">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
