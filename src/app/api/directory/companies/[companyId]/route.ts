import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/db/tenant";

type RouteContext = {
  params: { companyId: string } | Promise<{ companyId: string }>;
};

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { supabase, companyId: tenantCompanyId } = await getTenantContext();
    const resolved = await Promise.resolve(context.params);
    const companyId = resolved?.companyId ?? "";
    if (!companyId) {
      return NextResponse.json({ error: "Company id required." }, { status: 400 });
    }

    const { error } = await supabase
      .from("directory_companies")
      .delete()
      .eq("id", companyId)
      .eq("tenant_company_id", tenantCompanyId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    const status = message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
