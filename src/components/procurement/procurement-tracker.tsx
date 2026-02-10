"use client";

import { useEffect, useMemo, useState } from "react";
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

const statusClass = (status: ProcurementStatus) => {
  switch (status) {
    case "awaiting_approval":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "ordered":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "in_production":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "shipped":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "delivered":
      return "border-slate-200 bg-slate-50 text-slate-700";
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

const riskClass = "border-rose-200 bg-rose-50 text-rose-700";

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
  const [editingItem, setEditingItem] = useState<ProcurementItem | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [initialDraft, setInitialDraft] = useState<Draft>(emptyDraft());
  const [initialNotesHistory, setInitialNotesHistory] = useState<ProcurementNoteEntry[]>([]);
  const [newNote, setNewNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refreshItems = async () => {
    setLoading(true);
    if (!effectiveProjectId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const data = await listItems(effectiveProjectId);
    setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    refreshItems();
  }, [effectiveProjectId]);

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
        const aDate = a.expected_delivery_date ? new Date(a.expected_delivery_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bDate = b.expected_delivery_date ? new Date(b.expected_delivery_date).getTime() : Number.MAX_SAFE_INTEGER;
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

  const approvedCount = useMemo(() =>
    items.filter((item) => {
      const rank = statusRank.get(item.status) ?? 0;
      const approvedRank = statusRank.get("approved") ?? 0;
      const completeRank = statusRank.get("complete") ?? 0;
      return rank >= approvedRank && rank <= completeRank;
    }).length
  , [items]);

  const orderedCount = useMemo(() =>
    items.filter((item) => {
      if (item.ordered_date) return true;
      const rank = statusRank.get(item.status) ?? 0;
      const orderedRank = statusRank.get("ordered") ?? 0;
      const completeRank = statusRank.get("complete") ?? 0;
      return rank >= orderedRank && rank <= completeRank;
    }).length
  , [items]);

  const longestLeadTime = useMemo(() => {
    const leadTimes = items.map((item) => item.lead_time_days).filter((value): value is number => value !== null);
    if (!leadTimes.length) return null;
    return Math.max(...leadTimes);
  }, [items]);

  const nextNeedBy = useMemo(() => {
    const dates = items
      .map((item) => (item.need_by_date ? new Date(item.need_by_date) : null))
      .filter((date): date is Date => !!date)
      .sort((a, b) => a.getTime() - b.getTime());
    return dates[0] ?? null;
  }, [items]);

  const openNewModal = () => {
    const nextDraft = emptyDraft();
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
    setInitialNotesHistory([]);
    setEditingId(null);
    setEditingItem(null);
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
    setInitialNotesHistory(item.notes_history ? [...item.notes_history] : []);
    setEditingId(item.id);
    setEditingItem(item);
    setNewNote("");
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setEditingItem(null);
    setInitialDraft(emptyDraft());
    setInitialNotesHistory([]);
    setNewNote("");
    setError(null);
  };

  const hasUnsavedChanges = () => {
    const draftChanged = JSON.stringify(draft) !== JSON.stringify(initialDraft);
    const historyChanged =
      JSON.stringify(editingItem?.notes_history ?? []) !== JSON.stringify(initialNotesHistory);
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

  const buildNoteHistory = (item: ProcurementItem | null, nextNote: string | null) => {
    const history = item?.notes_history ? [...item.notes_history] : [];
    if (nextNote && nextNote.trim()) {
      const previous = item?.notes ?? "";
      if (nextNote.trim() !== previous.trim()) {
        const entry: ProcurementNoteEntry = {
          note: nextNote.trim(),
          created_at: new Date().toISOString(),
        };
        history.unshift(entry);
      }
    }
    return history;
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const noteEntry: ProcurementNoteEntry = {
      note: newNote.trim(),
      created_at: new Date().toISOString(),
    };
    const existingHistory = editingItem?.notes_history ? [...editingItem.notes_history] : [];
    const nextHistory = [noteEntry, ...existingHistory];
    setEditingItem((prev) => (prev ? { ...prev, notes_history: nextHistory } : prev));
    setDraft((prev) => ({ ...prev, notes: newNote.trim() }));
    setNewNote("");
  };

  const handleDeleteNote = (index: number) => {
    if (!editingItem?.notes_history) return;
    const nextHistory = editingItem.notes_history.filter((_, entryIndex) => entryIndex !== index);
    setEditingItem((prev) => (prev ? { ...prev, notes_history: nextHistory } : prev));
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
      const notesHistory = buildNoteHistory(editingItem, payload.notes ?? null);
      await updateItem(editingId, { ...payload, notes_history: notesHistory });
    } else {
      if (!effectiveProjectId) {
        setError("Project context is missing. Open this page from a project.");
        return;
      }
      const notesHistory = buildNoteHistory(null, payload.notes ?? null);
      await createItem(effectiveProjectId, { ...payload, notes_history: notesHistory });
    }

    await refreshItems();
    closeModal();
  };

  const handleArchive = async (item: ProcurementItem) => {
    const confirmed = window.confirm(`Archive ${item.item_name}?`);
    if (!confirmed) return;
    await deleteItem(item.id);
    await refreshItems();
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
      if (value.includes("\"") || value.includes(",") || value.includes("\n")) {
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

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Procurement Tracking</h1>
          <p className="text-sm opacity-80">
            Track long-lead items, approvals, ordering, and delivery milestones for this project.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded border border-black/10 px-3 py-2 text-sm" onClick={handleExport}>
            Export CSV
          </button>
          <button className="rounded bg-black px-3 py-2 text-sm text-white" onClick={openNewModal}>
            New Item
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="rounded-lg border border-black/10 p-4">
          <div className="text-sm opacity-70">Total Items</div>
          <div className="mt-1 text-2xl font-semibold">{items.length}</div>
          <div className="text-xs opacity-60">Across all scopes</div>
        </div>
        <div className="rounded-lg border border-black/10 p-4">
          <div className="text-sm opacity-70">Approved</div>
          <div className="mt-1 text-2xl font-semibold">{approvedCount}</div>
          <div className="text-xs opacity-60">Released for purchase</div>
        </div>
        <div className="rounded-lg border border-black/10 p-4">
          <div className="text-sm opacity-70">Ordered</div>
          <div className="mt-1 text-2xl font-semibold">{orderedCount}</div>
          <div className="text-xs opacity-60">POs issued</div>
        </div>
        <div className="rounded-lg border border-black/10 p-4">
          <div className="text-sm opacity-70">At Risk</div>
          <div className="mt-1 text-2xl font-semibold">{atRiskCount}</div>
          <div className="text-xs opacity-60">
            {nextNeedBy ? `Next need-by: ${dateFormatter.format(nextNeedBy)}` : "No need-by dates"}
          </div>
        </div>
        <div className="rounded-lg border border-black/10 p-4">
          <div className="text-sm opacity-70">Longest Lead Time</div>
          <div className="mt-1 text-2xl font-semibold">{longestLeadTime ?? "—"}</div>
          <div className="text-xs opacity-60">Days across active items</div>
        </div>
      </section>

      <section className="rounded-lg border border-black/10">
        <div className="flex flex-wrap items-center gap-3 border-b border-black/10 px-4 py-3">
          <div className="text-sm font-medium">Items</div>
          <div className="text-xs opacity-60">
            {longestLeadTime ? `Longest lead time: ${longestLeadTime} days` : "Longest lead time: —"}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              className="w-56 rounded border border-black/10 px-3 py-2 text-sm"
              placeholder="Search item or vendor"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <select
              className="rounded border border-black/10 px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | ProcurementStatus)}
            >
              <option value="all">All statuses</option>
              {PROCUREMENT_STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {PROCUREMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <select
              className="rounded border border-black/10 px-3 py-2 text-sm"
              value={sortBy}
              onChange={(event) =>
                setSortBy(
                  event.target.value as
                    | "need_by"
                    | "status"
                    | "lead_time"
                    | "item_name"
                    | "vendor_name"
                    | "approved_date"
                    | "ordered_date"
                    | "expected_delivery_date"
                )
              }
            >
              <option value="need_by">Sort by need-by</option>
              <option value="status">Sort by status</option>
              <option value="lead_time">Sort by lead time</option>
              <option value="item_name">Sort by item</option>
              <option value="vendor_name">Sort by vendor</option>
              <option value="approved_date">Sort by approved date</option>
              <option value="ordered_date">Sort by ordered date</option>
              <option value="expected_delivery_date">Sort by expected delivery</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-black/[0.02] text-left">
              <tr>
                <th className="px-4 py-3 font-medium">
                  <button
                    className="inline-flex items-center gap-2"
                    onClick={() => toggleSort("item_name")}
                    type="button"
                  >
                    Item {sortIndicator("item_name")}
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">
                  <button
                    className="inline-flex items-center gap-2"
                    onClick={() => toggleSort("vendor_name")}
                    type="button"
                  >
                    Vendor {sortIndicator("vendor_name")}
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">
                  <button
                    className="inline-flex items-center gap-2"
                    onClick={() => toggleSort("status")}
                    type="button"
                  >
                    Status {sortIndicator("status")}
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">
                  <button
                    className="inline-flex items-center gap-2"
                    onClick={() => toggleSort("approved_date")}
                    type="button"
                  >
                    Approved {sortIndicator("approved_date")}
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">
                  <button
                    className="inline-flex items-center gap-2"
                    onClick={() => toggleSort("ordered_date")}
                    type="button"
                  >
                    Ordered {sortIndicator("ordered_date")}
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">
                  <button
                    className="inline-flex items-center gap-2"
                    onClick={() => toggleSort("lead_time")}
                    type="button"
                  >
                    Lead Time {sortIndicator("lead_time")}
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">
                  <button
                    className="inline-flex items-center gap-2"
                    onClick={() => toggleSort("need_by")}
                    type="button"
                  >
                    Need By {sortIndicator("need_by")}
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">
                  <button
                    className="inline-flex items-center gap-2"
                    onClick={() => toggleSort("expected_delivery_date")}
                    type="button"
                  >
                    Expected {sortIndicator("expected_delivery_date")}
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">PO</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-sm opacity-70" colSpan={11}>
                    Loading procurement items...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm opacity-70" colSpan={11}>
                    No items match your filters. Try adjusting the search or status filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const atRisk = isAtRisk(item);
                  return (
                    <tr
                      key={item.id}
                      className="border-t border-black/5 hover:bg-black/[0.02]"
                      onClick={() => openEditModal(item)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.item_name}</div>
                      </td>
                      <td className="px-4 py-3">{item.vendor_name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(
                              item.status
                            )}`}
                          >
                            {PROCUREMENT_STATUS_LABELS[item.status]}
                          </span>
                          {atRisk ? (
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${riskClass}`}
                            >
                              At Risk
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">{formatDate(item.approved_date)}</td>
                      <td className="px-4 py-3">{formatDate(item.ordered_date)}</td>
                      <td className="px-4 py-3">
                        {item.lead_time_days !== null ? `${item.lead_time_days} days` : "—"}
                      </td>
                      <td className="px-4 py-3">{formatDate(item.need_by_date)}</td>
                      <td className="px-4 py-3">{formatDate(item.expected_delivery_date)}</td>
                      <td className="px-4 py-3">{item.po_number ?? "—"}</td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <div className="truncate" title={item.notes ?? undefined}>
                          {item.notes ?? "—"}
                        </div>
                        <div className="text-xs opacity-60">Updated {formatDate(item.updated_at)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            className="text-xs underline"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditModal(item);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="text-xs text-red-600 underline"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleArchive(item);
                            }}
                          >
                            Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={handleCloseRequest}
          role="presentation"
        >
          <div
            className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-lg border bg-white p-6 pb-8"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">
              {editingId ? "Edit Procurement Item" : "New Procurement Item"}
            </h2>
            <p className="mt-1 text-sm opacity-70">
              Required fields: item name, vendor, status, and need-by date.
            </p>
            <div className="mt-4">
              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <label className="md:col-span-2">
                <div className="mb-1 opacity-70">Item name *</div>
                <input
                  className="w-full rounded border px-3 py-2"
                  value={draft.item_name}
                  onChange={(event) => setDraft({ ...draft, item_name: event.target.value })}
                />
              </label>
              <label>
                <div className="mb-1 opacity-70">Vendor name *</div>
                <input
                  className="w-full rounded border px-3 py-2"
                  value={draft.vendor_name}
                  onChange={(event) => setDraft({ ...draft, vendor_name: event.target.value })}
                />
              </label>
              <label>
                <div className="mb-1 opacity-70">Status *</div>
                <select
                  className="w-full rounded border px-3 py-2"
                  value={draft.status}
                  onChange={(event) =>
                    setDraft({ ...draft, status: event.target.value as ProcurementStatus })
                  }
                >
                  {PROCUREMENT_STATUS_ORDER.map((status) => (
                    <option key={status} value={status}>
                      {PROCUREMENT_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <div className="mb-1 opacity-70">Need-by date *</div>
                <input
                  className="w-full rounded border px-3 py-2"
                  type="date"
                  value={draft.need_by_date}
                  onChange={(event) => setDraft({ ...draft, need_by_date: event.target.value })}
                />
              </label>
              <label>
                <div className="mb-1 opacity-70">Lead time (days)</div>
                <input
                  className="w-full rounded border px-3 py-2"
                  type="number"
                  min={0}
                  value={draft.lead_time_days}
                  onChange={(event) => setDraft({ ...draft, lead_time_days: event.target.value })}
                />
              </label>
              <label>
                <div className="mb-1 opacity-70">Approved date</div>
                <input
                  className="w-full rounded border px-3 py-2"
                  type="date"
                  value={draft.approved_date}
                  onChange={(event) => setDraft({ ...draft, approved_date: event.target.value })}
                />
              </label>
              <label>
                <div className="mb-1 opacity-70">Ordered date</div>
                <input
                  className="w-full rounded border px-3 py-2"
                  type="date"
                  value={draft.ordered_date}
                  onChange={(event) => setDraft({ ...draft, ordered_date: event.target.value })}
                />
              </label>
              <label>
                <div className="mb-1 opacity-70">Expected delivery date</div>
                <input
                  className="w-full rounded border px-3 py-2"
                  type="date"
                  value={draft.expected_delivery_date}
                  onChange={(event) =>
                    setDraft({ ...draft, expected_delivery_date: event.target.value })
                  }
                />
              </label>
              <label>
                <div className="mb-1 opacity-70">Actual delivery date</div>
                <input
                  className="w-full rounded border px-3 py-2"
                  type="date"
                  value={draft.actual_delivery_date}
                  onChange={(event) =>
                    setDraft({ ...draft, actual_delivery_date: event.target.value })
                  }
                />
              </label>
              <label>
                <div className="mb-1 opacity-70">PO number</div>
                <input
                  className="w-full rounded border px-3 py-2"
                  value={draft.po_number}
                  onChange={(event) => setDraft({ ...draft, po_number: event.target.value })}
                />
              </label>
              <div className="md:col-span-2 mt-2 border-t border-black/10 pt-4">
                <div className="text-sm font-semibold">Quality Control</div>
                <div className="text-xs opacity-60">Receiving and inspection details.</div>
              </div>
              <label>
                <div className="mb-1 opacity-70">Received by</div>
                <input
                  className="w-full rounded border px-3 py-2"
                  value={draft.received_by}
                  onChange={(event) => setDraft({ ...draft, received_by: event.target.value })}
                />
              </label>
              <label>
                <div className="mb-1 opacity-70">Received date</div>
                <input
                  className="w-full rounded border px-3 py-2"
                  type="date"
                  value={draft.received_date}
                  onChange={(event) => setDraft({ ...draft, received_date: event.target.value })}
                />
              </label>
              <label>
                <div className="mb-1 opacity-70">QC status</div>
                <select
                  className="w-full rounded border px-3 py-2"
                  value={draft.qc_status}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
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
              <label className="inline-flex items-end gap-2 text-sm">
                <input
                  className="mb-1 h-5 w-5"
                  type="checkbox"
                  checked={Boolean(draft.qc_match_submittals)}
                  onChange={(event) =>
                    setDraft({ ...draft, qc_match_submittals: event.target.checked })
                  }
                />
                <span className="mb-1">Match Submittals</span>
              </label>
              <label className="md:col-span-2">
                <div className="mb-1 opacity-70">QC notes</div>
                <textarea
                  className="w-full rounded border px-3 py-2"
                  rows={2}
                  value={draft.qc_notes}
                  onChange={(event) => setDraft({ ...draft, qc_notes: event.target.value })}
                />
              </label>
            </div>
              <div className="mt-4">
                <div className="text-sm font-medium">Note History</div>
                <div className="mt-2 flex flex-wrap items-end gap-2 text-sm">
                  <label className="flex-1">
                    <div className="mb-1 text-xs opacity-60">Add note</div>
                    <input
                      className="w-full rounded border px-3 py-2 text-sm"
                      placeholder="Add a dated note entry"
                      value={newNote}
                      onChange={(event) => setNewNote(event.target.value)}
                    />
                  </label>
                  <button
                    className="rounded border border-black bg-black px-3 py-2 text-xs text-white"
                    type="button"
                    onClick={handleAddNote}
                  >
                    Add Note
                  </button>
                </div>
                <div className="mt-2 space-y-2 text-sm">
                {editingItem?.notes_history && editingItem.notes_history.length > 0 ? (
                  editingItem.notes_history.map((entry, index) => (
                    <div
                      key={`${entry.created_at}-${index}`}
                      className="rounded border border-black/10 p-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs opacity-60">{formatDate(entry.created_at)}</div>
                        <button
                          className="rounded p-1 text-black/80 hover:bg-black/5 hover:text-black"
                          type="button"
                          aria-label="Delete note"
                          onClick={() => handleDeleteNote(index)}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                          >
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M6 6l1 14h10l1-14" />
                          </svg>
                        </button>
                      </div>
                      <div className="mt-1">{entry.note}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs opacity-60">No notes yet.</div>
                )}
              </div>
            </div>
            </div>
            {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
            <div className="mt-4 flex justify-end gap-2 pb-8 mb-4">
              <button className="rounded border px-3 py-2 text-sm" onClick={handleCloseRequest}>
                Cancel
              </button>
              <button
                className="rounded border border-black bg-black px-3 py-2 text-sm text-white"
                onClick={handleSave}
              >
                {editingId ? "Save Changes" : "Create Item"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
