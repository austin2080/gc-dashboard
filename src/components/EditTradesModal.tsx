"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { CompanyCostCode } from "@/lib/bidding/store";
import TradeCombobox from "./TradeCombobox";

export type TradeEditDraft = {
  id: string | null;
  trade_name: string;
  sort_order: number;
};

type EditTradesModalProps = {
  open: boolean;
  tradeDrafts: TradeEditDraft[];
  tradeEditError: string | null;
  savingTrades: boolean;
  loadingCompanyCostCodes: boolean;
  companyCostCodeError: string | null;
  companyCostCodes: CompanyCostCode[];
  assignedCompanyCostCodeIds: string[];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> | void;
  onTradeNameChange: (index: number, value: string) => void;
  onRemoveTrade: (index: number) => void;
  onSelectCostCode: (costCode: CompanyCostCode) => Promise<void> | void;
  onCreateCustomTrade: (payload: { customCode: string; customTitle: string }) => Promise<void> | void;
};

export default function EditTradesModal({
  open,
  tradeDrafts,
  tradeEditError,
  savingTrades,
  loadingCompanyCostCodes,
  companyCostCodeError,
  companyCostCodes,
  assignedCompanyCostCodeIds,
  onClose,
  onSubmit,
  onTradeNameChange,
  onRemoveTrade,
  onSelectCostCode,
  onCreateCustomTrade,
}: EditTradesModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
      <div className="flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-xl sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Edit Trades</h2>
          <p className="mt-1 text-sm text-slate-500">Rename existing trades and add new ones from company cost codes.</p>
        </div>
        <form
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:gap-5 sm:px-6 sm:py-5"
          onSubmit={(event) => void onSubmit(event)}
        >
          <div className="grid gap-3 md:grid-cols-2 sm:gap-4">
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                <div className="flex items-center justify-between gap-2">
                  <span>Project Trades</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {tradeDrafts.length}
                  </span>
                </div>
              </div>
              <div className="max-h-72 space-y-2 overflow-auto p-3 sm:max-h-80">
                {tradeDrafts.length ? (
                  tradeDrafts.map((trade, index) => (
                    <div key={`${trade.id ?? "new"}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          value={trade.trade_name}
                          onChange={(event) => onTradeNameChange(index, event.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none sm:flex-1"
                          placeholder="Trade name"
                        />
                        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                          <button
                            type="button"
                            onClick={() => onRemoveTrade(index)}
                            className="rounded-lg border border-rose-200 bg-white px-2 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                            aria-label="Remove trade"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                    No trades yet. Add from company cost codes or create a custom trade.
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50">
              <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                Add Trade
              </div>
              <div className="space-y-3 p-3">
                <p className="text-xs text-slate-500">
                  Search by code, title, or division. Selected codes are hidden once added to this project.
                </p>
                <TradeCombobox
                  costCodes={companyCostCodes}
                  assignedCostCodeIds={assignedCompanyCostCodeIds}
                  loading={loadingCompanyCostCodes}
                  error={companyCostCodeError}
                  disabled={savingTrades}
                  onSelectCostCode={onSelectCostCode}
                  onCreateCustomTrade={onCreateCustomTrade}
                />
              </div>
            </div>
          </div>
          {tradeEditError ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {tradeEditError}
            </p>
          ) : null}
          <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white pt-4">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingTrades}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {savingTrades ? "Saving..." : "Save Trades"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
