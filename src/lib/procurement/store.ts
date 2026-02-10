import { mockProcurementItems } from "./mock";
import { ProcurementItem, ProcurementItemInput } from "./types";

const STORAGE_KEY = "gc-procurement-items-v1";

type ProcurementStore = {
  items: ProcurementItem[];
  seededProjects: string[];
};

const emptyStore: ProcurementStore = { items: [], seededProjects: [] };

const readStore = (): ProcurementStore => {
  if (typeof window === "undefined") return emptyStore;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...emptyStore };
  try {
    const parsed = JSON.parse(raw) as ProcurementStore;
    if (!parsed || !Array.isArray(parsed.items) || !Array.isArray(parsed.seededProjects)) {
      return { ...emptyStore };
    }
    return parsed;
  } catch {
    return { ...emptyStore };
  }
};

const writeStore = (store: ProcurementStore) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
};

const ensureSeeded = (projectId: string, store: ProcurementStore) => {
  if (store.seededProjects.includes(projectId)) return store;
  const seeded = mockProcurementItems(projectId);
  const next = {
    items: [...store.items, ...seeded],
    seededProjects: [...store.seededProjects, projectId],
  };
  writeStore(next);
  return next;
};

const nowIso = () => new Date().toISOString();

export async function listItems(projectId: string): Promise<ProcurementItem[]> {
  if (!projectId) return [];
  let store = readStore();
  store = ensureSeeded(projectId, store);
  return store.items.filter((item) => item.project_id === projectId && !item.archived_at);
}

export async function createItem(projectId: string, payload: ProcurementItemInput): Promise<ProcurementItem> {
  if (!projectId) {
    throw new Error("Project ID is required to create a procurement item.");
  }
  const store = readStore();
  const timestamp = nowIso();
  const item: ProcurementItem = {
    id: `proc-${Date.now()}`,
    project_id: projectId,
    ...payload,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };
  const next = { ...store, items: [...store.items, item] };
  writeStore(next);
  return item;
}

export async function updateItem(id: string, patch: Partial<ProcurementItemInput>): Promise<ProcurementItem | null> {
  const store = readStore();
  let updated: ProcurementItem | null = null;
  const nextItems = store.items.map((item) => {
    if (item.id !== id) return item;
    updated = { ...item, ...patch, updated_at: nowIso() };
    return updated;
  });
  if (!updated) return null;
  writeStore({ ...store, items: nextItems });
  return updated;
}

export async function deleteItem(id: string): Promise<void> {
  const store = readStore();
  const nextItems = store.items.map((item) =>
    item.id === id ? { ...item, archived_at: nowIso(), updated_at: nowIso() } : item
  );
  writeStore({ ...store, items: nextItems });
}
