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
  bid: LevelingBid;
  subName: string;
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

  const bidColumns = useMemo(() => {
    if (!data || !selectedTrade) return [] as BidColumn[];
    const subNameById = new Map(
      data.projectSubs.map((sub) => [sub.id, sub.subcontractor?.company_name ?? "Subcontractor"])
    );
    return data.bids
      .filter((bid) => bid.trade_id === selectedTrade.id)
      .sort((a, b) => {
        const aAmount = a.base_bid_amount ?? Number.POSITIVE_INFINITY;
        const bAmount = b.base_bid_amount ?? Number.POSITIVE_INFINITY;
        if (aAmount !== bAmount) return aAmount - bAmount;
        return (subNameById.get(a.sub_id) ?? "").localeCompare(subNameById.get(b.sub_id) ?? "");
      })
      .map((bid) => ({
        bid,
        subName: subNameById.get(bid.sub_id) ?? "Subcontractor",
      }));
  }, [data, selectedTrade]);

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

  const submittedCount = bidColumns.filter((col) => col.bid.status === "submitted").length;

  const inviteLineItemsByBidId = useMemo(() => {
    if (!data || !selectedTrade) return {} as Record<string, InviteQuoteLineItem[]>;
    const next: Record<string, InviteQuoteLineItem[]> = {};
    bidColumns.forEach((col) => {
      const key = `${data.project.id}:${selectedTrade.id}:${col.bid.sub_id}`;
      next[col.bid.id] = inviteQuoteLineItemsMap[key] ?? [];
    });
    return next;
  }, [bidColumns, data, inviteQuoteLineItemsMap, selectedTrade]);

  const importedLineItemLabels = useMemo(() => {
    const labels: string[] = [];
    const seen = new Set<string>();
    bidColumns.forEach((col) => {
      const items = inviteLineItemsByBidId[col.bid.id] ?? [];
      items.forEach((item) => {
        const normalized = normalizeLineItemLabel(item.label);
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        labels.push(item.label.trim());
      });
    });
    return labels;
  }, [bidColumns, inviteLineItemsByBidId]);

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

  const getInitialAmountForCell = (row: LineItemRow, bid: LevelingBid): string => {
    if (row.id === "base-bid") {
      return bid.base_bid_amount !== null && Number.isFinite(bid.base_bid_amount)
        ? formatCurrencyInput(String(bid.base_bid_amount))
        : "";
    }
    const items = inviteLineItemsByBidId[bid.id] ?? [];
    const match = items.find(
      (item) => normalizeLineItemLabel(item.label) === normalizeLineItemLabel(row.label)
    );
    return match ? formatCurrencyInput(match.amount) : "";
  };

  const getDisplayAmountForCell = (row: LineItemRow, bid: LevelingBid): string => {
    const key = getAmountCellKey(row.id, bid.id);
    return amountDraftByCell[key] ?? getInitialAmountForCell(row, bid);
  };

  const getInitialAdditionalInfoForCell = (rowKey: AdditionalInfoRowKey, bid: LevelingBid): string => {
    if (rowKey === "comments") return bid.notes ?? "";
    if (rowKey === "inclusions") {
      const key = `${data.project.id}:${selectedTrade?.id}:${bid.sub_id}`;
      return inclusionsByCellKey[key] ?? "Labor, material, and equipment per plans/specs.";
    }
    if (rowKey === "exclusions") {
      const key = `${data.project.id}:${selectedTrade?.id}:${bid.sub_id}`;
      return exclusionsByCellKey[key] ?? "Overtime and out-of-sequence work excluded.";
    }
    return "";
  };

  const getDisplayAdditionalInfoForCell = (rowKey: AdditionalInfoRowKey, bid: LevelingBid): string => {
    const key = getAdditionalInfoCellKey(rowKey, bid.id);
    return additionalInfoDraftByCell[key] ?? getInitialAdditionalInfoForCell(rowKey, bid);
  };

  const totalByBidId: Record<string, number | null> = {};
  bidColumns.forEach((col) => {
    let sum = 0;
    let hasValue = false;
    displayLineItems.forEach((row) => {
      const parsed = parseCurrencyInput(getDisplayAmountForCell(row, col.bid));
      if (parsed === null) return;
      sum += parsed;
      hasValue = true;
    });
    totalByBidId[col.bid.id] = hasValue ? sum : null;
  });

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
            <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-0">
              <colgroup>
                <col style={{ width: "34%" }} />
                {bidColumns.map((col) => (
                  <col key={col.bid.id} style={{ width: `${66 / Math.max(1, bidColumns.length)}%` }} />
                ))}
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
                    <th key={`head-${col.bid.id}`} className="border-b border-r border-slate-200 bg-slate-50 p-4 text-left align-top last:border-r-0">
                      <div className="text-2xl font-semibold text-slate-900">{col.subName}</div>
                      <div className="mt-1 text-sm text-slate-500">{col.bid.status}</div>
                    </th>
                  ))}
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
                      <td key={`${row.id}-${col.bid.id}`} className="border-b border-r border-slate-200 px-4 py-2.5 text-right text-base text-slate-700 last:border-r-0">
                        <div className="relative ml-auto w-full max-w-[180px]">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                          <input
                            value={getDisplayAmountForCell(row, col.bid)}
                            onChange={(event) =>
                              setAmountDraftByCell((prev) => ({
                                ...prev,
                                [getAmountCellKey(row.id, col.bid.id)]: formatCurrencyWhileTyping(event.target.value),
                              }))
                            }
                            onBlur={(event) =>
                              setAmountDraftByCell((prev) => ({
                                ...prev,
                                [getAmountCellKey(row.id, col.bid.id)]: formatCurrencyInput(event.target.value),
                              }))
                            }
                            placeholder="0.00"
                            inputMode="decimal"
                            className="w-full rounded-md border border-slate-200 pl-7 pr-2 py-1.5 text-right text-base text-slate-700 focus:border-slate-400 focus:outline-none"
                          />
                        </div>
                      </td>
                    ))}
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
                    <td key={`line-item-add-${col.bid.id}`} className="border-b border-r border-slate-200 px-4 py-2.5 last:border-r-0" />
                  ))}
                </tr>
                <tr>
                  <td className="border-b border-r border-slate-200 bg-slate-50 px-4 py-2.5 text-base font-semibold text-slate-900">
                    Total
                  </td>
                  {bidColumns.map((col) => (
                    <td
                      key={`line-item-total-${col.bid.id}`}
                      className="border-b border-r border-slate-200 bg-slate-50 px-4 py-2.5 text-right text-base font-semibold text-slate-900 last:border-r-0"
                    >
                      {totalByBidId[col.bid.id] !== null
                        ? `$${formatCurrencyInput(String(totalByBidId[col.bid.id]))}`
                        : "--"}
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-lg font-semibold text-slate-900">
                    Additional Bid Information
                  </td>
                  {bidColumns.map((col) => (
                    <td key={`additional-head-${col.bid.id}`} className="border-b border-r border-slate-200 bg-slate-50 px-4 py-3 last:border-r-0" />
                  ))}
                </tr>

                {ADDITIONAL_INFO_ROWS.map((row) => (
                  <tr key={row.key}>
                    <td className="border-b border-r border-slate-200 px-4 py-3 text-base font-medium text-slate-700">
                      {row.label}
                    </td>
                    {bidColumns.map((col) => (
                      <td key={`${row.key}-${col.bid.id}`} className="border-b border-r border-slate-200 px-4 py-3 text-base text-slate-700 last:border-r-0">
                        {row.key === "attachments" ? (
                          "Download"
                        ) : (
                          <textarea
                            value={getDisplayAdditionalInfoForCell(row.key, col.bid)}
                            onChange={(event) =>
                              setAdditionalInfoDraftByCell((prev) => ({
                                ...prev,
                                [getAdditionalInfoCellKey(row.key, col.bid.id)]: event.target.value,
                              }))
                            }
                            rows={2}
                            className="w-full resize-y rounded-md border border-slate-200 px-2 py-1.5 text-sm leading-5 text-slate-700 focus:border-slate-400 focus:outline-none"
                          />
                        )}
                      </td>
                    ))}
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
