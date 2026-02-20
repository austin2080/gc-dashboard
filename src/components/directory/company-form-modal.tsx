"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CompanyCostCode } from "@/lib/bidding/store";

type TradeSelection = {
  type: "cost_code" | "custom";
  id?: string;
  code?: string;
  title: string;
  division?: string;
};

type CompanyDraft = {
  companyName: string;
  trades: TradeSelection[];
  contactTitle: string;
  primaryContact: string;
  email: string;
  cellPhone: string;
  officePhone: string;
  notes: string;
  isActive: boolean;
};

type Props = {
  open: boolean;
  title: string;
  draft: CompanyDraft;
  costCodeOptions?: CompanyCostCode[];
  loadingCostCodes?: boolean;
  costCodeError?: string;
  error?: string;
  saving?: boolean;
  onClose: () => void;
  onChange: (draft: CompanyDraft) => void;
  onSave: () => void;
};

type DropdownOption =
  | { kind: "cost_code"; value: TradeSelection; searchText: string }
  | { kind: "create"; query: string };

function normalizeValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function selectionLabel(selection: TradeSelection): string {
  if (selection.type === "cost_code") {
    return `${selection.code ?? ""}${selection.title ? ` ${selection.title}` : ""}`.trim();
  }
  return selection.title.trim();
}

function selectionKey(selection: TradeSelection): string {
  if (selection.type === "cost_code" && selection.id) return `cost_code:${selection.id}`;
  return `custom:${normalizeValue(selectionLabel(selection))}`;
}

