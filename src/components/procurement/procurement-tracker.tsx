"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createItem, deleteItem, listItems, updateItem } from "@/lib/procurement/store";
import { isProcurementItemAtRisk } from "@/lib/procurement/risk";
import {
  PROCUREMENT_STATUSES,
  STATUS_ORDER,
  type ProcurementItem,
  type ProcurementItemPayload,
  type ProcurementSortKey,
  type ProcurementStatus,
} from "@/lib/procurement/types";

type SortDirection = "asc" | "desc";
type StatusFilter = "all" | ProcurementStatus;

type FormState = {
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
};

const DEFAULT_FORM: FormState = {
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
};

function statusLabel(status: ProcurementStatus) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusColor(status: ProcurementStatus) {
  if (status === "awaiting_approval") return "bg-amber-100 text-amber-800 border-amber-200";
  if (status === "approved") return "bg-green-100 text-green-800 border-green-200";
  if (status === "ordered") return "bg-blue-100 text-blue-800 border-blue-200";
  if (status === "delivered" || status === "complete") return "bg-gray-100 text-gray-700 border-gray-200";
  if (status === "on_hold") return "bg-orange-100 text-orange-800 border-orange-200";
  if (status === "canceled") return "bg-red-100 text-red-700 border-red-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function statusIcon(status: ProcurementStatus) {
  if (status === "awaiting_approval") return "◷";
  if (status === "approved") return "✓";
  if (status === "ordered") return "📦";
  if (status === "in_production") return "🏭";
  if (status === "shipped") return "🚚";
  if (status === "delivered" || status === "complete") return "⬢";
  if (status === "on_hold") return "⏸";
  if (status === "canceled") return "✕";
  return "•";
}

function statusIndex(status: ProcurementStatus) {
  return STATUS_ORDER.indexOf(status);
}

function isApprovedOrLater(status: ProcurementStatus) {
  const index = statusIndex(status);
  return index >= statusIndex("approved") && index <= statusIndex("complete");
}

function isOrderedOrLater(status: ProcurementStatus) {
  const index = statusIndex(status);
  return index >= statusIndex("ordered") && index <= statusIndex("complete");
}

function toNullable(value: string) {
  return value.trim() ? value.trim() : null;
}

function toNullableNumber(value: string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapItemToForm(item: ProcurementItem): FormState {
  return {
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
    notes: "",
  };
}

function mapFormToPayload(form: FormState): ProcurementItemPayload {
  const timestamp = new Date().toISOString();
  const noteText = form.notes.trim();

  return {
    item_name: form.item_name.trim(),
    vendor_name: form.vendor_name.trim(),
    status: form.status,
    approved_date: toNullable(form.approved_date),
    ordered_date: toNullable(form.ordered_date),
    lead_time_days: toNullableNumber(form.lead_time_days),
    need_by_date: toNullable(form.need_by_date),
    expected_delivery_date: toNullable(form.expected_delivery_date),
    actual_delivery_date: toNullable(form.actual_delivery_date),
    po_number: toNullable(form.po_number),
    notes: noteText || null,
    notes_history: noteText
      ? [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text: noteText, created_at: timestamp }]
      : [],
    attachments: [],
  };
}

function toCsvValue(value: string | number | null) {
  if (value === null) return "";
  const source = String(value);
  if (!source.includes(",") && !source.includes('"') && !source.includes("\n")) return source;
  return `"${source.replaceAll('"', '""')}"`;
}

function formatDisplayDate(date: string | null) {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function nextDateFromLeadTime(leadTimeDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + leadTimeDays);
  return date.toISOString().slice(0, 10);
}

