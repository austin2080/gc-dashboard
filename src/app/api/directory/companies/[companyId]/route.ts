import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: { companyId: string } | Promise<{ companyId: string }>;
};

type DirectoryCompanyRow = {
  id: string;
  name: string | null;
  trade: string | null;
  primary_contact: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  notes: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  last_contacted?: string | null;
};

type ProfilePayload = {
  company: {
    id: string;
    company_name: string;
    trade: string | null;
    status: "Active" | "Inactive";
    primary_contact: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
    notes: string | null;
    created_at: string | null;
    updated_at: string | null;
    last_contacted: string | null;
  };
  assignments: Array<{
    project_id: string;
    project_name: string;
    city: string | null;
    status: string | null;
    last_activity: string | null;
    role_trade: string | null;
  }>;
  assignmentsSource: "directory_company_projects" | "company_projects" | "none";
  notes: Array<{ id: string; note: string; created_at: string | null }>;
  notesSource: "company_notes" | "companies";
};

type UpdatePayload = {
  updates?: {
    company_name?: string;
    trade?: string;
    primary_contact?: string;
    email?: string;
    phone?: string;
    status?: "Active" | "Inactive" | string;
    notes?: string;
  };
  addNote?: string;
};

function clean(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const value = String((err as { message?: unknown }).message ?? "").trim();
    if (value) return value;
  }
  return fallback;
}

function isMissingRelationError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = String((error as { code?: string }).code ?? "");
  const message = String((error as { message?: string }).message ?? "");
  return code === "42P01" || code === "PGRST205" || message.toLowerCase().includes("does not exist");
}

function extractNote(row: Record<string, unknown>) {
  const value = row.note ?? row.content ?? row.body ?? row.text ?? row.message;
  const note = clean(value);
  if (!note) return null;
  const createdAt = clean(row.created_at ?? row.updated_at);
  return {
    id: String(row.id ?? crypto.randomUUID()),
    note,
    created_at: createdAt,
  };
}

async function loadAssignments(
  supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>,
  tenantCompanyId: string,
  directoryCompanyId: string,
  fallbackTrade: string | null
) {
  const { data: directoryRows, error: directoryError } = await supabase
    .from("directory_company_projects")
    .select("project_id,assigned_at")
    .eq("tenant_company_id", tenantCompanyId)
    .eq("company_id", directoryCompanyId);

  if (!directoryError) {
    const projectIds = Array.from(
      new Set(
        (directoryRows ?? [])
          .map((row) => clean(row.project_id))
          .filter((value): value is string => Boolean(value))
      )
    );
    const { data: projects } =
      projectIds.length > 0
        ? await supabase.from("projects").select("id,name,city,status,updated_at").in("id", projectIds)
        : { data: [] as Array<{ id: string; name: string | null; city: string | null; status: string | null; updated_at: string | null }> };
    const byProjectId = new Map((projects ?? []).map((project) => [project.id, project]));
    return {
      assignmentsSource: "directory_company_projects" as const,
      assignments: (directoryRows ?? []).flatMap((row) => {
        const projectId = clean(row.project_id);
        if (!projectId) return [];
        const project = byProjectId.get(projectId);
        return [
          {
            project_id: projectId,
            project_name: clean(project?.name) ?? "Untitled project",
            city: clean(project?.city),
            status: clean(project?.status) ?? "Active",
            last_activity: clean(project?.updated_at ?? row.assigned_at),
            role_trade: fallbackTrade,
          },
        ];
      }),
    };
  }

  if (!isMissingRelationError(directoryError)) {
    return { assignmentsSource: "none" as const, assignments: [] };
  }

  const { data: companyProjectRows, error: companyProjectError } = await supabase
    .from("company_projects")
    .select("*")
    .eq("company_id", directoryCompanyId);

  if (companyProjectError) {
    return { assignmentsSource: "none" as const, assignments: [] };
  }

  const projectIds = Array.from(
    new Set(
      (companyProjectRows ?? [])
        .map((row) => clean((row as Record<string, unknown>).project_id))
        .filter((value): value is string => Boolean(value))
    )
  );

  const { data: projects } =
    projectIds.length > 0
      ? await supabase.from("projects").select("id,name,city,status,updated_at").in("id", projectIds)
      : { data: [] as Array<{ id: string; name: string | null; city: string | null; status: string | null; updated_at: string | null }> };
  const byProjectId = new Map((projects ?? []).map((project) => [project.id, project]));

  return {
    assignmentsSource: "company_projects" as const,
    assignments: (companyProjectRows ?? []).flatMap((row) => {
      const raw = row as Record<string, unknown>;
      const projectId = clean(raw.project_id);
      if (!projectId) return [];
      const project = byProjectId.get(projectId);
      return [
        {
          project_id: projectId,
          project_name: clean(project?.name) ?? "Untitled project",
          city: clean(project?.city),
          status: clean(project?.status ?? raw.status) ?? "Active",
          last_activity: clean(project?.updated_at ?? raw.updated_at ?? raw.created_at),
          role_trade: clean(raw.role ?? raw.trade) ?? fallbackTrade,
        },
      ];
    }),
  };
}

