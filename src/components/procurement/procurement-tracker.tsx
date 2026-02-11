"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  PROCUREMENT_STATUS_LABELS,
  PROCUREMENT_STATUS_ORDER,
  ProcurementItem,
  ProcurementItemInput,
  ProcurementNoteEntry,
  ProcurementStatus,
} from "@/lib/procurement/types";
import { createItem, deleteItem, listItems, updateItem } from "@/lib/procurement/store";
import { isAtRisk } from "@/lib/procurement/risk";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const statusRank = new Map(PROCUREMENT_STATUS_ORDER.map((status, index) => [status, index]));

const trendData = {
  total: { delta: 3, label: "vs last week" },
  approved: { delta: 1, label: "vs last week" },
  ordered: { delta: 0, label: "vs last week" },
  atRisk: { delta: 2, label: "vs last week" },
  lead: { delta: -1, label: "vs last week" },
};

const trendLabel = (delta: number) => {
  if (delta > 0) return `↗ +${delta}`;
  if (delta < 0) return `↘ ${delta}`;
  return "→ 0";
};

const statusClass = (status: ProcurementStatus) => {
  switch (status) {
    case "awaiting_approval":
      return "border-[hsl(var(--status-awaiting))] bg-[hsl(var(--status-awaiting-bg))] text-[hsl(var(--status-awaiting-foreground))]";
    case "approved":
      return "border-[hsl(var(--status-approved))] bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]";
    case "ordered":
      return "border-[hsl(var(--status-ordered))] bg-[hsl(var(--status-ordered-bg))] text-[hsl(var(--status-ordered-foreground))]";
    case "in_production":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "shipped":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "delivered":
      return "border-[hsl(var(--status-delivered))] bg-[hsl(var(--status-delivered-bg))] text-[hsl(var(--status-delivered-foreground))]";
    case "complete":
      return "border-green-200 bg-green-50 text-green-700";
    case "on_hold":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "canceled":
      return "border-zinc-200 bg-zinc-50 text-zinc-700";
    default:
      return "border-black/10 bg-black/5 text-black/70";
  }
};

const riskClass =
  "border-[hsl(var(--status-risk))] bg-[hsl(var(--status-risk-bg))] text-[hsl(var(--status-risk-foreground))]";

const timelineSteps = [
  { key: "awaiting_approval", label: "Awaiting Approval" },
  { key: "approved", label: "Approved" },
  { key: "ordered", label: "Ordered" },
  { key: "delivered", label: "Delivered" },
] as const;

type Draft = {
  item_name: string;
  vendor_name: string;
  status: ProcurementStatus;
  need_by_date: string;
  lead_time_days: string;
  approved_date: string;
  ordered_date: string;
  expected_delivery_date: string;
  actual_delivery_date: string;
  po_number: string;
  notes: string;
  received_by: string;
  received_date: string;
  qc_status: "" | "pass" | "fail" | "hold" | "needs_review";
  qc_notes: string;
  qc_match_submittals: boolean;
};

const emptyDraft = (): Draft => ({
  item_name: "",
  vendor_name: "",
  status: "awaiting_approval",
  need_by_date: "",
  lead_time_days: "",
  approved_date: "",
  ordered_date: "",
  expected_delivery_date: "",
  actual_delivery_date: "",
  po_number: "",
  notes: "",
  received_by: "",
  received_date: "",
  qc_status: "",
  qc_notes: "",
  qc_match_submittals: false,
});

const draftFromItem = (item: ProcurementItem): Draft => ({
  item_name: item.item_name,
  vendor_name: item.vendor_name,
  status: item.status,
  need_by_date: item.need_by_date ?? "",
  lead_time_days: item.lead_time_days?.toString() ?? "",
  approved_date: item.approved_date ?? "",
  ordered_date: item.ordered_date ?? "",
  expected_delivery_date: item.expected_delivery_date ?? "",
  actual_delivery_date: item.actual_delivery_date ?? "",
  po_number: item.po_number ?? "",
  notes: item.notes ?? "",
  received_by: item.received_by ?? "",
  received_date: item.received_date ?? "",
  qc_status: item.qc_status ?? "",
  qc_notes: item.qc_notes ?? "",
  qc_match_submittals: item.qc_match_submittals ?? false,
});

const toNullableString = (value: string) => (value.trim() ? value.trim() : null);

const payloadFromDraft = (draft: Draft): ProcurementItemInput => {
  const leadTime = draft.lead_time_days.trim() ? Number(draft.lead_time_days) : Number.NaN;
  return {
    item_name: draft.item_name.trim(),
    vendor_name: draft.vendor_name.trim(),
    status: draft.status,
    need_by_date: toNullableString(draft.need_by_date),
    lead_time_days: Number.isFinite(leadTime) ? leadTime : null,
    approved_date: toNullableString(draft.approved_date),
    ordered_date: toNullableString(draft.ordered_date),
    expected_delivery_date: toNullableString(draft.expected_delivery_date),
    actual_delivery_date: toNullableString(draft.actual_delivery_date),
    po_number: toNullableString(draft.po_number),
    notes: toNullableString(draft.notes),
    received_by: toNullableString(draft.received_by),
    received_date: toNullableString(draft.received_date),
    qc_status: draft.qc_status ? draft.qc_status : null,
    qc_notes: toNullableString(draft.qc_notes),
    qc_match_submittals: draft.qc_match_submittals,
  };
};

