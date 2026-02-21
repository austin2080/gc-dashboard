"use client";

import BaseBidBuilder, { computeBaseItemsTotal } from "@/components/bid-leveling/BaseBidBuilder";
import AlternatesEditor from "@/components/bid-leveling/AlternatesEditor";
import { formatCurrency, parseMoney } from "@/components/bid-leveling/utils";
import type { BidProjectSub, BidTrade } from "@/lib/bidding/types";
import type { BidAlternateDraft, BidBaseItemDraft, LevelingBid, LevelingBidStatus } from "@/lib/bidding/leveling-types";

type ScopeDraft = {
  id: string;
  label: string;
  included: "included" | "excluded" | "unclear";
  notes: string;
};

export type BidDrawerDraft = {
  status: LevelingBidStatus;
  baseItems: BidBaseItemDraft[];
  alternates: BidAlternateDraft[];
  inclusions: string;
  notes: string;
  receivedAt: string;
  recommended: boolean;
  compareSubId: string;
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

  const baseTotal = computeBaseItemsTotal(draft.baseItems);
  const acceptedAlternatesTotal = draft.alternates.reduce((sum, alternate) => {
    if (!alternate.accepted) return sum;
    return sum + (parseMoney(alternate.amount) ?? 0);
  }, 0);
  const grandTotal = baseTotal + acceptedAlternatesTotal;

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

          <BaseBidBuilder items={draft.baseItems} readOnly={readOnly} onChange={(baseItems) => onChange({ ...draft, baseItems })} />

          <AlternatesEditor alternates={draft.alternates} readOnly={readOnly} onChange={(alternates) => onChange({ ...draft, alternates })} />

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-2 text-sm md:grid-cols-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Base Total</div>
                <div className="font-semibold text-slate-900">{formatCurrency(baseTotal)}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Accepted Alternates</div>
                <div className="font-semibold text-slate-900">{formatCurrency(acceptedAlternatesTotal)}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Grand Total</div>
                <div className="font-semibold text-slate-900">{formatCurrency(grandTotal)}</div>
              </div>
            </div>
          </section>

          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Inclusions
            <textarea
              value={draft.inclusions}
              onChange={(event) => onChange({ ...draft, inclusions: event.target.value })}
              disabled={readOnly}
              rows={3}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
            />
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
