"use client";

import type { BidAlternateDraft } from "@/lib/bidding/leveling-types";
import { useState } from "react";
import { formatCurrency, formatMoneyInputBlur, formatMoneyInputTyping, parseMoney } from "@/components/bid-leveling/utils";

function makeAlternate(sortOrder: number): BidAlternateDraft {
  return {
    id: crypto.randomUUID(),
    title: "",
    accepted: false,
    amount: "",
    notes: "",
    sortOrder,
  };
}

type AlternatesEditorProps = {
  alternates: BidAlternateDraft[];
  readOnly: boolean;
  onChange: (alternates: BidAlternateDraft[]) => void;
};

export default function AlternatesEditor({ alternates, readOnly, onChange }: AlternatesEditorProps) {
  const [collapsed, setCollapsed] = useState(false);
  const acceptedTotal = alternates.reduce((sum, row) => {
    if (!row.accepted) return sum;
    return sum + (parseMoney(row.amount) ?? 0);
  }, 0);

  const update = (id: string, patch: Partial<BidAlternateDraft>) => {
    onChange(alternates.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Alternates ({alternates.length})</h3>
        <span className={`text-slate-500 transition ${collapsed ? "" : "rotate-180"}`}>⌃</span>
      </button>

      {!collapsed ? (
        <div className="px-4 pb-3">
          <div className="space-y-1">
            {alternates.map((alternate, index) => (
              <div key={alternate.id} className="grid grid-cols-[auto_1fr_160px_auto] items-center gap-2 rounded px-1 py-1.5 hover:bg-slate-50/70">
                <button
                  type="button"
                  role="switch"
                  aria-checked={alternate.accepted}
                  disabled={readOnly}
                  onClick={() => update(alternate.id, { accepted: !alternate.accepted })}
                  className={`relative h-6 w-11 rounded-full transition ${
                    alternate.accepted ? "bg-slate-700" : "bg-slate-200"
                  } disabled:opacity-50`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                      alternate.accepted ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
                <input
                  value={alternate.title}
                  disabled={readOnly}
                  onChange={(event) => update(alternate.id, { title: event.target.value })}
                  placeholder={`Alt #${index + 1}`}
                  className="h-7 rounded border border-transparent bg-transparent px-1 text-sm text-slate-800 focus:border-slate-300 focus:bg-white focus:outline-none"
                />
                <input
                  value={alternate.amount}
                  disabled={readOnly}
                  onChange={(event) => update(alternate.id, { amount: formatMoneyInputTyping(event.target.value) })}
                  onFocus={() => {
                    const parsed = parseMoney(alternate.amount);
                    if (parsed !== null) update(alternate.id, { amount: String(parsed) });
                  }}
                  onBlur={() => update(alternate.id, { amount: formatMoneyInputBlur(alternate.amount) })}
                  inputMode="decimal"
                  placeholder="$0.00"
                  className="h-7 rounded border border-transparent bg-transparent px-1 text-right font-mono text-sm text-slate-800 focus:border-slate-300 focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => onChange(alternates.filter((row) => row.id !== alternate.id))}
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-rose-600 disabled:opacity-40"
                  aria-label="Remove alternate"
                >
                  ×
                </button>
              </div>
            ))}

            {!alternates.length ? <p className="px-1 text-xs text-slate-500">No alternates added.</p> : null}
          </div>

          <button
            type="button"
            disabled={readOnly}
            onClick={() => onChange([...alternates, makeAlternate(alternates.length + 1)])}
            className="mt-2 text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-40"
          >
            + Add alternate
          </button>

          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Accepted Total</span>
            <span className="text-right font-mono text-sm font-bold text-slate-900">{formatCurrency(acceptedTotal)}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
