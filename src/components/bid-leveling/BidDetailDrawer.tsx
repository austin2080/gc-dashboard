"use client";

import type { BidProjectSub, BidTrade } from "@/lib/bidding/types";
import type { LevelingBid, LevelingBidStatus } from "@/lib/bidding/leveling-types";
import { formatCurrency } from "@/components/bid-leveling/utils";

type LineItemDraft = {
  id: string;
  type: "allowance" | "alternate" | "unit_price" | "clarifications";
  label: string;
  amount: string;
  included: boolean;
  notes: string;
};

type ScopeDraft = {
  id: string;
  label: string;
  included: "included" | "excluded" | "unclear";
  notes: string;
};

export type BidDrawerDraft = {
  status: LevelingBidStatus;
  baseBidAmount: string;
  notes: string;
  receivedAt: string;
  recommended: boolean;
  compareSubId: string;
  lineItems: LineItemDraft[];
  scopeItems: ScopeDraft[];
};

type BidDetailDrawerProps = {
  open: boolean;
  readOnly: boolean;
  trade: BidTrade | null;
  sub: BidProjectSub | null;
  allSubs: BidProjectSub[];
  bid: LevelingBid | null;
  draft: BidDrawerDraft;
  compareBid: LevelingBid | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onChange: (next: BidDrawerDraft) => void;
  onSave: () => void;
};

export default function BidDetailDrawer({
  open,
  readOnly,
  trade,
  sub,
  allSubs,
  bid,
  draft,
  compareBid,
  saving,
  error,
  onClose,
  onChange,
  onSave,
}: BidDetailDrawerProps) {
  if (!open || !trade || !sub) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-slate-950/40" onClick={onClose} aria-label="Close bid details drawer" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-900">{trade.trade_name}</h2>
          <div className="mt-2 grid gap-1 text-sm text-slate-600">
            <div>Sub: {sub.subcontractor?.company_name ?? "Unknown"}</div>
            <div>Status: {draft.status.replace("_", " ")}</div>
            <div>Received: {draft.receivedAt || "Not received"}</div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Base bid
            <input
              value={draft.baseBidAmount}
              onChange={(event) => onChange({ ...draft, baseBidAmount: event.target.value })}
              disabled={readOnly}
              inputMode="decimal"
              placeholder="0"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Status
            <select
              value={draft.status}
              onChange={(event) => onChange({ ...draft, status: event.target.value as LevelingBidStatus })}
              disabled={readOnly}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
            >
              <option value="invited">Invited</option>
              <option value="bidding">Bidding</option>
              <option value="submitted">Submitted</option>
              <option value="declined">Declined</option>
              <option value="no_response">No response</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Exclusions / clarifications
            <textarea
              value={draft.notes}
              onChange={(event) => onChange({ ...draft, notes: event.target.value })}
              disabled={readOnly}
              rows={4}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
            />
          </label>

          <section className="rounded-xl border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Alternates / Allowances (scaffold)</h3>
              <button
                type="button"
                disabled={readOnly}
                onClick={() =>
                  onChange({
                    ...draft,
                    lineItems: [
                      ...draft.lineItems,
                      {
                        id: `line-${Date.now()}`,
                        type: "alternate",
                        label: "",
                        amount: "",
                        included: true,
                        notes: "",
                      },
                    ],
                  })
                }
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 disabled:bg-slate-100"
              >
                Add
              </button>
            </div>
            <div className="space-y-2">
              {draft.lineItems.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2">
                  <select
                    value={item.type}
                    disabled={readOnly}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        lineItems: draft.lineItems.map((row) =>
                          row.id === item.id ? { ...row, type: event.target.value as LineItemDraft["type"] } : row
                        ),
                      })
                    }
                    className="col-span-3 rounded-md border border-slate-200 px-2 py-1 text-xs"
                  >
                    <option value="allowance">Allowance</option>
                    <option value="alternate">Alternate</option>
                    <option value="unit_price">Unit Price</option>
                    <option value="clarifications">Clarification</option>
                  </select>
                  <input
                    value={item.label}
                    disabled={readOnly}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        lineItems: draft.lineItems.map((row) =>
                          row.id === item.id ? { ...row, label: event.target.value } : row
                        ),
                      })
                    }
                    placeholder="Label"
                    className="col-span-5 rounded-md border border-slate-200 px-2 py-1 text-xs"
                  />
                  <input
                    value={item.amount}
                    disabled={readOnly}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        lineItems: draft.lineItems.map((row) =>
                          row.id === item.id ? { ...row, amount: event.target.value } : row
                        ),
                      })
                    }
                    placeholder="Amount"
                    className="col-span-3 rounded-md border border-slate-200 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() =>
                      onChange({ ...draft, lineItems: draft.lineItems.filter((row) => row.id !== item.id) })
                    }
                    className="col-span-1 rounded-md border border-rose-200 px-1 py-1 text-xs text-rose-700"
                  >
                    x
                  </button>
                </div>
              ))}
              {!draft.lineItems.length ? <p className="text-xs text-slate-500">No line items</p> : null}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 p-3">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Scope checklist (scaffold)</h3>
            <div className="space-y-2">
              {draft.scopeItems.map((item) => (
                <div key={item.id} className="grid grid-cols-12 items-center gap-2">
                  <div className="col-span-6 text-xs text-slate-700">{item.label}</div>
                  <select
                    value={item.included}
                    disabled={readOnly}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        scopeItems: draft.scopeItems.map((row) =>
                          row.id === item.id ? { ...row, included: event.target.value as ScopeDraft["included"] } : row
                        ),
                      })
                    }
                    className="col-span-3 rounded-md border border-slate-200 px-2 py-1 text-xs"
                  >
                    <option value="included">Included</option>
                    <option value="excluded">Excluded</option>
                    <option value="unclear">Unclear</option>
                  </select>
                  <input
                    value={item.notes}
                    disabled={readOnly}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        scopeItems: draft.scopeItems.map((row) =>
                          row.id === item.id ? { ...row, notes: event.target.value } : row
                        ),
                      })
                    }
                    placeholder="Notes"
                    className="col-span-3 rounded-md border border-slate-200 px-2 py-1 text-xs"
                  />
                </div>
              ))}
              {!draft.scopeItems.length ? <p className="text-xs text-slate-500">Scope templates will populate here.</p> : null}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Compare</h3>
              <button
                type="button"
                onClick={() => onChange({ ...draft, recommended: !draft.recommended })}
                disabled={readOnly}
                className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                  draft.recommended ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-700"
                }`}
              >
                Mark Recommended
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <select
                value={draft.compareSubId}
                onChange={(event) => onChange({ ...draft, compareSubId: event.target.value })}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs"
              >
                <option value="">Select sub to compare</option>
                {allSubs
                  .filter((row) => row.id !== sub.id)
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.subcontractor?.company_name ?? "Unknown"}
                    </option>
                  ))}
              </select>
              <div className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600">
                {compareBid ? `Compare amount: ${formatCurrency(compareBid.base_bid_amount)}` : "No comparison selected"}
              </div>
            </div>
          </section>

          {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
              Close
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={readOnly || saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
