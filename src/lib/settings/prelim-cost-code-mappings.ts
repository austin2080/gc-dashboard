"use client";

import type { WorkspaceCostCode } from "./company-cost-codes";

export type WorkspacePrelimCostCodeMapping = {
  rowId: string;
  costCodeRowId: string | null;
};

export const WORKSPACE_PRELIM_COST_CODE_MAPPINGS_STORAGE_KEY =
  "builderos.settings.prelim-cost-code-mappings";

export const PRELIM_COST_CODE_MAPPING_ITEMS = [
  {
    rowId: "fees-general-liability",
    label: "General Liability Insurance",
    aliases: ["General Liability Insurance"],
  },
  {
    rowId: "fees-builders-risk",
    label: "Builders Risk Insurance",
    aliases: ["Builders Risk Insurance", "Builders Risk"],
  },
  {
    rowId: "fees-overhead",
    label: "Overhead",
    aliases: ["Overhead"],
  },
  {
    rowId: "fees-profit",
    label: "Profit",
    aliases: ["Profit"],
  },
  {
    rowId: "fees-performance-bond",
    label: "Performance Bond",
    aliases: ["Performance Bond", "Performance Bonding Requirements"],
  },
  {
    rowId: "fees-contingency",
    label: "Contingency",
    aliases: ["Contingency"],
  },
  {
    rowId: "__tax__",
    label: "Tax",
    aliases: ["Tax", "Sales Tax"],
  },
] as const;

function normalizeValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildDefaultMappings(
  costCodes: WorkspaceCostCode[]
): WorkspacePrelimCostCodeMapping[] {
  return PRELIM_COST_CODE_MAPPING_ITEMS.map((item) => {
    const match = costCodes.find((costCode) => {
      const normalizedDescription = normalizeValue(costCode.description);
      return item.aliases.some((alias) => normalizeValue(alias) === normalizedDescription);
    });

    return {
      rowId: item.rowId,
      costCodeRowId: match?.id ?? null,
    };
  });
}

function normalizeMappings(
  value: unknown,
  costCodes: WorkspaceCostCode[]
): WorkspacePrelimCostCodeMapping[] {
  const defaultMappings = buildDefaultMappings(costCodes);
  if (!Array.isArray(value)) return defaultMappings;

  const costCodeIds = new Set(costCodes.map((costCode) => costCode.id));
  const mappingsByRowId = new Map<string, string | null>();

  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const mapping = row as Partial<WorkspacePrelimCostCodeMapping>;
    if (typeof mapping.rowId !== "string" || !mapping.rowId.trim()) continue;
    const normalizedCostCodeRowId =
      typeof mapping.costCodeRowId === "string" && costCodeIds.has(mapping.costCodeRowId)
        ? mapping.costCodeRowId
        : null;
    mappingsByRowId.set(mapping.rowId, normalizedCostCodeRowId);
  }

  return PRELIM_COST_CODE_MAPPING_ITEMS.map((item) => ({
    rowId: item.rowId,
    costCodeRowId: mappingsByRowId.get(item.rowId) ?? defaultMappings.find((row) => row.rowId === item.rowId)?.costCodeRowId ?? null,
  }));
}

export function getDefaultWorkspacePrelimCostCodeMappings(
  costCodes: WorkspaceCostCode[]
): WorkspacePrelimCostCodeMapping[] {
  return buildDefaultMappings(costCodes);
}

export function getWorkspacePrelimCostCodeMappings(
  costCodes: WorkspaceCostCode[]
): WorkspacePrelimCostCodeMapping[] {
  const defaultMappings = buildDefaultMappings(costCodes);
  if (typeof window === "undefined") return defaultMappings;

  try {
    const raw = window.localStorage.getItem(WORKSPACE_PRELIM_COST_CODE_MAPPINGS_STORAGE_KEY);
    if (!raw) return defaultMappings;
    const parsed = JSON.parse(raw) as unknown;
    return normalizeMappings(parsed, costCodes);
  } catch {
    return defaultMappings;
  }
}

export function setWorkspacePrelimCostCodeMappings(
  mappings: WorkspacePrelimCostCodeMapping[]
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    WORKSPACE_PRELIM_COST_CODE_MAPPINGS_STORAGE_KEY,
    JSON.stringify(mappings)
  );
}
