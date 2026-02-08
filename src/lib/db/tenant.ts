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

  const { data: member, error } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", authData.user.id)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (error || !member) throw new Error("No active company membership");

  return {
    supabase,
    userId: authData.user.id,
    companyId: member.company_id as string,
  };
}
