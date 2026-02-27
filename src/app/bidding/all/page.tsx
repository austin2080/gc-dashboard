"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { BidProjectSummary } from "@/lib/bidding/types";
import { listArchivedBidProjects, listBidProjects } from "@/lib/bidding/store";

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
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rangeStart = visibleRows.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, visibleRows.length);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return visibleRows.slice(start, start + PAGE_SIZE);
  }, [currentPage, visibleRows]);

  return (
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
          <Link
            href="/bidding"
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-base font-semibold text-white shadow-sm transition hover:bg-orange-600"
          >
            <span aria-hidden>＋</span>
            Add Bid Package
          </Link>
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
                {rangeStart}-{rangeEnd} of {visibleRows.length}
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
                    <th className="w-20 border-r border-slate-100 px-4 py-4 text-left font-semibold">
                      <span className="inline-flex items-center gap-4">
                        #
                        <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
                          <path d="M10 4 5.5 9h9L10 4z" fill="#3B82F6" />
                          <path d="M10 16 14.5 11h-9L10 16z" fill="#CBD5E1" />
                        </svg>
                      </span>
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
                    const rowNumber = rangeStart + index;
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
                        <button
                          type="button"
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex size-8 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label="Delete bid package"
                        >
                          <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden>
                            <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v8h-2V9zm4 0h2v8h-2V9zM7 9h2v8H7V9z" />
                          </svg>
                        </button>
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
  );
}
