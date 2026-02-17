export type ModuleKey = "bidding" | "waiverdesk" | "pm";

export type CompanyModuleAccess = {
  id: string;
  name: string | null;
  plan: string;
  enabled_modules: ModuleKey[];
};

const MODULE_SET = new Set<ModuleKey>(["bidding", "waiverdesk", "pm"]);

export function normalizeEnabledModules(value: unknown): ModuleKey[] {
  if (!Array.isArray(value)) return ["bidding"];

  const modules = value
    .map((item) => String(item).toLowerCase())
    .filter((item): item is ModuleKey => MODULE_SET.has(item as ModuleKey));

  if (!modules.includes("bidding")) modules.unshift("bidding");
  return Array.from(new Set(modules));
}

export function hasModuleAccess(
  company: Pick<CompanyModuleAccess, "enabled_modules"> | null | undefined,
  moduleKey: ModuleKey
) {
  if (moduleKey === "bidding") return true;
  if (!company) return false;
  return normalizeEnabledModules(company.enabled_modules).includes(moduleKey);
}

export function requireModuleAccess(
  company: Pick<CompanyModuleAccess, "enabled_modules"> | null | undefined,
  moduleKey: ModuleKey
) {
  return hasModuleAccess(company, moduleKey);
}
