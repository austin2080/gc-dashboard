"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatCurrency,
  formatMoneyInputBlur,
  formatMoneyInputTyping,
  parseCurrencyInput,
} from "@/components/bid-leveling/utils";

type BudgetCellProps = {
  value: number | null;
  notes: string | null;
  readOnly: boolean;
  onChange: (payload: { value: number | null; notes: string | null }) => void;
};

export default function BudgetCell({ value, notes, readOnly, onChange }: BudgetCellProps) {
  const [draft, setDraft] = useState(value !== null ? String(value) : "");
  const [notesDraft, setNotesDraft] = useState(notes ?? "");

  useEffect(() => {
    setDraft(value !== null ? String(value) : "");
  }, [value]);

  useEffect(() => {
    setNotesDraft(notes ?? "");
  }, [notes]);

  const placeholder = useMemo(() => (value !== null ? formatCurrency(value) : "$0.00"), [value]);

  return (
    <div className="space-y-1">
      <input
        value={draft}
        onChange={(event) => setDraft(formatMoneyInputTyping(event.target.value))}
        onFocus={() => {
          const parsed = parseCurrencyInput(draft);
          if (parsed !== null) setDraft(String(parsed));
        }}
        onBlur={() => {
          setDraft(formatMoneyInputBlur(draft));
          onChange({ value: parseCurrencyInput(draft), notes: notesDraft.trim() || null });
        }}
        disabled={readOnly}
        inputMode="decimal"
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:border-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
      />
      <input
        value={notesDraft}
        onChange={(event) => setNotesDraft(event.target.value)}
        onBlur={() => onChange({ value: parseCurrencyInput(draft), notes: notesDraft.trim() || null })}
        disabled={readOnly}
        placeholder="Budget note"
        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 focus:border-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
      />
    </div>
  );
}
