import type { ProcurementItem, ProcurementItemPayload, ProcurementStatus } from "./types";

const STORAGE_KEY = "gc-dashboard.procurement.v3";

type StoreShape = Record<string, ProcurementItem[]>;

type ItemWithProject = { item: ProcurementItem; projectId: string };

type RawItem = Partial<ProcurementItem> & Record<string, unknown>;

function parseStore(raw: string | null): StoreShape {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as StoreShape;
  } catch {
    return {};
  }
}

function readStore(): StoreShape {
  if (typeof window === "undefined") return {};
  return parseStore(window.localStorage.getItem(STORAGE_KEY));
}

function writeStore(value: StoreShape) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function isoNow() {
  return new Date().toISOString();
}

function randomId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim() ? value : null;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toStatus(value: unknown): ProcurementStatus {
  const allowed: ProcurementStatus[] = [
    "awaiting_approval",
    "approved",
    "ordered",
    "in_production",
    "shipped",
    "delivered",
    "complete",
    "on_hold",
    "canceled",
  ];
  if (typeof value === "string" && allowed.includes(value as ProcurementStatus)) {
    return value as ProcurementStatus;
  }
  return "awaiting_approval";
}

function normalizeItem(raw: RawItem, projectId: string): ProcurementItem {
  const now = isoNow();
  const fallbackName = toNullableString(raw.item_name) ?? toNullableString(raw.product) ?? "Unnamed Item";
  const fallbackVendor = toNullableString(raw.vendor_name) ?? toNullableString(raw.vendor) ?? "Unknown Vendor";
  const note = toNullableString(raw.notes);

  return {
    id: toNullableString(raw.id) ?? randomId(),
    project_id: toNullableString(raw.project_id) ?? projectId,
    item_name: fallbackName,
    vendor_name: fallbackVendor,
    status: toStatus(raw.status),
    approved_date: toNullableString(raw.approved_date) ?? toNullableString(raw.approvedDate),
    ordered_date: toNullableString(raw.ordered_date) ?? toNullableString(raw.orderedDate),
    lead_time_days: toNullableNumber(raw.lead_time_days) ?? toNullableNumber(raw.leadTimeDays),
    need_by_date: toNullableString(raw.need_by_date),
    expected_delivery_date: toNullableString(raw.expected_delivery_date),
    actual_delivery_date: toNullableString(raw.actual_delivery_date),
    po_number: toNullableString(raw.po_number),
    notes: note,
    notes_history: Array.isArray(raw.notes_history)
      ? raw.notes_history
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const candidate = entry as Record<string, unknown>;
            const text = toNullableString(candidate.text);
            if (!text) return null;
            return {
              id: toNullableString(candidate.id) ?? randomId(),
              text,
              created_at: toNullableString(candidate.created_at) ?? now,
            };
          })
          .filter((entry): entry is ProcurementItem["notes_history"][number] => Boolean(entry))
      : note
        ? [{ id: randomId(), text: note, created_at: now }]
        : [],
    attachments: Array.isArray(raw.attachments)
      ? raw.attachments.filter((entry): entry is string => typeof entry === "string")
      : [],
    archived_at: toNullableString(raw.archived_at),
    created_at: toNullableString(raw.created_at) ?? now,
    updated_at: toNullableString(raw.updated_at) ?? now,
  };
}

function seedItems(projectId: string): ProcurementItem[] {
  const now = isoNow();
  return [
    {
      id: `${projectId}-proc-1`,
      project_id: projectId,
      item_name: "Plumbing Fixtures Set",
      vendor_name: "AquaFlow Ltd.",
      status: "delivered",
      approved_date: "2026-01-26",
      ordered_date: "2026-01-29",
      lead_time_days: 7,
      need_by_date: "2026-02-08",
      expected_delivery_date: "2026-02-07",
      actual_delivery_date: "2026-02-07",
      po_number: "PO-4601",
      notes: "Delivered on time.",
      notes_history: [{ id: randomId(), text: "Delivered on time.", created_at: "2026-02-07T20:35:00.000Z" }],
      attachments: ["submittal-ack.pdf"],
      archived_at: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: `${projectId}-proc-2`,
      project_id: projectId,
      item_name: "Safety Harnesses (x20)",
      vendor_name: "SafeGear Co.",
      status: "awaiting_approval",
      approved_date: null,
      ordered_date: null,
      lead_time_days: 4,
      need_by_date: "2026-02-13",
      expected_delivery_date: null,
      actual_delivery_date: null,
      po_number: null,
      notes: "Awaiting superintendent sign-off.",
      notes_history: [{ id: randomId(), text: "Awaiting superintendent sign-off.", created_at: now }],
      attachments: [],
      archived_at: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: `${projectId}-proc-3`,
      project_id: projectId,
      item_name: "HVAC Ductwork",
      vendor_name: "ClimateControl Systems",
      status: "ordered",
      approved_date: "2026-02-02",
      ordered_date: "2026-02-03",
      lead_time_days: 14,
      need_by_date: "2026-02-16",
      expected_delivery_date: "2026-02-20",
      actual_delivery_date: null,
      po_number: "PO-4610",
      notes: "Supplier warned of possible delay.",
      notes_history: [{ id: randomId(), text: "Supplier warned of possible delay.", created_at: now }],
      attachments: ["fabrication-log.xlsx"],
      archived_at: null,
      created_at: now,
      updated_at: now,
    },
  ];
}

function ensureProjectItems(projectId: string) {
  const store = readStore();
  if (!store[projectId]) {
    store[projectId] = seedItems(projectId);
    writeStore(store);
  } else {
    const normalized = (store[projectId] ?? []).map((item) => normalizeItem(item, projectId));
    store[projectId] = normalized;
    writeStore(store);
  }
  return store;
}

function findItemById(store: StoreShape, id: string): ItemWithProject | null {
  for (const [projectId, items] of Object.entries(store)) {
    const item = items.find((current) => current.id === id);
    if (item) return { item, projectId };
  }
  return null;
}

export function listItems(project_id: string): ProcurementItem[] {
  const store = ensureProjectItems(project_id);
  return (store[project_id] ?? []).filter((item) => !item.archived_at);
}

export function createItem(project_id: string, payload: ProcurementItemPayload): ProcurementItem {
  const store = ensureProjectItems(project_id);
  const timestamp = isoNow();
  const item: ProcurementItem = normalizeItem(
    {
      id: randomId(),
      project_id,
      archived_at: null,
      created_at: timestamp,
      updated_at: timestamp,
      ...payload,
    },
    project_id
  );

  const items = store[project_id] ?? [];
  items.unshift(item);
  store[project_id] = items;
  writeStore(store);

  return item;
}

export function updateItem(id: string, patch: Partial<ProcurementItemPayload>): ProcurementItem | null {
  const store = readStore();
  const located = findItemById(store, id);
  if (!located) return null;

  const updated = normalizeItem(
    {
      ...located.item,
      ...patch,
      updated_at: isoNow(),
    },
    located.projectId
  );

  store[located.projectId] = (store[located.projectId] ?? []).map((item) =>
    item.id === id ? updated : normalizeItem(item, located.projectId)
  );

  writeStore(store);
  return updated;
}

export function deleteItem(id: string): boolean {
  const store = readStore();
  const located = findItemById(store, id);
  if (!located) return false;

  const now = isoNow();
  store[located.projectId] = (store[located.projectId] ?? []).map((item) =>
    item.id === id ? { ...item, archived_at: now, updated_at: now } : item
  );

  writeStore(store);
  return true;
}