function buildComparator(sortKey: ProcurementSortKey, direction: SortDirection) {
  const factor = direction === "asc" ? 1 : -1;
  return (a: ProcurementItem, b: ProcurementItem) => {
    if (sortKey === "status") return factor * (statusIndex(a.status) - statusIndex(b.status));
    if (sortKey === "lead_time_days") {
      return factor * ((a.lead_time_days ?? Number.MAX_SAFE_INTEGER) - (b.lead_time_days ?? Number.MAX_SAFE_INTEGER));
    }
    if (sortKey === "need_by_date") {
      const left = a.need_by_date ? new Date(a.need_by_date).getTime() : Number.MAX_SAFE_INTEGER;
      const right = b.need_by_date ? new Date(b.need_by_date).getTime() : Number.MAX_SAFE_INTEGER;
      return factor * (left - right);
    }
    if (sortKey === "vendor_name") {
      return factor * a.vendor_name.localeCompare(b.vendor_name);
    }
    return factor * a.item_name.localeCompare(b.item_name);
  };
}

export default function ProcurementTracker({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [items, setItems] = useState<ProcurementItem[] | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<ProcurementSortKey>("need_by_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerItemId, setDrawerItemId] = useState<string | null>(null);
  const [newForm, setNewForm] = useState<FormState>(DEFAULT_FORM);
  const [editForm, setEditForm] = useState<FormState>(DEFAULT_FORM);
  const [bulkStatus, setBulkStatus] = useState<ProcurementStatus>("approved");
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function refreshItems() {
    setItems(listItems(projectId));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setItems(listItems(projectId));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [projectId]);

  const activeItems = useMemo(() => items ?? [], [items]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = [...activeItems];

    if (term) {
      rows = rows.filter((item) => {
        return item.item_name.toLowerCase().includes(term) || item.vendor_name.toLowerCase().includes(term);
      });
    }

    if (statusFilter !== "all") {
      rows = rows.filter((item) => item.status === statusFilter);
    }

    return rows.sort(buildComparator(sortKey, sortDirection));
  }, [activeItems, search, statusFilter, sortKey, sortDirection]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const summary = useMemo(() => {
    const approved = activeItems.filter((item) => isApprovedOrLater(item.status)).length;
    const ordered = activeItems.filter((item) => item.ordered_date || isOrderedOrLater(item.status)).length;
    const atRisk = activeItems.filter((item) => isProcurementItemAtRisk(item)).length;
    const longestLead = activeItems.reduce((max, item) => Math.max(max, item.lead_time_days ?? 0), 0);

    return {
      total: activeItems.length,
      approved,
      ordered,
      atRisk,
      longestLead,
      trends: { total: "+3", approved: "+1", ordered: "0", atRisk: "+2", longestLead: "-1d" },
    };
  }, [activeItems]);

  const drawerItem = useMemo(() => activeItems.find((item) => item.id === drawerItemId) ?? null, [activeItems, drawerItemId]);

  function validateForm(form: FormState) {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.item_name.trim()) nextErrors.item_name = "Item name is required.";
    if (!form.vendor_name.trim()) nextErrors.vendor_name = "Vendor is required.";
    if (!form.need_by_date) nextErrors.need_by_date = "Need-by date is required.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function openDrawer(item: ProcurementItem) {
    setDrawerItemId(item.id);
    setEditForm(mapItemToForm(item));
    setErrors({});
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerItemId(null);
    setEditForm(DEFAULT_FORM);
    setIsDrawerOpen(false);
  }

  function applySave(form: FormState, existingId?: string | null) {
    if (!validateForm(form)) return;

    const payload = mapFormToPayload(form);

    if (existingId) {
      const existing = activeItems.find((item) => item.id === existingId);
      updateItem(existingId, {
        ...payload,
        notes_history: [...(existing?.notes_history ?? []), ...payload.notes_history],
      });
    } else {
      createItem(projectId, payload);
    }

    refreshItems();
  }

  function saveNewItem() {
    applySave(newForm, null);
    if (!validateForm(newForm)) return;
    setIsNewModalOpen(false);
    setNewForm(DEFAULT_FORM);
    setErrors({});
  }

  function saveDrawerItem() {
    if (!drawerItemId) return;
    applySave(editForm, drawerItemId);
    if (!validateForm(editForm)) return;
    closeDrawer();
  }

  function handleArchive(id: string) {
    deleteItem(id);
    refreshItems();
    setSelectedIds((current) => current.filter((value) => value !== id));
  }

  function quickStatus(id: string, status: ProcurementStatus) {
    updateItem(id, {
      status,
      approved_date: status === "approved" ? new Date().toISOString().slice(0, 10) : undefined,
      ordered_date: status === "ordered" ? new Date().toISOString().slice(0, 10) : undefined,
    });
    refreshItems();
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) return [...new Set([...current, id])];
      return current.filter((value) => value !== id);
    });
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) setSelectedIds(filteredItems.map((item) => item.id));
    else setSelectedIds([]);
  }

  function applyBulkStatus(status: ProcurementStatus) {
    selectedIds.forEach((id) => {
      updateItem(id, {
        status,
        approved_date: status === "approved" ? new Date().toISOString().slice(0, 10) : undefined,
        ordered_date: status === "ordered" ? new Date().toISOString().slice(0, 10) : undefined,
      });
    });
    refreshItems();
    setSelectedIds([]);
  }

  function applyBulkArchive() {
    selectedIds.forEach((id) => deleteItem(id));
    refreshItems();
    setSelectedIds([]);
  }

  function exportCsv() {
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
      "po_number",
      "notes",
    ];

    const rows = filteredItems.map((item) => [
      item.item_name,
      item.vendor_name,
      item.status,
      item.approved_date,
      item.ordered_date,
      item.lead_time_days,
      item.need_by_date,
      item.expected_delivery_date,
      item.actual_delivery_date,
      item.po_number,
      item.notes,
    ]);

    const csv = [headers, ...rows].map((row) => row.map((value) => toCsvValue(value)).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `procurement-${projectId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function onHeaderSort(key: ProcurementSortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection("asc");
      return;
    }
    setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
  }

  return (
    <div className="space-y-6 rounded-2xl border border-black/10 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-4xl font-semibold tracking-tight text-slate-900">Procurement Tracking</h2>
          <p className="mt-2 text-xl text-slate-500">Track and manage procurement items across your project.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-800">
            ⤓ Export CSV
          </button>
          <button onClick={() => setIsNewModalOpen(true)} className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white">
            + Add Item
          </button>
        </div>
      </div>

      {items === null ? (
        <div className="grid gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`sk-${index}`} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-2xl text-slate-500">📦</p>
            <p className="mt-2 text-xl font-semibold text-slate-600">Total Items</p>
            <p className="mt-1 text-5xl font-semibold text-slate-900">{summary.total}</p>
            <p className="mt-2 text-xl text-emerald-600">↗ {summary.trends.total} vs last week</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-green-50/60 p-4">
            <p className="text-2xl text-green-500">✅</p>
            <p className="mt-2 text-xl font-semibold text-slate-600">Approved</p>
            <p className="mt-1 text-5xl font-semibold text-slate-900">{summary.approved}</p>
            <p className="mt-2 text-xl text-emerald-600">↗ {summary.trends.approved} vs last week</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-blue-50/60 p-4">
            <p className="text-2xl text-blue-500">🚚</p>
            <p className="mt-2 text-xl font-semibold text-slate-600">Ordered</p>
            <p className="mt-1 text-5xl font-semibold text-slate-900">{summary.ordered}</p>
            <p className="mt-2 text-xl text-emerald-600">↗ {summary.trends.ordered} vs last week</p>
          </div>
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <p className="text-2xl text-orange-500">⚠️</p>
            <p className="mt-2 text-xl font-semibold text-slate-600">At Risk</p>
            <p className="mt-1 text-5xl font-semibold text-slate-900">{summary.atRisk}</p>
            <p className="mt-2 text-xl text-orange-600">↘ {summary.trends.atRisk} vs last week</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-amber-50/60 p-4">
            <p className="text-2xl text-amber-500">🕒</p>
            <p className="mt-2 text-xl font-semibold text-slate-600">Longest Lead</p>
            <p className="mt-1 text-5xl font-semibold text-slate-900">{summary.longestLead}d</p>
            <p className="mt-2 text-xl text-emerald-600">↗ {summary.trends.longestLead} vs last week</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full max-w-lg rounded-xl border border-slate-300 px-4 py-3 text-lg"
          placeholder="Search items or vendors..."
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-lg"
          >
            <option value="all">All Statuses</option>
            {PROCUREMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as ProcurementSortKey)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-lg"
          >
            <option value="need_by_date">Sort by Need-By</option>
            <option value="status">Sort by Status</option>
            <option value="lead_time_days">Sort by Lead Time</option>
            <option value="item_name">Sort by Item</option>
            <option value="vendor_name">Sort by Vendor</option>
          </select>
        </div>
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="font-medium text-blue-900">{selectedIds.length} selected</p>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => applyBulkStatus("approved")} className="rounded border border-blue-300 px-3 py-1 text-sm text-blue-900">Bulk Approve</button>
            <button onClick={() => applyBulkStatus("ordered")} className="rounded border border-blue-300 px-3 py-1 text-sm text-blue-900">Bulk Mark Ordered</button>
            <select
              value={bulkStatus}
              onChange={(event) => setBulkStatus(event.target.value as ProcurementStatus)}
              className="rounded border border-blue-300 px-3 py-1 text-sm"
            >
              {PROCUREMENT_STATUSES.map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </select>
            <button onClick={() => applyBulkStatus(bulkStatus)} className="rounded border border-blue-300 px-3 py-1 text-sm text-blue-900">Apply Status</button>
            <button onClick={applyBulkArchive} className="rounded border border-red-300 px-3 py-1 text-sm text-red-700">Archive Selected</button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full border-collapse text-left">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={filteredItems.length > 0 && selectedIds.length === filteredItems.length}
                  onChange={(event) => toggleSelectAll(event.target.checked)}
                />
              </th>
              <th className="px-4 py-3 cursor-pointer" onClick={() => onHeaderSort("item_name")}>Item ↕</th>
              <th className="px-4 py-3 cursor-pointer" onClick={() => onHeaderSort("vendor_name")}>Vendor ↕</th>
              <th className="px-4 py-3 cursor-pointer" onClick={() => onHeaderSort("status")}>Status ↕</th>
              <th className="px-4 py-3 cursor-pointer" onClick={() => onHeaderSort("need_by_date")}>Need By ↕</th>
              <th className="px-4 py-3 cursor-pointer" onClick={() => onHeaderSort("lead_time_days")}>Lead Time ↕</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items === null ? (
              Array.from({ length: 4 }).map((_, index) => (
                <tr key={`row-sk-${index}`} className="border-t border-slate-200">
                  <td className="px-4 py-4" colSpan={7}><div className="h-8 animate-pulse rounded bg-slate-100" /></td>
                </tr>
              ))
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <p className="text-6xl">📭</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-800">No procurement items found</p>
                  <p className="mt-1 text-slate-500">Add your first item to start tracking approvals and delivery.</p>
                </td>
              </tr>
            ) : (
              filteredItems.map((item, index) => {
                const expanded = Boolean(expandedRows[item.id]);
                const atRisk = isProcurementItemAtRisk(item);
                return (
                  <Fragment key={item.id}>
                    <tr
                      className={`border-t border-slate-200 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-blue-50/40`}
                      onClick={() => setExpandedRows((current) => ({ ...current, [item.id]: !expanded }))}
                    >
                      <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedSet.has(item.id)}
                          onChange={(event) => toggleSelect(item.id, event.target.checked)}
                        />
                      </td>
                      <td className="px-4 py-4 text-xl font-semibold text-slate-900">
                        {expanded ? "⌄" : "›"} {item.item_name} {atRisk ? <span className="text-orange-500">⚠</span> : null}
                      </td>
                      <td className="px-4 py-4 text-xl text-slate-600">{item.vendor_name}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium ${statusColor(item.status)}`}>
                          <span>{statusIcon(item.status)}</span>
                          {statusLabel(item.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xl text-slate-800">{formatDisplayDate(item.need_by_date)}</td>
                      <td className="px-4 py-4 text-xl text-slate-800">{item.lead_time_days ? `${item.lead_time_days} days` : "—"}</td>
                      <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          {item.status === "awaiting_approval" ? (
                            <button onClick={() => quickStatus(item.id, "approved")} className="font-medium text-slate-900 underline">Approve</button>
                          ) : null}
                          {item.status === "approved" ? (
                            <button onClick={() => quickStatus(item.id, "ordered")} className="font-medium text-slate-900 underline">Mark Ordered</button>
                          ) : null}
                          <button onClick={() => openDrawer(item)} className="font-medium text-slate-900 underline">Edit</button>
                          <button onClick={() => handleArchive(item.id)} className="font-medium text-red-600 underline">Archive</button>
                        </div>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="grid gap-4 md:grid-cols-4">
                            <div>
                              <p className="text-sm font-semibold text-slate-500">Expected Delivery</p>
                              <p className="text-2xl font-semibold text-slate-900">{formatDisplayDate(item.expected_delivery_date)}</p>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-500">Created</p>
                              <p className="text-2xl font-semibold text-slate-900">{formatDisplayDate(item.created_at)}</p>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-500">Risk Status</p>
                              <p className={`text-2xl font-semibold ${atRisk ? "text-orange-600" : "text-green-600"}`}>{atRisk ? "At Risk" : "On Track"}</p>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-500">Attached Documents</p>
                              <p className="text-lg text-slate-700">{item.attachments.length ? item.attachments.join(", ") : "No documents"}</p>
                            </div>
                          </div>
                          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                            <p className="text-sm font-semibold text-slate-500">Notes History</p>
                            {item.notes_history.length ? (
                              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                                {item.notes_history.map((entry) => (
                                  <li key={entry.id}>• {entry.text} — {formatDisplayDate(entry.created_at)}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-2 text-sm text-slate-500">No notes yet.</p>
                            )}
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

      {isNewModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
            <h3 className="text-3xl font-semibold text-slate-900">Add Procurement Item</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium">Item Name *</span>
                <input value={newForm.item_name} onChange={(e) => setNewForm((c) => ({ ...c, item_name: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                {errors.item_name ? <p className="text-xs text-red-600">{errors.item_name}</p> : null}
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium">Vendor *</span>
                <input value={newForm.vendor_name} onChange={(e) => setNewForm((c) => ({ ...c, vendor_name: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                {errors.vendor_name ? <p className="text-xs text-red-600">{errors.vendor_name}</p> : null}
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium">Need-By Date *</span>
                <input type="date" value={newForm.need_by_date} onChange={(e) => setNewForm((c) => ({ ...c, need_by_date: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                {errors.need_by_date ? <p className="text-xs text-red-600">{errors.need_by_date}</p> : null}
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium">Lead Time (days)</span>
                <input
                  type="number"
                  min={0}
                  value={newForm.lead_time_days}
                  onChange={(e) => {
                    const lead = e.target.value;
                    setNewForm((current) => ({
                      ...current,
                      lead_time_days: lead,
                      expected_delivery_date:
                        !current.expected_delivery_date && lead ? nextDateFromLeadTime(Number(lead)) : current.expected_delivery_date,
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-sm font-medium">Notes</span>
                <textarea value={newForm.notes} onChange={(e) => setNewForm((c) => ({ ...c, notes: e.target.value }))} className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setIsNewModalOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2">Cancel</button>
              <button onClick={saveNewItem} className="rounded-lg bg-slate-900 px-4 py-2 text-white">Create Item</button>
            </div>
          </div>
        </div>
      ) : null}

      {isDrawerOpen && drawerItem ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="h-full w-full max-w-3xl overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-4xl font-semibold text-slate-900">Edit Item</h3>
              <button onClick={closeDrawer} className="text-2xl text-slate-500">×</button>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 p-4">
              <p className="text-xl font-semibold text-slate-500">Status Timeline</p>
              <div className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                {["awaiting_approval", "approved", "ordered", "delivered"].map((status, index) => {
                  const complete = statusIndex(drawerItem.status) >= statusIndex(status as ProcurementStatus);
                  return (
                    <div key={status} className="flex items-center gap-2">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full border ${complete ? "border-green-500 bg-green-100 text-green-700" : "border-slate-300 text-slate-400"}`}>{complete ? "✓" : index + 1}</span>
                      <span>{statusLabel(status as ProcurementStatus)}</span>
                      {index < 3 ? <span className="mx-1 h-px w-8 bg-slate-300" /> : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 sm:col-span-2"><span className="text-sm font-medium">Item Name</span><input value={editForm.item_name} onChange={(e) => setEditForm((c) => ({ ...c, item_name: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Vendor</span><input value={editForm.vendor_name} onChange={(e) => setEditForm((c) => ({ ...c, vendor_name: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Status</span><select value={editForm.status} onChange={(e) => setEditForm((c) => ({ ...c, status: e.target.value as ProcurementStatus }))} className="w-full rounded-lg border border-slate-300 px-3 py-2">{PROCUREMENT_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
              <label className="space-y-1"><span className="text-sm font-medium">Lead Time (days)</span><input type="number" value={editForm.lead_time_days} onChange={(e) => setEditForm((c) => ({ ...c, lead_time_days: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Need-By Date</span><input type="date" value={editForm.need_by_date} onChange={(e) => setEditForm((c) => ({ ...c, need_by_date: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Approved Date</span><input type="date" value={editForm.approved_date} onChange={(e) => setEditForm((c) => ({ ...c, approved_date: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Ordered Date</span><input type="date" value={editForm.ordered_date} onChange={(e) => setEditForm((c) => ({ ...c, ordered_date: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Expected Delivery</span><input type="date" value={editForm.expected_delivery_date} onChange={(e) => setEditForm((c) => ({ ...c, expected_delivery_date: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Actual Delivery</span><input type="date" value={editForm.actual_delivery_date} onChange={(e) => setEditForm((c) => ({ ...c, actual_delivery_date: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              <label className="space-y-1"><span className="text-sm font-medium">PO Number</span><input value={editForm.po_number} onChange={(e) => setEditForm((c) => ({ ...c, po_number: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              <label className="space-y-1 sm:col-span-2"><span className="text-sm font-medium">Add Note</span><textarea value={editForm.notes} onChange={(e) => setEditForm((c) => ({ ...c, notes: e.target.value }))} className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 p-3">
              <p className="text-xl font-semibold text-slate-600">Notes History</p>
              {drawerItem.notes_history.length ? (
                <ul className="mt-2 space-y-1 text-slate-700">
                  {drawerItem.notes_history.map((entry) => (
                    <li key={entry.id}>• {entry.text}<span className="text-sm text-slate-500"> — {new Date(entry.created_at).toLocaleString()}</span></li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No notes logged yet.</p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={closeDrawer} className="rounded-lg border border-slate-300 px-4 py-2">Cancel</button>
              <button onClick={saveDrawerItem} className="rounded-lg bg-slate-900 px-4 py-2 text-white">Save Changes</button>
            </div>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-slate-500">Project: {projectName}</p>
    </div>
  );
}
