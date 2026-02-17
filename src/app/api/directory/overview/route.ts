import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/db/tenant";

type DirectoryCompanyRow = {
  id: string;
  name: string;
  trade?: string | null;
  primary_contact?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  website?: string | null;
  license_number?: string | null;
  tax_id?: string | null;
  vendor_type?: string | null;
  procore_company_id?: string | null;
  notes?: string | null;
  is_active?: boolean | null;
  updated_at?: string | null;
  created_at?: string | null;
};

function mapCompany(row: DirectoryCompanyRow) {
  return {
    id: row.id,
    name: row.name,
    trade: row.trade ?? undefined,
    primaryContact: row.primary_contact ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    zip: row.zip ?? undefined,
    country: row.country ?? undefined,
    website: row.website ?? undefined,
    licenseNumber: row.license_number ?? undefined,
    taxId: row.tax_id ?? undefined,
    vendorType: row.vendor_type ?? undefined,
    procoreCompanyId: row.procore_company_id ?? undefined,
    notes: row.notes ?? undefined,
    isActive: row.is_active ?? true,
    lastUpdated: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

export async function GET() {
  try {
    const { supabase, companyId } = await getTenantContext();

    const { data: companies, error: companiesError } = await supabase
      .from("directory_companies")
      .select(
        "id,name,trade,primary_contact,email,phone,address,city,state,zip,country,website,license_number,tax_id,vendor_type,procore_company_id,notes,is_active,updated_at,created_at"
      )
      .eq("tenant_company_id", companyId)
      .order("name", { ascending: true });

    if (companiesError) {
      return NextResponse.json({ error: companiesError.message }, { status: 500 });
    }

    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id,name")
      .eq("company_id", companyId)
      .order("name", { ascending: true });

    if (projectsError) {
      return NextResponse.json({ error: projectsError.message }, { status: 500 });
    }

    const { data: assignments, error: assignmentsError } = await supabase
      .from("directory_company_projects")
      .select("id,company_id,project_id,assigned_at")
      .eq("tenant_company_id", companyId);

    if (assignmentsError) {
      return NextResponse.json({ error: assignmentsError.message }, { status: 500 });
    }

    return NextResponse.json({
      companies: (companies ?? []).map(mapCompany),
      projects: (projects ?? []).map((project) => ({ id: project.id, name: project.name })),
      projectCompanies: (assignments ?? []).map((row) => ({
        id: row.id,
        companyId: row.company_id,
        projectId: row.project_id,
        assignedAt: row.assigned_at,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    const status = message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
