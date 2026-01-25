"use client";

import { useEffect, useMemo, useState } from "react";

type SovOption = { code: string; description?: string };
type CostCodeOption = { code: string; description?: string; division?: string };

type LineItem = {
  id: string;
  costCode: string;
  description: string;
  amount: string;
};

type Props = {
  sovOptions: SovOption[];
  costCodeOptions: CostCodeOption[];
  initialItems?: Array<{ cost_code?: string | null; description?: string | null; amount?: number | null }>;
  inputName?: string;
};

const createItem = (): LineItem => ({
  id: crypto.randomUUID(),
  costCode: "",
  description: "",
  amount: "",
});

export default function ChangeOrderLineItems({
  sovOptions,
  costCodeOptions,
  initialItems,
  inputName = "items_json",
}: Props) {
  const moneyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );

  const formatMoney = (value: string | number) => {
    const numeric = Number(String(value).replace(/[^\d.-]/g, ""));
    if (Number.isNaN(numeric)) return "";
    return moneyFormatter.format(numeric);
  };

  const [items, setItems] = useState<LineItem[]>(() => {
    if (initialItems && initialItems.length > 0) {
      return initialItems.map((item) => ({
        id: crypto.randomUUID(),
        costCode: String(item.cost_code ?? ""),
        description: String(item.description ?? ""),
        amount: formatMoney(item.amount ?? 0),
      }));
    }
    return [createItem()];
  });
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");

  const codeOptions = useMemo(() => {
    const seen = new Set<string>();
    return sovOptions.filter((opt) => {
      if (!opt.code) return false;
      if (seen.has(opt.code)) return false;
      seen.add(opt.code);
      return true;
    });
  }, [sovOptions]);

  const codeSet = useMemo(() => new Set(codeOptions.map((opt) => opt.code)), [codeOptions]);
  const filteredCostCodes = useMemo(() => {
    const query = pickerQuery.trim().toLowerCase();
    if (!query) return costCodeOptions;
    return costCodeOptions.filter((opt) => {
      const label = `${opt.code} ${opt.description ?? ""} ${opt.division ?? ""}`.toLowerCase();
      return label.includes(query);
    });
  }, [costCodeOptions, pickerQuery]);

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      const val = Number(String(item.amount).replace(/[^\d.-]/g, ""));
      return sum + (Number.isNaN(val) ? 0 : val);
    }, 0);
  }, [items]);

  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>(`input[name="${inputName}"]`);
    if (!input) return;
    input.value = JSON.stringify(
      items.map((item) => ({
        cost_code: item.costCode.trim(),
        description: item.description.trim(),
        amount: Number(String(item.amount).replace(/[^\d.-]/g, "")) || 0,
      }))
    );
  }, [items, inputName]);

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
  };

  return (
    <section className="border rounded-lg">
      <div className="p-4 border-b flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Schedule of Values</h2>
          <p className="text-sm opacity-70">
            Add cost codes and values tied to this change order.
          </p>
        </div>
        <button
          type="button"
          className="border rounded px-3 py-2 text-sm"
          onClick={() => setItems((prev) => [...prev, createItem()])}
        >
          Add Line Item
        </button>
      </div>
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-black/5 backdrop-blur border-b">
            <tr>
              <th className="text-left p-3">Cost Code</th>
              <th className="text-left p-3">Description</th>
              <th className="text-right p-3">Amount</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b last:border-b-0">
                <td className="p-3">
                  <div className="space-y-2">
                    <select
                      className="w-full rounded border border-black/20 px-3 py-2"
                      value={item.costCode || ""}
                      onChange={(event) => {
                        const next = event.target.value;
                        if (next === "__custom__") {
                          updateItem(item.id, {
                            costCode: codeSet.has(item.costCode) ? "" : item.costCode,
                          });
                          setPickerQuery("");
                          setPickerOpenFor(item.id);
                          return;
                        }
                        const match = codeOptions.find((opt) => opt.code === next);
                        updateItem(item.id, {
                          costCode: next,
                          description:
                            item.description && item.description.length > 0
                              ? item.description
                              : match?.description ?? "",
                        });
                      }}
                    >
                      <option value="">Select cost code</option>
                      {codeOptions.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.code} — {opt.description ?? ""}
                        </option>
                      ))}
                      {!codeSet.has(item.costCode) && item.costCode ? (
                        <option value={item.costCode}>{item.costCode}</option>
                      ) : null}
                      <option value="__custom__">Add cost code…</option>
                    </select>
                  </div>
                </td>
                <td className="p-3">
                  <input
                    value={item.description}
                    onChange={(event) => updateItem(item.id, { description: event.target.value })}
                    className="w-full rounded border border-black/20 px-3 py-2"
                    placeholder="Description"
                  />
                </td>
                <td className="p-3">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/60">
                      $
                    </span>
                    <input
                      value={item.amount}
                      onChange={(event) => updateItem(item.id, { amount: event.target.value })}
                      onBlur={() => updateItem(item.id, { amount: formatMoney(item.amount) })}
                      className="w-full rounded border border-black/20 pl-6 pr-3 py-2 text-right"
                      placeholder="0.00"
                    />
                  </div>
                </td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    className="text-xs opacity-70 hover:opacity-100"
                    onClick={() => removeItem(item.id)}
                    disabled={items.length === 1}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-black/[0.02]">
              <td className="p-3 font-medium" colSpan={2}>
                Total
              </td>
              <td className="p-3 text-right font-semibold">
                ${moneyFormatter.format(total)}
              </td>
              <td className="p-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <input type="hidden" name={inputName} />
      {pickerOpenFor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="font-semibold">Select a Cost Code</div>
              <button
                type="button"
                className="text-sm opacity-70 hover:opacity-100"
                onClick={() => setPickerOpenFor(null)}
              >
                Close
              </button>
            </div>
            <div className="p-4 space-y-3">
              <input
                value={pickerQuery}
                onChange={(event) => setPickerQuery(event.target.value)}
                className="w-full rounded border border-black/20 px-3 py-2 text-sm"
                placeholder="Search cost codes"
              />
              <div className="max-h-[320px] overflow-auto rounded border border-black/10">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-black/5 backdrop-blur border-b">
                    <tr>
                      <th className="text-left p-2">Code</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-left p-2">Division</th>
                      <th className="text-right p-2">Select</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCostCodes.length > 0 ? (
                      filteredCostCodes.map((opt) => (
                        <tr key={opt.code} className="border-b last:border-b-0">
                          <td className="p-2">{opt.code}</td>
                          <td className="p-2">{opt.description ?? "-"}</td>
                          <td className="p-2">{opt.division ?? "-"}</td>
                          <td className="p-2 text-right">
                            <button
                              type="button"
                              className="text-xs underline"
                              onClick={() => {
                                const match = codeOptions.find((c) => c.code === opt.code);
                                updateItem(pickerOpenFor, {
                                  costCode: opt.code,
                                  description:
                                    items.find((i) => i.id === pickerOpenFor)?.description?.length
                                      ? items.find((i) => i.id === pickerOpenFor)?.description ?? ""
                                      : match?.description ?? opt.description ?? "",
                                });
                                setPickerOpenFor(null);
                              }}
                            >
                              Use
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="p-3 opacity-70" colSpan={4}>
                          No cost codes found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
