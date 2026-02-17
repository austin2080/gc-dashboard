import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/db/tenant";

type ProjectRow = {
  id: string;
  name: string;
  end_date: string | null;
  health: "on_track" | "at_risk" | "on_hold" | "complete";
};

export async function GET() {
  try {
    const { supabase, companyId } = await getTenantContext();
    const { data, error } = await supabase
      .from("projects")
      .select("id,name,end_date,health")
      .eq("company_id", companyId)
      .neq("health", "complete")
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ projects: (data ?? []) as ProjectRow[] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    const status = message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
