import { createClient } from "@/lib/supabase/server";

export type ProjectRow = {
  id: string;
  name: string;
  city: string | null;
  health: "on_track" | "at_risk" | "on_hold" | "complete";
  start_date: string | null;
  end_date: string | null;
  contracted_value: number;
  estimated_profit: number;
  estimated_buyout: number;
  updated_at: string;
};

export async function listProjects(companyId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .select(
      "id,name,city,health,start_date,end_date,contracted_value,estimated_profit,estimated_buyout,updated_at"
    )
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProjectRow[];
}
