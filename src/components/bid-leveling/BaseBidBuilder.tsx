"use client";

import type { BidBaseItemDraft, UnitType } from "@/lib/bidding/leveling-types";
import { formatCurrency, formatMoneyInputBlur, formatMoneyInputTyping, parseMoney } from "@/components/bid-leveling/utils";

const UNIT_OPTIONS: UnitType[] = ["LF", "SF", "SY", "CY", "EA", "HR", "DAY", "LS", "ALLOW", "UNIT", "OTHER"];

function isLumpUnit(unit: UnitType): boolean {
  return unit === "LS" || unit === "ALLOW";
}

export function computeBaseLineTotal(item: BidBaseItemDraft): number {
  const unitPrice = parseMoney(item.unitPrice) ?? 0;
  if (isLumpUnit(item.unit)) return unitPrice;
  const qty = Number(item.qty || 0);
  if (!Number.isFinite(qty)) return 0;
  return qty * unitPrice;
}

export function computeBaseItemsTotal(items: BidBaseItemDraft[]): number {
  return items.reduce((sum, item) => sum + computeBaseLineTotal(item), 0);
}

function createLineItem(sortOrder: number): BidBaseItemDraft {
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

type BaseBidBuilderProps = {
  items: BidBaseItemDraft[];
  readOnly: boolean;
  onChange: (items: BidBaseItemDraft[]) => void;
};

export default function BaseBidBuilder({ items, readOnly, onChange }: BaseBidBuilderProps) {
  const lineItemsTotal = computeBaseItemsTotal(items);

  const updateItem = (id: string, patch: Partial<BidBaseItemDraft>) => {
    onChange(
      items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        if (isLumpUnit(next.unit)) next.qty = "1";
        return next;
      })
    );
  };

  return (
    <section className="rounded-xl border border-slate-200 p-3">
      <h3 className="text-sm font-semibold text-slate-900">Base Bid</h3>

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Base Bid Total</div>
        <div className="text-2xl font-semibold text-slate-900">{formatCurrency(lineItemsTotal)}</div>
        <div className="text-xs text-slate-500">Automatically calculated from line items</div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[840px] table-fixed border-separate border-spacing-0 text-xs">
          <colgroup>
            <col />
            <col style={{ width: "80px" }} />
            <col style={{ width: "90px" }} />
            <col style={{ width: "130px" }} />
            <col style={{ width: "120px" }} />
            <col style={{ width: "90px" }} />
          </colgroup>
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
              const lumpUnit = isLumpUnit(item.unit);
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
                  </td>
                  <td className="border-b border-slate-100 px-2 py-1 align-top">
                    <input
                      value={item.qty}
                      disabled={readOnly || lumpUnit}
                      onChange={(event) => updateItem(item.id, { qty: event.target.value })}
                      inputMode="decimal"
                      placeholder="0"
                      className="w-16 rounded border border-slate-200 px-1.5 py-1 disabled:bg-slate-100"
                    />
                  </td>
                  <td className="border-b border-slate-100 px-2 py-1 align-top">
                    <select
                      value={item.unit}
                      disabled={readOnly}
                      onChange={(event) => updateItem(item.id, { unit: event.target.value as UnitType })}
                      className="w-20 rounded border border-slate-200 px-1.5 py-1"
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
                      onChange={(event) => updateItem(item.id, { unitPrice: formatMoneyInputTyping(event.target.value) })}
                      onFocus={(event) => {
                        const parsed = parseMoney(event.target.value);
                        if (parsed !== null) updateItem(item.id, { unitPrice: String(parsed) });
                      }}
                      onBlur={(event) => updateItem(item.id, { unitPrice: formatMoneyInputBlur(event.target.value) })}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="w-full rounded border border-slate-200 px-2 py-1"
                    />
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

      {items.length === 0 ? <p className="mt-2 text-xs text-slate-500">Add line items to build this bid.</p> : null}

      <div className="mt-3 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
        <span className="font-semibold text-slate-700">Line Items Total</span>
        <span className="font-semibold text-slate-900">{formatCurrency(lineItemsTotal)}</span>
      </div>

      <div className="mt-3">
        <button
          type="button"
          disabled={readOnly}
          onClick={() => onChange([...items, createLineItem(items.length + 1)])}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:bg-slate-100"
        >
          + Add line item
        </button>
      </div>
    </section>
  );
}