function buildFallbackNotes(notes: string | null) {
  const value = clean(notes);
  if (!value) return [];
  return [{ id: "company-notes-fallback", note: value, created_at: null }];
}

async function loadNotes(
  supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>,
  directoryCompanyId: string,
  fallbackNotes: string | null
) {
  const { data, error } = await supabase
    .from("company_notes")
    .select("*")
    .eq("company_id", directoryCompanyId)
    .order("created_at", { ascending: false });

  if (error) {
    return { notesSource: "companies" as const, notes: buildFallbackNotes(fallbackNotes) };
  }

  const parsed = (data ?? [])
    .map((row) => extractNote(row as Record<string, unknown>))
    .filter((row): row is { id: string; note: string; created_at: string | null } => Boolean(row));

  return {
    notesSource: "company_notes" as const,
    notes: parsed,
  };
}

async function loadCompanyProfile(
  supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>,
  tenantCompanyId: string,
  directoryCompanyId: string
): Promise<ProfilePayload | null> {
  const { data: company, error } = await supabase
    .from("directory_companies")
    .select("id,name,trade,primary_contact,email,phone,address,city,state,zip,country,notes,is_active,created_at,updated_at")
    .eq("tenant_company_id", tenantCompanyId)
    .eq("id", directoryCompanyId)
    .maybeSingle();

  if (error) throw error;
  if (!company) return null;
  const companyRow = company as DirectoryCompanyRow;

  const assignmentsData = await loadAssignments(supabase, tenantCompanyId, directoryCompanyId, companyRow.trade ?? null);
  const notesData = await loadNotes(supabase, directoryCompanyId, companyRow.notes ?? null);

  return {
    company: {
      id: companyRow.id,
      company_name: clean(companyRow.name) ?? "Unnamed company",
      trade: companyRow.trade ?? null,
      status: companyRow.is_active === false ? "Inactive" : "Active",
      primary_contact: companyRow.primary_contact ?? null,
      email: companyRow.email ?? null,
      phone: companyRow.phone ?? null,
      address: companyRow.address ?? null,
      city: companyRow.city ?? null,
      state: companyRow.state ?? null,
      zip: companyRow.zip ?? null,
      country: companyRow.country ?? null,
      notes: companyRow.notes ?? null,
      created_at: companyRow.created_at ?? null,
      updated_at: companyRow.updated_at ?? null,
      last_contacted: null,
    },
    assignments: assignmentsData.assignments,
    assignmentsSource: assignmentsData.assignmentsSource,
    notes: notesData.notes,
    notesSource: notesData.notesSource,
  };
}

async function appendNoteToCompanyNotes(
  supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>,
  tenantCompanyId: string,
  directoryCompanyId: string,
  userId: string,
  note: string
) {
  const attempts: Record<string, unknown>[] = [
    { tenant_company_id: tenantCompanyId, company_id: directoryCompanyId, note, created_by: userId },
    { tenant_company_id: tenantCompanyId, company_id: directoryCompanyId, content: note, created_by: userId },
    { company_id: directoryCompanyId, note, created_by: userId },
    { company_id: directoryCompanyId, content: note, created_by: userId },
  ];

  for (const payload of attempts) {
    const { error } = await supabase.from("company_notes").insert(payload);
    if (!error) return { inserted: true as const };
    if (isMissingRelationError(error)) return { inserted: false as const };
  }
  return { inserted: false as const };
}

async function appendNoteFallback(
  supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>,
  tenantCompanyId: string,
  directoryCompanyId: string,
  note: string
) {
  const { data: existing, error: loadError } = await supabase
    .from("directory_companies")
    .select("notes")
    .eq("tenant_company_id", tenantCompanyId)
    .eq("id", directoryCompanyId)
    .maybeSingle<{ notes: string | null }>();
  if (loadError) throw loadError;

  const prefix = new Date().toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  const nextValue = existing?.notes ? `${existing.notes}\n[${prefix}] ${note}` : `[${prefix}] ${note}`;

  const { error: updateError } = await supabase
    .from("directory_companies")
    .update({ notes: nextValue, updated_at: new Date().toISOString() })
    .eq("tenant_company_id", tenantCompanyId)
    .eq("id", directoryCompanyId);
  if (updateError) throw updateError;
}

