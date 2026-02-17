"use client";

import { useEffect, useMemo, useState } from "react";
import { BidManagementHeader } from "@/components/bidding/bid-management-header";
import { useBidManagementToolbar } from "@/components/bidding/bid-management-toolbar";

type OwnerBidStatus = "Draft" | "Submitted" | "Shortlisted" | "Awarded" | "Lost" | "No-bid" | "On hold" | "Archived";

type OwnerBid = {
  id: string;
  projectName: string;
  client: string;
  dueDate: string;
  submittedDate: string | null;
  status: OwnerBidStatus;
  bidAmount: number;
  assignedTo: string;
  lastUpdated: string;
  notes: string;
  archived: boolean;
};

const statusOptions: OwnerBidStatus[] = ["Draft", "Submitted", "Shortlisted", "Awarded", "Lost", "No-bid", "On hold", "Archived"];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function ytdStartDate(): string {
  return `${new Date().getFullYear()}-01-01`;
}

const starterBids: OwnerBid[] = [
  {
    id: "ob-1",
    projectName: "Westlake Medical Pavilion",
    client: "Apex Health Partners",
    dueDate: "2026-03-04",
    submittedDate: "2026-02-25",
    status: "Submitted",
    bidAmount: 7280000,
    assignedTo: "Alex Carter",
    lastUpdated: "2026-02-26",
    notes: "Clarification on alternate HVAC package pending owner response.",
    archived: false,
  },
  {
    id: "ob-2",
    projectName: "Riverfront Logistics Phase II",
    client: "North Harbor Development",
    dueDate: "2026-03-12",
    submittedDate: null,
    status: "Draft",
    bidAmount: 15950000,
    assignedTo: "Morgan Lee",
    lastUpdated: "2026-02-24",
    notes: "Waiting on final geotech addendum before issuance.",
    archived: false,
  },
  {
    id: "ob-3",
    projectName: "Southline Municipal Service Center",
    client: "City of Southline",
    dueDate: "2025-12-18",
    submittedDate: "2025-12-18",
    status: "Lost",
    bidAmount: 11300000,
    assignedTo: "Jordan Smith",
    lastUpdated: "2026-01-10",
    notes: "Debrief requested; owner selected lower GMP option.",
    archived: true,
  },
];

