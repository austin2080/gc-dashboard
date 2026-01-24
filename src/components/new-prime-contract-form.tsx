"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";

type FormState = { error?: string };

type SovItem = {
  cost_code: string;
  description: string;
  unit: string;
  quantity: string;
  unit_price: string;
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
  costCodes = [],
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  projectId: string;
  defaults?: PrimeContractDefaults;
  submitLabel?: string;
  headerTitle?: string;
  headerSubtitle?: string;
  backHref?: string;
  costCodes?: { code: string; description: string | null }[];
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});
  const [sovItems, setSovItems] = useState<SovItem[]>(
    defaults?.schedule_of_values?.length
      ? defaults.schedule_of_values
      : [
          {
            cost_code: "",
            description: "",
            amount: "",
            unit: "",
            quantity: "",
            unit_price: "",
          },
        ]
  );

  const moneyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );

  const sovTotal = useMemo(() => {
    return sovItems.reduce((sum, item) => {
      const val = Number(String(item.amount).replace(/[^\d.]/g, ""));
      return sum + (Number.isNaN(val) ? 0 : val);
    }, 0);
  }, [sovItems]);

  function formatMoney(value: string) {
    const num = Number(String(value).replace(/[^\d.]/g, ""));
    if (Number.isNaN(num)) return "";
    return moneyFormatter.format(num);
  }

  function calcAmount(qtyRaw: string, unitRaw: string) {
    const qty = Number(String(qtyRaw).replace(/[^\d.]/g, ""));
    const unitPrice = Number(String(unitRaw).replace(/[^\d.]/g, ""));
    if (Number.isNaN(qty) || Number.isNaN(unitPrice)) return "";
    return moneyFormatter.format(qty * unitPrice);
  }

  function updateSovItem(index: number, patch: Partial<SovItem>) {
    setSovItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }

  function addSovItem() {
    setSovItems((prev) => [
      ...prev,
      {
        cost_code: "",
        description: "",
        amount: "",
        unit: "",
        quantity: "",
        unit_price: "",
      },
    ]);
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
                  <th className="text-left p-3">Unit</th>
                  <th className="text-right p-3">Qty</th>
                  <th className="text-right p-3">Unit Price</th>
                  <th className="text-right p-3">Amount</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sovItems.map((item, idx) => (
                  <tr key={`sov-${idx}`} className="border-b last:border-b-0">
                    <td className="p-3">
                      <select
                        className="w-full rounded border border-black/20 px-3 py-2"
                        value={item.cost_code}
                        onChange={(e) => {
                          const selected = costCodes.find((c) => c.code === e.target.value);
                          updateSovItem(idx, {
                            cost_code: e.target.value,
                            description:
                              item.description && item.description.length > 0
                                ? item.description
                                : selected?.description ?? "",
                          });
                        }}
                      >
                        <option value="">Select cost code</option>
                        {costCodes.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code} — {c.description ?? ""}
                          </option>
                        ))}
                      </select>
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
                      <select
                        className="w-full rounded border border-black/20 px-3 py-2"
                        value={item.unit}
                        onChange={(e) => updateSovItem(idx, { unit: e.target.value })}
                      >
                        <option value="">Select</option>
                        <option value="ls">LS (Lump Sum)</option>
                        <option value="ea">EA (Each)</option>
                        <option value="lf">LF (Linear Foot)</option>
                        <option value="sf">SF (Square Foot)</option>
                        <option value="sy">SY (Square Yard)</option>
                        <option value="cy">CY (Cubic Yard)</option>
                        <option value="ton">TON</option>
                        <option value="hr">HR (Hour)</option>
                        <option value="day">DAY</option>
                        <option value="mo">MO (Month)</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <input
                        className="w-full rounded border border-black/20 px-3 py-2 text-right"
                        value={item.quantity}
                        onChange={(e) => {
                          const nextQty = e.target.value;
                          const amount = calcAmount(nextQty, item.unit_price);
                          updateSovItem(idx, {
                            quantity: nextQty,
                            amount,
                          });
                        }}
                        onBlur={() =>
                          updateSovItem(idx, {
                            quantity: formatMoney(item.quantity),
                          })
                        }
                        placeholder="0.00"
                      />
                    </td>
                    <td className="p-3">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/60">
                          $
                        </span>
                        <input
                          className="w-full rounded border border-black/20 pl-6 pr-3 py-2 text-right"
                          value={item.unit_price}
                          onChange={(e) => {
                            const nextPrice = e.target.value;
                            const amount = calcAmount(item.quantity, nextPrice);
                            updateSovItem(idx, {
                              unit_price: nextPrice,
                              amount,
                            });
                          }}
                          onBlur={() =>
                            updateSovItem(idx, {
                              unit_price: formatMoney(item.unit_price),
                            })
                          }
                          placeholder="0.00"
                        />
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/60">
                          $
                        </span>
                        <input
                          className="w-full rounded border border-black/20 pl-6 pr-3 py-2 text-right"
                          value={item.amount}
                          readOnly
                          placeholder="0.00"
                        />
                      </div>
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
                  <td className="p-3 font-medium" colSpan={5}>
                    Total
                  </td>
                  <td className="p-3 text-right font-semibold">
                    ${moneyFormatter.format(sovTotal)}
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