async function resolveRequestContext(directoryCompanyId: string) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Not authenticated");
  const dataClient: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient> = (() => {
    try {
      return createAdminClient();
    } catch {
      return supabase;
    }
  })();

  const { data: tenantRow, error: tenantError } = await dataClient
    .from("directory_companies")
    .select("tenant_company_id")
    .eq("id", directoryCompanyId)
    .limit(1)
    .maybeSingle<{ tenant_company_id: string | null }>();

  if (tenantError) throw tenantError;
  const tenantCompanyId = clean(tenantRow?.tenant_company_id);
  if (!tenantCompanyId) throw new Error("Company not found.");

  return {
    supabase: dataClient,
    userId: authData.user.id,
    tenantCompanyId,
  };
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const resolved = await Promise.resolve(context.params);
    const companyId = clean(resolved?.companyId);
    if (!companyId) return NextResponse.json({ error: "Company id required." }, { status: 400 });

    const { supabase, tenantCompanyId } = await resolveRequestContext(companyId);
    const payload = await loadCompanyProfile(supabase, tenantCompanyId, companyId);
    if (!payload) return NextResponse.json({ error: "Company not found." }, { status: 404 });

    return NextResponse.json(payload);
  } catch (err) {
    const message = getErrorMessage(err, "Failed to load company profile.");
    const status = message === "Not authenticated" ? 401 : message === "Company not found." ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const resolved = await Promise.resolve(context.params);
    const directoryCompanyId = clean(resolved?.companyId);
    if (!directoryCompanyId) {
      return NextResponse.json({ error: "Company id required." }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as UpdatePayload;
    const { supabase, tenantCompanyId, userId } = await resolveRequestContext(directoryCompanyId);

    const updateSet: Record<string, unknown> = {};
    const updates = body.updates;
    if (updates) {
      if (Object.prototype.hasOwnProperty.call(updates, "company_name")) {
        updateSet.name = clean(updates.company_name);
      }
      if (Object.prototype.hasOwnProperty.call(updates, "trade")) {
        updateSet.trade = clean(updates.trade);
      }
      if (Object.prototype.hasOwnProperty.call(updates, "primary_contact")) {
        updateSet.primary_contact = clean(updates.primary_contact);
      }
      if (Object.prototype.hasOwnProperty.call(updates, "email")) {
        updateSet.email = clean(updates.email);
      }
      if (Object.prototype.hasOwnProperty.call(updates, "phone")) {
        updateSet.phone = clean(updates.phone);
      }
      if (Object.prototype.hasOwnProperty.call(updates, "notes")) {
        updateSet.notes = clean(updates.notes);
      }
      if (Object.prototype.hasOwnProperty.call(updates, "status")) {
        const normalized = String(updates.status ?? "").trim().toLowerCase();
        updateSet.is_active = normalized !== "inactive";
      }
    }

    if (Object.keys(updateSet).length > 0) {
      updateSet.updated_at = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("directory_companies")
        .update(updateSet)
        .eq("tenant_company_id", tenantCompanyId)
        .eq("id", directoryCompanyId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    const newNote = clean(body.addNote);
    if (newNote) {
      const inserted = await appendNoteToCompanyNotes(
        supabase,
        tenantCompanyId,
        directoryCompanyId,
        userId,
        newNote
      );
      if (!inserted.inserted) {
        await appendNoteFallback(supabase, tenantCompanyId, directoryCompanyId, newNote);
      }
    }

    const payload = await loadCompanyProfile(supabase, tenantCompanyId, directoryCompanyId);
    if (!payload) return NextResponse.json({ error: "Company not found." }, { status: 404 });

    return NextResponse.json(payload);
  } catch (err) {
    const message = getErrorMessage(err, "Failed to update company.");
    const status = message === "Not authenticated" ? 401 : message === "Company not found." ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const resolved = await Promise.resolve(context.params);
    const companyId = clean(resolved?.companyId);
    if (!companyId) {
      return NextResponse.json({ error: "Company id required." }, { status: 400 });
    }
    const { supabase, tenantCompanyId } = await resolveRequestContext(companyId);

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
    const message = getErrorMessage(err, "Not authenticated");
    const status = message === "Not authenticated" ? 401 : message === "Company not found." ? 404 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
