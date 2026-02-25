"use client";

import { useMemo, useState } from "react";
import {
  formatCurrency,
  formatMoneyInputBlur,
  formatMoneyInputTyping,
  parseCurrencyInput,
} from "@/components/bid-leveling/utils";

type BudgetCellProps = {
  value: number | null;
  selectedBidAmount: number | null;
  recommendedBidAmount: number | null;
  notes: string | null;
  readOnly: boolean;
  onChange: (payload: { value: number | null; notes: string | null }) => void;
};

function parseCurrencyDraft(value: string): { parsed: number | null; invalid: boolean } {
  const trimmed = value.trim();
  if (!trimmed) return { parsed: null, invalid: false };
  const sanitized = trimmed.replace(/[$,\s]/g, "");
  if (!/^-?\d*(\.\d{0,2})?$/.test(sanitized)) return { parsed: null, invalid: true };
  const parsed = Number(sanitized);
  return { parsed: Number.isFinite(parsed) ? parsed : null, invalid: !Number.isFinite(parsed) };
}

export default function BudgetCell({ value, selectedBidAmount, recommendedBidAmount, notes, readOnly, onChange }: BudgetCellProps) {
  const [draft, setDraft] = useState(value !== null ? formatMoneyInputBlur(String(value)) : "");
  const [notesDraft, setNotesDraft] = useState(notes ?? "");
  const [isNoteOpen, setIsNoteOpen] = useState(false);


  const placeholder = useMemo(() => (value !== null ? formatCurrency(value) : "$0.00"), [value]);
  const draftState = useMemo(() => parseCurrencyDraft(draft), [draft]);
  const comparisonBid = selectedBidAmount ?? recommendedBidAmount;
  const varianceAmount = value !== null && comparisonBid !== null ? value - comparisonBid : null;
  const variancePercent = varianceAmount !== null && comparisonBid !== null && comparisonBid > 0 ? (varianceAmount / comparisonBid) * 100 : null;
  const showMissingBudget = value === null;

  return (
    <div className="space-y-2">
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Budget baseline</div>
        {showMissingBudget ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
            <div className="flex items-center gap-1 font-semibold">
              <span aria-hidden>⚠️</span>
              Missing budget
            </div>
            <p className="mt-0.5 text-[11px]">Enter a baseline to evaluate bid variance.</p>
          </div>
        ) : null}
        <input
          value={draft}
          onChange={(event) => setDraft(formatMoneyInputTyping(event.target.value))}
          onBlur={() => {
            const { parsed, invalid } = parseCurrencyDraft(draft);
            if (!invalid) {
              setDraft(formatMoneyInputBlur(draft));
              onChange({ value: parsed, notes: notesDraft.trim() || null });
            }
          }}
          disabled={readOnly}
          inputMode="decimal"
          placeholder={placeholder}
          className={`w-full rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 ${
            draftState.invalid
              ? "border-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
              : "border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          }`}
        />
        {draftState.invalid ? <p className="mt-1 text-[11px] text-rose-700">Enter a valid currency amount (max 2 decimals).</p> : null}
      </div>

      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Variance vs selected bid</div>
        {comparisonBid === null || value === null || varianceAmount === null ? (
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            Waiting for baseline + selected bid
          </span>
        ) : varianceAmount >= 0 ? (
          <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
            Over by {formatCurrency(varianceAmount)} / {variancePercent !== null ? `${variancePercent.toFixed(1)}%` : "--"}
          </span>
        ) : (
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            Under budget {formatCurrency(Math.abs(varianceAmount))}
          </span>
        )}
      </div>

      <div>
        {isNoteOpen || notesDraft ? (
          <input
            value={notesDraft}
            onChange={(event) => setNotesDraft(event.target.value)}
            onBlur={() => {
              onChange({ value: parseCurrencyInput(draft), notes: notesDraft.trim() || null });
              setIsNoteOpen(false);
            }}
            onFocus={() => setIsNoteOpen(true)}
            disabled={readOnly}
            placeholder="Budget note"
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 focus:border-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsNoteOpen(true)}
            disabled={readOnly}
            className="text-[11px] font-medium text-slate-500 underline decoration-dotted underline-offset-2 disabled:cursor-not-allowed"
          >
            Add budget note
          </button>
        )}
      </div>
    </div>
  );
}
