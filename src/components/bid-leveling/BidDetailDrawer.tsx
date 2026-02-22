"use client";

import { useMemo, useState } from "react";
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

function formatDateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toISOString().slice(0, 10);
}

function getStatusTone(status: LevelingBidStatus): string {
  if (status === "submitted") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "bidding") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "declined") return "border-rose-200 bg-rose-50 text-rose-800";
  if (status === "no_response") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

const STATUS_LABEL: Record<LevelingBidStatus, string> = {
  invited: "Invited",
  bidding: "Bidding",
  submitted: "Submitted",
  declined: "Declined",
  no_response: "No response",
};

function parseTradeHeader(tradeName: string): { code: string; title: string } {
  const normalized = tradeName.trim().replace(/\s+/g, " ");
  const spacedCodeMatch = normalized.match(/^(\d{2}\s+\d{2}\s+\d{2})\s+(.+)$/);
  if (spacedCodeMatch) {
    return { code: spacedCodeMatch[1], title: spacedCodeMatch[2] };
  }
  const csiCodeMatch = normalized.match(/^(\d{2}(?:\.\d+){1,2})\s+(.+)$/);
  if (csiCodeMatch) {
    return { code: csiCodeMatch[1], title: csiCodeMatch[2] };
  }
  return { code: "03 30 00", title: tradeName };
}

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
  const [notesTab, setNotesTab] = useState<"inclusions" | "exclusions" | "clarifications">("inclusions");
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  if (!open || !trade || !sub) return null;

  const baseTotal = computeBaseItemsTotal(draft.baseItems);
  const acceptedAlternatesTotal = draft.alternates.reduce((sum, alternate) => {
    if (!alternate.accepted) return sum;
    return sum + (parseMoney(alternate.amount) ?? 0);
  }, 0);
  const grandTotal = baseTotal + acceptedAlternatesTotal;

  const notesPlaceholder =
    notesTab === "inclusions"
      ? "Includes pump and finish."
      : notesTab === "exclusions"
        ? "List excluded scope here."
        : "List clarifications and assumptions here.";

  const { code: codeLabel, title: tradeTitle } = useMemo(() => parseTradeHeader(trade.trade_name), [trade.trade_name]);
  const compareSubName = useMemo(() => {
    if (!draft.compareSubId) return "Selected sub";
    return allSubs.find((row) => row.id === draft.compareSubId)?.subcontractor?.company_name ?? "Selected sub";
  }, [allSubs, draft.compareSubId]);

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-slate-950/45" onClick={onClose} aria-label="Close bid details drawer" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[740px] overflow-hidden rounded-l-3xl border-l border-slate-200 bg-[#f6f8fb] shadow-2xl">
        <div className="flex h-full flex-col">
          <header className="border-b border-slate-200 bg-[#f6f8fb] px-6 py-5">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <p className="mb-1 font-mono text-sm tracking-[0.22em] text-slate-500">{codeLabel}</p>
                <h2 className="text-4xl font-semibold leading-tight text-slate-900">{tradeTitle}</h2>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm leading-none text-slate-800">
                    {sub.subcontractor?.company_name ?? "Unknown"}
                  </span>
                  {isEditingStatus && !readOnly ? (
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 ${getStatusTone(draft.status)}`}>
                      <select
                        autoFocus
                        value={draft.status}
                        onChange={(event) => onChange({ ...draft, status: event.target.value as LevelingBidStatus })}
                        onBlur={() => setIsEditingStatus(false)}
                        className="bg-transparent text-sm font-semibold leading-none outline-none"
                      >
                        <option value="invited">Invited</option>
                        <option value="bidding">Bidding</option>
                        <option value="submitted">Submitted</option>
                        <option value="declined">Declined</option>
                        <option value="no_response">No response</option>
                      </select>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => setIsEditingStatus(true)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-semibold leading-none ${getStatusTone(draft.status)} ${
                        readOnly ? "cursor-default" : "hover:brightness-95"
                      }`}
                    >
                      <span>{STATUS_LABEL[draft.status]}</span>
                      {!readOnly ? <span className="text-[10px]">▾</span> : null}
                    </button>
                  )}
                  <span className="font-mono text-sm leading-none text-slate-500">
                    {draft.receivedAt ? formatDateLabel(draft.receivedAt) : "No received date"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-2xl text-slate-500 transition hover:bg-white hover:text-slate-900"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <BaseBidBuilder items={draft.baseItems} readOnly={readOnly} onChange={(baseItems) => onChange({ ...draft, baseItems })} />

            <AlternatesEditor alternates={draft.alternates} readOnly={readOnly} onChange={(alternates) => onChange({ ...draft, alternates })} />

            <section className="rounded-xl border border-slate-300 bg-white p-3">
              <div className="mb-2 inline-flex rounded-md bg-slate-50 p-0.5 text-[11px]">
                {[
                  { id: "inclusions", label: "Inclusions" },
                  { id: "exclusions", label: "Exclusions" },
                  { id: "clarifications", label: "Clarifications" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setNotesTab(tab.id as typeof notesTab);
                      setIsEditingNotes(false);
                    }}
                    className={`rounded px-2 py-0.5 font-medium transition ${
                      notesTab === tab.id ? "bg-white text-slate-700" : "text-slate-400"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {isEditingNotes && !readOnly ? (
                <textarea
                  autoFocus
                  value={notesTab === "inclusions" ? draft.inclusions : draft.notes}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      inclusions: notesTab === "inclusions" ? event.target.value : draft.inclusions,
                      notes: notesTab === "inclusions" ? draft.notes : event.target.value,
                    })
                  }
                  onBlur={() => setIsEditingNotes(false)}
                  rows={3}
                  placeholder={notesPlaceholder}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300"
                />
              ) : (
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => setIsEditingNotes(true)}
                  className={`w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-500 ${
                    readOnly ? "cursor-default" : "cursor-text hover:bg-slate-100"
                  }`}
                >
                  <span className="block min-h-[42px] whitespace-pre-wrap text-slate-600">
                    {(notesTab === "inclusions" ? draft.inclusions : draft.notes) || notesPlaceholder}
                  </span>
                </button>
              )}
            </section>

            <section className="rounded-xl border border-slate-300 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Compare Subs</h3>
                <button
                  type="button"
                  onClick={() => onChange({ ...draft, recommended: !draft.recommended })}
                  disabled={readOnly}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${
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
                  className="h-9 rounded-md border border-slate-200 px-2.5 text-xs"
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
                <div className="flex h-9 items-center rounded-md border border-slate-200 px-2.5 text-xs text-slate-600">
                  {compareBid
                    ? `${compareSubName}: ${formatCurrency(compareBid.base_bid_amount)}`
                    : "No comparison selected"}
                </div>
              </div>
            </section>

            {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
          </div>

          <footer className="border-t border-slate-200 bg-white px-6 py-3">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Base Total</div>
                <div className="font-mono text-sm font-bold text-slate-900">{formatCurrency(baseTotal)}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Alternates</div>
                <div className="font-mono text-sm font-bold text-slate-900">{formatCurrency(acceptedAlternatesTotal)}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Grand Total</div>
                <div className="font-mono text-sm font-bold text-slate-900">{formatCurrency(grandTotal)}</div>
              </div>
              <div className="flex items-center gap-2 md:justify-end">
                <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  Close
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={readOnly || saving}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </footer>
        </div>
      </aside>
    </div>
  );
}
