"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CompanyCostCode } from "@/lib/bidding/store";

type TradeComboboxProps = {
  costCodes: CompanyCostCode[];
  assignedCostCodeIds: string[];
  loading: boolean;
  error: string | null;
  disabled?: boolean;
  onSelectCostCode: (costCode: CompanyCostCode) => Promise<void> | void;
  onCreateCustomTrade: (payload: { customCode: string; customTitle: string }) => Promise<void> | void;
};

function compareCostCode(a: string, b: string): number {
  const aParts = a.split(/\D+/).filter(Boolean).map(Number);
  const bParts = b.split(/\D+/).filter(Boolean).map(Number);
  const maxLen = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < maxLen; i += 1) {
    const aValue = aParts[i] ?? -1;
    const bValue = bParts[i] ?? -1;
    if (aValue !== bValue) return aValue - bValue;
  }
  return a.localeCompare(b);
}

export default function TradeCombobox({
  costCodes,
  assignedCostCodeIds,
  loading,
  error,
  disabled = false,
  onSelectCostCode,
  onCreateCustomTrade,
}: TradeComboboxProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCustomFields, setShowCustomFields] = useState(false);
  const [customCode, setCustomCode] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!wrapperRef.current?.contains(target)) {
        setIsOpen(false);
        setShowCustomFields(false);
        setCustomError(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const assignedSet = useMemo(() => new Set(assignedCostCodeIds), [assignedCostCodeIds]);
  const filteredCodes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return costCodes
      .filter((code) => !assignedSet.has(code.id))
      .filter((code) => {
        if (!normalized) return true;
        const haystack = `${code.code} ${code.title ?? ""} ${code.division ?? ""}`.toLowerCase();
        return haystack.includes(normalized);
      })
      .sort((a, b) => compareCostCode(a.code, b.code));
  }, [assignedSet, costCodes, query]);

  const handleSelectCostCode = async (costCode: CompanyCostCode) => {
    if (disabled || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSelectCostCode(costCode);
      setQuery("");
      setIsOpen(false);
      setShowCustomFields(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCustom = async () => {
    if (disabled || isSubmitting) return;
    if (!customTitle.trim()) {
      setCustomError("Custom trade title is required.");
      return;
    }
    setIsSubmitting(true);
    setCustomError(null);
    try {
      await onCreateCustomTrade({
        customCode: customCode.trim(),
        customTitle: customTitle.trim(),
      });
      setCustomCode("");
      setCustomTitle("");
      setShowCustomFields(false);
      setQuery("");
      setIsOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      {error ? (
        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {error}
        </div>
      ) : null}
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Search company cost codes"
        disabled={disabled}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
      />
      {isOpen ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="max-h-[300px] overflow-auto">
            {loading ? (
              <div className="px-3 py-4 text-sm text-slate-500">Loading company cost codes...</div>
            ) : filteredCodes.length ? (
              filteredCodes.map((code) => (
                <button
                  key={code.id}
                  type="button"
                  onClick={() => void handleSelectCostCode(code)}
                  disabled={disabled || isSubmitting}
                  className="w-full border-b border-slate-100 px-3 py-2 text-left transition last:border-b-0 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <p className="text-sm font-medium text-slate-900">
                    [{code.code}] - {code.title ?? "Untitled"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{code.division ?? "No division"}</p>
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-slate-500">No matching cost codes.</div>
            )}
          </div>
          <div className="border-t border-slate-200 bg-slate-50 p-2">
            {showCustomFields ? (
              <div className="space-y-2">
                <input
                  value={customCode}
                  onChange={(event) => setCustomCode(event.target.value)}
                  placeholder="Custom code (optional)"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                />
                <input
                  value={customTitle}
                  onChange={(event) => setCustomTitle(event.target.value)}
                  placeholder="Custom title"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                />
                {customError ? <p className="text-xs text-rose-700">{customError}</p> : null}
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomFields(false);
                      setCustomError(null);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCreateCustom()}
                    disabled={disabled || isSubmitting}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Save Custom Trade
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowCustomFields(true);
                  setCustomError(null);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Create Custom Trade
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