export default function CompanyFormModal({
  open,
  title,
  draft,
  costCodeOptions = [],
  loadingCostCodes = false,
  costCodeError = "",
  error,
  saving = false,
  onClose,
  onChange,
  onSave,
}: Props) {
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedKeySet = useMemo(() => new Set(draft.trades.map((trade) => selectionKey(trade))), [draft.trades]);
  const normalizedQuery = query.trim().toLowerCase();
  const availableCostCodeOptions = useMemo(() => {
    return costCodeOptions
      .map((code) => {
        const value: TradeSelection = {
          type: "cost_code",
          id: code.id,
          code: code.code,
          title: code.title ?? "",
          division: code.division ?? undefined,
        };
        const searchText = [code.code, code.title ?? "", code.division ?? "", selectionLabel(value)]
          .join(" ")
          .toLowerCase();
        return { value, searchText };
      })
      .filter(({ value }) => !selectedKeySet.has(selectionKey(value)));
  }, [costCodeOptions, selectedKeySet]);

  const filteredCostCodeOptions = useMemo(
    () =>
      availableCostCodeOptions.filter((option) => {
        if (!normalizedQuery) return true;
        return option.searchText.includes(normalizedQuery);
      }),
    [availableCostCodeOptions, normalizedQuery]
  );

  const canCreateCustom = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return false;
    const normalized = normalizeValue(trimmed);
    if (selectedKeySet.has(`custom:${normalized}`)) return false;
    const hasExactCostCode = costCodeOptions.some((code) => {
      const label = `${code.code}${code.title ? ` ${code.title}` : ""}`.trim();
      return normalizeValue(label) === normalized;
    });
    return !hasExactCostCode;
  }, [costCodeOptions, query, selectedKeySet]);

  const dropdownOptions = useMemo<DropdownOption[]>(() => {
    const costCodeRows: DropdownOption[] = filteredCostCodeOptions.map((option) => ({
      kind: "cost_code",
      value: option.value,
      searchText: option.searchText,
    }));
    if (!canCreateCustom) return costCodeRows;
    return [...costCodeRows, { kind: "create", query: query.trim() }];
  }, [canCreateCustom, filteredCostCodeOptions, query]);

  useEffect(() => {
    setActiveIndex((prev) => {
      if (dropdownOptions.length === 0) return 0;
      if (prev < 0) return 0;
      if (prev > dropdownOptions.length - 1) return dropdownOptions.length - 1;
      return prev;
    });
  }, [dropdownOptions]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDropdownOpen(false);
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [dropdownOpen]);

  if (!open) return null;

  const addTradeSelection = (selection: TradeSelection) => {
    const key = selectionKey(selection);
    if (selectedKeySet.has(key)) return;
    onChange({ ...draft, trades: [...draft.trades, selection] });
    setQuery("");
    setDropdownOpen(true);
    setActiveIndex(0);
    inputRef.current?.focus();
  };

  const removeTradeSelection = (key: string) => {
    onChange({
      ...draft,
      trades: draft.trades.filter((trade) => selectionKey(trade) !== key),
    });
    setDropdownOpen(true);
    inputRef.current?.focus();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm opacity-70">Manual directory entry for waiver tracking workflows.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <label className="md:col-span-2"><div className="mb-1 opacity-70">Company name *</div><input className="w-full rounded border px-3 py-2" value={draft.companyName} onChange={(event) => onChange({ ...draft, companyName: event.target.value })} /></label>
          <label className="md:col-span-2">
            <div className="mb-1 opacity-70">Trades *</div>
            <div className="relative" ref={containerRef}>
              <div
                className="min-h-[42px] w-full rounded border border-slate-300 bg-white px-2 py-1.5 focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-300"
                onClick={() => {
                  setDropdownOpen(true);
                  inputRef.current?.focus();
                }}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  {draft.trades.map((trade) => {
                    const key = selectionKey(trade);
                    return (
                      <span key={key} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                        {selectionLabel(trade)}
                        <button
                          type="button"
                          className="text-slate-500 hover:text-slate-800"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeTradeSelection(key);
                          }}
                          aria-label={`Remove ${selectionLabel(trade)}`}
                        >
                          x
                        </button>
                      </span>
                    );
                  })}
                  <input
                    ref={inputRef}
                    className="min-w-[180px] flex-1 border-0 px-1 py-1 text-sm text-slate-900 outline-none"
                    value={query}
                    onFocus={() => setDropdownOpen(true)}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setDropdownOpen(true);
                      setActiveIndex(0);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setDropdownOpen(false);
                        return;
                      }
                      if (event.key === "Backspace" && !query) {
                        const last = draft.trades[draft.trades.length - 1];
                        if (last) {
                          event.preventDefault();
                          removeTradeSelection(selectionKey(last));
                        }
                        return;
                      }
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setDropdownOpen(true);
                        setActiveIndex((prev) =>
                          dropdownOptions.length ? (prev + 1) % dropdownOptions.length : 0
                        );
                        return;
                      }
                      if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setDropdownOpen(true);
                        setActiveIndex((prev) =>
                          dropdownOptions.length ? (prev - 1 + dropdownOptions.length) % dropdownOptions.length : 0
                        );
                        return;
                      }
                      if (event.key === "Enter") {
                        if (!dropdownOpen || dropdownOptions.length === 0) return;
                        event.preventDefault();
                        const option = dropdownOptions[activeIndex];
                        if (!option) return;
                        if (option.kind === "cost_code") {
                          addTradeSelection(option.value);
                        } else {
                          addTradeSelection({
                            type: "custom",
                            title: option.query,
                          });
                        }
                      }
                    }}
                    placeholder={draft.trades.length ? "" : "Search or add trades"}
                    disabled={loadingCostCodes}
                  />
                </div>
              </div>
              {dropdownOpen ? (
                <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Cost codes
                  </div>
                  {filteredCostCodeOptions.length ? (
                    filteredCostCodeOptions.map((option, index) => {
                      const active = activeIndex === index;
                      const rowTitle = option.value.title || option.value.code || "Untitled";
                      return (
                        <button
                          key={option.value.id ?? option.searchText}
                          type="button"
                          className={`w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 ${
                            active ? "bg-slate-100" : "hover:bg-slate-50"
                          }`}
                          onMouseEnter={() => setActiveIndex(index)}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            addTradeSelection(option.value);
                          }}
                        >
                          <div className="text-sm font-medium text-slate-900">{rowTitle}</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            <span className="text-slate-400">{option.value.code}</span>
                            {option.value.division ? <span> · {option.value.division}</span> : null}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-3 py-2 text-sm text-slate-500">No matching cost codes.</div>
                  )}
                  {canCreateCustom ? (
                    <button
                      type="button"
                      className={`w-full px-3 py-2 text-left text-sm ${
                        activeIndex === dropdownOptions.length - 1 ? "bg-slate-100" : "hover:bg-slate-50"
                      }`}
                      onMouseEnter={() => setActiveIndex(dropdownOptions.length - 1)}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        addTradeSelection({ type: "custom", title: query.trim() });
                      }}
                    >
                      + Add "{query.trim()}"
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            {costCodeError ? <div className="mt-1 text-xs text-red-600">{costCodeError}</div> : null}
          </label>
          <label><div className="mb-1 opacity-70">Primary contact name *</div><input className="w-full rounded border px-3 py-2" value={draft.primaryContact} onChange={(event) => onChange({ ...draft, primaryContact: event.target.value })} /></label>
          <label><div className="mb-1 opacity-70">Title</div><input className="w-full rounded border px-3 py-2" value={draft.contactTitle} onChange={(event) => onChange({ ...draft, contactTitle: event.target.value })} /></label>
          <label><div className="mb-1 opacity-70">Email *</div><input className="w-full rounded border px-3 py-2" value={draft.email} onChange={(event) => onChange({ ...draft, email: event.target.value })} /></label>
          <label><div className="mb-1 opacity-70">Cell *</div><input className="w-full rounded border px-3 py-2" value={draft.cellPhone} onChange={(event) => onChange({ ...draft, cellPhone: event.target.value })} /></label>
          <label><div className="mb-1 opacity-70">Office Phone</div><input className="w-full rounded border px-3 py-2" value={draft.officePhone} onChange={(event) => onChange({ ...draft, officePhone: event.target.value })} /></label>
          <label className="md:col-span-2"><div className="mb-1 opacity-70">Notes</div><textarea className="w-full rounded border px-3 py-2" rows={3} value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} /></label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.isActive} onChange={(event) => onChange({ ...draft, isActive: event.target.checked })} />Active</label>
        </div>
        {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded border px-3 py-2 text-sm disabled:opacity-60" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="rounded border border-black bg-black px-3 py-2 text-sm text-white disabled:opacity-60" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save Company"}
          </button>
        </div>
      </div>
    </div>
  );
}
