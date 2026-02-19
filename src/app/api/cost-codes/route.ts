import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/db/tenant";
import { createClient } from "@/lib/supabase/server";

type CostCodeRow = {
  id: string;
  code: string;
  description?: string | null;
  division?: string | null;
  is_active?: boolean | null;
};

export async function GET() {
  try {
    let supabase: Awaited<ReturnType<typeof createClient>>;
    let companyId: string;
    try {
      const tenant = await getTenantContext();
      supabase = tenant.supabase;
      companyId = tenant.companyId;
    } catch {
      // Fallback for users who can access Bid Management but lack an "active" membership flag.
      supabase = await createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Not authenticated");
      const { data: member, error: memberError } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", authData.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (memberError || !member?.company_id) throw new Error("No company membership");
      companyId = member.company_id as string;
    }

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
