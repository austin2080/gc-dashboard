import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/db/tenant";
import { createClient } from "@/lib/supabase/server";

type CompanyInput = {
  id?: string;
  name?: string;
  trade?: string;
  primaryContact?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  website?: string;
  licenseNumber?: string;
  taxId?: string;
  vendorType?: string;
  procoreCompanyId?: string;
  notes?: string;
  isActive?: boolean;
};

function clean(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const queryProjectId = url.searchParams.get("project");
    const payload = (await req.json().catch(() => null)) as { companies?: CompanyInput[]; projectId?: string } | null;
    const fallbackProjectId = payload?.projectId ?? queryProjectId;

    let supabase: Awaited<ReturnType<typeof createClient>>;
    let companyId: string;
    try {
      const tenant = await getTenantContext();
      supabase = tenant.supabase;
      companyId = tenant.companyId;
    } catch {
      supabase = await createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Not authenticated");

      const { data: member } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", authData.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (member?.company_id) {
        companyId = member.company_id as string;
      } else if (fallbackProjectId) {
        const { data: project, error: projectError } = await supabase
          .from("projects")
          .select("company_id")
          .eq("id", fallbackProjectId)
          .limit(1)
          .maybeSingle();
        if (projectError || !project?.company_id) throw new Error("No company membership");
        companyId = project.company_id as string;
      } else {
        const { data: anyProject } = await supabase
          .from("projects")
          .select("company_id")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (anyProject?.company_id) {
          companyId = anyProject.company_id as string;
        } else {
          const { data: anyDirectory } = await supabase
            .from("directory_companies")
            .select("tenant_company_id")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!anyDirectory?.tenant_company_id) throw new Error("No company membership");
          companyId = anyDirectory.tenant_company_id as string;
        }
      }
    }

    const companies = payload?.companies ?? [];
    if (!Array.isArray(companies) || companies.length === 0) {
      return NextResponse.json({ error: "No companies provided." }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("directory_companies")
      .select("id,name,procore_company_id")
      .eq("tenant_company_id", companyId);

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    const byName = new Map(
      (existing ?? []).map((row) => [String(row.name ?? "").toLowerCase(), row.id])
    );
    const byProcore = new Map(
      (existing ?? [])
        .filter((row) => row.procore_company_id)
        .map((row) => [String(row.procore_company_id), row.id])
    );

    const rows = companies
      .map((company) => {
        const name = clean(company.name);
        if (!name) return null;

        const procoreCompanyId = clean(company.procoreCompanyId);
        const idMatch =
          (procoreCompanyId && byProcore.get(procoreCompanyId)) ??
          byName.get(name.toLowerCase()) ??
          company.id;

        return {
          id: idMatch ?? undefined,
          tenant_company_id: companyId,
          name,
          trade: clean(company.trade),
          primary_contact: clean(company.primaryContact),
          email: clean(company.email),
          phone: clean(company.phone),
          address: clean(company.address),
          city: clean(company.city),
          state: clean(company.state),
          zip: clean(company.zip),
          country: clean(company.country),
          website: clean(company.website),
          license_number: clean(company.licenseNumber),
          tax_id: clean(company.taxId),
          vendor_type: clean(company.vendorType),
          procore_company_id: procoreCompanyId,
          notes: clean(company.notes),
          is_active: company.isActive ?? true,
        };
      })
      .filter(Boolean);

    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid companies to save." }, { status: 400 });
    }

    const { data: saved, error } = await supabase
      .from("directory_companies")
      .upsert(rows, {
        onConflict: "id",
      })
      .select("id,name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, count: rows.length, companies: saved ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    if (message === "Not authenticated") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
