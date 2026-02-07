"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getProjectPayAppsData, upsertWaiverRecord } from "@/lib/pay-apps/store";
import type { WaiverStatus, WaiverType } from "@/lib/pay-apps/types";

const waiverTypeLabels: Record<WaiverType, string> = {
  conditional_progress: "Conditional Progress",
  unconditional_progress: "Unconditional Progress",
  conditional_final: "Conditional Final",
  unconditional_final: "Unconditional Final",
};

const statuses: WaiverStatus[] = ["missing", "requested", "uploaded", "approved"];

const formatCurrency = (value?: number) =>
  typeof value === "number" ? value.toLocaleString(undefined, { style: "currency", currency: "USD" }) : "—";

export default function PayAppDetailWorkspace({
  projectId,
  payAppId,
}: {
  projectId: string;
  payAppId: string;
}) {
  const [state, setState] = useState(() => getProjectPayAppsData(projectId));
  const payApp = state.payApps.find((item) => item.id === payAppId);

  const contractors = state.contractors;

  const expectedWaiverTypes = (hasFinalWaivers: boolean): WaiverType[] =>
    hasFinalWaivers
      ? ["conditional_progress", "unconditional_progress", "conditional_final", "unconditional_final"]
      : ["conditional_progress", "unconditional_progress"];

  const payAppRecords = useMemo(
    () => state.waiverRecords.filter((record) => record.payAppId === payAppId),
    [state.waiverRecords, payAppId]
  );

  if (!payApp) {
    return (
      <main className="p-6">
        <p className="text-sm">Pay app not found.</p>
        <Link href={`/projects/${projectId}/pay-apps`} className="mt-3 inline-block text-sm underline">
          Back to Pay Apps
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[color:var(--muted,#65758b)]">Waiver Compliance</p>
          <h1 className="text-2xl font-semibold">Pay App {payApp.number}</h1>
          <p className="text-sm text-[color:var(--muted,#65758b)]">Primary place to create and update waiver records.</p>
        </div>
        <Link href={`/projects/${projectId}/pay-apps`} className="rounded border border-black/20 px-4 py-2 text-sm">
          Back to Pay Apps
        </Link>
      </header>

      <section className="grid grid-cols-1 gap-4 rounded-lg border border-black/10 bg-white p-4 md:grid-cols-3">
        <div>
          <div className="text-xs uppercase text-[color:var(--muted,#65758b)]">Period</div>
          <div className="font-semibold">
            {payApp.periodStart ? new Date(payApp.periodStart).toLocaleDateString() : "—"} -{" "}
            {payApp.periodEnd ? new Date(payApp.periodEnd).toLocaleDateString() : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-[color:var(--muted,#65758b)]">Total Amount</div>
          <div className="font-semibold">{formatCurrency(payApp.totalAmount)}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-[color:var(--muted,#65758b)]">Notes</div>
          <div className="font-semibold">{payApp.notes || "—"}</div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-black/10 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-black/[0.03]">
            <tr>
              <th className="p-3 text-left">Contractor</th>
              <th className="p-3 text-left">Waiver Slot</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-left">File Upload</th>
            </tr>
          </thead>
          <tbody>
            {contractors.flatMap((contractor) =>
              expectedWaiverTypes(contractor.hasFinalWaivers).map((waiverType, index) => {
                const id = `${payAppId}-${contractor.id}-${waiverType}`;
                const existing = payAppRecords.find((record) => record.id === id);

                return (
                  <tr key={id} className="border-t border-black/10">
                    <td className="p-3">{index === 0 ? contractor.name : ""}</td>
                    <td className="p-3">{waiverTypeLabels[waiverType]}</td>
                    <td className="p-3">
                      <select
                        value={existing?.status ?? "missing"}
                        onChange={(event) => {
                          upsertWaiverRecord(projectId, {
                            id,
                            projectId,
                            contractorId: contractor.id,
                            payAppId,
                            waiverType,
                            status: event.target.value as WaiverStatus,
                            amount: existing?.amount,
                            updatedAt: new Date().toISOString(),
                          });
                          setState(getProjectPayAppsData(projectId));
                        }}
                        className="rounded border border-black/20 px-2 py-1"
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 text-right">
                      <input
                        type="number"
                        defaultValue={existing?.amount}
                        min="0"
                        step="0.01"
                        onBlur={(event) => {
                          upsertWaiverRecord(projectId, {
                            id,
                            projectId,
                            contractorId: contractor.id,
                            payAppId,
                            waiverType,
                            status: existing?.status ?? "missing",
                            amount: Number(event.target.value) || 0,
                            updatedAt: new Date().toISOString(),
                          });
                          setState(getProjectPayAppsData(projectId));
                        }}
                        className="w-32 rounded border border-black/20 px-2 py-1 text-right"
                      />
                    </td>
                    <td className="p-3">
                      <button className="rounded border border-dashed border-black/30 px-3 py-1 text-xs text-black/60">
                        Upload Placeholder
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
