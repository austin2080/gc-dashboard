"use client";

import { useEffect, useState } from "react";
import { listOwnerBidAssignees } from "@/lib/bidding/owner-bids-store";
import type {
  NewOwnerBidInput,
  OwnerBidLostReason,
  OwnerBidProjectType,
  OwnerBidStatus,
  OwnerBidType,
} from "@/lib/bidding/owner-bids-types";

type NewOwnerBidOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: NewOwnerBidInput) => Promise<void> | void;
  mode?: "create" | "edit";
  initialValues?: NewOwnerBidInput | null;
};

const projectTypeOptions: OwnerBidProjectType[] = ["TI", "Ground-Up", "Design-Build", "Budget", "GMP", "Other"];
const bidTypeOptions: OwnerBidType[] = ["Hard Bid", "Negotiated", "Budget", "GMP"];
const statusOptions: OwnerBidStatus[] = ["Draft", "Submitted", "Awarded", "Lost"];
const lostReasonOptions: OwnerBidLostReason[] = ["Price", "Schedule", "Qualifications", "Client Ghosted", "Competitor", "Other"];

function parseMoneyInput(value: string): number | null {
  const cleaned = value.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoneyTypingInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  if (!cleaned) return "";

  const parts = cleaned.split(".");
  const whole = parts[0] ?? "";
  const decimalRaw = parts[1];
  const wholeWithCommas = whole
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(whole))
    : "0";

  if (decimalRaw === undefined) return wholeWithCommas;
  const decimal = decimalRaw.slice(0, 2);
  return `${wholeWithCommas}.${decimal}`;
}

