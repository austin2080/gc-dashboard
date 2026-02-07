import { DIRECTORY_SEED_DATA } from "@/lib/directory/mock-seed";
import { Company, DirectoryData, ProjectCompany } from "@/lib/directory/types";

const STORAGE_KEY = "gc-dashboard.directory.v1";

let memoryStore: DirectoryData | null = null;

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readStore(): DirectoryData {
  if (typeof window === "undefined") {
    if (!memoryStore) memoryStore = clone(DIRECTORY_SEED_DATA);
    return clone(memoryStore);
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = clone(DIRECTORY_SEED_DATA);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    return JSON.parse(raw) as DirectoryData;
  } catch {
    const seeded = clone(DIRECTORY_SEED_DATA);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function writeStore(next: DirectoryData): void {
  if (typeof window === "undefined") {
    memoryStore = clone(next);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getDirectoryData(): DirectoryData {
  return readStore();
}

export function upsertCompany(input: Omit<Company, "id" | "lastUpdated"> & { id?: string }): Company {
  const data = readStore();
  const now = new Date().toISOString();

  const company: Company = {
    ...input,
    id: input.id ?? uid("comp"),
    lastUpdated: now,
  };

  const idx = data.companies.findIndex((item) => item.id === company.id);
  if (idx >= 0) data.companies[idx] = company;
  else data.companies.unshift(company);

  writeStore(data);
  return company;
}

export function setCompanyActive(companyId: string, isActive: boolean): void {
  const data = readStore();
  const company = data.companies.find((item) => item.id === companyId);
  if (!company) return;

  company.isActive = isActive;
  company.lastUpdated = new Date().toISOString();
  writeStore(data);
}

export function removeCompany(companyId: string): void {
  const data = readStore();
  data.companies = data.companies.filter((item) => item.id !== companyId);
  data.projectCompanies = data.projectCompanies.filter((item) => item.companyId !== companyId);
  writeStore(data);
}

export function assignCompanyToProject(projectId: string, companyId: string): ProjectCompany | null {
  const data = readStore();
  const exists = data.projectCompanies.find(
    (entry) => entry.projectId === projectId && entry.companyId === companyId
  );
  if (exists) return exists;

  const relation: ProjectCompany = {
    id: uid("pc"),
    projectId,
    companyId,
    assignedAt: new Date().toISOString(),
  };

  data.projectCompanies.push(relation);
  writeStore(data);
  return relation;
}