export default function OwnerBidsPage() {
  const { setActions } = useBidManagementToolbar();
  const [bids, setBids] = useState<OwnerBid[]>(starterBids);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OwnerBidStatus>("all");
  const [activeView, setActiveView] = useState<"active" | "archived">("active");
  const [dateFrom, setDateFrom] = useState(ytdStartDate);
  const [dateTo, setDateTo] = useState(todayIsoDate);
  const [selectedBidId, setSelectedBidId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState({
    projectName: "",
    client: "",
    dueDate: "",
    bidAmount: "",
    status: "Draft" as OwnerBidStatus,
  });

  const visibleBids = useMemo(() => {
    return bids.filter((bid) => {
      if (activeView === "active" && bid.archived) return false;
      if (activeView === "archived" && !bid.archived) return false;
      if (search) {
        const text = `${bid.projectName} ${bid.client} ${bid.assignedTo}`.toLowerCase();
        if (!text.includes(search.toLowerCase())) return false;
      }
      if (statusFilter !== "all" && bid.status !== statusFilter) return false;
      if (dateFrom && bid.dueDate < dateFrom) return false;
      if (dateTo && bid.dueDate > dateTo) return false;
      return true;
    });
  }, [activeView, bids, dateFrom, dateTo, search, statusFilter]);

  const selectedBid = bids.find((bid) => bid.id === selectedBidId) ?? null;

  useEffect(() => {
    setActions(
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
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
      <BidManagementHeader />

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
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setActiveView("active")}
              className={`rounded-lg px-3 py-2 ${activeView === "active" ? "bg-white text-slate-900" : "text-slate-600"}`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setActiveView("archived")}
              className={`rounded-lg px-3 py-2 ${activeView === "archived" ? "bg-white text-slate-900" : "text-slate-600"}`}
            >
              Archived
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-3">Bid/Project</th>
                <th className="px-3 py-3">Client</th>
                <th className="px-3 py-3">Due Date</th>
                <th className="px-3 py-3">Submitted Date</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Bid Amount</th>
                <th className="px-3 py-3">Assigned To</th>
                <th className="px-3 py-3">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {visibleBids.length ? (
                visibleBids.map((bid) => (
                  <tr
                    key={bid.id}
                    onClick={() => setSelectedBidId(bid.id)}
                    className="cursor-pointer border-t border-slate-200 text-slate-700 transition hover:bg-slate-50"
                  >
                    <td className="px-3 py-3 font-semibold text-slate-900">{bid.projectName}</td>
                    <td className="px-3 py-3">{bid.client}</td>
                    <td className="px-3 py-3">{bid.dueDate}</td>
                    <td className="px-3 py-3">{bid.submittedDate ?? "—"}</td>
                    <td className="px-3 py-3">{bid.status}</td>
                    <td className="px-3 py-3">{formatCurrency(bid.bidAmount)}</td>
                    <td className="px-3 py-3">{bid.assignedTo}</td>
                    <td className="px-3 py-3">{bid.lastUpdated}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">
                    No owner bids match current filters.
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
            <h2 className="text-xl font-semibold text-slate-900">{selectedBid.projectName}</h2>
            <button type="button" onClick={() => setSelectedBidId(null)} className="text-sm font-semibold text-slate-500 hover:text-slate-700">
              Close
            </button>
          </div>
          <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
            <p><span className="font-semibold text-slate-900">Client:</span> {selectedBid.client}</p>
            <p><span className="font-semibold text-slate-900">Status:</span> {selectedBid.status}</p>
            <p><span className="font-semibold text-slate-900">Assigned To:</span> {selectedBid.assignedTo}</p>
            <p><span className="font-semibold text-slate-900">Due Date:</span> {selectedBid.dueDate}</p>
            <p><span className="font-semibold text-slate-900">Submitted Date:</span> {selectedBid.submittedDate ?? "—"}</p>
            <p><span className="font-semibold text-slate-900">Bid Amount:</span> {formatCurrency(selectedBid.bidAmount)}</p>
          </div>
          <div className="mt-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Internal Notes</h3>
              <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{selectedBid.notes}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Attachments</h3>
              <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
                Attachments placeholder (plans, owner forms, proposal PDF).
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Related Bid Workspace</h3>
              <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
                Link or associate this owner bid with a sub bid package / project bid workspace.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">New Owner Bid</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-sm font-semibold text-slate-500 hover:text-slate-700">
                Close
              </button>
            </div>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!draft.projectName.trim() || !draft.client.trim() || !draft.dueDate || !draft.bidAmount) return;
                const now = todayIsoDate();
                const amount = Number(draft.bidAmount);
                setBids((prev) => [
                  {
                    id: `ob-${Math.random().toString(36).slice(2, 10)}`,
                    projectName: draft.projectName.trim(),
                    client: draft.client.trim(),
                    dueDate: draft.dueDate,
                    submittedDate: draft.status === "Submitted" ? now : null,
                    status: draft.status,
                    bidAmount: Number.isFinite(amount) ? amount : 0,
                    assignedTo: "Unassigned",
                    lastUpdated: now,
                    notes: "",
                    archived: draft.status === "Archived",
                  },
                  ...prev,
                ]);
                setDraft({ projectName: "", client: "", dueDate: "", bidAmount: "", status: "Draft" });
                setIsModalOpen(false);
              }}
            >
              <input
                required
                value={draft.projectName}
                onChange={(event) => setDraft((prev) => ({ ...prev, projectName: event.target.value }))}
                placeholder="Project/Bid name"
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              />
              <input
                required
                value={draft.client}
                onChange={(event) => setDraft((prev) => ({ ...prev, client: event.target.value }))}
                placeholder="Client"
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  required
                  type="date"
                  value={draft.dueDate}
                  onChange={(event) => setDraft((prev) => ({ ...prev, dueDate: event.target.value }))}
                  className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
                />
                <input
                  required
                  type="number"
                  min="0"
                  value={draft.bidAmount}
                  onChange={(event) => setDraft((prev) => ({ ...prev, bidAmount: event.target.value }))}
                  placeholder="Bid Amount"
                  className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
                />
              </div>
              <select
                value={draft.status}
                onChange={(event) => setDraft((prev) => ({ ...prev, status: event.target.value as OwnerBidStatus }))}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
