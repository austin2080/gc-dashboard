import { createClient } from "@/lib/supabase/server";

export async function getMyCompanyId() {
  const supabase = await createClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error("Not authenticated");

  const userId = userData.user.id;

  const { data: activeMember, error: activeError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (activeMember?.company_id) return activeMember.company_id as string;

  const { data: fallbackMember, error: fallbackError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallbackError || !fallbackMember?.company_id) throw activeError ?? fallbackError ?? new Error("No company membership");

  return fallbackMember.company_id as string;
}

export async function getMyCompanyMember() {
  const supabase = await createClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error("Not authenticated");

  const userId = userData.user.id;

  const { data: activeMember, error: activeError } = await supabase
    .from("company_members")
    .select("company_id,can_view_all_projects")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (activeMember?.company_id) {
    return activeMember as { company_id: string; can_view_all_projects: boolean | null };
  }

  const { data: fallbackMember, error: fallbackError } = await supabase
    .from("company_members")
    .select("company_id,can_view_all_projects")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallbackError || !fallbackMember?.company_id) throw activeError ?? fallbackError ?? new Error("No company membership");

  return fallbackMember as { company_id: string; can_view_all_projects: boolean | null };
}
