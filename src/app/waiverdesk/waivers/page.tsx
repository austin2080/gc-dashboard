"use client";

import { useMemo } from "react";

import WaiverRiskBadge from "@/components/waiver-risk-badge";
import WaiverStatusPill from "@/components/waiver-status-pill";
import { getProjectPayAppsData } from "@/lib/pay-apps/store";

export default function WaiverDeskWaiversPage() {
  const data = getProjectPayAppsData("default");

  const rows = useMemo(
    () =>
      data.waiverRecords.map((record) => {
        const contractor = data.contractors.find((item) => item.id === record.contractorId);
        const payApp = data.payApps.find((item) => item.id === record.payAppId);
        return {
          id: record.id,
          contractor: contractor?.name ?? "Unknown",
          payApp: payApp?.number ?? "Unknown",
          status: record.status,
          amount: record.amount,
          updatedAt: record.updatedAt,
        };
      }),
    [data]
  );

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Waiver Center · Aggregated Waivers</h1>
      <p className="text-sm text-[color:var(--muted,#65758b)]">
        Records below are sourced directly from project Pay Apps waiver slots.
      </p>
      <div className="overflow-hidden rounded-lg border border-black/10 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-black/[0.03]">
            <tr>
              <th className="p-3 text-left">Contractor</th>
              <th className="p-3 text-left">Pay App</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Risk</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-left">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-black/10">
                <td className="p-3">{row.contractor}</td>
                <td className="p-3">{row.payApp}</td>
                <td className="p-3">
                  <WaiverStatusPill status={row.status} />
                </td>
                <td className="p-3">
                  <WaiverRiskBadge status={row.status} />
                </td>
                <td className="p-3 text-right">
                  {typeof row.amount === "number"
                    ? row.amount.toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                      })
                    : "—"}
                </td>
                <td className="p-3">{new Date(row.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
