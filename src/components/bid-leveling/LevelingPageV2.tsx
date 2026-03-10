"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getBidLevelingProjectData } from "@/lib/bidding/leveling-store";
import type { BidLevelingProjectData, LevelingBid } from "@/lib/bidding/leveling-types";
import { getBidProjectIdForProject } from "@/lib/bidding/project-links";

function formatDate(iso: string | null): string {
  if (!iso) return "No due date";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function parseCurrencyInput(value: string): number | null {
  const normalized = value.replace(/[$,\s]/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrencyInput(value: string): string {
  const parsed = parseCurrencyInput(value);
  if (parsed === null) return "";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed);
}

function formatCurrencyWhileTyping(value: string): string {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return "";
  const firstDotIndex = cleaned.indexOf(".");
  let integerPart = cleaned;
  let decimalPart = "";
  if (firstDotIndex >= 0) {
    integerPart = cleaned.slice(0, firstDotIndex);
    decimalPart = cleaned.slice(firstDotIndex + 1).replace(/\./g, "").slice(0, 2);
  }
  integerPart = integerPart.replace(/\D/g, "");
  if (!integerPart && firstDotIndex >= 0) integerPart = "0";
  if (!integerPart && !decimalPart) return "";
  const withCommas = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return firstDotIndex >= 0 ? `${withCommas}.${decimalPart}` : withCommas;
}

function getAmountCellKey(rowId: string, bidId: string): string {
  return `${rowId}:${bidId}`;
}

function getAdditionalInfoCellKey(rowKey: string, bidId: string): string {
  return `${rowKey}:${bidId}`;
}

type BidColumn = {
  id: string;
  bid: LevelingBid | null;
  subId: string | null;
  subName: string;
  status: string;
};

type LineItemRow = {
  id: string;
  label: string;
};

type InviteQuoteLineItem = {
  label: string;
  amount: string;
};

const ADDITIONAL_INFO_ROWS = [
  { key: "inclusions", label: "Inclusions" },
  { key: "exclusions", label: "Exclusions" },
  { key: "comments", label: "Comments" },
  { key: "attachments", label: "Attachments" },
] as const;

type AdditionalInfoRowKey = (typeof ADDITIONAL_INFO_ROWS)[number]["key"];

const QUOTE_LINE_ITEMS_STORAGE_KEY = "bidQuoteLineItemsByCell";
const BID_INCLUSIONS_STORAGE_KEY = "bidInclusionsByCell";
const BID_EXCLUSIONS_STORAGE_KEY = "bidExclusionsByCell";
const MIN_SUBCONTRACTOR_COLUMNS = 3;
const LINE_ITEM_COLUMN_WIDTH_PX = 420;
const SUBCONTRACTOR_COLUMN_MIN_WIDTH_PX = 280;
const ADD_COLUMN_CELL_WIDTH_PX = 168;

function normalizeLineItemLabel(value: string): string {
  return value.trim().toLowerCase();
}

function readQuoteLineItemsMap(): Record<string, InviteQuoteLineItem[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(QUOTE_LINE_ITEMS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const next: Record<string, InviteQuoteLineItem[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue;
      const items = value
        .filter((item) => Boolean(item) && typeof item === "object")
        .map((item) => ({
          label: typeof (item as { label?: unknown }).label === "string" ? (item as { label: string }).label : "",
          amount: typeof (item as { amount?: unknown }).amount === "string" ? (item as { amount: string }).amount : "",
        }))
        .filter((item) => item.label.trim().length > 0);
      if (items.length) next[key] = items;
    }
    return next;
  } catch {
    return {};
  }
}

function readBidTextByCellMap(storageKey: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.entries(parsed).reduce<Record<string, string>>((acc, [key, value]) => {
      if (typeof key === "string" && typeof value === "string") acc[key] = value;
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export default function LevelingPageV2({
  hideCreateBidForm = false,
  leftNavItems,
}: {
  hideCreateBidForm?: boolean;
  leftNavItems?: string[];
}) {
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("project");
  const [data, setData] = useState<BidLevelingProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [selectedLeftNavItem, setSelectedLeftNavItem] = useState<string | null>(leftNavItems?.[0] ?? null);
  const [manualLineItems, setManualLineItems] = useState<LineItemRow[]>([]);
  const [inviteQuoteLineItemsMap, setInviteQuoteLineItemsMap] = useState<Record<string, InviteQuoteLineItem[]>>(
    () => readQuoteLineItemsMap()
  );
  const [inclusionsByCellKey, setInclusionsByCellKey] = useState<Record<string, string>>(() =>
    readBidTextByCellMap(BID_INCLUSIONS_STORAGE_KEY)
  );
  const [exclusionsByCellKey, setExclusionsByCellKey] = useState<Record<string, string>>(() =>
    readBidTextByCellMap(BID_EXCLUSIONS_STORAGE_KEY)
  );
  const [amountDraftByCell, setAmountDraftByCell] = useState<Record<string, string>>({});
  const [additionalInfoDraftByCell, setAdditionalInfoDraftByCell] = useState<Record<string, string>>({});
  const [subcontractorNameDraftByColumnId, setSubcontractorNameDraftByColumnId] = useState<Record<string, string>>(
    {}
  );
  const [extraPlaceholderColumnIdsByTradeId, setExtraPlaceholderColumnIdsByTradeId] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      if (!queryProjectId) {
        if (active) {
          setData(null);
          setLoading(false);
        }
        return;
      }

      const mappedBidProjectId = getBidProjectIdForProject(queryProjectId);
      const candidates = [mappedBidProjectId, queryProjectId].filter(
        (id, index, list): id is string => Boolean(id) && list.indexOf(id) === index
      );
      let nextData: BidLevelingProjectData | null = null;
      for (const candidate of candidates) {
        nextData = await getBidLevelingProjectData(candidate);
        if (nextData) break;
      }
      if (!active) return;
      setData(nextData);
      setSelectedTradeId(nextData?.trades?.[0]?.id ?? null);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [queryProjectId]);

  const effectiveSelectedLeftNavItem = leftNavItems?.length
    ? selectedLeftNavItem && leftNavItems.includes(selectedLeftNavItem)
      ? selectedLeftNavItem
      : leftNavItems[0]
    : null;

  const selectedTrade = useMemo(
    () => data?.trades.find((trade) => trade.id === selectedTradeId) ?? null,
    [data?.trades, selectedTradeId]
  );
  const extraPlaceholderColumnIdsForTrade = useMemo(
    () => (selectedTrade ? extraPlaceholderColumnIdsByTradeId[selectedTrade.id] ?? [] : []),
    [extraPlaceholderColumnIdsByTradeId, selectedTrade]
  );

  const bidColumns = useMemo(() => {
    if (!data || !selectedTrade) return [] as BidColumn[];
    const subNameById = new Map(
      data.projectSubs.map((sub) => [sub.id, sub.subcontractor?.company_name ?? "Subcontractor"])
    );
    const realColumns: BidColumn[] = data.bids
      .filter((bid) => bid.trade_id === selectedTrade.id)
      .sort((a, b) => {
        const aAmount = a.base_bid_amount ?? Number.POSITIVE_INFINITY;
        const bAmount = b.base_bid_amount ?? Number.POSITIVE_INFINITY;
        if (aAmount !== bAmount) return aAmount - bAmount;
        return (subNameById.get(a.sub_id) ?? "").localeCompare(subNameById.get(b.sub_id) ?? "");
      })
      .map((bid) => ({
        id: bid.id,
        bid,
        subId: bid.sub_id,
        subName: subNameById.get(bid.sub_id) ?? "Subcontractor",
        status: bid.status,
      }));
    const next = [...realColumns];
    const minimumPlaceholderCount = Math.max(0, MIN_SUBCONTRACTOR_COLUMNS - realColumns.length);
    for (let index = 0; index < minimumPlaceholderCount; index += 1) {
      next.push({
        id: `placeholder-sub-${selectedTrade.id}-${index + 1}`,
        bid: null,
        subId: null,
        subName: `Subcontractor ${realColumns.length + index + 1}`,
        status: "not invited",
      });
    }
    extraPlaceholderColumnIdsForTrade.forEach((columnId, index) => {
      next.push({
        id: columnId,
        bid: null,
        subId: null,
        subName: `Subcontractor ${realColumns.length + minimumPlaceholderCount + index + 1}`,
        status: "not invited",
      });
    });
    return next;
  }, [data, extraPlaceholderColumnIdsForTrade, selectedTrade]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key &&
        event.key !== QUOTE_LINE_ITEMS_STORAGE_KEY &&
        event.key !== BID_INCLUSIONS_STORAGE_KEY &&
        event.key !== BID_EXCLUSIONS_STORAGE_KEY
      ) {
        return;
      }
      setInviteQuoteLineItemsMap(readQuoteLineItemsMap());
      setInclusionsByCellKey(readBidTextByCellMap(BID_INCLUSIONS_STORAGE_KEY));
      setExclusionsByCellKey(readBidTextByCellMap(BID_EXCLUSIONS_STORAGE_KEY));
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const submittedCount = bidColumns.filter((col) => col.status === "submitted").length;

  const inviteLineItemsByColumnId = useMemo(() => {
    if (!data || !selectedTrade) return {} as Record<string, InviteQuoteLineItem[]>;
    const next: Record<string, InviteQuoteLineItem[]> = {};
    bidColumns.forEach((col) => {
      if (!col.subId) {
        next[col.id] = [];
        return;
      }
      const key = `${data.project.id}:${selectedTrade.id}:${col.subId}`;
      next[col.id] = inviteQuoteLineItemsMap[key] ?? [];
    });
    return next;
  }, [bidColumns, data, inviteQuoteLineItemsMap, selectedTrade]);

  const importedLineItemLabels = useMemo(() => {
    const labels: string[] = [];
    const seen = new Set<string>();
    bidColumns.forEach((col) => {
      const items = inviteLineItemsByColumnId[col.id] ?? [];
      items.forEach((item) => {
        const normalized = normalizeLineItemLabel(item.label);
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        labels.push(item.label.trim());
      });
    });
    return labels;
  }, [bidColumns, inviteLineItemsByColumnId]);

  const hasImportedBaseBid = useMemo(
    () => importedLineItemLabels.some((label) => normalizeLineItemLabel(label) === "base bid"),
    [importedLineItemLabels]
  );

  const displayLineItems = useMemo(() => {
    const rows: LineItemRow[] = [];
    rows.push({ id: "base-bid", label: hasImportedBaseBid ? "Base Bid" : "" });
    importedLineItemLabels
      .filter((label) => normalizeLineItemLabel(label) !== "base bid")
      .forEach((label) => {
        rows.push({ id: `imported-${normalizeLineItemLabel(label)}`, label });
      });
    manualLineItems.forEach((item) => rows.push(item));
    return rows;
  }, [hasImportedBaseBid, importedLineItemLabels, manualLineItems]);

  const getInitialAmountForCell = (row: LineItemRow, col: BidColumn): string => {
    if (!col.bid) return "";
    if (row.id === "base-bid") {
      return col.bid.base_bid_amount !== null && Number.isFinite(col.bid.base_bid_amount)
        ? formatCurrencyInput(String(col.bid.base_bid_amount))
        : "";
    }
    const items = inviteLineItemsByColumnId[col.id] ?? [];
    const match = items.find(
      (item) => normalizeLineItemLabel(item.label) === normalizeLineItemLabel(row.label)
    );
    return match ? formatCurrencyInput(match.amount) : "";
  };

  const getDisplayAmountForCell = (row: LineItemRow, col: BidColumn): string => {
    const key = getAmountCellKey(row.id, col.id);
    return amountDraftByCell[key] ?? getInitialAmountForCell(row, col);
  };

  const getInitialAdditionalInfoForCell = (rowKey: AdditionalInfoRowKey, col: BidColumn): string => {
    if (rowKey === "comments") return col.bid?.notes ?? "";
    if (rowKey === "inclusions") {
      if (!col.subId || !data || !selectedTrade) return "Labor, material, and equipment per plans/specs.";
      const key = `${data.project.id}:${selectedTrade.id}:${col.subId}`;
      return inclusionsByCellKey[key] ?? "Labor, material, and equipment per plans/specs.";
    }
    if (rowKey === "exclusions") {
      if (!col.subId || !data || !selectedTrade) return "Overtime and out-of-sequence work excluded.";
      const key = `${data.project.id}:${selectedTrade.id}:${col.subId}`;
      return exclusionsByCellKey[key] ?? "Overtime and out-of-sequence work excluded.";
    }
    return "";
  };

  const getDisplayAdditionalInfoForCell = (rowKey: AdditionalInfoRowKey, col: BidColumn): string => {
    const key = getAdditionalInfoCellKey(rowKey, col.id);
    return additionalInfoDraftByCell[key] ?? getInitialAdditionalInfoForCell(rowKey, col);
  };

  const totalByColumnId: Record<string, number | null> = {};
  bidColumns.forEach((col) => {
    let sum = 0;
    let hasValue = false;
    displayLineItems.forEach((row) => {
      const parsed = parseCurrencyInput(getDisplayAmountForCell(row, col));
      if (parsed === null) return;
      sum += parsed;
      hasValue = true;
    });
    totalByColumnId[col.id] = hasValue ? sum : null;
  });
  const tableWidthPx =
    LINE_ITEM_COLUMN_WIDTH_PX +
    bidColumns.length * SUBCONTRACTOR_COLUMN_MIN_WIDTH_PX +
    ADD_COLUMN_CELL_WIDTH_PX;

  const isUserAddedColumn = (columnId: string) => extraPlaceholderColumnIdsForTrade.includes(columnId);

  const handleAddSubcontractorColumn = () => {
    if (!selectedTrade) return;
    const nextId = `manual-sub-${selectedTrade.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setExtraPlaceholderColumnIdsByTradeId((prev) => ({
      ...prev,
      [selectedTrade.id]: [...(prev[selectedTrade.id] ?? []), nextId],
    }));
  };

  const handleRemoveSubcontractorColumn = (columnId: string) => {
    if (!selectedTrade) return;
    if (!isUserAddedColumn(columnId)) return;
    setExtraPlaceholderColumnIdsByTradeId((prev) => ({
      ...prev,
      [selectedTrade.id]: (prev[selectedTrade.id] ?? []).filter((id) => id !== columnId),
    }));
    setSubcontractorNameDraftByColumnId((prev) => {
      const next = { ...prev };
      delete next[columnId];
      return next;
    });
    setAmountDraftByCell((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (key.endsWith(`:${columnId}`)) delete next[key];
      });
      return next;
    });
    setAdditionalInfoDraftByCell((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (key.endsWith(`:${columnId}`)) delete next[key];
      });
      return next;
    });
  };

  if (!queryProjectId) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-6 text-sm text-slate-500 shadow-sm">
        Select a project to view bid leveling.
      </section>
    );
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-sm text-slate-500 shadow-sm">
        Loading bid leveling layout...
      </section>
    );
  }

  if (!data) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-sm text-slate-600 shadow-sm">
        No bid package data found for this project.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid min-h-[720px] grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-r border-slate-200 bg-slate-50">
          {!hideCreateBidForm ? (
            <div className="border-b border-slate-200 px-4 py-3">
              <button
                type="button"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                + Create Bid Form
              </button>
            </div>
          ) : null}
          <nav className="space-y-1 p-2">
            {leftNavItems?.length
              ? leftNavItems.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setSelectedLeftNavItem(item)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                      effectiveSelectedLeftNavItem === item
                        ? "border-l-4 border-blue-600 bg-white font-semibold text-blue-700"
                        : "text-slate-700 hover:bg-white"
                    }`}
                  >
                    {item}
                  </button>
                ))
              : data.trades.map((trade) => (
                  <button
                    key={trade.id}
                    type="button"
                    onClick={() => setSelectedTradeId(trade.id)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                      trade.id === selectedTradeId
                        ? "border-l-4 border-blue-600 bg-white font-semibold text-blue-700"
                        : "text-slate-700 hover:bg-white"
                    }`}
                  >
                    {trade.trade_name}
                  </button>
                ))}
          </nav>
        </aside>

        <div className="overflow-hidden">
          <div className="overflow-x-auto">
            <table
              className="min-w-full table-fixed border-separate border-spacing-0"
              style={{ width: `${tableWidthPx}px` }}
            >
              <colgroup>
                <col style={{ width: `${LINE_ITEM_COLUMN_WIDTH_PX}px` }} />
                {bidColumns.map((col) => (
                  <col key={col.id} style={{ width: `${SUBCONTRACTOR_COLUMN_MIN_WIDTH_PX}px` }} />
                ))}
                <col style={{ width: `${ADD_COLUMN_CELL_WIDTH_PX}px` }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="border-b border-r border-slate-200 bg-slate-50 p-4 text-left align-top">
                    <div className="text-sm text-slate-500">
                      Due: {formatDate(data.project.due_date)}
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">{submittedCount} Bids Submitted</div>
                  </th>
                  {bidColumns.map((col) => (
                    <th key={`head-${col.id}`} className="border-b border-r border-slate-200 bg-slate-50 p-4 text-left align-top last:border-r-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {col.bid ? (
                            <div className="truncate text-2xl font-semibold text-slate-900">{col.subName}</div>
                          ) : (
                            <input
                              value={subcontractorNameDraftByColumnId[col.id] ?? col.subName}
                              onChange={(event) =>
                                setSubcontractorNameDraftByColumnId((prev) => ({
                                  ...prev,
                                  [col.id]: event.target.value,
                                }))
                              }
                              placeholder={col.subName}
                              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-2xl font-semibold text-slate-900 focus:border-slate-400 focus:outline-none"
                            />
                          )}
                        </div>
                        {isUserAddedColumn(col.id) ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveSubcontractorColumn(col.id)}
                            className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                            aria-label="Delete subcontractor column"
                            title="Delete column"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">{col.status}</div>
                    </th>
                  ))}
                  <th className="border-b border-slate-200 bg-slate-50 p-3 align-top">
                    <button
                      type="button"
                      onClick={handleAddSubcontractorColumn}
                      className="flex h-full min-h-[88px] w-full items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                    >
                      + Add Subcontractor
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayLineItems.map((row, rowIndex) => (
                  <tr key={row.id}>
                    <td className="border-b border-r border-slate-200 px-4 py-2.5 text-base font-medium text-slate-700">
                      <input
                        value={row.label}
                        onChange={(event) =>
                          row.id.startsWith("imported-")
                            ? undefined
                            : row.id === "base-bid"
                              ? undefined
                              : setManualLineItems((prev) =>
                                  prev.map((item) =>
                                    item.id === row.id ? { ...item, label: event.target.value } : item
                                  )
                                )
                        }
                        placeholder={rowIndex === 0 ? "Base Bid" : "Add line item"}
                        readOnly={row.id.startsWith("imported-")}
                        className={`w-full rounded-md border border-slate-200 px-2 py-1.5 text-base text-slate-700 focus:border-slate-400 focus:outline-none ${
                          row.id.startsWith("imported-") ? "bg-slate-50" : ""
                        }`}
                      />
                    </td>
                    {bidColumns.map((col) => (
                      <td key={`${row.id}-${col.id}`} className="border-b border-r border-slate-200 px-4 py-2.5 text-right text-base text-slate-700 last:border-r-0">
                        <div className="relative ml-auto w-full max-w-[180px]">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                          <input
                            value={getDisplayAmountForCell(row, col)}
                            onChange={(event) =>
                              setAmountDraftByCell((prev) => ({
                                ...prev,
                                [getAmountCellKey(row.id, col.id)]: formatCurrencyWhileTyping(event.target.value),
                              }))
                            }
                            onBlur={(event) =>
                              setAmountDraftByCell((prev) => ({
                                ...prev,
                                [getAmountCellKey(row.id, col.id)]: formatCurrencyInput(event.target.value),
                              }))
                            }
                            placeholder="0.00"
                            inputMode="decimal"
                            className="w-full rounded-md border border-slate-200 pl-7 pr-2 py-1.5 text-right text-base text-slate-700 focus:border-slate-400 focus:outline-none"
                          />
                        </div>
                      </td>
                    ))}
                    <td className="border-b border-slate-200 p-2">
                      <div className="h-full min-h-[44px] rounded-md border-2 border-dashed border-slate-200 bg-slate-50/50" />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="border-b border-r border-slate-200 px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setManualLineItems((prev) => [
                          ...prev,
                          {
                            id: `line-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                            label: "",
                          },
                        ])
                      }
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      + Add line item
                    </button>
                  </td>
                  {bidColumns.map((col) => (
                    <td key={`line-item-add-${col.id}`} className="border-b border-r border-slate-200 px-4 py-2.5 last:border-r-0" />
                  ))}
                  <td className="border-b border-slate-200 p-2">
                    <div className="h-full min-h-[44px] rounded-md border-2 border-dashed border-slate-200 bg-slate-50/50" />
                  </td>
                </tr>
                <tr>
                  <td className="border-b border-r border-slate-200 bg-slate-50 px-4 py-2.5 text-base font-semibold text-slate-900">
                    Total
                  </td>
                  {bidColumns.map((col) => (
                    <td
                      key={`line-item-total-${col.id}`}
                      className="border-b border-r border-slate-200 bg-slate-50 px-4 py-2.5 text-right text-base font-semibold text-slate-900 last:border-r-0"
                    >
                      {totalByColumnId[col.id] !== null
                        ? `$${formatCurrencyInput(String(totalByColumnId[col.id]))}`
                        : "--"}
                    </td>
                  ))}
                  <td className="border-b border-slate-200 p-2">
                    <div className="h-full min-h-[44px] rounded-md border-2 border-dashed border-slate-200 bg-slate-50/50" />
                  </td>
                </tr>

                <tr>
                  <td className="border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-lg font-semibold text-slate-900">
                    Additional Bid Information
                  </td>
                  {bidColumns.map((col) => (
                    <td key={`additional-head-${col.id}`} className="border-b border-r border-slate-200 bg-slate-50 px-4 py-3 last:border-r-0" />
                  ))}
                  <td className="border-b border-slate-200 p-2">
                    <div className="h-full min-h-[44px] rounded-md border-2 border-dashed border-slate-200 bg-slate-50/50" />
                  </td>
                </tr>

                {ADDITIONAL_INFO_ROWS.map((row) => (
                  <tr key={row.key}>
                    <td className="border-b border-r border-slate-200 px-4 py-3 text-base font-medium text-slate-700">
                      {row.label}
                    </td>
                    {bidColumns.map((col) => (
                      <td key={`${row.key}-${col.id}`} className="border-b border-r border-slate-200 px-4 py-3 text-base text-slate-700 last:border-r-0">
                        {row.key === "attachments" ? (
                          "Download"
                        ) : (
                          <textarea
                            value={getDisplayAdditionalInfoForCell(row.key, col)}
                            onChange={(event) =>
                              setAdditionalInfoDraftByCell((prev) => ({
                                ...prev,
                                [getAdditionalInfoCellKey(row.key, col.id)]: event.target.value,
                              }))
                            }
                            rows={2}
                            className="w-full resize-y rounded-md border border-slate-200 px-2 py-1.5 text-sm leading-5 text-slate-700 focus:border-slate-400 focus:outline-none"
                          />
                        )}
                      </td>
                    ))}
                    <td className="border-b border-slate-200 p-2">
                      <div className="h-full min-h-[44px] rounded-md border-2 border-dashed border-slate-200 bg-slate-50/50" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
