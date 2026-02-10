"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type PayAppRow = {
  id: string;
  app_number: string | null;
  submitted_date: string | null;
  due_date: string | null;
  amount: number | null;
  status: string | null;
  contract_id: string | null;
};

type Props = {
  projectId: string;
  projectName: string;
  payApps: PayAppRow[];
  retentionPercent: number;
};

const STATUS_TABS = ["all", "draft", "submitted", "under_review", "approved", "rejected", "paid"] as const;
const PAYMENT_TABS = ["all", "unpaid", "overdue", "paid"] as const;

const statusLabel: Record<string, string> = {
  under_review: "Under Review",
};

const money = (value: number) =>
  value.toLocaleString(undefined, { style: "currency", currency: "USD" });

export default function PayAppsTable({ projectId, projectName, payApps, retentionPercent }: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]>("all");
  const [paymentFilter, setPaymentFilter] = useState<(typeof PAYMENT_TABS)[number]>("all");
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const now = useMemo(() => new Date(), []);

  const paymentStatus = useCallback((row: PayAppRow) => {
    if (row.status === "paid") return "paid";
    const due = row.due_date ? new Date(row.due_date) : null;
    if (due && due.getTime() < now.getTime()) return "overdue";
    return "unpaid";
  }, [now]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? payApps.filter((app) => {
          const haystack = `${app.app_number ?? ""} ${app.status ?? ""} ${projectName}`.toLowerCase();
          return haystack.includes(q);
        })
      : payApps;

    const statusList =
      statusFilter === "all" ? list : list.filter((app) => (app.status ?? "").toLowerCase() === statusFilter);

    const paymentList =
      paymentFilter === "all"
        ? statusList
        : statusList.filter((app) => paymentStatus(app) === paymentFilter);

    if (!startDate && !endDate) return paymentList;

    return paymentList.filter((app) => {
      if (!app.submitted_date) return false;
      const date = new Date(app.submitted_date).getTime();
      if (startDate && date < new Date(startDate).getTime()) return false;
      if (endDate && date > new Date(endDate).getTime()) return false;
      return true;
    });
  }, [payApps, projectName, query, statusFilter, paymentFilter, startDate, endDate, paymentStatus]);

  const sortedForTotals = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aTime = a.submitted_date ? new Date(a.submitted_date).getTime() : 0;
      const bTime = b.submitted_date ? new Date(b.submitted_date).getTime() : 0;
      return aTime - bTime;
    });
  }, [filtered]);

  const totalById = useMemo(() => {
    let running = 0;
    const map = new Map<string, number>();
    sortedForTotals.forEach((app) => {
      running += app.amount ?? 0;
      map.set(app.id, running);
    });
    return map;
  }, [sortedForTotals]);

  const formatStatus = (status?: string | null) => {
    if (!status) return "-";
    return statusLabel[status] ?? status.replace(/_/g, " ");
  };

  const daysOpen = (created?: string | null) => {
    if (!created) return "-";
    const start = new Date(created);
    const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? `${diff}d` : "—";
  };

  const badgeClass = (value: string) => {
    if (value === "approved") return "bg-emerald-100 text-emerald-700";
    if (value === "paid") return "bg-emerald-100 text-emerald-700";
    if (value === "overdue") return "bg-red-100 text-red-700";
    if (value === "rejected") return "bg-red-100 text-red-700";
    if (value === "draft") return "bg-black/10 text-black/70";
    if (value === "submitted" || value === "under_review") return "bg-amber-100 text-amber-800";
    return "bg-black/10 text-black/70";
  };

  return (
    <section className="border rounded-lg">
      <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Pay Applications</h2>
          <p className="text-sm opacity-70">Quick read on billing, approval, and payment status.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`rounded-full px-3 py-1 capitalize ${
                statusFilter === tab ? "bg-black/10 text-black" : "text-black/70 hover:bg-black/5"
              }`}
              onClick={() => setStatusFilter(tab)}
            >
              {tab === "all" ? "All" : formatStatus(tab)}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 border-b grid grid-cols-1 lg:grid-cols-4 gap-3 text-sm">
        <input
          className="w-full rounded border border-black/20 px-3 py-2"
          placeholder="Search by pay app # or status"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="w-full rounded border border-black/20 px-3 py-2"
          value={paymentFilter}
          onChange={(event) => setPaymentFilter(event.target.value as (typeof PAYMENT_TABS)[number])}
        >
          {PAYMENT_TABS.map((tab) => (
            <option key={tab} value={tab}>
              {tab === "all" ? "All Payment Statuses" : tab.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="w-full rounded border border-black/20 px-3 py-2"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
        />
        <input
          type="date"
          className="w-full rounded border border-black/20 px-3 py-2"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
        />
      </div>
      <div className="max-h-[640px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-black/5 backdrop-blur border-b">
            <tr>
              <th className="text-left p-3">Pay App #</th>
              <th className="text-left p-3">Billing Period</th>
              <th className="text-left p-3">Application Date</th>
              <th className="text-left p-3">Billing Type</th>
              <th className="text-right p-3">Amount This Period</th>
              <th className="text-right p-3">Total Billed to Date</th>
              <th className="text-right p-3">Retention</th>
              <th className="text-right p-3">Net Due</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Payment Status</th>
              <th className="text-left p-3">Project</th>
              <th className="text-left p-3">Due Date</th>
              <th className="text-left p-3">Latest Response</th>
              <th className="text-left p-3">Revision</th>
              <th className="text-left p-3">Days Open</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((app) => {
                const amount = app.amount ?? 0;
                const retention = amount * (retentionPercent / 100);
                const netDue = amount - retention;
                const payStatus = paymentStatus(app);

                return (
                  <tr
                    key={app.id}
                    className="border-b last:border-b-0 hover:bg-black/[0.03] cursor-pointer"
                    onClick={() => router.push(`/projects/${projectId}/pay-apps/${app.id}`)}
                  >
                    <td className="p-3">{app.app_number ?? "-"}</td>
                    <td className="p-3">
                      {app.submitted_date ? new Date(app.submitted_date).toLocaleDateString() : "-"}
                      {app.due_date ? ` – ${new Date(app.due_date).toLocaleDateString()}` : ""}
                    </td>
                    <td className="p-3">
                      {app.submitted_date ? new Date(app.submitted_date).toLocaleDateString() : "-"}
                    </td>
                    <td className="p-3">Owner</td>
                    <td className="p-3 text-right">{money(amount)}</td>
                    <td className="p-3 text-right">{money(totalById.get(app.id) ?? amount)}</td>
                    <td className="p-3 text-right">{money(retention)}</td>
                    <td className="p-3 text-right">{money(netDue)}</td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs capitalize ${badgeClass(app.status ?? "draft")}`}>
                        {formatStatus(app.status ?? "draft")}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs capitalize ${badgeClass(payStatus)}`}>
                        {payStatus.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="p-3">{projectName}</td>
                    <td className="p-3">
                      {app.due_date ? new Date(app.due_date).toLocaleDateString() : "-"}
                    </td>
                    <td className="p-3">-</td>
                    <td className="p-3">-</td>
                    <td className="p-3">{daysOpen(app.submitted_date)}</td>
                    <td className="p-3 text-right" onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2 text-xs">
                        <button
                          type="button"
                          className="rounded border border-black/20 px-2 py-1"
                          onClick={() => router.push(`/projects/${projectId}/pay-apps/${app.id}`)}
                        >
                          View
                        </button>
                        <button type="button" className="rounded border border-black/20 px-2 py-1" disabled>
                          Edit
                        </button>
                        <button type="button" className="rounded border border-black/20 px-2 py-1" disabled>
                          Download PDF
                        </button>
                        <button type="button" className="rounded border border-black/20 px-2 py-1" disabled>
                          View Backup
                        </button>
                        <button type="button" className="rounded border border-black/20 px-2 py-1" disabled>
                          Mark as Paid
                        </button>
                        <button type="button" className="rounded border border-black/20 px-2 py-1" disabled>
                          View History
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="p-4 opacity-70" colSpan={16}>
                  No pay apps match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
