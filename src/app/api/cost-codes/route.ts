import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/db/tenant";

type CostCodeRow = {
  id: string;
  code: string;
  description?: string | null;
  division?: string | null;
  is_active?: boolean | null;
};

export async function GET() {
  try {
    const { supabase, companyId } = await getTenantContext();

    const { data, error } = await supabase
      .from("cost_codes")
      .select("id,code,description,division,is_active")
      .eq("company_id", companyId)
      .order("code", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      costCodes: (data ?? []) as CostCodeRow[],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    const status = message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