const formatDate = (value: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return dateFormatter.format(parsed);
};

const toDateInput = (value: Date) => value.toISOString().slice(0, 10);

const addDays = (dateString: string, days: number) => {
  const base = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return "";
  base.setUTCDate(base.getUTCDate() + days);
  return toDateInput(base);
};

const subtractDays = (dateString: string, days: number) => {
  const base = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return "";
  base.setUTCDate(base.getUTCDate() - days);
  return toDateInput(base);
};

const calculateExpectedDelivery = (nextDraft: Draft): Draft => {
  const leadTime = nextDraft.lead_time_days.trim() ? Number(nextDraft.lead_time_days) : Number.NaN;
  if (!Number.isFinite(leadTime)) {
    return { ...nextDraft, expected_delivery_date: "" };
  }
  if (nextDraft.ordered_date) {
    return { ...nextDraft, expected_delivery_date: addDays(nextDraft.ordered_date, leadTime) };
  }
  if (nextDraft.need_by_date) {
    return { ...nextDraft, expected_delivery_date: subtractDays(nextDraft.need_by_date, leadTime) };
  }
  return nextDraft;
};

type Props = {
  projectId: string;
};

export default function ProcurementTracker({ projectId }: Props) {
  const params = useParams();
  const routeProjectId =
    typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const effectiveProjectId = projectId || routeProjectId || "";
  const [items, setItems] = useState<ProcurementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProcurementStatus>("all");
  const [sortBy, setSortBy] = useState<
    | "need_by"
    | "status"
    | "lead_time"
    | "item_name"
    | "vendor_name"
    | "approved_date"
    | "ordered_date"
    | "expected_delivery_date"
  >("need_by");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [initialDraft, setInitialDraft] = useState<Draft>(emptyDraft());
  const [initialNotesHistory, setInitialNotesHistory] = useState<ProcurementNoteEntry[]>([]);
  const [notesHistoryDraft, setNotesHistoryDraft] = useState<ProcurementNoteEntry[]>([]);
  const [newNote, setNewNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<"" | ProcurementStatus>("");

  const refreshItems = useCallback(async () => {
    setLoading(true);
    if (!effectiveProjectId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const data = await listItems(effectiveProjectId);
    setItems(data);
    setLoading(false);
  }, [effectiveProjectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshItems();
  }, [refreshItems]);

  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOpen]);

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = items.filter((item) => {
      const matchesSearch =
        !query ||
        item.item_name.toLowerCase().includes(query) ||
        item.vendor_name.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    const sorted = [...filtered].sort((a, b) => {
      let result = 0;
      if (sortBy === "status") {
        result = (statusRank.get(a.status) ?? 0) - (statusRank.get(b.status) ?? 0);
      } else if (sortBy === "lead_time") {
        const aLead = a.lead_time_days ?? Number.MAX_SAFE_INTEGER;
        const bLead = b.lead_time_days ?? Number.MAX_SAFE_INTEGER;
        result = aLead - bLead;
      } else if (sortBy === "item_name") {
        result = a.item_name.localeCompare(b.item_name);
      } else if (sortBy === "vendor_name") {
        result = a.vendor_name.localeCompare(b.vendor_name);
      } else if (sortBy === "approved_date") {
        const aDate = a.approved_date ? new Date(a.approved_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bDate = b.approved_date ? new Date(b.approved_date).getTime() : Number.MAX_SAFE_INTEGER;
        result = aDate - bDate;
      } else if (sortBy === "ordered_date") {
        const aDate = a.ordered_date ? new Date(a.ordered_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bDate = b.ordered_date ? new Date(b.ordered_date).getTime() : Number.MAX_SAFE_INTEGER;
        result = aDate - bDate;
      } else if (sortBy === "expected_delivery_date") {
        const aDate = a.expected_delivery_date
          ? new Date(a.expected_delivery_date).getTime()
          : Number.MAX_SAFE_INTEGER;
        const bDate = b.expected_delivery_date
          ? new Date(b.expected_delivery_date).getTime()
          : Number.MAX_SAFE_INTEGER;
        result = aDate - bDate;
      } else {
        const aDate = a.need_by_date ? new Date(a.need_by_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bDate = b.need_by_date ? new Date(b.need_by_date).getTime() : Number.MAX_SAFE_INTEGER;
        result = aDate - bDate;
      }
      return sortDirection === "asc" ? result : result * -1;
    });

    return sorted;
  }, [items, searchTerm, statusFilter, sortBy, sortDirection]);

  const atRiskCount = useMemo(() => items.filter((item) => isAtRisk(item)).length, [items]);

  const approvedCount = useMemo(
    () =>
      items.filter((item) => {
        const rank = statusRank.get(item.status) ?? 0;
        const approvedRank = statusRank.get("approved") ?? 0;
        const completeRank = statusRank.get("complete") ?? 0;
        return rank >= approvedRank && rank <= completeRank;
      }).length,
    [items]
  );

  const orderedCount = useMemo(
    () =>
      items.filter((item) => {
        if (item.ordered_date) return true;
        const rank = statusRank.get(item.status) ?? 0;
        const orderedRank = statusRank.get("ordered") ?? 0;
        const completeRank = statusRank.get("complete") ?? 0;
        return rank >= orderedRank && rank <= completeRank;
      }).length,
    [items]
  );

  const longestLeadTime = useMemo(() => {
    const leadTimes = items.map((item) => item.lead_time_days).filter((value): value is number => value !== null);
    if (!leadTimes.length) return null;
    return Math.max(...leadTimes);
  }, [items]);

  const openNewModal = () => {
    const nextDraft = emptyDraft();
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
    setInitialNotesHistory([]);
    setNotesHistoryDraft([]);
    setEditingId(null);
    setNewNote("");
    setError(null);
    setModalOpen(true);
  };

  const toggleSort = (
    key:
      | "need_by"
      | "status"
      | "lead_time"
      | "item_name"
      | "vendor_name"
      | "approved_date"
      | "ordered_date"
      | "expected_delivery_date"
  ) => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDirection("asc");
    }
  };

  const sortIndicator = (key: typeof sortBy) => {
    if (sortBy !== key) return "";
    return sortDirection === "asc" ? "▲" : "▼";
  };

  const openEditModal = (item: ProcurementItem) => {
    const nextDraft = draftFromItem(item);
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
    const nextNotesHistory = item.notes_history ? [...item.notes_history] : [];
    setInitialNotesHistory(nextNotesHistory);
    setNotesHistoryDraft(nextNotesHistory);
    setEditingId(item.id);
    setNewNote("");
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setInitialDraft(emptyDraft());
    setInitialNotesHistory([]);
    setNotesHistoryDraft([]);
    setNewNote("");
    setError(null);
  };

  const hasUnsavedChanges = () => {
    const draftChanged = JSON.stringify(draft) !== JSON.stringify(initialDraft);
    const historyChanged = JSON.stringify(notesHistoryDraft) !== JSON.stringify(initialNotesHistory);
    const newNotePending = Boolean(newNote.trim());
    return draftChanged || historyChanged || newNotePending;
  };

  const handleCloseRequest = () => {
    if (hasUnsavedChanges()) {
      const confirmed = window.confirm("You have unsaved changes. Discard them?");
      if (!confirmed) return;
    }
    closeModal();
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const noteEntry: ProcurementNoteEntry = {
      note: newNote.trim(),
      created_at: new Date().toISOString(),
    };
    setNotesHistoryDraft((prev) => [noteEntry, ...prev]);
    setDraft((prev) => ({ ...prev, notes: noteEntry.note }));
    setNewNote("");
  };

  const handleDeleteNote = (index: number) => {
    const nextHistory = notesHistoryDraft.filter((_, entryIndex) => entryIndex !== index);
    setNotesHistoryDraft(nextHistory);
    const nextLatest = nextHistory[0]?.note ?? "";
    setDraft((prev) => ({ ...prev, notes: nextLatest }));
  };

  const handleSave = async () => {
    if (!draft.item_name.trim() || !draft.vendor_name.trim() || !draft.need_by_date.trim()) {
      setError("Item name, vendor, and need-by date are required.");
      return;
    }

    const payload = payloadFromDraft(draft);

    if (editingId) {
      await updateItem(editingId, { ...payload, notes_history: notesHistoryDraft });
    } else {
      if (!effectiveProjectId) {
        setError("Project context is missing. Open this page from a project.");
        return;
      }
      await createItem(effectiveProjectId, { ...payload, notes_history: notesHistoryDraft });
    }

    await refreshItems();
    closeModal();
  };

  const handleArchive = async (item: ProcurementItem) => {
    const confirmed = window.confirm(`Archive ${item.item_name}?`);
    if (!confirmed) return;
    await deleteItem(item.id);
    await refreshItems();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  };

  const handleExport = () => {
    const headers = [
      "item_name",
      "vendor_name",
      "status",
      "approved_date",
      "ordered_date",
      "lead_time_days",
      "need_by_date",
      "expected_delivery_date",
      "actual_delivery_date",
      "received_by",
      "received_date",
      "qc_status",
      "qc_notes",
      "po_number",
      "notes",
    ];

    const rows = filteredItems.map((item) => ({
      item_name: item.item_name,
      vendor_name: item.vendor_name,
      status: item.status,
      approved_date: item.approved_date ?? "",
      ordered_date: item.ordered_date ?? "",
      lead_time_days: item.lead_time_days?.toString() ?? "",
      need_by_date: item.need_by_date ?? "",
      expected_delivery_date: item.expected_delivery_date ?? "",
      actual_delivery_date: item.actual_delivery_date ?? "",
      received_by: item.received_by ?? "",
      received_date: item.received_date ?? "",
      qc_status: item.qc_status ?? "",
      qc_notes: item.qc_notes ?? "",
      po_number: item.po_number ?? "",
      notes: item.notes ?? "",
    }));

    const escape = (value: string) => {
      if (value.includes('"') || value.includes(",") || value.includes("\n")) {
        return `"${value.replace(/\"/g, '""')}"`;
      }
      return value;
    };

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers.map((header) => escape(String(row[header as keyof typeof row] ?? ""))).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `procurement-${effectiveProjectId || "project"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const updateDraft = (patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const updateDraftAuto = (patch: Partial<Draft>) => {
    setDraft((prev) => calculateExpectedDelivery({ ...prev, ...patch }));
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id));

  const handleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredItems.forEach((item) => next.delete(item.id));
      } else {
        filteredItems.forEach((item) => next.add(item.id));
      }
      return next;
    });
  };

  const bulkUpdate = async (patch: Partial<ProcurementItemInput>) => {
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map((id) => updateItem(id, patch)));
    await refreshItems();
    setSelectedIds(new Set());
    setBulkStatus("");
  };

  const handleBulkApprove = async () => {
    const today = new Date().toISOString().slice(0, 10);
    await bulkUpdate({ status: "approved", approved_date: today });
  };

  const handleBulkOrdered = async () => {
    const today = new Date().toISOString().slice(0, 10);
    await bulkUpdate({ status: "ordered", ordered_date: today });
  };

  const handleBulkArchive = async () => {
    const confirmed = window.confirm(`Archive ${selectedIds.size} items?`);
    if (!confirmed) return;
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map((id) => deleteItem(id)));
    await refreshItems();
    setSelectedIds(new Set());
    setBulkStatus("");
  };

  const handleBulkStatusChange = async (status: ProcurementStatus) => {
    await bulkUpdate({ status });
  };

  const handleQuickApprove = async (item: ProcurementItem) => {
    const today = new Date().toISOString().slice(0, 10);
    await updateItem(item.id, {
      status: "approved",
      approved_date: item.approved_date ?? today,
    });
    await refreshItems();
  };

  const handleQuickOrdered = async (item: ProcurementItem) => {
    const today = new Date().toISOString().slice(0, 10);
    const expected = item.lead_time_days
      ? addDays(item.ordered_date ?? today, item.lead_time_days)
      : item.expected_delivery_date ?? "";
    await updateItem(item.id, {
      status: "ordered",
      ordered_date: item.ordered_date ?? today,
      expected_delivery_date: expected || null,
    });
    await refreshItems();
  };

  const statusTimelineIndex = (status: ProcurementStatus) => {
    if (status === "awaiting_approval") return 0;
    if (status === "approved") return 1;
    if (status === "ordered" || status === "in_production" || status === "shipped") return 2;
    if (status === "delivered" || status === "complete") return 3;
    return 0;
  };

  const timelineIndex = statusTimelineIndex(draft.status);

  return (
    <main className="space-y-8 px-12 py-8 font-[var(--font-inter)]">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-[32px] font-semibold tracking-tight text-slate-900">
            Procurement Tracking
          </h1>
          <p className="text-lg text-slate-500">
            Track and manage procurement items across your project.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-3 rounded-xl border border-[hsl(var(--ds-border))] bg-white px-5 py-3 text-base font-semibold text-slate-800 shadow-sm"
            onClick={handleExport}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="M7 10l5 5 5-5" />
              <path d="M12 15V3" />
            </svg>
            Export CSV
          </button>
          <button
            className="inline-flex items-center gap-3 rounded-xl bg-slate-900 px-6 py-3 text-base font-semibold text-white shadow"
            onClick={openNewModal}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            Add Item
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div
              key={`card-skel-${index}`}
              className="rounded-2xl border border-[hsl(var(--ds-border)/0.6)] bg-white p-1 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
            >
              <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-7 w-16 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-3 w-24 animate-pulse rounded bg-slate-200" />
            </div>
          ))
        ) : (
          <>
            <div className="rounded-2xl border border-[hsl(var(--ds-border)/0.6)] bg-white p-1 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between text-base text-slate-500">
                <span className="font-medium">Total Items</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--metric-total-bg))] text-[hsl(var(--metric-total))]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3h18v18H3z" />
                    <path d="M7 7h10v10H7z" />
                  </svg>
                </span>
              </div>
              <div className="mt-1 text-3xl font-semibold text-slate-900">{items.length}</div>
              <div className="mt-1 flex items-center gap-2 text-sm text-emerald-600">
                <span>{trendLabel(trendData.total.delta)}</span>
                <span className="text-slate-500">vs last week</span>
              </div>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--ds-border)/0.6)] bg-white p-1 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between text-base text-slate-500">
                <span className="font-medium">Approved</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved))]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </span>
              </div>
              <div className="mt-1 text-3xl font-semibold text-slate-900">{approvedCount}</div>
              <div className="mt-1 flex items-center gap-2 text-sm text-emerald-600">
                <span>{trendLabel(trendData.approved.delta)}</span>
                <span className="text-slate-500">vs last week</span>
              </div>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--ds-border)/0.6)] bg-white p-1 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between text-base text-slate-500">
                <span className="font-medium">Ordered</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--status-ordered-bg))] text-[hsl(var(--status-ordered))]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 7h13v10H3z" />
                    <path d="M16 10h4l2 3v4h-6z" />
                    <circle cx="7" cy="17" r="2" />
                    <circle cx="18" cy="17" r="2" />
                  </svg>
                </span>
              </div>
              <div className="mt-1 text-3xl font-semibold text-slate-900">{orderedCount}</div>
              <div className="mt-1 flex items-center gap-2 text-sm text-emerald-600">
                <span>{trendLabel(trendData.ordered.delta)}</span>
                <span className="text-slate-500">vs last week</span>
              </div>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--status-risk)/0.6)] bg-white p-1 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between text-base text-slate-500">
                <span className="font-medium">At Risk</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--status-risk-bg))] text-[hsl(var(--status-risk))]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                  </svg>
                </span>
              </div>
              <div className="mt-1 text-3xl font-semibold text-slate-900">{atRiskCount}</div>
              <div className="mt-1 flex items-center gap-2 text-sm text-[hsl(var(--status-risk))]">
                <span>{trendLabel(trendData.atRisk.delta)}</span>
                <span className="text-slate-500">vs last week</span>
              </div>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--ds-border)/0.6)] bg-white p-1 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between text-base text-slate-500">
                <span className="font-medium">Longest Lead</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </span>
              </div>
              <div className="mt-1 text-3xl font-semibold text-slate-900">
                {longestLeadTime ? `${longestLeadTime}d` : "—"}
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm text-emerald-600">
                <span>{trendLabel(trendData.lead.delta)}d</span>
                <span className="text-slate-500">vs last week</span>
              </div>
            </div>
          </>
        )}
      </section>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-2xl">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input
            className="w-full rounded-lg border border-[hsl(var(--ds-border))] bg-white py-2.5 pl-9 pr-3 text-base text-slate-700"
            placeholder="Search items or vendors..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <select
          className="min-w-[200px] rounded-lg border border-[hsl(var(--ds-border))] bg-white px-3 py-2.5 text-base text-slate-700"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "all" | ProcurementStatus)}
        >
          <option value="all">All Statuses</option>
          {PROCUREMENT_STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {PROCUREMENT_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <section className="space-y-4 rounded-xl border border-[hsl(var(--ds-border))] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-end gap-2" />

        {selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[hsl(var(--ds-border))] bg-[hsl(var(--status-delivered-bg))] px-3 py-2 text-base">
            <span className="font-medium text-slate-700">{selectedIds.size} selected</span>
            <button
              className="rounded border border-[hsl(var(--status-approved))] bg-white px-2.5 py-1 text-base text-[hsl(var(--status-approved-foreground))]"
              onClick={handleBulkApprove}
            >
              Bulk Approve
            </button>
            <button
              className="rounded border border-[hsl(var(--status-ordered))] bg-white px-2.5 py-1 text-base text-[hsl(var(--status-ordered-foreground))]"
              onClick={handleBulkOrdered}
            >
              Bulk Ordered
            </button>
            <select
              className="rounded border border-[hsl(var(--ds-border))] bg-white px-2.5 py-1 text-base"
              value={bulkStatus}
              onChange={(event) => {
                const value = event.target.value as ProcurementStatus;
                setBulkStatus(value);
                if (value) {
                  handleBulkStatusChange(value);
                }
              }}
            >
              <option value="">Change status...</option>
              {PROCUREMENT_STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {PROCUREMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <button
              className="ml-auto rounded border border-[hsl(var(--status-risk))] bg-white px-2.5 py-1 text-base text-[hsl(var(--status-risk-foreground))]"
              onClick={handleBulkArchive}
            >
              Archive Selected
            </button>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-base">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-[hsl(var(--ds-border))] text-base">
                <th className="w-10 px-3 py-2 align-middle">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-slate-900"
                    checked={allFilteredSelected}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-3 py-2 align-middle font-medium">
                  <button className="inline-flex items-center gap-2" onClick={() => toggleSort("item_name")}>
                    Item {sortIndicator("item_name")}
                  </button>
                </th>
                <th className="px-3 py-2 align-middle font-medium">
                  <button className="inline-flex items-center gap-2" onClick={() => toggleSort("vendor_name")}>
                    Vendor {sortIndicator("vendor_name")}
                  </button>
                </th>
                <th className="px-3 py-2 align-middle font-medium">
                  <button className="inline-flex items-center gap-2" onClick={() => toggleSort("status")}>
                    Status {sortIndicator("status")}
                  </button>
                </th>
                <th className="px-3 py-2 align-middle font-medium">
                  <button className="inline-flex items-center gap-2" onClick={() => toggleSort("need_by")}>
                    Need By {sortIndicator("need_by")}
                  </button>
                </th>
                <th className="px-3 py-2 align-middle font-medium">
                  <button className="inline-flex items-center gap-2" onClick={() => toggleSort("lead_time")}>
                    Lead Time {sortIndicator("lead_time")}
                  </button>
                </th>
                <th className="px-3 py-2 align-middle font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={`row-skel-${index}`} className="border-b border-[hsl(var(--ds-border))]">
                    <td className="px-3 py-1 align-middle" colSpan={7}>
                      <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10">
                    <div className="flex flex-col items-center gap-4 text-center text-base text-slate-500">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--status-delivered-bg))]">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M3 7h13v10H3z" />
                          <path d="M16 10h4l2 3v4h-6z" />
                          <circle cx="7" cy="17" r="2" />
                          <circle cx="18" cy="17" r="2" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-base font-medium text-slate-700">No procurement items yet</div>
                        <div>Add your first item to start tracking approvals and deliveries.</div>
                      </div>
                      <button
                        className="rounded-lg bg-slate-900 px-3 py-2 text-base font-medium text-white"
                        onClick={openNewModal}
                      >
                        Add Item
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-base text-slate-500" colSpan={7}>
                    No items match your filters. Try adjusting the search or status filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  const atRisk = isAtRisk(item);
                  const isExpanded = expandedIds.has(item.id);
                  const showApprove = item.status === "awaiting_approval";
                  const showOrdered = item.status === "approved";
                  const rowShade = index % 2 === 1 ? "bg-slate-50" : "bg-white";
                  return (
                    <Fragment key={item.id}>
                      <tr
                        className={`border-b border-[hsl(var(--ds-border))] ${rowShade} hover:bg-[hsl(var(--status-delivered-bg))]`}
                        onClick={() => toggleExpanded(item.id)}
                      >
                        <td className="px-3 py-1 align-middle">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-slate-900"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelected(item.id)}
                            onClick={(event) => event.stopPropagation()}
                          />
                        </td>
                        <td className="px-3 py-1 align-middle">
                          <div className="flex items-center gap-2">
                            <button
                              className="flex h-6 w-6 items-center justify-center rounded-full border border-[hsl(var(--ds-border))] text-slate-500"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleExpanded(item.id);
                              }}
                              type="button"
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className={`${isExpanded ? "rotate-90" : "rotate-0"} transition-transform`}
                              >
                                <path d="M9 6l6 6-6 6" />
                              </svg>
                            </button>
                            <div className="font-medium text-slate-900">
                              {item.item_name}
                              {atRisk ? (
                                <span className="ml-2 inline-flex items-center text-base text-[hsl(var(--status-risk))]">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                    <path d="M12 9v4" />
                                    <path d="M12 17h.01" />
                                  </svg>
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-1 align-middle text-slate-600">{item.vendor_name}</td>
                        <td className="px-3 py-1 align-middle">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-base font-medium ${statusClass(
                                item.status
                              )}`}
                            >
                              {PROCUREMENT_STATUS_LABELS[item.status]}
                            </span>
                            {atRisk ? (
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-base font-medium ${riskClass}`}
                              >
                                At Risk
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-1 align-middle text-slate-700">{formatDate(item.need_by_date)}</td>
                        <td className="px-3 py-1 align-middle text-slate-700">
                          {item.lead_time_days !== null ? `${item.lead_time_days} days` : "—"}
                        </td>
                        <td className="px-3 py-1 align-middle">
                          <div className="flex items-center justify-end gap-2">
                            {showApprove ? (
                              <button
                                className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--status-awaiting))] bg-[hsl(var(--status-awaiting-bg))] px-3 py-1 text-base text-[hsl(var(--status-awaiting-foreground))]"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleQuickApprove(item);
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" />
                                  <path d="m9 12 2 2 4-4" />
                                </svg>
                                Approve
                              </button>
                            ) : null}
                            {showOrdered ? (
                              <button
                                className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--status-ordered))] bg-[hsl(var(--status-ordered-bg))] px-3 py-1 text-base text-[hsl(var(--status-ordered-foreground))]"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleQuickOrdered(item);
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 7h13v10H3z" />
                                  <path d="M16 10h4l2 3v4h-6z" />
                                  <circle cx="7" cy="17" r="2" />
                                  <circle cx="18" cy="17" r="2" />
                                </svg>
                                Mark Ordered
                              </button>
                            ) : null}
                            <button
                              className="rounded-full border border-[hsl(var(--ds-border))] bg-white p-2 text-slate-600"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditModal(item);
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                              </svg>
                            </button>
                            <button
                              className="rounded-full border border-[hsl(var(--ds-border))] bg-white p-2 text-slate-600"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleArchive(item);
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M6 6l1 14h10l1-14" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="border-b border-[hsl(var(--ds-border))] bg-[hsl(var(--status-delivered-bg))]">
                          <td colSpan={7} className="px-6 py-4 text-base text-slate-600">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                              <div>
                                <div className="text-base font-semibold uppercase text-slate-400">Expected Delivery</div>
                                <div className="mt-1 text-base font-medium text-slate-900">
                                  {formatDate(item.expected_delivery_date)}
                                </div>
                                <div className="mt-3 text-base font-semibold uppercase text-slate-400">Notes</div>
                                <div className="mt-1 rounded-lg border border-[hsl(var(--ds-border))] bg-white px-3 py-2 text-slate-700">
                                  {item.notes ?? "No notes yet."}
                                </div>
                              </div>
                              <div>
                                <div className="text-base font-semibold uppercase text-slate-400">Created</div>
                                <div className="mt-1 text-base font-medium text-slate-900">
                                  {formatDate(item.created_at)}
                                </div>
                                <div className="mt-3 text-base font-semibold uppercase text-slate-400">Risk Status</div>
                                <div
                                  className={`mt-1 text-base font-medium ${
                                    atRisk ? "text-[hsl(var(--status-risk))]" : "text-[hsl(var(--status-approved))]"
                                  }`}
                                >
                                  {atRisk ? "At Risk" : "On Track"}
                                </div>
                              </div>
                              <div>
                                <div className="text-base font-semibold uppercase text-slate-400">Attachments</div>
                                <div className="mt-1 text-base text-slate-600">No documents attached.</div>
                                <div className="mt-3 text-base font-semibold uppercase text-slate-400">Latest Update</div>
                                <div className="mt-1 text-base text-slate-700">{formatDate(item.updated_at)}</div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30"
          onClick={handleCloseRequest}
          role="presentation"
        >
          <aside
            className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{editingId ? "Edit Item" : "New Item"}</h2>
                <p className="mt-1 text-base text-slate-500">Update status, dates, and notes.</p>
              </div>
              <button
                className="rounded-full p-2 text-slate-500 hover:bg-[hsl(var(--status-delivered-bg))]"
                onClick={handleCloseRequest}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-6">
              <div className="text-base font-medium text-slate-700">Status Timeline</div>
              <div className="mt-3 flex items-center gap-3">
                {timelineSteps.map((step, index) => {
                  const isComplete = index <= timelineIndex;
                  const isActive = index === timelineIndex;
                  return (
                    <div key={step.key} className="flex items-center gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-full border text-base font-semibold ${
                            isComplete
                              ? "border-[hsl(var(--status-approved))] bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]"
                              : "border-[hsl(var(--ds-border))] bg-white text-slate-400"
                          }`}
                        >
                          {isComplete ? "✓" : ""}
                        </div>
                        <div className={`mt-2 text-[11px] ${isActive ? "text-slate-900" : "text-slate-400"}`}>
                          {step.label}
                        </div>
                      </div>
                      {index < timelineSteps.length - 1 ? (
                        <div
                          className={`h-[2px] w-10 ${
                            index < timelineIndex ? "bg-[hsl(var(--status-approved))]" : "bg-[hsl(var(--ds-border))]"
                          }`}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 text-base">
              <label>
                <div className="mb-1 text-base font-medium text-slate-500">Item Name *</div>
                <input
                  className="w-full rounded-lg border border-[hsl(var(--ds-border))] px-3 py-2"
                  value={draft.item_name}
                  onChange={(event) => updateDraft({ item_name: event.target.value })}
                />
              </label>
              <label>
                <div className="mb-1 text-base font-medium text-slate-500">Vendor *</div>
                <input
                  className="w-full rounded-lg border border-[hsl(var(--ds-border))] px-3 py-2"
                  value={draft.vendor_name}
                  onChange={(event) => updateDraft({ vendor_name: event.target.value })}
                />
              </label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label>
                  <div className="mb-1 text-base font-medium text-slate-500">Lead Time (days)</div>
                  <input
                    className="w-full rounded-lg border border-[hsl(var(--ds-border))] px-3 py-2"
                    type="number"
                    min={0}
                    value={draft.lead_time_days}
                    onChange={(event) => updateDraftAuto({ lead_time_days: event.target.value })}
                  />
                </label>
                <label>
                  <div className="mb-1 text-base font-medium text-slate-500">Need-By Date *</div>
                  <input
                    className="w-full rounded-lg border border-[hsl(var(--ds-border))] px-3 py-2"
                    type="date"
                    value={draft.need_by_date}
                    onChange={(event) => updateDraftAuto({ need_by_date: event.target.value })}
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label>
                  <div className="mb-1 text-base font-medium text-slate-500">Status *</div>
                  <select
                    className="w-full rounded-lg border border-[hsl(var(--ds-border))] px-3 py-2"
                    value={draft.status}
                    onChange={(event) => updateDraft({ status: event.target.value as ProcurementStatus })}
                  >
                    {PROCUREMENT_STATUS_ORDER.map((status) => (
                      <option key={status} value={status}>
                        {PROCUREMENT_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <div className="mb-1 text-base font-medium text-slate-500">Ordered Date</div>
                  <input
                    className="w-full rounded-lg border border-[hsl(var(--ds-border))] px-3 py-2"
                    type="date"
                    value={draft.ordered_date}
                    onChange={(event) => updateDraftAuto({ ordered_date: event.target.value })}
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label>
                  <div className="mb-1 text-base font-medium text-slate-500">Expected Delivery</div>
                  <input
                    className="w-full rounded-lg border border-[hsl(var(--ds-border))] px-3 py-2"
                    type="date"
                    value={draft.expected_delivery_date}
                    onChange={(event) => updateDraft({ expected_delivery_date: event.target.value })}
                  />
                </label>
                <label>
                  <div className="mb-1 text-base font-medium text-slate-500">Approved Date</div>
                  <input
                    className="w-full rounded-lg border border-[hsl(var(--ds-border))] px-3 py-2"
                    type="date"
                    value={draft.approved_date}
                    onChange={(event) => updateDraft({ approved_date: event.target.value })}
                  />
                </label>
              </div>
              <div className="mt-2 text-base font-medium text-slate-700">Additional Details</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label>
                  <div className="mb-1 text-base font-medium text-slate-500">PO Number</div>
                  <input
                    className="w-full rounded-lg border border-[hsl(var(--ds-border))] px-3 py-2"
                    value={draft.po_number}
                    onChange={(event) => updateDraft({ po_number: event.target.value })}
                  />
                </label>
                <label>
                  <div className="mb-1 text-base font-medium text-slate-500">Actual Delivery</div>
                  <input
                    className="w-full rounded-lg border border-[hsl(var(--ds-border))] px-3 py-2"
                    type="date"
                    value={draft.actual_delivery_date}
                    onChange={(event) => updateDraft({ actual_delivery_date: event.target.value })}
                  />
                </label>
                <label>
                  <div className="mb-1 text-base font-medium text-slate-500">Received By</div>
                  <input
                    className="w-full rounded-lg border border-[hsl(var(--ds-border))] px-3 py-2"
                    value={draft.received_by}
                    onChange={(event) => updateDraft({ received_by: event.target.value })}
                  />
                </label>
                <label>
                  <div className="mb-1 text-base font-medium text-slate-500">Received Date</div>
                  <input
                    className="w-full rounded-lg border border-[hsl(var(--ds-border))] px-3 py-2"
                    type="date"
                    value={draft.received_date}
                    onChange={(event) => updateDraft({ received_date: event.target.value })}
                  />
                </label>
                <label>
                  <div className="mb-1 text-base font-medium text-slate-500">QC Status</div>
                  <select
                    className="w-full rounded-lg border border-[hsl(var(--ds-border))] px-3 py-2"
                    value={draft.qc_status}
                    onChange={(event) =>
                      updateDraft({
                        qc_status: event.target.value as "" | "pass" | "fail" | "hold" | "needs_review",
                      })
                    }
                  >
                    <option value="">Not set</option>
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                    <option value="hold">Hold</option>
                    <option value="needs_review">Needs review</option>
                  </select>
                </label>
                <label className="flex items-end gap-2 text-base text-slate-600">
                  <input
                    className="h-4 w-4"
                    type="checkbox"
                    checked={Boolean(draft.qc_match_submittals)}
                    onChange={(event) => updateDraft({ qc_match_submittals: event.target.checked })}
                  />
                  Match Submittals
                </label>
                <label className="md:col-span-2">
                  <div className="mb-1 text-base font-medium text-slate-500">QC Notes</div>
                  <textarea
                    className="w-full rounded-lg border border-[hsl(var(--ds-border))] px-3 py-2"
                    rows={2}
                    value={draft.qc_notes}
                    onChange={(event) => updateDraft({ qc_notes: event.target.value })}
                  />
                </label>
              </div>
              <label>
                <div className="mb-1 text-base font-medium text-slate-500">Add Note</div>
                <textarea
                  className="w-full rounded-lg border border-[hsl(var(--ds-border))] px-3 py-2"
                  rows={3}
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(event) => setNewNote(event.target.value)}
                />
              </label>
              <button
                className="w-full rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-base font-semibold text-white"
                type="button"
                onClick={handleAddNote}
              >
                Add Note
              </button>

              <div>
                <div className="text-base font-medium text-slate-700">Notes History</div>
                <div className="mt-2 space-y-2">
                  {notesHistoryDraft.length > 0 ? (
                    notesHistoryDraft.map((entry, index) => (
                      <div
                        key={`${entry.created_at}-${index}`}
                        className="rounded-lg border border-[hsl(var(--ds-border))] p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-base text-slate-400">{formatDate(entry.created_at)}</div>
                          <button
                            className="rounded p-1 text-slate-500 hover:bg-[hsl(var(--status-delivered-bg))]"
                            type="button"
                            aria-label="Delete note"
                            onClick={() => handleDeleteNote(index)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M6 6l1 14h10l1-14" />
                            </svg>
                          </button>
                        </div>
                        <div className="mt-2 text-base text-slate-700">{entry.note}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-base text-slate-400">No notes yet.</div>
                  )}
                </div>
              </div>
            </div>

            {error ? <div className="mt-3 text-base text-rose-600">{error}</div> : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                className="rounded-lg border border-[hsl(var(--ds-border))] px-3 py-2 text-base"
                onClick={handleCloseRequest}
              >
                Cancel
              </button>
              <button
                className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-base text-white"
                onClick={handleSave}
              >
                {editingId ? "Save Changes" : "Create Item"}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
