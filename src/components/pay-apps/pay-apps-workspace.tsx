"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getProjectPayAppsData, summarizeStatuses, upsertPayApp } from "@/lib/pay-apps/store";
import type { PayApp } from "@/lib/pay-apps/types";

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export default function PayAppsWorkspace({ projectId }: { projectId: string }) {
  const [state, setState] = useState(() => getProjectPayAppsData(projectId));
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = state.payApps.find((item) => item.id === editingId) ?? null;

  const rows = useMemo(
    () =>
      state.payApps.map((payApp) => {
        const records = state.waiverRecords.filter((record) => record.payAppId === payApp.id);
        const summary = summarizeStatuses(records);
        return { payApp, summary };
      }),
    [state.payApps, state.waiverRecords]
  );

  const onSubmit = (formData: FormData) => {
    const number = String(formData.get("number") ?? "").trim();
    if (!number) return;

    const next: PayApp = {
      id: editing?.id ?? `pa-${crypto.randomUUID()}`,
      projectId,
      number,
      periodStart: String(formData.get("periodStart") ?? "") || undefined,
      periodEnd: String(formData.get("periodEnd") ?? "") || undefined,
      totalAmount: Number(formData.get("totalAmount") ?? "") || undefined,
      notes: String(formData.get("notes") ?? "") || undefined,
      updatedAt: new Date().toISOString(),
    };

    upsertPayApp(projectId, next);
    setState(getProjectPayAppsData(projectId));
    setEditingId(null);
    setIsFormOpen(false);
  };

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[color:var(--muted,#65758b)]">Waiver Center</p>
          <h1 className="text-2xl font-semibold">Pay Apps</h1>
          <p className="text-sm text-[color:var(--muted,#65758b)]">
            Project-level source of truth for waiver records.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setIsFormOpen(true);
          }}
          className="rounded bg-[color:var(--primary)] px-4 py-2 text-sm text-white hover:bg-[color:var(--primary-hover)]"
        >
          Create Pay App
        </button>
      </header>

      {isFormOpen && (
        <section className="rounded-lg border border-black/10 bg-white p-4">
          <h2 className="font-semibold">{editing ? "Edit Pay App" : "Create Pay App"}</h2>
          <form action={onSubmit} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm">
              Pay App Number *
              <input
                name="number"
                required
                defaultValue={editing?.number}
                className="mt-1 w-full rounded border border-black/20 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Total amount (optional)
              <input
                name="totalAmount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={editing?.totalAmount}
                className="mt-1 w-full rounded border border-black/20 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Period start
              <input
                name="periodStart"
                type="date"
                defaultValue={editing?.periodStart}
                className="mt-1 w-full rounded border border-black/20 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Period end
              <input
                name="periodEnd"
                type="date"
                defaultValue={editing?.periodEnd}
                className="mt-1 w-full rounded border border-black/20 px-3 py-2"
              />
            </label>
            <label className="text-sm md:col-span-2">
              Notes
              <textarea
                name="notes"
                rows={3}
                defaultValue={editing?.notes}
                className="mt-1 w-full rounded border border-black/20 px-3 py-2"
              />
            </label>
            <div className="md:col-span-2 flex gap-2">
              <button className="rounded bg-black px-4 py-2 text-sm text-white">Save Pay App</button>
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingId(null);
                }}
                className="rounded border border-black/20 px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-black/10 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-black/[0.03]">
            <tr>
              <th className="p-3 text-left">Pay App #</th>
              <th className="p-3 text-left">Period</th>
              <th className="p-3 text-right">Total Amount</th>
              <th className="p-3 text-left">Status Summary</th>
              <th className="p-3 text-left">Last Updated</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ payApp, summary }) => (
              <tr key={payApp.id} className="border-t border-black/10 align-top">
                <td className="p-3 font-medium">{payApp.number}</td>
                <td className="p-3">
                  {formatDate(payApp.periodStart)} - {formatDate(payApp.periodEnd)}
                </td>
                <td className="p-3 text-right">
                  {typeof payApp.totalAmount === "number" ? `$${payApp.totalAmount.toLocaleString()}` : "—"}
                </td>
                <td className="p-3 text-xs text-[color:var(--muted,#65758b)]">
                  {summary.missing} missing / {summary.uploaded} uploaded / {summary.approved} approved
                </td>
                <td className="p-3">{formatDate(payApp.updatedAt)}</td>
                <td className="p-3 text-right">
                  <div className="inline-flex gap-2">
                    <button
                      onClick={() => {
                        setEditingId(payApp.id);
                        setIsFormOpen(true);
                      }}
                      className="rounded border border-black/20 px-3 py-1"
                    >
                      Edit
                    </button>
                    <Link
                      href={`/projects/${projectId}/pay-apps/${payApp.id}`}
                      className="rounded bg-[color:var(--primary)] px-3 py-1 text-white"
                    >
                      Open
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