function parseNumberInput(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatWithCommas(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatPercentInput(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "";
  return value.toFixed(2);
}

function normalizeAssigneeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getDefaultFormState() {
  return {
    name: "",
    client: "",
    projectType: "TI" as OwnerBidProjectType,
    address: "",
    squareFeet: null as number | null,
    squareFeetInput: "",
    dueDate: "",
    bidType: "Hard Bid" as OwnerBidType,
    status: "Draft" as OwnerBidStatus,
    assignedTo: "",
    probability: 50,
    showAdvanced: false,
    estCost: null as number | null,
    estCostInput: "",
    markupPct: null as number | null,
    bidAmount: null as number | null,
    bidAmountInput: "",
    lostReason: "Price" as OwnerBidLostReason,
    lostNotes: "",
    convertToProject: false,
  };
}

function getFormStateFromValues(values?: NewOwnerBidInput | null) {
  const defaults = getDefaultFormState();
  if (!values) return defaults;

  return {
    ...defaults,
    name: values.name,
    client: values.client,
    projectType: values.projectType,
    address: values.address,
    squareFeet: values.squareFeet,
    squareFeetInput: formatWithCommas(values.squareFeet),
    dueDate: values.dueDate ?? "",
    bidType: values.bidType,
    status: values.status,
    assignedTo: values.assignedTo,
    probability: values.probability,
    showAdvanced: values.probability !== 50,
    estCost: values.estCost,
    estCostInput: values.estCost === null ? "" : formatMoneyTypingInput(values.estCost.toFixed(2)),
    markupPct: values.markupPct,
    bidAmount: values.bidAmount,
    bidAmountInput: values.bidAmount === null ? "" : formatMoneyTypingInput(values.bidAmount.toFixed(2)),
    lostReason: values.lostReason ?? "Price",
    lostNotes: values.lostNotes,
    convertToProject: values.convertToProject,
  };
}

export function NewOwnerBidOverlay({
  open,
  onOpenChange,
  onSubmit,
  mode = "create",
  initialValues = null,
}: NewOwnerBidOverlayProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [form, setForm] = useState(() => getFormStateFromValues(initialValues));
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [assigneeOptions, setAssigneeOptions] = useState<string[]>([]);
  const [assigneeLoading, setAssigneeLoading] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadAssignees() {
      if (!open) return;
      setAssigneeLoading(true);
      const names = await listOwnerBidAssignees();
      if (!active) return;
      setAssigneeOptions(names);
      setAssigneeLoading(false);
    }

    loadAssignees();
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!form.assignedTo || !assigneeOptions.length) return;
    const selectedNormalized = normalizeAssigneeLabel(form.assignedTo);
    if (!selectedNormalized) return;
    const canonical = assigneeOptions.find(
      (option) => normalizeAssigneeLabel(option) === selectedNormalized
    );
    if (!canonical || canonical === form.assignedTo) return;
    setForm((prev) => ({ ...prev, assignedTo: canonical }));
  }, [assigneeOptions, form.assignedTo]);

  const isValid = form.name.trim().length > 0 && form.client.trim().length > 0;
  const calculatedOhpAmount =
    form.bidAmount !== null && form.markupPct !== null ? (form.bidAmount * form.markupPct) / 100 : null;
  const displayedOhpAmountInput = calculatedOhpAmount === null ? "" : formatMoneyTypingInput(calculatedOhpAmount.toFixed(2));
  const totalEstimateProfit =
    calculatedOhpAmount !== null && form.estCost !== null ? calculatedOhpAmount + form.estCost : null;
  const displayedTotalEstimateProfitInput =
    totalEstimateProfit === null ? "" : formatMoneyTypingInput(totalEstimateProfit.toFixed(2));
  const estimatedProfitPct =
    totalEstimateProfit !== null && form.bidAmount !== null && form.bidAmount > 0
      ? (totalEstimateProfit / form.bidAmount) * 100
      : null;
  const displayedEstimatedProfitPctInput = formatPercentInput(estimatedProfitPct);
  const isEditing = mode === "edit";
  const headerTitle = isEditing ? "Edit Owner Bid" : "New Owner Bid";
  const helperText = isEditing
    ? "Update this bid record for tracking submissions, win/loss, margin, and analytics."
    : "Create a bid record for tracking submissions, win/loss, margin, and analytics.";
  const submitLabel = isEditing ? "Save Changes" : "Save";
  const availableAssignees =
    form.assignedTo && !assigneeOptions.includes(form.assignedTo)
      ? [form.assignedTo, ...assigneeOptions]
      : assigneeOptions;

  function close() {
    setForm(getFormStateFromValues(initialValues));
    setSubmitError(null);
    onOpenChange(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid || saving) return;

    setSubmitError(null);
    setSaving(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        client: form.client.trim(),
        projectType: form.projectType,
        address: form.address.trim(),
        squareFeet: form.squareFeet,
        dueDate: form.dueDate || null,
        bidType: form.bidType,
        status: form.status,
        assignedTo: form.assignedTo,
        probability: form.probability,
        estCost: form.estCost,
        ohpAmount: calculatedOhpAmount,
        markupPct: form.markupPct,
        bidAmount: form.bidAmount,
        expectedProfit: totalEstimateProfit,
        marginPct: estimatedProfitPct,
        lostReason: form.status === "Lost" ? form.lostReason : null,
        lostNotes: form.status === "Lost" ? form.lostNotes.trim() : "",
        convertToProject: form.status === "Awarded" ? form.convertToProject : false,
      });
      close();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save owner bid.";
      setSubmitError(message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55">
      <div
        className={
          isMobile
            ? "fixed inset-x-0 bottom-0 max-h-[92vh] overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl"
            : "fixed left-1/2 top-1/2 w-[min(900px,96vw)] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        }
      >
        <form className="flex h-full max-h-[90vh] flex-col" onSubmit={submit}>
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">{headerTitle}</p>
                <p className="text-sm text-slate-500">{helperText}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (saving) return;
                  close();
                }}
                aria-label="Close"
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving}
              >
                ✕
              </button>
            </div>
          </header>

          <div className="space-y-6 overflow-y-auto px-5 py-4">
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Project Info</h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Section A</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-800">Project/Bid Name *</span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800"
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-800">Client *</span>
                  <input
                    value={form.client}
                    onChange={(event) => setForm((prev) => ({ ...prev, client: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800"
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-800">Project Type</span>
                  <select
                    value={form.projectType}
                    onChange={(event) => setForm((prev) => ({ ...prev, projectType: event.target.value as OwnerBidProjectType }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800"
                  >
                    {projectTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-800">Square Feet</span>
                  <input
                    value={form.squareFeetInput}
                    onChange={(event) => {
                      const digits = event.target.value.replace(/[^\d]/g, "");
                      const numberValue = digits ? Number(digits) : null;
                      setForm((prev) => ({
                        ...prev,
                        squareFeet: numberValue,
                        squareFeetInput: digits ? formatWithCommas(numberValue) : "",
                      }));
                    }}
                    inputMode="numeric"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800"
                  />
                </label>

                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="font-medium text-slate-800">Project Address</span>
                  <input
                    value={form.address}
                    onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800"
                  />
                </label>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Bid Details</h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Section B</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-800">Bid Due Date</span>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800"
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-800">Bid Type</span>
                  <select
                    value={form.bidType}
                    onChange={(event) => setForm((prev) => ({ ...prev, bidType: event.target.value as OwnerBidType }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800"
                  >
                    {bidTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-800">Status</span>
                  <select
                    value={form.status}
                    onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as OwnerBidStatus }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800"
                  >
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-800">Assigned To</span>
                  <select
                    value={form.assignedTo}
                    onChange={(event) => setForm((prev) => ({ ...prev, assignedTo: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800"
                  >
                    <option value="">Select assignee</option>
                    {availableAssignees.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {assigneeLoading ? (
                    <p className="text-xs text-slate-500">Loading assignees...</p>
                  ) : null}
                </label>
              </div>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, showAdvanced: !prev.showAdvanced }))}
                  className="text-sm font-medium text-slate-700"
                >
                  {form.showAdvanced ? "Hide Advanced" : "Show Advanced"}
                </button>
                {form.showAdvanced ? (
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-slate-800">Probability to Win: {form.probability}%</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={form.probability}
                      onChange={(event) => setForm((prev) => ({ ...prev, probability: Number(event.target.value) }))}
                      className="w-full"
                    />
                  </label>
                ) : null}
              </div>

              {form.status === "Lost" ? (
                <div className="grid gap-4 rounded-xl border border-amber-200 bg-amber-50 p-3 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-800">Lost Reason</span>
                    <select
                      value={form.lostReason}
                      onChange={(event) => setForm((prev) => ({ ...prev, lostReason: event.target.value as OwnerBidLostReason }))}
                      className="h-11 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm text-slate-800"
                    >
                      {lostReasonOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm md:col-span-2">
                    <span className="font-medium text-slate-800">Notes</span>
                    <textarea
                      value={form.lostNotes}
                      onChange={(event) => setForm((prev) => ({ ...prev, lostNotes: event.target.value }))}
                      rows={3}
                      className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800"
                    />
                  </label>
                </div>
              ) : null}

              {form.status === "Awarded" ? (
                <label className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  <input
                    type="checkbox"
                    checked={form.convertToProject}
                    onChange={(event) => setForm((prev) => ({ ...prev, convertToProject: event.target.checked }))}
                    className="h-4 w-4"
                  />
                  Convert to Project after saving
                </label>
              ) : null}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Financials</h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Section C</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-800">Bid Amount</span>
                  <div className="relative">
                    <input
                      value={form.bidAmountInput}
                      onChange={(event) => {
                        const formatted = formatMoneyTypingInput(event.target.value);
                        const numeric = parseMoneyInput(formatted);
                        setForm((prev) => ({
                          ...prev,
                          bidAmountInput: formatted,
                          bidAmount: numeric,
                        }));
                      }}
                      onBlur={() => {
                        setForm((prev) => ({
                          ...prev,
                          bidAmountInput: prev.bidAmount === null ? "" : formatMoneyTypingInput(prev.bidAmount.toFixed(2)),
                        }));
                      }}
                      inputMode="decimal"
                      className="h-11 w-full rounded-xl border border-slate-200 pl-8 pr-3 text-sm text-slate-800"
                    />
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
                  </div>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-800">OH&amp;P %</span>
                  <div className="relative">
                    <input
                      value={form.markupPct ?? ""}
                      onChange={(event) => setForm((prev) => ({ ...prev, markupPct: parseNumberInput(event.target.value) }))}
                      inputMode="decimal"
                      className="h-11 w-full rounded-xl border border-slate-200 px-3 pr-8 text-sm text-slate-800"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">%</span>
                  </div>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-800">OH&amp;P $</span>
                  <div className="relative">
                    <input
                      value={displayedOhpAmountInput}
                      readOnly
                      className="h-11 w-full rounded-xl border border-slate-200 pl-8 pr-3 text-sm text-slate-800"
                    />
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
                  </div>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-800">Estimated Buyout</span>
                  <div className="relative">
                    <input
                      value={form.estCostInput}
                      onChange={(event) => {
                        const formatted = formatMoneyTypingInput(event.target.value);
                        const numeric = parseMoneyInput(formatted);
                        setForm((prev) => ({
                          ...prev,
                          estCostInput: formatted,
                          estCost: numeric,
                        }));
                      }}
                      onBlur={() => {
                        setForm((prev) => ({
                          ...prev,
                          estCostInput: prev.estCost === null ? "" : formatMoneyTypingInput(prev.estCost.toFixed(2)),
                        }));
                      }}
                      inputMode="decimal"
                      className="h-11 w-full rounded-xl border border-slate-200 pl-8 pr-3 text-sm text-slate-800"
                    />
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
                  </div>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-800">Total Estimated Profit</span>
                  <div className="relative">
                    <input
                      value={displayedTotalEstimateProfitInput}
                      readOnly
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-sm text-slate-800"
                    />
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
                  </div>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-800">Estimated Profit %</span>
                  <div className="relative">
                    <input
                      value={displayedEstimatedProfitPctInput}
                      readOnly
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 pr-8 text-sm text-slate-800"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">%</span>
                  </div>
                </label>
              </div>
            </section>
          </div>

          {submitError ? (
            <div className="mx-5 mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {submitError}
            </div>
          ) : null}

          <footer className="border-t border-slate-200 bg-white px-5 py-3">
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (saving) return;
                  close();
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValid || saving}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : submitLabel}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
