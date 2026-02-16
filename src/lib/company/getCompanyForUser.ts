import { createClient } from "@/lib/supabase/server";
import { normalizeEnabledModules } from "@/lib/access/modules";
import type { CompanyModuleAccess } from "@/lib/access/modules";

type CompanyRow = {
  id: string;
  name: string | null;
  plan: string | null;
  enabled_modules: unknown;
};

type MemberRow = {
  company_id: string;
  companies: CompanyRow | CompanyRow[] | null;
};

function pickCompany(companies: MemberRow["companies"]): CompanyRow | null {
  if (!companies) return null;
  if (Array.isArray(companies)) return companies[0] ?? null;
  return companies;
}

export async function getCompanyForUser(): Promise<CompanyModuleAccess | null> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) return null;

  const { data, error } = await supabase
    .from("company_members")
    .select("company_id, companies(id,name,plan,enabled_modules)")
    .eq("user_id", authData.user.id)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (error || !data) return null;

  const company = pickCompany((data as MemberRow).companies);
  if (!company) return null;

  return {
    id: company.id,
    name: company.name ?? null,
    plan: company.plan ?? "bidding_core",
    enabled_modules: normalizeEnabledModules(company.enabled_modules),
  };
}
