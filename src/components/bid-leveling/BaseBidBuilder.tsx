"use client";

import type { BidBaseItemDraft, UnitType } from "@/lib/bidding/leveling-types";
import { useState } from "react";
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

type EditableField = "description" | "qty" | "unit" | "unitPrice";

export default function BaseBidBuilder({ items, readOnly, onChange }: BaseBidBuilderProps) {
  const lineItemsTotal = computeBaseItemsTotal(items);
  const [activeCell, setActiveCell] = useState<{ id: string; field: EditableField } | null>(null);

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
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Base Bid</h3>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] table-fixed text-sm">
            <colgroup>
              <col />
              <col style={{ width: "76px" }} />
              <col style={{ width: "84px" }} />
              <col style={{ width: "132px" }} />
              <col style={{ width: "148px" }} />
              <col style={{ width: "52px" }} />
            </colgroup>
            <thead className="bg-slate-50/60">
              <tr>
                <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Description
                </th>
                <th className="border-b border-slate-200 px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Qty
                </th>
                <th className="border-b border-slate-200 px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Unit
                </th>
                <th className="border-b border-slate-200 px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Unit Price
                </th>
                <th className="border-b border-slate-200 px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Total
                </th>
                <th className="border-b border-slate-200 px-1 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const lumpUnit = isLumpUnit(item.unit);
                return (
                  <tr key={item.id} className="group hover:bg-slate-50/70">
                    <td
                      className={`border-b border-slate-200 px-4 py-2 align-middle ${readOnly ? "" : "cursor-text"}`}
                      onClick={() => !readOnly && setActiveCell({ id: item.id, field: "description" })}
                    >
                      {activeCell?.id === item.id && activeCell.field === "description" && !readOnly ? (
                        <input
                          autoFocus
                          value={item.description}
                          onChange={(event) => updateItem(item.id, { description: event.target.value })}
                          onBlur={() => setActiveCell(null)}
                          placeholder="Description"
                          className="h-7 w-full rounded border border-slate-300 bg-white px-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-300"
                        />
                      ) : (
                        <span className="text-sm text-slate-800">{item.description || " "}</span>
                      )}
                    </td>
                    <td
                      className={`border-b border-slate-200 px-2 py-2 text-right align-middle ${readOnly || lumpUnit ? "" : "cursor-text"}`}
                      onClick={() => !readOnly && !lumpUnit && setActiveCell({ id: item.id, field: "qty" })}
                    >
                      {activeCell?.id === item.id && activeCell.field === "qty" && !readOnly && !lumpUnit ? (
                        <input
                          autoFocus
                          value={item.qty}
                          onChange={(event) => updateItem(item.id, { qty: event.target.value })}
                          onBlur={() => setActiveCell(null)}
                          inputMode="decimal"
                          placeholder="0"
                          className="h-7 w-full rounded border border-slate-300 bg-white px-1.5 text-right font-mono text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-300"
                        />
                      ) : (
                        <span className="font-mono text-sm text-slate-800">{lumpUnit ? "1" : item.qty || "0"}</span>
                      )}
                    </td>
                    <td
                      className={`border-b border-slate-200 px-2 py-2 text-right align-middle ${readOnly ? "" : "cursor-text"}`}
                      onClick={() => !readOnly && setActiveCell({ id: item.id, field: "unit" })}
                    >
                      {activeCell?.id === item.id && activeCell.field === "unit" && !readOnly ? (
                        <select
                          autoFocus
                          value={item.unit}
                          onChange={(event) => updateItem(item.id, { unit: event.target.value as UnitType })}
                          onBlur={() => setActiveCell(null)}
                          className="h-7 w-full rounded border border-slate-300 bg-white px-1 text-right font-mono text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-300"
                        >
                          {UNIT_OPTIONS.map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-mono text-sm text-slate-800">{item.unit}</span>
                      )}
                    </td>
                    <td
                      className={`border-b border-slate-200 px-2 py-2 text-right align-middle ${readOnly ? "" : "cursor-text"}`}
                      onClick={() => !readOnly && setActiveCell({ id: item.id, field: "unitPrice" })}
                    >
                      {activeCell?.id === item.id && activeCell.field === "unitPrice" && !readOnly ? (
                        <input
                          autoFocus
                          value={item.unitPrice}
                          onChange={(event) => updateItem(item.id, { unitPrice: formatMoneyInputTyping(event.target.value) })}
                          onFocus={(event) => {
                            const parsed = parseMoney(event.target.value);
                            if (parsed !== null) updateItem(item.id, { unitPrice: String(parsed) });
                          }}
                          onBlur={(event) => {
                            updateItem(item.id, { unitPrice: formatMoneyInputBlur(event.target.value) });
                            setActiveCell(null);
                          }}
                          inputMode="decimal"
                          placeholder="$0.00"
                          className="h-7 w-full rounded border border-slate-300 bg-white px-2 text-right font-mono text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-300"
                        />
                      ) : (
                        <span className="font-mono text-sm text-slate-800">{formatCurrency(parseMoney(item.unitPrice) ?? 0)}</span>
                      )}
                    </td>
                    <td className="border-b border-slate-200 px-2 py-2 text-right font-mono text-sm font-medium text-slate-800">
                      {formatCurrency(computeBaseLineTotal(item))}
                    </td>
                    <td className="border-b border-slate-200 px-1 py-2 text-right">
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => onChange(items.filter((row) => row.id !== item.id))}
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 opacity-0 hover:bg-slate-100 hover:text-rose-600 group-hover:opacity-100 disabled:opacity-40"
                        aria-label="Remove line item"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="border-b border-slate-200 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Base Total
                </td>
                <td className="border-b border-slate-200 px-2 py-2.5 text-right font-mono text-sm font-bold text-slate-900">
                  {formatCurrency(lineItemsTotal)}
                </td>
                <td className="border-b border-slate-200 px-1 py-2.5" />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="px-4 py-2.5">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => onChange([...items, createLineItem(items.length + 1)])}
            className="text-sm font-medium text-slate-500 underline-offset-2 hover:underline hover:text-slate-700 disabled:opacity-40"
          >
            + Add Line Item
          </button>
        </div>
      </div>

      {items.length === 0 ? <p className="mt-2 text-xs text-slate-500">Add line items to build this bid.</p> : null}
    </section>
  );
}
