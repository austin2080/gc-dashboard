import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type DirectoryCompanyRow = {
  id: string;
  name: string;
  trade?: string | null;
  contact_title?: string | null;
  primary_contact?: string | null;
  email?: string | null;
  phone?: string | null;
  office_phone?: string | null;
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
    contactTitle: row.contact_title ?? undefined,
    primaryContact: row.primary_contact ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    officePhone: row.office_phone ?? undefined,
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

    let companyId: string | null = null;

    const { data: activeMember } = await dataClient
      .from("company_members")
      .select("company_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (activeMember?.company_id) companyId = activeMember.company_id as string;

    if (!companyId) {
      const { data: fallbackMember } = await dataClient
        .from("company_members")
        .select("company_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fallbackMember?.company_id) companyId = fallbackMember.company_id as string;
    }

    if (!companyId) {
      const { data: userProject } = await dataClient
        .from("projects")
        .select("company_id")
        .eq("created_by", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (userProject?.company_id) companyId = userProject.company_id as string;
    }

    if (!companyId) {
      const { data: userCompany } = await dataClient
        .from("companies")
        .select("id")
        .eq("created_by", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (userCompany?.id) companyId = userCompany.id as string;
    }

    if (!companyId) {
      const { data: anyProject } = await dataClient
        .from("projects")
        .select("company_id")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (anyProject?.company_id) companyId = anyProject.company_id as string;
    }

    if (!companyId) {
      const { data: anyDirectory } = await dataClient
        .from("directory_companies")
        .select("tenant_company_id")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (anyDirectory?.tenant_company_id) companyId = anyDirectory.tenant_company_id as string;
    }

    if (!companyId) throw new Error("No company membership");

    const { data: companies, error: companiesError } = await dataClient
      .from("directory_companies")
      .select(
        "id,name,trade,contact_title,primary_contact,email,phone,office_phone,address,city,state,zip,country,website,license_number,tax_id,vendor_type,procore_company_id,notes,is_active,updated_at,created_at"
      )
      .eq("tenant_company_id", companyId)
      .order("name", { ascending: true });

    if (companiesError) {
      return NextResponse.json({ error: companiesError.message }, { status: 500 });
    }

    const { data: projects, error: projectsError } = await dataClient
      .from("projects")
      .select("id,name")
      .eq("company_id", companyId)
      .order("name", { ascending: true });

    if (projectsError) {
      return NextResponse.json({ error: projectsError.message }, { status: 500 });
    }

    const { data: assignments, error: assignmentsError } = await dataClient
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
    if (message === "Not authenticated") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json(
      {
        companies: [],
        projects: [],
        projectCompanies: [],
      },
      { status: 200 }
    );
  }
}
