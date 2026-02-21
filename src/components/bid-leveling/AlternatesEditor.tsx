"use client";

import type { BidAlternateDraft } from "@/lib/bidding/leveling-types";
import { formatCurrency, parseMoney } from "@/components/bid-leveling/utils";

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
  const acceptedTotal = alternates.reduce((sum, row) => {
    if (!row.accepted) return sum;
    return sum + (parseMoney(row.amount) ?? 0);
  }, 0);

  const update = (id: string, patch: Partial<BidAlternateDraft>) => {
    onChange(alternates.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  return (
    <section className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Alternates</h3>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => onChange([...alternates, makeAlternate(alternates.length + 1)])}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 disabled:bg-slate-100"
        >
          Add alternate
        </button>
      </div>

      <div className="space-y-2">
        {alternates.map((alternate, index) => (
          <div key={alternate.id} className="rounded-lg border border-slate-200 bg-white p-2">
            <div className="grid gap-2 md:grid-cols-[1fr_160px_120px_auto]">
              <input
                value={alternate.title}
                disabled={readOnly}
                onChange={(event) => update(alternate.id, { title: event.target.value })}
                placeholder={`Alt #${index + 1} title`}
                className="rounded border border-slate-200 px-2 py-1 text-xs"
              />
              <input
                value={alternate.amount}
                disabled={readOnly}
                onChange={(event) => update(alternate.id, { amount: event.target.value })}
                inputMode="decimal"
                placeholder="Amount"
                className="rounded border border-slate-200 px-2 py-1 text-xs"
              />
              <label className="inline-flex items-center gap-2 rounded border border-slate-200 px-2 py-1 text-xs">
                <input
                  type="checkbox"
                  checked={alternate.accepted}
                  disabled={readOnly}
                  onChange={(event) => update(alternate.id, { accepted: event.target.checked })}
                />
                Accepted
              </label>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => onChange(alternates.filter((row) => row.id !== alternate.id))}
                className="rounded border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 disabled:bg-slate-100"
              >
                Remove
              </button>
            </div>
            <input
              value={alternate.notes}
              disabled={readOnly}
              onChange={(event) => update(alternate.id, { notes: event.target.value })}
              placeholder="Notes (optional)"
              className="mt-2 w-full rounded border border-slate-200 px-2 py-1 text-xs"
            />
          </div>
        ))}
        {!alternates.length ? <p className="text-xs text-slate-500">No alternates added.</p> : null}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
        <span className="font-semibold text-slate-700">Accepted Alternates Total</span>
        <span className="font-semibold text-slate-900">{formatCurrency(acceptedTotal)}</span>
      </div>
    </section>
  );
}
