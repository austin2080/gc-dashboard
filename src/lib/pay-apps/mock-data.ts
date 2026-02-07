import type { Contractor, PayApp, PayAppsData, WaiverRecord, WaiverType } from "./types";

const now = new Date().toISOString();

const contractorsSeed: Contractor[] = [
  { id: "c-1", projectId: "default", name: "Atlas Concrete", hasFinalWaivers: false },
  { id: "c-2", projectId: "default", name: "Pioneer Mechanical", hasFinalWaivers: false },
  { id: "c-3", projectId: "default", name: "Summit Electrical", hasFinalWaivers: true },
];

const payAppsSeed: PayApp[] = [
  {
    id: "pa-1",
    projectId: "default",
    number: "PA-001",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    totalAmount: 285000,
    notes: "Initial draw",
    updatedAt: now,
  },
  {
    id: "pa-2",
    projectId: "default",
    number: "PA-002",
    periodStart: "2026-02-01",
    periodEnd: "2026-02-28",
    totalAmount: 392500,
    notes: "Framing and MEP rough-in progress",
    updatedAt: now,
  },
];

const defaultWaiverTypes: WaiverType[] = ["conditional_progress", "unconditional_progress"];

function record(
  contractorId: string,
  payAppId: string,
  waiverType: WaiverType,
  status: WaiverRecord["status"],
  amount?: number
): WaiverRecord {
  return {
    id: `${payAppId}-${contractorId}-${waiverType}`,
    projectId: "default",
    contractorId,
    payAppId,
    waiverType,
    status,
    amount,
    updatedAt: now,
  };
}

const waiverRecordsSeed: WaiverRecord[] = [
  record("c-1", "pa-1", "conditional_progress", "approved", 110000),
  record("c-1", "pa-1", "unconditional_progress", "uploaded", 100000),
  record("c-2", "pa-1", "conditional_progress", "requested", 75000),
  record("c-2", "pa-1", "unconditional_progress", "missing", 0),
  record("c-3", "pa-1", "conditional_progress", "approved", 95000),
  record("c-3", "pa-1", "unconditional_progress", "approved", 90000),
  record("c-1", "pa-2", "conditional_progress", "requested", 125000),
  record("c-1", "pa-2", "unconditional_progress", "missing", 0),
  record("c-2", "pa-2", "conditional_progress", "missing", 0),
  record("c-2", "pa-2", "unconditional_progress", "missing", 0),
  ...defaultWaiverTypes.map((type) => record("c-3", "pa-2", type, "uploaded", 80000)),
  record("c-3", "pa-2", "conditional_final", "missing", 0),
  record("c-3", "pa-2", "unconditional_final", "missing", 0),
];

export function buildSeedData(projectId: string): PayAppsData {
  return {
    payApps: payAppsSeed.map((item) => ({ ...item, projectId })),
    contractors: contractorsSeed.map((item) => ({ ...item, projectId })),
    waiverRecords: waiverRecordsSeed.map((item) => ({ ...item, projectId })),
  };
}
