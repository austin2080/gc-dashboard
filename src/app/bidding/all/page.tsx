"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { BidProjectSummary } from "@/lib/bidding/types";
import {
  archiveBidProject,
  createBidProject,
  listArchivedBidProjects,
  listBidProjects,
  reopenBidProject,
} from "@/lib/bidding/store";

const PAGE_SIZE = 10;

function formatDueDateTime(isoDate: string | null): string {
  if (!isoDate) return "No due date";
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

function formatDueLabel(isoDate: string | null, todayYmd: string): string {
  if (!isoDate) return "No due date set";
  const due = new Date(`${isoDate}T00:00:00`);
  const today = new Date(`${todayYmd}T00:00:00`);
  if (Number.isNaN(due.getTime()) || Number.isNaN(today.getTime())) return "";
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Due today";
  if (diffDays > 0) return `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
  const pastDays = Math.abs(diffDays);
  return `Due ${pastDays} day${pastDays === 1 ? "" : "s"} ago`;
}

export default function AllBidsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<BidProjectSummary[]>([]);
  const [archivedRows, setArchivedRows] = useState<BidProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [rowSortDirection, setRowSortDirection] = useState<"asc" | "desc">("asc");
  const [pendingDelete, setPendingDelete] = useState<BidProjectSummary | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    project_name: "",
    package_number: "",
    status: "open",
    owner: "",
    location: "",
    budget: "",
    due_date: "",
    due_hour: "12",
    due_minute: "00",
    due_period: "am",
    tbd_due_date: false,
    primary_bidding_contact: "Project Manager",
    bidding_cc_group: "",
    bidding_instructions:
      "For help with submitting a bid, please visit Procore's bidding support page.\n\n" +
      "If you need assistance accessing the bid documents, please email Procore's customer support department at support@procore.com, and one of their support representatives will provide you with assistance.\n\n" +
      "BuilderOS looks forward to the opportunity to work with your project team in our new bidding process.",
    rfi_deadline_enabled: true,
    rfi_deadline_date: "2024-11-30",
    rfi_deadline_hour: "12",
    rfi_deadline_minute: "00",
    rfi_deadline_period: "am",
    site_walkthrough_enabled: false,
    site_walkthrough_date: "",
    site_walkthrough_hour: "12",
    site_walkthrough_minute: "00",
    site_walkthrough_period: "am",
    anticipated_award_date: "",
    countdown_emails: false,
    accept_submissions_past_due: false,
    enable_blind_bidding: false,
    disable_electronic_submission: false,
    include_bid_documents: true,
    bid_submission_confirmation_message: "",
  });

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const [projects, archived] = await Promise.all([listBidProjects(), listArchivedBidProjects()]);
      if (!active) return;
      setRows(projects);
      setArchivedRows(archived);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (!a.due_date && !b.due_date) return a.project_name.localeCompare(b.project_name);
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }),
    [rows]
  );

  const sortedArchivedRows = useMemo(
    () =>
      [...archivedRows].sort((a, b) => {
        if (!a.due_date && !b.due_date) return a.project_name.localeCompare(b.project_name);
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }),
    [archivedRows]
  );

  const todayYmd = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const openRows = useMemo(
    () => sortedRows.filter((row) => !row.due_date || row.due_date >= todayYmd),
    [sortedRows, todayYmd]
  );
  const closedRows = useMemo(
    () => sortedRows.filter((row) => Boolean(row.due_date && row.due_date < todayYmd)),
    [sortedRows, todayYmd]
  );

  const tab = searchParams.get("tab");
  const activeTab = tab === "open" || tab === "closed" || tab === "recycle" ? tab : "all";
  const visibleRows = activeTab === "open" ? openRows : activeTab === "closed" ? closedRows : activeTab === "recycle" ? sortedArchivedRows : sortedRows;
  const orderedRows = useMemo(
    () => (rowSortDirection === "asc" ? visibleRows : [...visibleRows].reverse()),
    [rowSortDirection, visibleRows]
  );
  const emptyMessage =
    activeTab === "open"
      ? "No open bid packages."
      : activeTab === "closed"
        ? "No closed bid packages."
        : activeTab === "recycle"
          ? "Recycle Bin is empty."
          : "No bid packages yet.";
  const tabs: Array<{ key: "all" | "open" | "closed" | "recycle"; label: string; count: number }> = [
    { key: "all", label: "All", count: sortedRows.length },
    { key: "open", label: "Open", count: openRows.length },
    { key: "closed", label: "Closed", count: closedRows.length },
    { key: "recycle", label: "Recycle Bin", count: sortedArchivedRows.length },
  ];
  const totalPages = Math.max(1, Math.ceil(orderedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rangeStart = orderedRows.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, orderedRows.length);
  const displayRangeStart = rowSortDirection === "asc" ? rangeStart : Math.max(orderedRows.length - rangeStart + 1, 0);
  const displayRangeEnd = rowSortDirection === "asc" ? rangeEnd : Math.max(orderedRows.length - rangeEnd + 1, 0);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return orderedRows.slice(start, start + PAGE_SIZE);
  }, [currentPage, orderedRows]);

  const openDeleteModal = (row: BidProjectSummary) => {
    if (activeTab === "recycle") return;
    setDeleteError(null);
    setPendingDelete(row);
  };

  const closeDeleteModal = () => {
    if (deleteSubmitting) return;
    setDeleteError(null);
    setPendingDelete(null);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    const ok = await archiveBidProject(pendingDelete.id);
    if (!ok) {
      setDeleteSubmitting(false);
      setDeleteError("Unable to move bid package to Recycle Bin. Please try again.");
      return;
    }
    setRows((prev) => prev.filter((item) => item.id !== pendingDelete.id));
    setArchivedRows((prev) => {
      if (prev.some((item) => item.id === pendingDelete.id)) return prev;
      return [pendingDelete, ...prev];
    });
    setDeleteSubmitting(false);
    setPendingDelete(null);
  };

  const closeCreateModal = () => {
    if (createSubmitting) return;
    setCreateModalOpen(false);
    setCreateError(null);
  };

  return (
    <>
      <main className="bg-slate-50 px-4 pb-4 sm:px-6 sm:pb-6">
      <header className="-mx-4 border-b border-slate-200 bg-white sm:-mx-6">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-6 items-center justify-center text-orange-500" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="2">
                  <path
                    d="m19.14 12.94.04-.94-.04-.94 1.93-1.5a.5.5 0 0 0 .12-.64l-1.82-3.16a.5.5 0 0 0-.61-.22l-2.28.92a7.3 7.3 0 0 0-1.63-.94l-.35-2.43A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.49.42L9.16 4.85c-.58.23-1.12.55-1.63.94l-2.28-.92a.5.5 0 0 0-.61.22L2.82 8.25a.5.5 0 0 0 .12.64l1.93 1.5-.04.94.04.94-1.93 1.5a.5.5 0 0 0-.12.64l1.82 3.16a.5.5 0 0 0 .61.22l2.28-.92c.5.39 1.05.71 1.63.94l.35 2.43A.5.5 0 0 0 10 22h4a.5.5 0 0 0 .49-.42l.35-2.43c.58-.23 1.12-.55 1.63-.94l2.28.92a.5.5 0 0 0 .61-.22l1.82-3.16a.5.5 0 0 0-.12-.64z"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </span>
              <h1 className="text-[32px] font-semibold text-slate-900">Bid Packages</h1>
            </div>
            <nav className="flex flex-wrap items-center gap-2" aria-label="Bid Package Filters">
              {tabs.map((item) => {
                const href = item.key === "all" ? "/bidding/all" : `/bidding/all?tab=${item.key}`;
                const isActive = activeTab === item.key;
                return (
                  <Link
                    key={item.key}
                    href={href}
                    onClick={() => setPage(1)}
                    className={`border-b-2 px-1 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "border-slate-900 text-slate-900"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {item.label} ({item.count})
                  </Link>
                );
              })}
            </nav>
          </div>
          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-base font-semibold text-white shadow-sm transition hover:bg-orange-600"
          >
            <span aria-hidden>＋</span>
            Add Bid Package
          </button>
        </div>
      </header>

      <div className="mt-4">
        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-sm text-slate-500 shadow-sm">
            Loading bids...
          </section>
        ) : visibleRows.length ? (
          <section className="space-y-2">
            <div className="flex items-center justify-end gap-8 px-1 text-[32px] text-slate-400">
              <span className="text-sm font-semibold italic text-slate-500">
                {displayRangeStart}-{displayRangeEnd} of {orderedRows.length}
              </span>
              <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
                <span>Page:</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-slate-400"
                  aria-label={`Current page ${currentPage}`}
                >
                  <span>{currentPage}</span>
                  <svg viewBox="0 0 20 20" className="size-4 fill-current" aria-hidden>
                    <path d="M5.5 7.5L10 12l4.5-4.5H5.5z" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                  className="inline-flex size-8 items-center justify-center rounded text-slate-400 disabled:opacity-30"
                  aria-label="Previous page"
                >
                  <svg viewBox="0 0 20 20" className="size-6 fill-current" aria-hidden>
                    <path d="M12.8 4.7 7.5 10l5.3 5.3-1.4 1.4L4.7 10l6.7-6.7z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  className="inline-flex size-8 items-center justify-center rounded text-slate-400 disabled:opacity-30"
                  aria-label="Next page"
                >
                  <svg viewBox="0 0 20 20" className="size-6 fill-current" aria-hidden>
                    <path d="m7.2 4.7 1.4-1.4L15.3 10l-6.7 6.7-1.4-1.4L12.5 10z" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-[1400px] w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="w-36 border-r border-slate-100 px-4 py-4 text-left font-semibold">&nbsp;</th>
                    <th className="w-20 border-r border-slate-100 px-4 py-4 text-left font-semibold" aria-sort={rowSortDirection === "asc" ? "ascending" : "descending"}>
                      <button
                        type="button"
                        onClick={() => {
                          setRowSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
                          setPage(1);
                        }}
                        className="inline-flex items-center gap-4 text-left"
                        aria-label={`Sort rows ${rowSortDirection === "asc" ? "descending" : "ascending"}`}
                      >
                        #
                        <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
                          <path d="M10 4 5.5 9h9L10 4z" fill={rowSortDirection === "asc" ? "#3B82F6" : "#CBD5E1"} />
                          <path d="M10 16 14.5 11h-9L10 16z" fill={rowSortDirection === "desc" ? "#3B82F6" : "#CBD5E1"} />
                        </svg>
                      </button>
                    </th>
                    <th className="border-r border-slate-100 px-4 py-4 text-left font-semibold">Bid Packages</th>
                    <th className="border-r border-slate-100 px-4 py-4 text-left font-semibold">Due Date/Time</th>
                    <th className="border-r border-slate-100 px-4 py-4 text-left font-semibold">Bid Invitations Sent</th>
                    <th className="border-r border-slate-100 px-4 py-4 text-left font-semibold">Will Bid</th>
                    <th className="border-r border-slate-100 px-4 py-4 text-left font-semibold">Bids Received</th>
                    <th className="border-r border-slate-100 px-4 py-4 text-left font-semibold">Status</th>
                    <th className="w-14 px-4 py-4 text-left font-semibold">&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row, index) => {
                    const absoluteIndex = (currentPage - 1) * PAGE_SIZE + index;
                    const rowNumber =
                      rowSortDirection === "asc" ? absoluteIndex + 1 : orderedRows.length - absoluteIndex;
                    const statusLabel =
                      activeTab === "recycle"
                        ? "Archived"
                        : row.due_date && row.due_date < todayYmd
                          ? "Closed"
                          : "Open";
                    return (
                    <tr key={row.id} className="border-t border-slate-200 bg-white hover:bg-slate-50">
                      <td className="border-r border-slate-100 px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              router.push(`/bidding?project=${row.id}`);
                            }}
                            className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              router.push(`/bidding?project=${row.id}`);
                            }}
                            className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                          >
                            View
                          </button>
                        </div>
                      </td>
                      <td className="border-r border-slate-100 px-4 py-4 text-sm font-semibold text-slate-700">{rowNumber}</td>
                      <td className="border-r border-slate-100 px-4 py-4 font-semibold">
                        <button
                          type="button"
                          onClick={() => router.push(`/bidding?project=${row.id}`)}
                          className="text-left text-sm text-slate-700 hover:underline"
                        >
                          {row.project_name}
                        </button>
                      </td>
                      <td className="border-r border-slate-100 px-4 py-4 text-slate-600">
                        <div className="text-sm font-semibold">{formatDueDateTime(row.due_date)}</div>
                        <div className="mt-1 text-sm font-semibold text-slate-500">{formatDueLabel(row.due_date, todayYmd)}</div>
                      </td>
                      <td className="border-r border-slate-100 px-4 py-4 text-sm font-semibold text-slate-600">0</td>
                      <td className="border-r border-slate-100 px-4 py-4 text-sm font-semibold text-slate-600">0 (0%)</td>
                      <td className="border-r border-slate-100 px-4 py-4 text-sm font-semibold text-slate-600">0 (0%)</td>
                      <td className="border-r border-slate-100 px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-4 py-1 text-sm font-semibold ${
                            statusLabel === "Open"
                              ? "bg-emerald-50 text-emerald-700"
                              : statusLabel === "Closed"
                                ? "bg-slate-100 text-slate-600"
                                : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {activeTab === "recycle" ? (
                          <button
                            type="button"
                            onClick={async (event) => {
                              event.stopPropagation();
                              setReopeningId(row.id);
                              const ok = await reopenBidProject(row.id);
                              if (!ok) {
                                setReopeningId(null);
                                return;
                              }
                              setArchivedRows((prev) => prev.filter((item) => item.id !== row.id));
                              setRows((prev) => [row, ...prev]);
                              setReopeningId(null);
                            }}
                            disabled={reopeningId === row.id}
                            className="inline-flex items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {reopeningId === row.id ? "Reopening..." : "Reopen"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openDeleteModal(row);
                            }}
                            className="inline-flex size-8 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Delete bid package"
                          >
                            <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden>
                              <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v8h-2V9zm4 0h2v8h-2V9zM7 9h2v8H7V9z" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500 shadow-sm">
            {emptyMessage}
          </section>
        )}
      </div>
      </main>

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Move to Recycle Bin?</h2>
              <p className="mt-1 text-sm text-slate-500">
                <span className="font-semibold text-slate-700">{pendingDelete.project_name}</span> will be removed from active bid packages.
              </p>
            </div>
            <div className="px-6 py-4">
              {deleteError ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{deleteError}</p> : null}
              <p className="text-sm text-slate-600">You can view it later in the Recycle Bin tab.</p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteSubmitting}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteSubmitting}
                className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteSubmitting ? "Moving..." : "Move to Recycle Bin"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {createModalOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40">
          <div className="h-full w-full max-w-4xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Add Bid Package</h2>
                <p className="mt-1 text-sm text-slate-500">Create a new bid package without leaving this page.</p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={createSubmitting}
                className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Close add bid package dialog"
              >
                ✕
              </button>
            </div>
            <form
              className="space-y-4 px-6 py-5"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!draft.project_name.trim()) {
                  setCreateError("Project name is required.");
                  return;
                }
                setCreateSubmitting(true);
                setCreateError(null);
                const budgetValue = draft.budget.trim() ? Number(draft.budget) : null;
                const created = await createBidProject({
                  project_name: draft.project_name.trim(),
                  owner: draft.owner.trim() || null,
                  location: draft.location.trim() || null,
                  budget: Number.isFinite(budgetValue) ? budgetValue : null,
                  due_date: draft.tbd_due_date ? null : draft.due_date.trim() || null,
                });
                if (!created) {
                  setCreateError("Unable to create bid package. Please try again.");
                  setCreateSubmitting(false);
                  return;
                }
                setRows((prev) => [created, ...prev]);
                setPage(1);
                setCreateSubmitting(false);
                setCreateModalOpen(false);
                setDraft({
                  project_name: "",
                  package_number: "",
                  status: "open",
                  owner: "",
                  location: "",
                  budget: "",
                  due_date: "",
                  due_hour: "12",
                  due_minute: "00",
                  due_period: "am",
                  tbd_due_date: false,
                  primary_bidding_contact: "Project Manager",
                  bidding_cc_group: "",
                  bidding_instructions:
                    "For help with submitting a bid, please visit Procore's bidding support page.\n\n" +
                    "If you need assistance accessing the bid documents, please email Procore's customer support department at support@procore.com, and one of their support representatives will provide you with assistance.\n\n" +
                    "BuilderOS looks forward to the opportunity to work with your project team in our new bidding process.",
                  rfi_deadline_enabled: true,
                  rfi_deadline_date: "2024-11-30",
                  rfi_deadline_hour: "12",
                  rfi_deadline_minute: "00",
                  rfi_deadline_period: "am",
                  site_walkthrough_enabled: false,
                  site_walkthrough_date: "",
                  site_walkthrough_hour: "12",
                  site_walkthrough_minute: "00",
                  site_walkthrough_period: "am",
                  anticipated_award_date: "",
                  countdown_emails: false,
                  accept_submissions_past_due: false,
                  enable_blind_bidding: false,
                  disable_electronic_submission: false,
                  include_bid_documents: true,
                  bid_submission_confirmation_message: "",
                });
              }}
            >
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-[18px] font-semibold text-slate-900">General Information</h3>
                <div className="mt-5 grid gap-4 sm:grid-cols-6">
                  <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                    <span className="inline-flex items-center gap-1">
                      Title of Package <span className="text-rose-600">*</span>
                    </span>
                    <input
                      value={draft.project_name}
                      onChange={(event) => setDraft((prev) => ({ ...prev, project_name: event.target.value }))}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                      placeholder="VBC CO #4"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                    Number
                    <input
                      value={draft.package_number}
                      onChange={(event) => setDraft((prev) => ({ ...prev, package_number: event.target.value }))}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                      placeholder="8"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                    Status
                    <div className="relative">
                      <select
                        value={draft.status}
                        onChange={(event) => setDraft((prev) => ({ ...prev, status: event.target.value }))}
                        className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                      </select>
                      <svg
                        viewBox="0 0 20 20"
                        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden
                      >
                        <path d="M5 7l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </label>
                  <div className="sm:col-span-6">
                    <div className="mb-2 text-sm font-semibold text-slate-700">
                      Bid Due Date <span className="text-rose-600">*</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={draft.due_date}
                        onChange={(event) => setDraft((prev) => ({ ...prev, due_date: event.target.value }))}
                        disabled={draft.tbd_due_date}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <select
                        value={draft.due_hour}
                        onChange={(event) => setDraft((prev) => ({ ...prev, due_hour: event.target.value }))}
                        disabled={draft.tbd_due_date}
                        className="rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((hour) => (
                          <option key={hour} value={hour}>
                            {hour}
                          </option>
                        ))}
                      </select>
                      <select
                        value={draft.due_minute}
                        onChange={(event) => setDraft((prev) => ({ ...prev, due_minute: event.target.value }))}
                        disabled={draft.tbd_due_date}
                        className="rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {["00", "15", "30", "45"].map((minute) => (
                          <option key={minute} value={minute}>
                            {minute}
                          </option>
                        ))}
                      </select>
                      <select
                        value={draft.due_period}
                        onChange={(event) => setDraft((prev) => ({ ...prev, due_period: event.target.value }))}
                        disabled={draft.tbd_due_date}
                        className="rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="am">am</option>
                        <option value="pm">pm</option>
                      </select>
                      <span className="text-sm text-slate-600">America/Adak</span>
                    </div>
                    <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={draft.tbd_due_date}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            tbd_due_date: event.target.checked,
                            due_date: event.target.checked ? "" : prev.due_date,
                          }))
                        }
                        className="size-4 rounded border-slate-300"
                      />
                      To be determined
                    </label>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-[18px] font-semibold text-slate-900">Package Contacts</h3>
                <div className="mt-5 space-y-5">
                  <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                    <span className="inline-flex items-center gap-2">
                      Primary Bidding Contact <span className="text-rose-600">*</span>
                      <span
                        className="inline-flex size-5 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white"
                        title="Who receives and sends bidding communications."
                        aria-label="Primary bidding contact help"
                      >
                        i
                      </span>
                    </span>
                    <div className="relative">
                      <select
                        value={draft.primary_bidding_contact}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, primary_bidding_contact: event.target.value }))
                        }
                        className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="Project Manager">Project Manager</option>
                        <option value="Estimator">Estimator</option>
                        <option value="Precon Manager">Precon Manager</option>
                      </select>
                      <svg
                        viewBox="0 0 20 20"
                        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden
                      >
                        <path d="M5 7l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-sm font-normal text-slate-600">
                      Emails will be sent from: test@builderos.com
                    </span>
                  </label>

                  <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                    <span className="inline-flex items-center gap-2">
                      Bidding CC Group
                      <span
                        className="inline-flex size-5 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white"
                        title="Optional distribution list for copied recipients."
                        aria-label="Bidding CC group help"
                      >
                        i
                      </span>
                    </span>
                    <div className="relative">
                      <select
                        value={draft.bidding_cc_group}
                        onChange={(event) => setDraft((prev) => ({ ...prev, bidding_cc_group: event.target.value }))}
                        className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">Choose a distribution group</option>
                        <option value="estimating-team">Estimating Team</option>
                        <option value="operations-leadership">Operations Leadership</option>
                        <option value="executive-updates">Executive Updates</option>
                      </select>
                      <svg
                        viewBox="0 0 20 20"
                        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden
                      >
                        <path d="M5 7l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </label>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-[18px] font-semibold text-slate-900">Bidding Instructions</h3>
                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                  <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <button type="button" className="rounded px-2 py-1 font-semibold hover:bg-slate-200">B</button>
                    <button type="button" className="rounded px-2 py-1 italic hover:bg-slate-200">I</button>
                    <button type="button" className="rounded px-2 py-1 underline hover:bg-slate-200">U</button>
                    <span className="mx-1 h-5 w-px bg-slate-300" />
                    <button type="button" className="rounded px-2 py-1 hover:bg-slate-200">• List</button>
                    <button type="button" className="rounded px-2 py-1 hover:bg-slate-200">1. List</button>
                    <span className="mx-1 h-5 w-px bg-slate-300" />
                    <button type="button" className="rounded px-2 py-1 hover:bg-slate-200">12pt</button>
                    <button type="button" className="rounded px-2 py-1 hover:bg-slate-200">A</button>
                  </div>
                  <textarea
                    value={draft.bidding_instructions}
                    onChange={(event) => setDraft((prev) => ({ ...prev, bidding_instructions: event.target.value }))}
                    className="min-h-56 w-full resize-y border-0 px-4 py-4 text-base leading-8 text-slate-800 focus:outline-none"
                  />
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-[18px] font-semibold text-slate-900">Pre-Bid Information</h3>
                <div className="mt-5 space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draft.rfi_deadline_enabled}
                      onClick={() =>
                        setDraft((prev) => ({ ...prev, rfi_deadline_enabled: !prev.rfi_deadline_enabled }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                        draft.rfi_deadline_enabled ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-slate-200"
                      }`}
                    >
                      <span
                        className={`inline-block size-5 transform rounded-full bg-white transition ${
                          draft.rfi_deadline_enabled ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <span className="text-sm font-medium text-slate-800">RFI Deadline</span>
                    {draft.rfi_deadline_enabled ? (
                      <div className="ml-4 flex flex-wrap items-center gap-2">
                        <input
                          type="date"
                          value={draft.rfi_deadline_date}
                          onChange={(event) =>
                            setDraft((prev) => ({ ...prev, rfi_deadline_date: event.target.value }))
                          }
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                        />
                        <select
                          value={draft.rfi_deadline_hour}
                          onChange={(event) =>
                            setDraft((prev) => ({ ...prev, rfi_deadline_hour: event.target.value }))
                          }
                          className="rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700"
                        >
                          {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((hour) => (
                            <option key={`rfi-hour-${hour}`} value={hour}>
                              {hour}
                            </option>
                          ))}
                        </select>
                        <select
                          value={draft.rfi_deadline_minute}
                          onChange={(event) =>
                            setDraft((prev) => ({ ...prev, rfi_deadline_minute: event.target.value }))
                          }
                          className="rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700"
                        >
                          {["00", "15", "30", "45"].map((minute) => (
                            <option key={`rfi-minute-${minute}`} value={minute}>
                              {minute}
                            </option>
                          ))}
                        </select>
                        <select
                          value={draft.rfi_deadline_period}
                          onChange={(event) =>
                            setDraft((prev) => ({ ...prev, rfi_deadline_period: event.target.value }))
                          }
                          className="rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700"
                        >
                          <option value="am">am</option>
                          <option value="pm">pm</option>
                        </select>
                        <span className="text-sm text-slate-600">America/Adak</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draft.site_walkthrough_enabled}
                      onClick={() =>
                        setDraft((prev) => ({ ...prev, site_walkthrough_enabled: !prev.site_walkthrough_enabled }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                        draft.site_walkthrough_enabled ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-slate-200"
                      }`}
                    >
                      <span
                        className={`inline-block size-5 transform rounded-full bg-white transition ${
                          draft.site_walkthrough_enabled ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <span className="text-sm font-medium text-slate-800">Site Walkthrough</span>
                    {draft.site_walkthrough_enabled ? (
                      <div className="ml-4 flex flex-wrap items-center gap-2">
                        <input
                          type="date"
                          value={draft.site_walkthrough_date}
                          onChange={(event) =>
                            setDraft((prev) => ({ ...prev, site_walkthrough_date: event.target.value }))
                          }
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                        />
                        <select
                          value={draft.site_walkthrough_hour}
                          onChange={(event) =>
                            setDraft((prev) => ({ ...prev, site_walkthrough_hour: event.target.value }))
                          }
                          className="rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700"
                        >
                          {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((hour) => (
                            <option key={`walk-hour-${hour}`} value={hour}>
                              {hour}
                            </option>
                          ))}
                        </select>
                        <select
                          value={draft.site_walkthrough_minute}
                          onChange={(event) =>
                            setDraft((prev) => ({ ...prev, site_walkthrough_minute: event.target.value }))
                          }
                          className="rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700"
                        >
                          {["00", "15", "30", "45"].map((minute) => (
                            <option key={`walk-minute-${minute}`} value={minute}>
                              {minute}
                            </option>
                          ))}
                        </select>
                        <select
                          value={draft.site_walkthrough_period}
                          onChange={(event) =>
                            setDraft((prev) => ({ ...prev, site_walkthrough_period: event.target.value }))
                          }
                          className="rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700"
                        >
                          <option value="am">am</option>
                          <option value="pm">pm</option>
                        </select>
                        <span className="text-sm text-slate-600">America/Adak</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-[18px] font-semibold text-slate-900">Advanced Settings</h3>
                <div className="mt-4">
                  <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                    Anticipated Award Date
                    <input
                      type="date"
                      value={draft.anticipated_award_date}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, anticipated_award_date: event.target.value }))
                      }
                      className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                    />
                  </label>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draft.countdown_emails}
                      onClick={() => setDraft((prev) => ({ ...prev, countdown_emails: !prev.countdown_emails }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                        draft.countdown_emails ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-slate-200"
                      }`}
                    >
                      <span
                        className={`inline-block size-5 transform rounded-full bg-white transition ${
                          draft.countdown_emails ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <span className="text-sm font-medium text-slate-800">Countdown Email(s)</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draft.accept_submissions_past_due}
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          accept_submissions_past_due: !prev.accept_submissions_past_due,
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                        draft.accept_submissions_past_due ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-slate-200"
                      }`}
                    >
                      <span
                        className={`inline-block size-5 transform rounded-full bg-white transition ${
                          draft.accept_submissions_past_due ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <span className="text-sm font-medium text-slate-800">Accept Submissions past Due Date</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draft.enable_blind_bidding}
                      onClick={() =>
                        setDraft((prev) => ({ ...prev, enable_blind_bidding: !prev.enable_blind_bidding }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                        draft.enable_blind_bidding ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-slate-200"
                      }`}
                    >
                      <span
                        className={`inline-block size-5 transform rounded-full bg-white transition ${
                          draft.enable_blind_bidding ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <span className="text-sm font-medium text-slate-800">Enable Blind Bidding</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draft.disable_electronic_submission}
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          disable_electronic_submission: !prev.disable_electronic_submission,
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                        draft.disable_electronic_submission ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-slate-200"
                      }`}
                    >
                      <span
                        className={`inline-block size-5 transform rounded-full bg-white transition ${
                          draft.disable_electronic_submission ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <span className="text-sm font-medium text-slate-800">Disable Electronic Submission of Bids</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draft.include_bid_documents}
                      onClick={() =>
                        setDraft((prev) => ({ ...prev, include_bid_documents: !prev.include_bid_documents }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                        draft.include_bid_documents ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-slate-200"
                      }`}
                    >
                      <span
                        className={`inline-block size-5 transform rounded-full bg-white transition ${
                          draft.include_bid_documents ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <span className="text-sm font-medium text-slate-800">Include Bid Documents</span>
                  </div>
                </div>

                <label className="mt-6 flex flex-col gap-2 text-sm font-semibold text-slate-700">
                  Bid Submission Confirmation Message
                  <textarea
                    value={draft.bid_submission_confirmation_message}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, bid_submission_confirmation_message: event.target.value }))
                    }
                    className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                    placeholder="Bid Submission Confirmation Message"
                  />
                </label>
              </section>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Owner / Client
                  <input
                    value={draft.owner}
                    onChange={(event) => setDraft((prev) => ({ ...prev, owner: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    placeholder="Owner name"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Location
                  <input
                    value={draft.location}
                    onChange={(event) => setDraft((prev) => ({ ...prev, location: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    placeholder="City, State"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Budget
                  <input
                    value={draft.budget}
                    onChange={(event) => setDraft((prev) => ({ ...prev, budget: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    placeholder="1000000"
                    inputMode="decimal"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Due date
                  <input
                    type="date"
                    value={draft.due_date}
                    onChange={(event) => setDraft((prev) => ({ ...prev, due_date: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                </label>
              </div>
              {createError ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{createError}</p> : null}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={createSubmitting}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createSubmitting ? "Creating..." : "Create Bid Package"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
