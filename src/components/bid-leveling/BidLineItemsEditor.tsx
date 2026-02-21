"use client";

import type { BidBaseItemDraft, UnitType } from "@/lib/bidding/leveling-types";
import { formatCurrency, parseMoney } from "@/components/bid-leveling/utils";

const UNIT_OPTIONS: UnitType[] = ["LF", "SF", "SY", "CY", "EA", "HR", "DAY", "LS", "ALLOW", "UNIT", "OTHER"];

function isLump(unit: UnitType): boolean {
  return unit === "LS" || unit === "ALLOW";
}

export function computeBaseLineTotal(item: BidBaseItemDraft): number {
  if (isLump(item.unit)) {
    const override = parseMoney(item.amountOverride);
    if (override !== null) return override;
    return parseMoney(item.unitPrice) ?? 0;
  }
  const qty = Number(item.qty || 0);
  const unitPrice = parseMoney(item.unitPrice) ?? 0;
  if (!Number.isFinite(qty)) return 0;
  return qty * unitPrice;
}

function makeItem(sortOrder: number): BidBaseItemDraft {
  return {
    id: crypto.randomUUID(),
    description: "",
    qty: "",
    unit: "EA",
    unitPrice: "",
    amountOverride: "",
    notes: "",
    sortOrder,
  };
}

type BidLineItemsEditorProps = {
  items: BidBaseItemDraft[];
  readOnly: boolean;
  onChange: (items: BidBaseItemDraft[]) => void;
  embedded?: boolean;
};

export default function BidLineItemsEditor({ items, readOnly, onChange, embedded = false }: BidLineItemsEditorProps) {
  const lineTotal = items.reduce((sum, item) => sum + computeBaseLineTotal(item), 0);

  const updateItem = (id: string, patch: Partial<BidBaseItemDraft>) => {
    onChange(
      items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        if (isLump(next.unit)) {
          next.qty = "1";
        }
        return next;
      })
    );
  };

  const content = (
    <>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Base Bid Line Items</h3>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => onChange([...items, makeItem(items.length + 1)])}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 disabled:bg-slate-100"
        >
          Add line item
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] table-fixed border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="border-b border-slate-200 px-2 py-1 text-left">Description</th>
              <th className="border-b border-slate-200 px-2 py-1 text-left">Qty</th>
              <th className="border-b border-slate-200 px-2 py-1 text-left">Unit</th>
              <th className="border-b border-slate-200 px-2 py-1 text-left">Unit Price</th>
              <th className="border-b border-slate-200 px-2 py-1 text-left">Line Total</th>
              <th className="border-b border-slate-200 px-2 py-1 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const lump = isLump(item.unit);
              return (
                <tr key={item.id}>
                  <td className="border-b border-slate-100 px-2 py-1 align-top">
                    <input
                      value={item.description}
                      disabled={readOnly}
                      onChange={(event) => updateItem(item.id, { description: event.target.value })}
                      placeholder="Description"
                      className="w-full rounded border border-slate-200 px-2 py-1"
                    />
                    <input
                      value={item.notes}
                      disabled={readOnly}
                      onChange={(event) => updateItem(item.id, { notes: event.target.value })}
                      placeholder="Notes (optional)"
                      className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
                    />
                  </td>
                  <td className="border-b border-slate-100 px-2 py-1 align-top">
                    <input
                      value={item.qty}
                      disabled={readOnly || lump}
                      onChange={(event) => updateItem(item.id, { qty: event.target.value })}
                      inputMode="decimal"
                      placeholder="0"
                      className="w-full rounded border border-slate-200 px-2 py-1 disabled:bg-slate-100"
                    />
                  </td>
                  <td className="border-b border-slate-100 px-2 py-1 align-top">
                    <select
                      value={item.unit}
                      disabled={readOnly}
                      onChange={(event) => updateItem(item.id, { unit: event.target.value as UnitType })}
                      className="w-full rounded border border-slate-200 px-2 py-1"
                    >
                      {UNIT_OPTIONS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border-b border-slate-100 px-2 py-1 align-top">
                    <input
                      value={item.unitPrice}
                      disabled={readOnly}
                      onChange={(event) => updateItem(item.id, { unitPrice: event.target.value })}
                      inputMode="decimal"
                      placeholder={lump ? "Lump amount" : "0.00"}
                      className="w-full rounded border border-slate-200 px-2 py-1"
                    />
                    {lump ? (
                      <input
                        value={item.amountOverride}
                        disabled={readOnly}
                        onChange={(event) => updateItem(item.id, { amountOverride: event.target.value })}
                        inputMode="decimal"
                        placeholder="Override (optional)"
                        className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
                      />
                    ) : null}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-1 align-top font-semibold text-slate-800">
                    {formatCurrency(computeBaseLineTotal(item))}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-1 align-top">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => onChange(items.filter((row) => row.id !== item.id))}
                      className="rounded border border-rose-200 px-2 py-1 text-rose-700 disabled:bg-slate-100"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
        <span className="font-semibold text-slate-700">Line Item Total</span>
        <span className="font-semibold text-slate-900">{formatCurrency(lineTotal)}</span>
      </div>
    </>
  );

  if (embedded) return content;

  return <section className="rounded-xl border border-slate-200 p-3">{content}</section>;
}
