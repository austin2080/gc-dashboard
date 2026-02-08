import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/db/tenant";

type AssignmentPayload = {
  companyId?: string;
  projectId?: string;
};

function clean(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(req: Request) {
  try {
    const { supabase, companyId: tenantCompanyId, userId } = await getTenantContext();
    const payload = (await req.json().catch(() => null)) as AssignmentPayload | null;
    const companyId = clean(payload?.companyId);
    const projectId = clean(payload?.projectId);

    if (!companyId || !projectId) {
      return NextResponse.json({ error: "Company and project are required." }, { status: 400 });
    }

    const { error } = await supabase.from("directory_company_projects").upsert(
      {
        tenant_company_id: tenantCompanyId,
        company_id: companyId,
        project_id: projectId,
        assigned_by: userId,
      },
      { onConflict: "tenant_company_id,company_id,project_id" }
    );

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

export async function DELETE(req: Request) {
  try {
    const { supabase, companyId: tenantCompanyId } = await getTenantContext();
    const payload = (await req.json().catch(() => null)) as AssignmentPayload | null;
    const companyId = clean(payload?.companyId);
    const projectId = clean(payload?.projectId);

    if (!companyId || !projectId) {
      return NextResponse.json({ error: "Company and project are required." }, { status: 400 });
    }

    const { error } = await supabase
      .from("directory_company_projects")
      .delete()
      .eq("tenant_company_id", tenantCompanyId)
      .eq("company_id", companyId)
      .eq("project_id", projectId);

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
