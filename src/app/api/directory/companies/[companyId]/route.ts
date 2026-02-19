import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: { companyId: string } | Promise<{ companyId: string }>;
};

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("Not authenticated");
    const userId = authData.user.id;
    const dataClient: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient> = (() => {
      try {
        return createAdminClient();
      } catch {
        return supabase;
      }
    })();

    let tenantCompanyId: string | null = null;

    const { data: activeMember } = await dataClient
      .from("company_members")
      .select("company_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (activeMember?.company_id) tenantCompanyId = activeMember.company_id as string;

    if (!tenantCompanyId) {
      const { data: fallbackMember } = await dataClient
        .from("company_members")
        .select("company_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fallbackMember?.company_id) tenantCompanyId = fallbackMember.company_id as string;
    }

    if (!tenantCompanyId) {
      const { data: userProject } = await dataClient
        .from("projects")
        .select("company_id")
        .eq("created_by", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (userProject?.company_id) tenantCompanyId = userProject.company_id as string;
    }

    if (!tenantCompanyId) {
      const { data: userCompany } = await dataClient
        .from("companies")
        .select("id")
        .eq("created_by", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (userCompany?.id) tenantCompanyId = userCompany.id as string;
    }

    if (!tenantCompanyId) {
      const { data: anyDirectory } = await dataClient
        .from("directory_companies")
        .select("tenant_company_id")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (anyDirectory?.tenant_company_id) tenantCompanyId = anyDirectory.tenant_company_id as string;
    }

    if (!tenantCompanyId) throw new Error("No company membership");

    const resolved = await Promise.resolve(context.params);
    const companyId = resolved?.companyId ?? "";
    if (!companyId) {
      return NextResponse.json({ error: "Company id required." }, { status: 400 });
    }

    const { error } = await dataClient
      .from("directory_companies")
      .delete()
      .eq("id", companyId)
      .eq("tenant_company_id", tenantCompanyId);

    if (error) {
      console.error("Failed to delete directory company", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Directory company DELETE failed", err);
    const message = err instanceof Error ? err.message : "Not authenticated";
    const status = message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
