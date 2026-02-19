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

  const { data: activeMember, error: activeError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", authData.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  let companyId = activeMember?.company_id as string | undefined;
  if (!companyId) {
    const { data: fallbackMember, error: fallbackError } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", authData.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallbackError || !fallbackMember?.company_id) throw new Error("No company membership");
    companyId = fallbackMember.company_id as string;
  }

  if (activeError && !companyId) throw new Error("No company membership");

  return {
    supabase,
    userId: authData.user.id,
    companyId,
  };
}
