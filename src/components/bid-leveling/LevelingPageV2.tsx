"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getBidLevelingProjectData } from "@/lib/bidding/leveling-store";
import type { BidLevelingProjectData, LevelingBid } from "@/lib/bidding/leveling-types";
import { getBidProjectIdForProject } from "@/lib/bidding/project-links";
import { useDirectoryData } from "@/components/directory/use-directory-data";

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
  isRemovable?: boolean;
  isPlaceholder?: boolean;
};

type LineItemRow = {
  id: string;
  label: string;
};

type InviteQuoteLineItem = {
  label: string;
  amount: string;
};

type AddedSubcontractorColumn = {
  id: string;
  subId: string | null;
  subName: string;
  status: string;
};

type ImportedEstimateUnitPrice = {
  costCodeCode: string;
  unitPrice: string;
  subcontractorName: string;
};

type UploadedBidDocument = {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  url: string;
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
const BID_DOCUMENTS_STORAGE_KEY = "bidDocumentsByCell";
const ESTIMATE_UNIT_PRICE_IMPORTS_STORAGE_KEY = "estimateUnitPriceImportsByProject";
const MIN_SUBCONTRACTOR_COLUMNS = 3;
const LINE_ITEM_COLUMN_WIDTH_PX = 420;
const SUBCONTRACTOR_COLUMN_MIN_WIDTH_PX = 280;
const ADD_COLUMN_CELL_WIDTH_PX = 168;

function normalizeLineItemLabel(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeSubcontractorName(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeCostCodeCode(value: string): string {
  return value.replace(/\D/g, "");
}

function extractTradeCostCode(tradeName: string): string {
  const match = tradeName.match(/^\d+(?:\s+\d+)*/);
  return match ? match[0].trim() : tradeName.trim();
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

function readBidDocumentsMap(): Record<string, UploadedBidDocument[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(BID_DOCUMENTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const next: Record<string, UploadedBidDocument[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue;
      next[key] = value.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Partial<UploadedBidDocument>;
        if (
          typeof row.id !== "string" ||
          typeof row.name !== "string" ||
          typeof row.size !== "number" ||
          typeof row.uploadedAt !== "string" ||
          typeof row.url !== "string"
        ) {
          return [];
        }
        return [
          {
            id: row.id,
            name: row.name,
            size: row.size,
            uploadedAt: row.uploadedAt,
            url: row.url,
          },
        ];
      });
    }
    return next;
  } catch {
    return {};
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readEstimateUnitPriceImportsMap(): Record<string, ImportedEstimateUnitPrice[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ESTIMATE_UNIT_PRICE_IMPORTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const next: Record<string, ImportedEstimateUnitPrice[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue;
      next[key] = value.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Partial<ImportedEstimateUnitPrice>;
        if (
          typeof row.costCodeCode !== "string" ||
          typeof row.unitPrice !== "string" ||
          typeof row.subcontractorName !== "string"
        ) {
          return [];
        }
        return [
          {
            costCodeCode: row.costCodeCode,
            unitPrice: row.unitPrice,
            subcontractorName: row.subcontractorName,
          },
        ];
      });
    }
    return next;
  } catch {
    return {};
  }
}

function writeEstimateUnitPriceImportsMap(map: Record<string, ImportedEstimateUnitPrice[]>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ESTIMATE_UNIT_PRICE_IMPORTS_STORAGE_KEY, JSON.stringify(map));
}

