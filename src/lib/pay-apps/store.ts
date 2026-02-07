import { buildSeedData } from "./mock-data";
import type { PayAppsData, PayApp, WaiverRecord } from "./types";

const STORAGE_KEY = "gc-dashboard.pay-apps";

type StoreShape = Record<string, PayAppsData>;

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

export function getProjectPayAppsData(projectId: string): PayAppsData {
  const store = readStore();
  if (!store[projectId]) {
    store[projectId] = buildSeedData(projectId);
    writeStore(store);
  }
  return store[projectId];
}

export function upsertPayApp(projectId: string, payApp: PayApp) {
  const store = readStore();
  const data = store[projectId] ?? buildSeedData(projectId);
  const existing = data.payApps.find((item) => item.id === payApp.id);

  if (existing) {
    Object.assign(existing, { ...payApp, updatedAt: new Date().toISOString() });
  } else {
    data.payApps.unshift({ ...payApp, updatedAt: new Date().toISOString() });
  }

  store[projectId] = data;
  writeStore(store);
}

export function upsertWaiverRecord(projectId: string, incoming: WaiverRecord) {
  const store = readStore();
  const data = store[projectId] ?? buildSeedData(projectId);
  const idx = data.waiverRecords.findIndex((item) => item.id === incoming.id);
  const record = { ...incoming, updatedAt: new Date().toISOString() };

  if (idx >= 0) data.waiverRecords[idx] = record;
  else data.waiverRecords.push(record);

  const payApp = data.payApps.find((item) => item.id === incoming.payAppId);
  if (payApp) payApp.updatedAt = new Date().toISOString();

  store[projectId] = data;
  writeStore(store);
}

export function summarizeStatuses(records: WaiverRecord[]) {
  return records.reduce(
    (acc, current) => {
      acc[current.status] += 1;
      return acc;
    },
    { missing: 0, requested: 0, uploaded: 0, approved: 0 }
  );
}
