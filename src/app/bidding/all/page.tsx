"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BidProjectSummary } from "@/lib/bidding/types";
import { listBidProjects } from "@/lib/bidding/store";

function formatCurrency(value: number | null): string {
  if (value === null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function daysUntil(isoDate: string | null): string {
  if (!isoDate) return "-";
  const today = new Date();
  const due = new Date(`${isoDate}T00:00:00`);
  const msPerDay = 1000 * 60 * 60 * 24;
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const value = Math.max(0, Math.ceil((due.getTime() - todayMidnight) / msPerDay));
  return `${value}d`;
}

export default function AllBidsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<BidProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const projects = await listBidProjects();
      if (!active) return;
      setRows(projects);
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

  return (
    <main className="space-y-4 bg-slate-50 p-4 sm:p-6">
      <header className="-mx-4 border-b border-slate-200 bg-white sm:-mx-6">
        <div className="px-6 py-3">
          <h1 className="text-3xl font-semibold text-slate-900">All Active Bids</h1>
          <p className="text-sm text-slate-600">Every active bid package in one table.</p>
        </div>
      </header>

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-sm text-slate-500 shadow-sm">
          Loading bids...
        </section>
      ) : sortedRows.length ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Bid Package</th>
                  <th className="px-4 py-3 text-left font-semibold">Owner</th>
                  <th className="px-4 py-3 text-left font-semibold">Location</th>
                  <th className="px-4 py-3 text-left font-semibold">Budget</th>
                  <th className="px-4 py-3 text-left font-semibold">Due Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Countdown</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-t border-slate-200 hover:bg-slate-50"
                    onClick={() => router.push(`/bidding?project=${row.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{row.project_name}</td>
                    <td className="px-4 py-3 text-slate-700">{row.owner ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{row.location ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrency(row.budget)}</td>
                    <td className="px-4 py-3 text-slate-700">{row.due_date ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{daysUntil(row.due_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500 shadow-sm">
          No active bids yet.
        </section>
      )}
    </main>
  );
}
