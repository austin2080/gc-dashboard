import { createClient } from "@/lib/supabase/server";

export async function getMyCompanyId() {
  const supabase = await createClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error("Not authenticated");

  const userId = userData.user.id;

  const { data, error } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (error) throw error;

  return data.company_id as string;
}

export async function getMyCompanyMember() {
  const supabase = await createClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error("Not authenticated");

  const userId = userData.user.id;

  const { data, error } = await supabase
    .from("company_members")
    .select("company_id,can_view_all_projects")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (error) throw error;

  return data as { company_id: string; can_view_all_projects: boolean | null };
}
