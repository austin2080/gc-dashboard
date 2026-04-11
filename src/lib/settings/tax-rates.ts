"use client";

export type WorkspaceTaxRate = {
  id: string;
  city: string;
  state: string;
  rate: string;
};

export const WORKSPACE_TAX_RATES_STORAGE_KEY = "builderos.settings.tax-rates";

export const DEFAULT_WORKSPACE_TAX_RATES: WorkspaceTaxRate[] = [
  { id: "tax-scottsdale", city: "Scottsdale", state: "AZ", rate: "8.0500" },
  { id: "tax-phoenix", city: "Phoenix", state: "AZ", rate: "8.6000" },
  { id: "tax-mesa", city: "Mesa", state: "AZ", rate: "8.3000" },
  { id: "tax-flagstaff", city: "Flagstaff", state: "AZ", rate: "9.1800" },
  { id: "tax-paradise-valley", city: "Paradise Valley", state: "AZ", rate: "8.8000" },
  { id: "tax-cave-creek", city: "Cave Creek", state: "AZ", rate: "9.3000" },
  { id: "tax-gilbert", city: "Gilbert", state: "AZ", rate: "8.3000" },
  { id: "tax-glendale", city: "Glendale", state: "AZ", rate: "9.2000" },
  { id: "tax-tempe", city: "Tempe", state: "AZ", rate: "8.1000" },
  { id: "tax-peoria", city: "Peoria", state: "AZ", rate: "8.1000" },
  { id: "tax-chandler", city: "Chandler", state: "AZ", rate: "7.8000" },
  { id: "tax-buckeye", city: "Buckeye", state: "AZ", rate: "9.3000" },
  { id: "tax-surprise", city: "Surprise", state: "AZ", rate: "10.0000" },
  { id: "tax-avondale", city: "Avondale", state: "AZ", rate: "8.8000" },
];

function normalizeTaxRateRow(value: unknown, index: number): WorkspaceTaxRate | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<WorkspaceTaxRate>;
  const city = typeof row.city === "string" ? row.city.trim() : "";
  const state = typeof row.state === "string" ? row.state.trim().toUpperCase() : "";
  const rate = typeof row.rate === "string" ? row.rate.trim() : "";
  if (!city || !state || !rate) return null;

  return {
    id: typeof row.id === "string" && row.id.trim() ? row.id : `tax-rate-${index + 1}`,
    city,
    state,
    rate,
  };
}

export function getWorkspaceTaxRates(): WorkspaceTaxRate[] {
  if (typeof window === "undefined") return DEFAULT_WORKSPACE_TAX_RATES;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_TAX_RATES_STORAGE_KEY);
    if (!raw) return DEFAULT_WORKSPACE_TAX_RATES;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_WORKSPACE_TAX_RATES;
    const rows = parsed
      .map((row, index) => normalizeTaxRateRow(row, index))
      .filter((row): row is WorkspaceTaxRate => Boolean(row));
    return rows.length ? rows : DEFAULT_WORKSPACE_TAX_RATES;
  } catch {
    return DEFAULT_WORKSPACE_TAX_RATES;
  }
}

export function setWorkspaceTaxRates(rows: WorkspaceTaxRate[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WORKSPACE_TAX_RATES_STORAGE_KEY, JSON.stringify(rows));
}
