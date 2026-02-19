import { createClient } from "@/lib/supabase/server";

type TenantContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  companyId: string;
};

export async function getTenantContext(): Promise<TenantContext> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Not authenticated");
  const userId = authData.user.id;

  const { data: activeMember, error: activeError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  let companyId = activeMember?.company_id as string | undefined;
  if (!companyId) {
    const { data: fallbackMember, error: fallbackError } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallbackMember?.company_id) {
      companyId = fallbackMember.company_id as string;
    } else {
      const { data: userProject } = await supabase
        .from("projects")
        .select("company_id")
        .eq("created_by", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (userProject?.company_id) {
        companyId = userProject.company_id as string;
      } else {
        const { data: userCompany } = await supabase
          .from("companies")
          .select("id")
          .eq("created_by", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (userCompany?.id) {
          companyId = userCompany.id as string;
        } else {
          const { data: anyDirectory } = await supabase
            .from("directory_companies")
            .select("tenant_company_id")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!anyDirectory?.tenant_company_id) throw fallbackError ?? new Error("No company membership");
          companyId = anyDirectory.tenant_company_id as string;
        }
      }
    }
  }

  if (activeError && !companyId) throw new Error("No company membership");

  return {
    supabase,
    userId,
    companyId,
  };
}
