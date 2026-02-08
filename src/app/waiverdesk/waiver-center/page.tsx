"use client";

import { useMemo, useState } from "react";

import StatusPill from "@/components/waivers/StatusPill";
import { getProjectPayAppsData } from "@/lib/pay-apps/store";

const projectIds = ["default"];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export default function WaiverCenterPage() {
  const [projectId, setProjectId] = useState(projectIds[0]);
  const data = getProjectPayAppsData(projectId);

  const rows = useMemo(
    () =>
      data.waiverRecords.map((record) => {
        const contractor = data.contractors.find((item) => item.id === record.contractorId);
        const payApp = data.payApps.find((item) => item.id === record.payAppId);
        return {
          ...record,
          vendorName: contractor?.name ?? "Unknown Vendor",
          payAppNumber: payApp?.number ?? "Unknown Pay App",
        };
      }),
    [data]
  );

  const summary = useMemo(() => {
    const missing = rows.filter((row) => row.status === "missing").length;
    const requested = rows.filter((row) => row.status === "requested").length;
    const uploaded = rows.filter((row) => row.status === "uploaded").length;
    const approved = rows.filter((row) => row.status === "approved").length;
    const exposure = rows
      .filter((row) => row.status !== "approved")
      .reduce((acc, row) => acc + (row.amount ?? 0), 0);

    return { missing, requested, uploaded, approved, exposure };
  }, [rows]);

  return (
    <main className="space-y-5 p-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-black/50">Waiver Center</p>
          <h1 className="text-2xl font-semibold">Project Waiver Rollup</h1>
          <p className="text-sm text-black/60">Aggregated records from project-level Lien Waivers pages.</p>
        </div>
        <label className="text-xs uppercase tracking-wide text-black/50">
          Project
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="mt-1 block rounded border border-black/20 px-3 py-2 text-sm"
          >
            {projectIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded border border-black/10 bg-white p-3 text-sm">Missing: {summary.missing}</div>
        <div className="rounded border border-black/10 bg-white p-3 text-sm">Awaiting upload: {summary.requested}</div>
        <div className="rounded border border-black/10 bg-white p-3 text-sm">Awaiting approval: {summary.uploaded}</div>
        <div className="rounded border border-black/10 bg-white p-3 text-sm">Approved: {summary.approved}</div>
        <div className="rounded border border-black/10 bg-white p-3 text-sm">
          Total exposure: {currencyFormatter.format(summary.exposure)}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-black/10 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-black/[0.03]">
            <tr>
              <th className="p-3 text-left">Vendor</th>
              <th className="p-3 text-left">Pay App #</th>
              <th className="p-3 text-left">Waiver Type</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-black/10">
                <td className="p-3">{row.vendorName}</td>
                <td className="p-3">{row.payAppNumber}</td>
                <td className="p-3">{row.waiverType.replace("_", " ")}</td>
                <td className="p-3 text-right">{currencyFormatter.format(row.amount ?? 0)}</td>
                <td className="p-3">
                  <StatusPill status={row.status} />
                </td>
                <td className="p-3">{formatDate(row.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
