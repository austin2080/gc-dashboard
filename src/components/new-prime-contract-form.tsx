"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";

type FormState = { error?: string };

type SovItem = {
  cost_code: string;
  description: string;
  amount: string;
};

type PrimeContractDefaults = {
  title?: string | null;
  owner_name?: string | null;
  contractor_name?: string | null;
  architect_engineer?: string | null;
  retention_percent?: number | null;
  status?: "draft" | "out_for_signature" | "approved" | null;
  executed?: boolean | null;
  original_amount?: number | null;
  estimated_profit?: number | null;
  estimated_buyout?: number | null;
  change_orders_amount?: number | null;
  pay_app_status?: string | null;
  payments_received?: string | null;
  inclusions?: string | null;
  exclusions?: string | null;
  invoice_contact_name?: string | null;
  invoice_contact_email?: string | null;
  invoice_contact_phone?: string | null;
  schedule_of_values?: SovItem[] | null;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded border border-black bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
      disabled={pending}
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

export default function NewPrimeContractForm({
  action,
  projectId,
  defaults,
  submitLabel = "Create Contract",
  headerTitle = "New Prime Contract",
  headerSubtitle = "Create a contract for this project.",
  backHref,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  projectId: string;
  defaults?: PrimeContractDefaults;
  submitLabel?: string;
  headerTitle?: string;
  headerSubtitle?: string;
  backHref?: string;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});
  const [sovItems, setSovItems] = useState<SovItem[]>(
    defaults?.schedule_of_values?.length
      ? defaults.schedule_of_values
      : [{ cost_code: "", description: "", amount: "" }]
  );

  const sovTotal = useMemo(() => {
    return sovItems.reduce((sum, item) => {
      const val = Number(String(item.amount).replace(/[^\d.]/g, ""));
      return sum + (Number.isNaN(val) ? 0 : val);
    }, 0);
  }, [sovItems]);

  function updateSovItem(index: number, patch: Partial<SovItem>) {
    setSovItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }

  function addSovItem() {
    setSovItems((prev) => [...prev, { cost_code: "", description: "", amount: "" }]);
  }

  function removeSovItem(index: number) {
    setSovItems((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{headerTitle}</h1>
          <p className="text-sm opacity-80">{headerSubtitle}</p>
        </div>
        <Link
          className="border rounded px-3 py-2 text-sm"
          href={backHref ?? `/projects/${projectId}/contract`}
        >
          Back to Contracts
        </Link>
      </header>

      <form action={formAction} className="space-y-6">
        <section className="border rounded-lg p-4 space-y-4">
          <h2 className="font-semibold">General Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <label className="space-y-1 md:col-span-2">
              <div className="opacity-70">Title</div>
              <input
                name="title"
                required
                defaultValue={defaults?.title ?? ""}
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="Prime Contract - Base Build"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Owner Name</div>
              <input
                name="owner_name"
                defaultValue={defaults?.owner_name ?? ""}
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="Owner/Client"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Retention (%)</div>
              <input
                type="number"
                name="retention_percent"
                defaultValue={defaults?.retention_percent ?? 0}
                className="w-full rounded border border-black/20 px-3 py-2"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Contractor</div>
              <input
                name="contractor_name"
                defaultValue={defaults?.contractor_name ?? ""}
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="General Contractor"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Architect/Engineer</div>
              <input
                name="architect_engineer"
                defaultValue={defaults?.architect_engineer ?? ""}
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="Architect / Engineer"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Status</div>
              <select
                name="status"
                className="w-full rounded border border-black/20 px-3 py-2"
                defaultValue={defaults?.status ?? "draft"}
              >
                <option value="draft">Draft</option>
                <option value="out_for_signature">Out for Signature</option>
                <option value="approved">Approved</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="executed"
                className="h-4 w-4"
                defaultChecked={Boolean(defaults?.executed)}
              />
              <span>Executed</span>
            </label>
            <label className="space-y-1 md:col-span-4">
              <div className="opacity-70">Contract Documents</div>
              <input type="file" className="w-full rounded border border-black/20 px-3 py-2" />
            </label>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4 border rounded-lg p-4 text-sm">
          <label className="space-y-1">
            <div className="opacity-70">Original Contract Value</div>
            <input
              type="number"
              name="original_amount"
              defaultValue={defaults?.original_amount ?? 0}
              className="w-full rounded border border-black/20 px-3 py-2"
              step="0.01"
              min="0"
              placeholder="0.00"
            />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Est. OH&P</div>
            <input
              type="number"
              name="estimated_profit"
              defaultValue={defaults?.estimated_profit ?? 0}
              className="w-full rounded border border-black/20 px-3 py-2"
              step="0.01"
              min="0"
              placeholder="0.00"
            />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Est. Buyout</div>
            <input
              type="number"
              name="estimated_buyout"
              defaultValue={defaults?.estimated_buyout ?? 0}
              className="w-full rounded border border-black/20 px-3 py-2"
              step="0.01"
              min="0"
              placeholder="0.00"
            />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Revised Contract Value</div>
            <input
              type="number"
              className="w-full rounded border border-black/20 px-3 py-2"
              step="0.01"
              min="0"
              placeholder="Calculated"
              readOnly
            />
          </label>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 border rounded-lg p-4 text-sm">
          <label className="space-y-1">
            <div className="opacity-70">Change Orders</div>
            <input
              type="number"
              name="change_orders_amount"
              defaultValue={defaults?.change_orders_amount ?? 0}
              className="w-full rounded border border-black/20 px-3 py-2"
              step="0.01"
              placeholder="0.00 (can be negative)"
            />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Pay App Status</div>
            <input
              name="pay_app_status"
              defaultValue={defaults?.pay_app_status ?? ""}
              className="w-full rounded border border-black/20 px-3 py-2"
              placeholder="Outstanding info"
            />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Payments Received</div>
            <input
              name="payments_received"
              defaultValue={defaults?.payments_received ?? ""}
              className="w-full rounded border border-black/20 px-3 py-2"
              placeholder="Most recent / total"
            />
          </label>
        </section>

        <section className="border rounded-lg">
          <div className="p-4 border-b flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">Schedule of Values</h2>
              <p className="text-sm opacity-70">
                Cost codes, descriptions, and values used to bill the owner.
              </p>
            </div>
            <button type="button" className="border rounded px-3 py-2 text-sm" onClick={addSovItem}>
              Add Line Item
            </button>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-black/5 backdrop-blur border-b">
                <tr>
                  <th className="text-left p-3">Cost Code</th>
                  <th className="text-left p-3">Description</th>
                  <th className="text-right p-3">Amount</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sovItems.map((item, idx) => (
                  <tr key={`sov-${idx}`} className="border-b last:border-b-0">
                    <td className="p-3">
                      <input
                        className="w-full rounded border border-black/20 px-3 py-2"
                        value={item.cost_code}
                        onChange={(e) => updateSovItem(idx, { cost_code: e.target.value })}
                        placeholder="01-000"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        className="w-full rounded border border-black/20 px-3 py-2"
                        value={item.description}
                        onChange={(e) => updateSovItem(idx, { description: e.target.value })}
                        placeholder="Description"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        className="w-full rounded border border-black/20 px-3 py-2 text-right"
                        value={item.amount}
                        onChange={(e) => updateSovItem(idx, { amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        className="text-xs opacity-70 hover:opacity-100"
                        onClick={() => removeSovItem(idx)}
                        disabled={sovItems.length === 1}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-black/[0.02]">
                  <td className="p-3 font-medium" colSpan={2}>
                    Total
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {sovTotal.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                  </td>
                  <td className="p-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <input type="hidden" name="schedule_of_values" value={JSON.stringify(sovItems)} />
        </section>

        <section className="border rounded-lg p-4 space-y-4">
          <h2 className="font-semibold">Inclusions / Exclusions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <label className="space-y-1">
              <div className="opacity-70">Inclusions</div>
              <textarea
                name="inclusions"
                className="w-full rounded border border-black/20 px-3 py-2"
                rows={5}
                placeholder="List what is included..."
                defaultValue={defaults?.inclusions ?? ""}
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Exclusions</div>
              <textarea
                name="exclusions"
                className="w-full rounded border border-black/20 px-3 py-2"
                rows={5}
                placeholder="List what is excluded..."
                defaultValue={defaults?.exclusions ?? ""}
              />
            </label>
          </div>
        </section>

        <section className="border rounded-lg p-4 space-y-4">
          <h2 className="font-semibold">Invoicing Contact</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <label className="space-y-1">
              <div className="opacity-70">Name</div>
              <input
                name="invoice_contact_name"
                defaultValue={defaults?.invoice_contact_name ?? ""}
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="Contact name"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Email</div>
              <input
                type="email"
                name="invoice_contact_email"
                defaultValue={defaults?.invoice_contact_email ?? ""}
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="email@company.com"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Phone</div>
              <input
                name="invoice_contact_phone"
                defaultValue={defaults?.invoice_contact_phone ?? ""}
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="(555) 555-5555"
              />
            </label>
          </div>
        </section>

        {state.error ? (
          <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <SubmitButton label={submitLabel} />
          <div className="text-xs opacity-60">You can edit this later.</div>
        </div>
      </form>
    </main>
  );
}
