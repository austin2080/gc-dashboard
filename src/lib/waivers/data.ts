import { MOCK_WAIVERS } from "@/lib/waivers/mockWaivers";
import type { WaiverRecord } from "@/lib/waiver-status";

export type Vendor = {
  id: string;
  name: string;
  trade?: string;
  email?: string;
};

export type Project = {
  id: string;
  name: string;
};

export type PayApp = {
  id: string;
  projectId: string;
  number: number;
};

export type WaiverDeskData = {
  vendors: Vendor[];
  projects: Project[];
  payApps: PayApp[];
  waiverRecords: WaiverRecord[];
};

const STORAGE_KEY = "gc-dashboard.waiverdesk-data";

const vendorSeeds: Vendor[] = [
  {
    id: "contractor-summit-concrete",
    name: "Summit Concrete",
    trade: "Concrete",
    email: "ap@summitconcrete.com",
  },
  {
    id: "contractor-prime-steel",
    name: "Prime Steel",
    trade: "Structural Steel",
    email: "billing@primestreel.com",
  },
  {
    id: "contractor-delta-electric",
    name: "Delta Electric",
    trade: "Electrical",
    email: "ap@deltaelectric.com",
  },
  {
    id: "contractor-skyline-masonry",
    name: "Skyline Masonry",
    trade: "Masonry",
    email: "ar@skylinemasonry.com",
  },
  {
    id: "contractor-north-plumbing",
    name: "North Plumbing",
    trade: "Plumbing",
    email: "ap@northplumbing.com",
  },
  {
    id: "contractor-apex-glass",
    name: "Apex Glass",
    trade: "Glazing",
    email: "ap@apexglass.com",
  },
  {
    id: "contractor-horizon-roofing",
    name: "Horizon Roofing",
    trade: "Roofing",
    email: "billing@horizonroofing.com",
  },
  {
    id: "contractor-ironline-steel",
    name: "Ironline Steel",
    trade: "Steel Fabrication",
    email: "ap@ironline.com",
  },
  {
    id: "contractor-copper-ridge-plumbing",
    name: "Copper Ridge Plumbing",
    trade: "Plumbing",
    email: "ap@copperridgeplumbing.com",
  },
];

function buildPayAppId(projectId: string, payAppNumber: number) {
  return `${projectId}-pa-${payAppNumber}`;
}

function buildSeedData(): WaiverDeskData {
  const projectMap = new Map<string, Project>();
  const payAppMap = new Map<string, PayApp>();

  MOCK_WAIVERS.forEach((record) => {
    if (!projectMap.has(record.projectId)) {
      projectMap.set(record.projectId, {
        id: record.projectId,
        name: record.projectName,
      });
    }

    const payAppId = buildPayAppId(record.projectId, record.payAppNumber);
    if (!payAppMap.has(payAppId)) {
      payAppMap.set(payAppId, {
        id: payAppId,
        projectId: record.projectId,
        number: record.payAppNumber,
      });
    }
  });

  return {
    vendors: vendorSeeds,
    projects: Array.from(projectMap.values()),
    payApps: Array.from(payAppMap.values()),
    waiverRecords: MOCK_WAIVERS,
  };
}

function parseStore(raw: string | null): WaiverDeskData | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WaiverDeskData;
  } catch {
    return null;
  }
}

function readStore(): WaiverDeskData | null {
  if (typeof window === "undefined") return null;
  return parseStore(window.localStorage.getItem(STORAGE_KEY));
}

function writeStore(value: WaiverDeskData) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function getWaiverDeskData(): WaiverDeskData {
  const stored = readStore();
  if (stored) return stored;

  const seed = buildSeedData();
  writeStore(seed);
  return seed;
}

export function getVendorById(data: WaiverDeskData, vendorId: string) {
  return data.vendors.find((vendor) => vendor.id === vendorId);
}

export function getVendorRecords(data: WaiverDeskData, vendorId: string) {
  return data.waiverRecords.filter((record) => record.contractorId === vendorId);
}

export function getProjectById(data: WaiverDeskData, projectId: string) {
  return data.projects.find((project) => project.id === projectId);
}

export function getPayAppsForProject(data: WaiverDeskData, projectId: string) {
  return data.payApps.filter((payApp) => payApp.projectId === projectId);
}

export function formatPayAppLabel(payApp: PayApp) {
  return `PA-${payApp.number}`;
}

export function getRecordPayAppLabel(record: WaiverRecord) {
  return `PA-${record.payAppNumber}`;
}