export default function LevelingPageV2({
  hideCreateBidForm = false,
  leftNavItems,
}: {
  hideCreateBidForm?: boolean;
  leftNavItems?: string[];
}) {
  const searchParams = useSearchParams();
  const { data: directoryData } = useDirectoryData();
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
  const [bidDocumentsByCell, setBidDocumentsByCell] = useState<Record<string, UploadedBidDocument[]>>(() =>
    readBidDocumentsMap()
  );
  const [amountDraftByCell, setAmountDraftByCell] = useState<Record<string, string>>({});
  const [additionalInfoDraftByCell, setAdditionalInfoDraftByCell] = useState<Record<string, string>>({});
  const [addedColumnsByTradeId, setAddedColumnsByTradeId] = useState<Record<string, AddedSubcontractorColumn[]>>({});
  const [hiddenSubIdsByTradeId, setHiddenSubIdsByTradeId] = useState<Record<string, string[]>>({});
  const [estimateImportsByProject, setEstimateImportsByProject] = useState<Record<string, ImportedEstimateUnitPrice[]>>(
    () => readEstimateUnitPriceImportsMap()
  );
  const [subcontractorSearch, setSubcontractorSearch] = useState("");
  const [subcontractorSearchOpen, setSubcontractorSearchOpen] = useState(false);
  const [activeSearchAnchorId, setActiveSearchAnchorId] = useState<string | null>(null);
  const subcontractorSearchRef = useRef<HTMLTableSectionElement | null>(null);
  const [openActionsColumnId, setOpenActionsColumnId] = useState<string | null>(null);

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
  const addedColumnsForTrade = useMemo(
    () => (selectedTrade ? addedColumnsByTradeId[selectedTrade.id] ?? [] : []),
    [addedColumnsByTradeId, selectedTrade]
  );
  const hiddenSubIdsForTrade = useMemo(
    () => (selectedTrade ? new Set(hiddenSubIdsByTradeId[selectedTrade.id] ?? []) : new Set<string>()),
    [hiddenSubIdsByTradeId, selectedTrade]
  );
  const overlayStateKey = `${openActionsColumnId ?? ""}:${subcontractorSearchOpen ? "1" : "0"}`;

  const bidColumns = useMemo(() => {
    if (!data || !selectedTrade) return [] as BidColumn[];
    const subNameById = new Map(
      data.projectSubs.map((sub) => [sub.id, sub.subcontractor?.company_name ?? "Subcontractor"])
    );
    const bidsBySubId = new Map(
      data.bids.filter((bid) => bid.trade_id === selectedTrade.id).map((bid) => [bid.sub_id, bid])
    );
    const submittedColumns: BidColumn[] = data.bids
      .filter(
        (bid) =>
          bid.trade_id === selectedTrade.id &&
          bid.status === "submitted" &&
          !hiddenSubIdsForTrade.has(bid.sub_id)
      )
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
    const visibleSubIds = new Set(submittedColumns.map((col) => col.subId).filter((value): value is string => Boolean(value)));
    const next = [...submittedColumns];
    addedColumnsForTrade.forEach((column) => {
      if (column.subId && visibleSubIds.has(column.subId)) return;
      const bid = column.subId ? (bidsBySubId.get(column.subId) ?? null) : null;
      next.push({
        id: column.id,
        bid,
        subId: column.subId,
        subName: column.subName,
        status: bid?.status ?? column.status,
        isRemovable: true,
      });
    });
    const placeholderCount = Math.max(0, MIN_SUBCONTRACTOR_COLUMNS - next.length);
    for (let index = 0; index < placeholderCount; index += 1) {
      next.push({
        id: `placeholder-sub-${selectedTrade.id}-${index + 1}`,
        bid: null,
        subId: null,
        subName: "Add Subcontractor",
        status: "not invited",
        isPlaceholder: true,
      });
    }
    return next;
  }, [addedColumnsForTrade, data, hiddenSubIdsForTrade, selectedTrade]);

  useEffect(() => {
    setSubcontractorSearch("");
    setSubcontractorSearchOpen(false);
    setActiveSearchAnchorId(null);
    setOpenActionsColumnId(null);
  }, [selectedTradeId]);

  useEffect(() => {
    if (!subcontractorSearchOpen && !openActionsColumnId) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const clickedActionsMenu = target?.closest("[data-leveling-sub-actions]") ?? null;
      if (clickedActionsMenu) return;
      if (!subcontractorSearchRef.current?.contains(event.target as Node)) {
        setSubcontractorSearchOpen(false);
        setOpenActionsColumnId(null);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [overlayStateKey]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== ESTIMATE_UNIT_PRICE_IMPORTS_STORAGE_KEY) return;
      setEstimateImportsByProject(readEstimateUnitPriceImportsMap());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key &&
        event.key !== QUOTE_LINE_ITEMS_STORAGE_KEY &&
        event.key !== BID_INCLUSIONS_STORAGE_KEY &&
        event.key !== BID_EXCLUSIONS_STORAGE_KEY &&
        event.key !== BID_DOCUMENTS_STORAGE_KEY
      ) {
        return;
      }
      setInviteQuoteLineItemsMap(readQuoteLineItemsMap());
      setInclusionsByCellKey(readBidTextByCellMap(BID_INCLUSIONS_STORAGE_KEY));
      setExclusionsByCellKey(readBidTextByCellMap(BID_EXCLUSIONS_STORAGE_KEY));
      setBidDocumentsByCell(readBidDocumentsMap());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const submittedCount = bidColumns.filter((col) => col.status === "submitted").length;
  const projectSubByNormalizedName = useMemo(() => {
    if (!data) return new Map<string, { id: string; name: string }>();
    return new Map(
      data.projectSubs.map((sub) => [
        normalizeSubcontractorName(sub.subcontractor?.company_name ?? "Subcontractor"),
        { id: sub.id, name: sub.subcontractor?.company_name ?? "Subcontractor" },
      ])
    );
  }, [data]);
  const visibleSubIds = useMemo(
    () => new Set(bidColumns.map((column) => column.subId).filter((value): value is string => Boolean(value))),
    [bidColumns]
  );
  const visibleSubNames = useMemo(
    () => new Set(bidColumns.map((column) => normalizeSubcontractorName(column.subName)).filter(Boolean)),
    [bidColumns]
  );
  const recommendedSubcontractors = useMemo(() => {
    if (!data || !selectedTrade) return [] as AddedSubcontractorColumn[];
    const subNameById = new Map(
      data.projectSubs.map((sub) => [sub.id, sub.subcontractor?.company_name ?? "Subcontractor"])
    );
    return data.bids
      .filter((bid) => bid.trade_id === selectedTrade.id && !visibleSubIds.has(bid.sub_id))
      .sort((a, b) => {
        const aHidden = hiddenSubIdsForTrade.has(a.sub_id) ? 0 : 1;
        const bHidden = hiddenSubIdsForTrade.has(b.sub_id) ? 0 : 1;
        if (aHidden !== bHidden) return aHidden - bHidden;
        const aName = subNameById.get(a.sub_id) ?? "";
        const bName = subNameById.get(b.sub_id) ?? "";
        return aName.localeCompare(bName);
      })
      .map((bid) => ({
        id: `recommended-${selectedTrade.id}-${bid.sub_id}`,
        subId: bid.sub_id,
        subName: subNameById.get(bid.sub_id) ?? "Subcontractor",
        status: bid.status,
      }));
  }, [data, hiddenSubIdsForTrade, selectedTrade, visibleSubIds]);
  const directoryMatches = useMemo(() => {
    const query = subcontractorSearch.trim().toLowerCase();
    if (!query || !directoryData) return [];
    return directoryData.companies
      .filter((company) => {
        const name = company.name ?? "";
        const trade = company.trade ?? "";
        return (
          name.toLowerCase().includes(query) ||
          trade.toLowerCase().includes(query) ||
          (company.city ?? "").toLowerCase().includes(query)
        );
      })
      .filter((company) => !visibleSubNames.has(normalizeSubcontractorName(company.name ?? "")))
      .slice(0, 12)
      .map((company) => {
        const matchedProjectSub = projectSubByNormalizedName.get(normalizeSubcontractorName(company.name ?? ""));
        return {
          id: `directory-${selectedTrade?.id ?? "trade"}-${company.id}`,
          subId: matchedProjectSub?.id ?? null,
          subName: matchedProjectSub?.name ?? company.name ?? "Subcontractor",
          status: matchedProjectSub?.id ? "invited" : "not invited",
          tradeLabel: company.trade ?? "",
          locationLabel: [company.city, company.state].filter(Boolean).join(", "),
        };
      });
  }, [directoryData, projectSubByNormalizedName, selectedTrade?.id, subcontractorSearch, visibleSubNames]);

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

  const displayLineItems = useMemo(() => {
    const rows: LineItemRow[] = [];
    if (!importedLineItemLabels.length) {
      rows.push({ id: "base-bid", label: "" });
    }
    importedLineItemLabels.forEach((label) => {
        rows.push({ id: `imported-${normalizeLineItemLabel(label)}`, label });
      });
    manualLineItems.forEach((item) => rows.push(item));
    return rows;
  }, [importedLineItemLabels, manualLineItems]);

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

  const getBidDocumentsForColumn = (col: BidColumn): UploadedBidDocument[] => {
    if (!col.subId || !data || !selectedTrade) return [];
    const key = `${data.project.id}:${selectedTrade.id}:${col.subId}`;
    return bidDocumentsByCell[key] ?? [];
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
    LINE_ITEM_COLUMN_WIDTH_PX + bidColumns.length * SUBCONTRACTOR_COLUMN_MIN_WIDTH_PX + ADD_COLUMN_CELL_WIDTH_PX;

  const handleRemoveSubcontractorColumn = (columnId: string) => {
    if (!selectedTrade) return;
    const targetColumn = bidColumns.find((column) => column.id === columnId) ?? null;
    setAddedColumnsByTradeId((prev) => ({
      ...prev,
      [selectedTrade.id]: (prev[selectedTrade.id] ?? []).filter((column) => column.id !== columnId),
    }));
    if (targetColumn?.subId) {
      setHiddenSubIdsByTradeId((prev) => ({
        ...prev,
        [selectedTrade.id]: Array.from(new Set([...(prev[selectedTrade.id] ?? []), targetColumn.subId!])),
      }));
    }
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
    setOpenActionsColumnId(null);
  };

  const handleAddSubcontractorColumn = (column: AddedSubcontractorColumn) => {
    if (!selectedTrade) return;
    if (column.subId) {
      setHiddenSubIdsByTradeId((prev) => ({
        ...prev,
        [selectedTrade.id]: (prev[selectedTrade.id] ?? []).filter((subId) => subId !== column.subId),
      }));
    }
    setAddedColumnsByTradeId((prev) => {
      const existing = prev[selectedTrade.id] ?? [];
      const alreadyExists = existing.some((item) =>
        column.subId
          ? item.subId === column.subId
          : normalizeSubcontractorName(item.subName) === normalizeSubcontractorName(column.subName)
      );
      if (alreadyExists) return prev;
      return {
        ...prev,
        [selectedTrade.id]: [...existing, column],
      };
    });
    setSubcontractorSearch("");
    setSubcontractorSearchOpen(false);
    setActiveSearchAnchorId(null);
  };

  const handleUseInEstimate = (column: BidColumn) => {
    if (!selectedTrade || !data) return;
    const totalByColumn = totalByColumnId[column.id];
    if (totalByColumn === null) return;
    const projectKey = data.project.id;
    const tradeCostCode = extractTradeCostCode(selectedTrade.trade_name ?? "");
    const imports = readEstimateUnitPriceImportsMap();
    const nextRows = (imports[projectKey] ?? []).filter(
      (row) => normalizeCostCodeCode(row.costCodeCode) !== normalizeCostCodeCode(tradeCostCode)
    );
    nextRows.push({
      costCodeCode: tradeCostCode,
      unitPrice: formatCurrencyInput(String(totalByColumn)),
      subcontractorName: column.subName,
    });
    const nextMap = {
      ...imports,
      [projectKey]: nextRows,
    };
    writeEstimateUnitPriceImportsMap(nextMap);
    setEstimateImportsByProject(nextMap);
    setOpenActionsColumnId(null);
  };

  const handleRemoveFromEstimate = () => {
    if (!selectedTrade || !data) return;
    const projectKey = data.project.id;
    const tradeCostCode = extractTradeCostCode(selectedTrade.trade_name ?? "");
    const imports = readEstimateUnitPriceImportsMap();
    const nextRows = (imports[projectKey] ?? []).filter(
      (row) => normalizeCostCodeCode(row.costCodeCode) !== normalizeCostCodeCode(tradeCostCode)
    );
    const nextMap = {
      ...imports,
      [projectKey]: nextRows,
    };
    writeEstimateUnitPriceImportsMap(nextMap);
    setEstimateImportsByProject(nextMap);
    setOpenActionsColumnId(null);
  };

  const usedInEstimateSubNameByTradeCode = useMemo(() => {
    if (!data) return new Map<string, string>();
    const rows = estimateImportsByProject[data.project.id] ?? [];
    return new Map(rows.map((row) => [normalizeCostCodeCode(row.costCodeCode), row.subcontractorName]));
  }, [data, estimateImportsByProject]);

  const renderSubcontractorSearchDropdown = () =>
    subcontractorSearchOpen ? (
      <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
        <div className="max-h-80 overflow-y-auto">
          <div className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Recommended
          </div>
          {recommendedSubcontractors.length ? (
            recommendedSubcontractors.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleAddSubcontractorColumn(item)}
                className="mb-1 w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50"
              >
                <div className="text-sm font-semibold text-slate-900">{item.subName}</div>
                <div className="text-xs text-slate-500">Status: {item.status}</div>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-slate-500">No invited subcontractors to recommend.</div>
          )}
          <div className="px-2 pb-2 pt-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Directory
          </div>
          {subcontractorSearch.trim().length ? (
            directoryMatches.length ? (
              directoryMatches.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    handleAddSubcontractorColumn({
                      id: `${item.id}-${Date.now()}`,
                      subId: item.subId,
                      subName: item.subName,
                      status: item.status,
                    })
                  }
                  className="mb-1 w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                >
                  <div className="text-sm font-semibold text-slate-900">{item.subName}</div>
                  <div className="text-xs text-slate-500">
                    {[item.tradeLabel, item.locationLabel].filter(Boolean).join(" · ") || "Directory match"}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-slate-500">No directory matches found.</div>
            )
          ) : (
            <div className="px-3 py-2 text-sm text-slate-500">Type to search the subcontractor directory.</div>
          )}
        </div>
      </div>
    ) : null;

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
              <thead ref={subcontractorSearchRef}>
                <tr>
                  <th className="border-b border-r border-slate-200 bg-slate-50 p-4 text-left align-top">
                    <div className="text-sm text-slate-500">
                      Due: {formatDate(data.project.due_date)}
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">{submittedCount} Bids Submitted</div>
                  </th>
                  {bidColumns.map((col) => (
                    <th key={`head-${col.id}`} className="border-b border-r border-slate-200 bg-slate-50 p-4 text-left align-top last:border-r-0">
                      {col.isPlaceholder ? (
                        <div className="relative pt-1">
                          <input
                            value={activeSearchAnchorId === col.id ? subcontractorSearch : ""}
                            onChange={(event) => {
                              setActiveSearchAnchorId(col.id);
                              setSubcontractorSearch(event.target.value);
                              setSubcontractorSearchOpen(true);
                            }}
                            onFocus={() => {
                              setSubcontractorSearchOpen(true);
                              setActiveSearchAnchorId(col.id);
                            }}
                            placeholder="Add Subcontractor"
                            className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none"
                          />
                          {activeSearchAnchorId === col.id ? renderSubcontractorSearchDropdown() : null}
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="whitespace-normal break-words text-2xl font-semibold text-slate-900">
                                {col.subName}
                              </div>
                              {selectedTrade &&
                              usedInEstimateSubNameByTradeCode.get(
                                normalizeCostCodeCode(extractTradeCostCode(selectedTrade.trade_name ?? ""))
                              ) === col.subName ? (
                                <div className="mt-2">
                                  <span className="inline-flex rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                                    Used In Estimate
                                  </span>
                                </div>
                              ) : null}
                            </div>
                            <div className="relative" data-leveling-sub-actions>
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenActionsColumnId((prev) => (prev === col.id ? null : col.id))
                                }
                                className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                aria-label="Open subcontractor actions"
                                title="Actions"
                              >
                                <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
                                  <path d="M10 4.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5ZM10 11.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5ZM11.25 17.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z" />
                                </svg>
                              </button>
                              {openActionsColumnId === col.id ? (
                                <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                                  {selectedTrade &&
                                  usedInEstimateSubNameByTradeCode.get(
                                    normalizeCostCodeCode(extractTradeCostCode(selectedTrade.trade_name ?? ""))
                                  ) === col.subName ? (
                                    <button
                                      type="button"
                                      onClick={handleRemoveFromEstimate}
                                      className="flex w-full rounded-md px-3 py-2 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"
                                    >
                                      Remove From Estimate Page
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleUseInEstimate(col)}
                                      className="flex w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                                    >
                                      Use in Estimate
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSubcontractorColumn(col.id)}
                                    className="flex w-full rounded-md px-3 py-2 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </>
                      )}
                    </th>
                  ))}
                  <th className="border-b border-slate-200 bg-slate-50 p-3 align-top">
                    <div className="relative">
                      <input
                        value={activeSearchAnchorId === "add-column" ? subcontractorSearch : ""}
                        onChange={(event) => {
                          setActiveSearchAnchorId("add-column");
                          setSubcontractorSearch(event.target.value);
                          setSubcontractorSearchOpen(true);
                        }}
                        onFocus={() => {
                          setSubcontractorSearchOpen(true);
                          setActiveSearchAnchorId("add-column");
                        }}
                        placeholder="Add Subcontractor"
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none"
                      />
                      {activeSearchAnchorId === "add-column" ? renderSubcontractorSearchDropdown() : null}
                    </div>
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
                          (() => {
                            const documents = getBidDocumentsForColumn(col);
                            if (!documents.length) {
                              return <span className="text-sm text-slate-400">No attachments</span>;
                            }
                            return (
                              <div className="space-y-2">
                                {documents.map((document) => (
                                  <a
                                    key={document.id}
                                    href={document.url}
                                    download={document.name}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    <div className="truncate">{document.name}</div>
                                    <div className="text-xs text-slate-500">{formatFileSize(document.size)}</div>
                                  </a>
                                ))}
                              </div>
                            );
                          })()
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
