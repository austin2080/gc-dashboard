import { createClient } from "@/lib/supabase/client";
import type {
  BidProjectDetail,
  BidProjectSub,
  BidProjectSummary,
  BidTrade,
  BidTradeBid,
} from "./types";

type BidProjectRow = BidProjectSummary;

type BidTradeRow = BidTrade;

type BidProjectSubRow = Omit<BidProjectSub, "subcontractor"> & {
  subcontractor: {
    id: string;
    company_name: string;
    primary_contact: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

type BidTradeBidRow = BidTradeBid;
type CompanyCostCodeRow = {
  id: string;
  code: string;
  title: string | null;
  division: string | null;
  is_active: boolean | null;
};
type ProjectTradeRow = {
  id: string;
  project_id: string;
  company_cost_code_id: string | null;
  custom_code: string | null;
  custom_title: string | null;
  is_custom: boolean;
};

export type CompanyCostCode = CompanyCostCodeRow;
export type ProjectTrade = ProjectTradeRow & {
  company_cost_code: CompanyCostCode | null;
};

type BidProjectRowWithOptionalPackageNumber = Omit<BidProjectRow, "package_number"> & {
  package_number?: string | null;
};
type BidProjectRowWithOptionalEmailTemplate = Omit<
  BidProjectRowWithOptionalPackageNumber,
  "bid_email_subject" | "bid_email_body_html"
> & {
  bid_email_subject?: string | null;
  bid_email_body_html?: string | null;
};

function isMissingPackageNumberColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const details = [error]
    .flatMap((item) =>
      typeof item === "object" && item !== null
        ? [Reflect.get(item, "message"), Reflect.get(item, "details"), Reflect.get(item, "hint"), Reflect.get(item, "code")]
        : []
    )
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return details.includes("package_number");
}

function isMissingBidEmailTemplateColumns(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const details = [error]
    .flatMap((item) =>
      typeof item === "object" && item !== null
        ? [Reflect.get(item, "message"), Reflect.get(item, "details"), Reflect.get(item, "hint"), Reflect.get(item, "code")]
        : []
    )
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return details.includes("bid_email_subject") || details.includes("bid_email_body_html");
}

function normalizeBidProjectRow(row: BidProjectRowWithOptionalEmailTemplate): BidProjectRow {
  return {
    ...row,
    package_number: row.package_number ?? null,
    bid_email_subject: row.bid_email_subject ?? null,
    bid_email_body_html: row.bid_email_body_html ?? null,
  };
}

function omitMissingBidProjectColumns<
  T extends {
    package_number?: string | null;
    bid_email_subject?: string | null;
    bid_email_body_html?: string | null;
  },
>(payload: T, error: unknown) {
  const next = { ...payload };
  if (isMissingPackageNumberColumn(error)) {
    delete next.package_number;
  }
  if (isMissingBidEmailTemplateColumns(error)) {
    delete next.bid_email_subject;
    delete next.bid_email_body_html;
  }
  return next;
}

function normalizeSubcontractor(
  value:
    | BidProjectSubRow["subcontractor"]
    | BidProjectSubRow["subcontractor"][]
    | null
    | undefined
): BidProjectSubRow["subcontractor"] {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

async function getCurrentCompanyId(): Promise<string | null> {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;
  const { data: member, error: memberError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (memberError || !member?.company_id) return null;
  return member.company_id as string;
}

export async function listCompanyCostCodesForCurrentCompany(options?: { includeInactive?: boolean }): Promise<CompanyCostCode[]> {
  const includeInactive = options?.includeInactive === true;
  const companyId = await getCurrentCompanyId();

  const supabase = createClient();
  let companyCostCodesQuery = supabase
    .from("company_cost_codes")
    .select("id, code, title, division, is_active")
    .order("code", { ascending: true });
  if (companyId) {
    companyCostCodesQuery = companyCostCodesQuery.eq("company_id", companyId);
  }
  const { data, error } = await companyCostCodesQuery;

  if (!error && data) {
    const rows = data as CompanyCostCodeRow[];
    return includeInactive ? rows : rows.filter((row) => row.is_active !== false);
  }

  // Fallback for environments still using legacy cost_codes.
  let legacyQuery = supabase
    .from("cost_codes")
    .select("id, code, description, division, is_active")
    .order("code", { ascending: true });
  if (companyId) {
    legacyQuery = legacyQuery.eq("company_id", companyId);
  }
  const { data: legacyData, error: legacyError } = await legacyQuery;

  if (legacyError || !legacyData) {
    console.error("Failed to load company cost codes", error ?? legacyError);
    return [];
  }

  const mapped = (legacyData as Array<{
    id: string;
    code: string;
    description: string | null;
    division: string | null;
    is_active: boolean | null;
  }>)
    .filter((row) => includeInactive || row.is_active !== false)
    .map((row) => ({
      id: row.id,
      code: row.code,
      title: row.description,
      division: row.division,
      is_active: row.is_active,
    }));
  return mapped;
}

export async function listProjectTrades(projectId: string): Promise<ProjectTrade[]> {
  if (!projectId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_trades")
    .select("id, project_id, company_cost_code_id, custom_code, custom_title, is_custom")
    .eq("project_id", projectId)
    .order("id", { ascending: true });

  if (error || !data) {
    return [];
  }

  const rows = data as ProjectTradeRow[];
  const companyCostCodeIds = rows
    .map((row) => row.company_cost_code_id)
    .filter((value): value is string => Boolean(value));
  const byId = new Map<string, CompanyCostCodeRow>();

  if (companyCostCodeIds.length) {
    const { data: codes } = await supabase
      .from("company_cost_codes")
      .select("id, code, title, division, is_active")
      .in("id", companyCostCodeIds);
    for (const code of (codes ?? []) as CompanyCostCodeRow[]) {
      byId.set(code.id, code);
    }
  }

  return rows.map((row) => ({
    ...row,
    company_cost_code: row.company_cost_code_id ? byId.get(row.company_cost_code_id) ?? null : null,
  }));
}

export async function createProjectTradeFromCostCode(
  projectId: string,
  companyCostCodeId: string
): Promise<ProjectTrade | null> {
  if (!projectId || !companyCostCodeId) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_trades")
    .insert({
      project_id: projectId,
      company_cost_code_id: companyCostCodeId,
      is_custom: false,
      custom_code: null,
      custom_title: null,
    })
    .select("id, project_id, company_cost_code_id, custom_code, custom_title, is_custom")
    .single();

  if (error || !data) {
    return null;
  }

  const row = data as ProjectTradeRow;
  let companyCostCode: CompanyCostCode | null = null;
  const { data: codeData } = await supabase
    .from("company_cost_codes")
    .select("id, code, title, division, is_active")
    .eq("id", companyCostCodeId)
    .maybeSingle();
  if (codeData) {
    companyCostCode = codeData as CompanyCostCode;
  }
  return {
    ...row,
    company_cost_code: companyCostCode,
  };
}

export async function createProjectCustomTrade(payload: {
  projectId: string;
  customCode?: string | null;
  customTitle: string;
}): Promise<ProjectTrade | null> {
  if (!payload.projectId || !payload.customTitle.trim()) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_trades")
    .insert({
      project_id: payload.projectId,
      company_cost_code_id: null,
      custom_code: payload.customCode?.trim() || null,
      custom_title: payload.customTitle.trim(),
      is_custom: true,
    })
    .select("id, project_id, company_cost_code_id, custom_code, custom_title, is_custom")
    .single();

  if (error || !data) {
    return null;
  }

  const row = data as ProjectTradeRow;
  return {
    ...row,
    company_cost_code: null,
  };
}

export async function listBidProjects(): Promise<BidProjectSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bid_projects")
    .select("id, project_name, package_number, owner, location, budget, due_date")
    .is("archived_at", null)
    .order("due_date", { ascending: true });

  if (!error && data) {
    return (data as BidProjectRowWithOptionalPackageNumber[]).map(normalizeBidProjectRow);
  }

  if (isMissingPackageNumberColumn(error)) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("bid_projects")
      .select("id, project_name, owner, location, budget, due_date")
      .is("archived_at", null)
      .order("due_date", { ascending: true });

    if (fallbackError || !fallbackData) {
      console.error("Failed to load bid projects", fallbackError);
      return [];
    }

    return (fallbackData as BidProjectRowWithOptionalPackageNumber[]).map(normalizeBidProjectRow);
  }

  if (error || !data) {
    console.error("Failed to load bid projects", error);
    return [];
  }

  return (data as BidProjectRowWithOptionalPackageNumber[]).map(normalizeBidProjectRow);
}

export async function listArchivedBidProjects(): Promise<BidProjectSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bid_projects")
    .select("id, project_name, package_number, owner, location, budget, due_date")
    .not("archived_at", "is", null)
    .order("updated_at", { ascending: false });

  if (!error && data) {
    return (data as BidProjectRowWithOptionalPackageNumber[]).map(normalizeBidProjectRow);
  }

  if (isMissingPackageNumberColumn(error)) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("bid_projects")
      .select("id, project_name, owner, location, budget, due_date")
      .not("archived_at", "is", null)
      .order("updated_at", { ascending: false });

    if (fallbackError || !fallbackData) {
      console.error("Failed to load archived bid projects", fallbackError);
      return [];
    }

    return (fallbackData as BidProjectRowWithOptionalPackageNumber[]).map(normalizeBidProjectRow);
  }

  if (error || !data) {
    console.error("Failed to load archived bid projects", error);
    return [];
  }

  return (data as BidProjectRowWithOptionalPackageNumber[]).map(normalizeBidProjectRow);
}

export async function createBidProject(payload: {
  project_name: string;
  package_number?: string | null;
  owner?: string | null;
  location?: string | null;
  budget?: number | null;
  due_date?: string | null;
  bid_email_subject?: string | null;
  bid_email_body_html?: string | null;
}): Promise<BidProjectSummary | null> {
  const supabase = createClient();
  const insertPayload = {
    project_name: payload.project_name.trim(),
    package_number: payload.package_number?.trim() || null,
    owner: payload.owner ?? null,
    location: payload.location ?? null,
    budget: payload.budget ?? null,
    due_date: payload.due_date ?? null,
    bid_email_subject: payload.bid_email_subject ?? null,
    bid_email_body_html: payload.bid_email_body_html ?? null,
  };
  const { data, error } = await supabase
    .from("bid_projects")
    .insert(insertPayload)
    .select("id, project_name, package_number, owner, location, budget, due_date, bid_email_subject, bid_email_body_html")
    .single();

  if (!error && data) {
    return normalizeBidProjectRow(data as BidProjectRowWithOptionalEmailTemplate);
  }

  if (isMissingPackageNumberColumn(error) || isMissingBidEmailTemplateColumns(error)) {
    const fallbackInsertPayload = omitMissingBidProjectColumns(insertPayload, error);
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("bid_projects")
      .insert(fallbackInsertPayload)
      .select("id, project_name, owner, location, budget, due_date")
      .single();

    if (fallbackError || !fallbackData) {
      console.error("Failed to create bid project", fallbackError);
      return null;
    }

    return normalizeBidProjectRow(fallbackData as BidProjectRowWithOptionalEmailTemplate);
  }

  if (error || !data) {
    console.error("Failed to create bid project", error);
    return null;
  }

  return normalizeBidProjectRow(data as BidProjectRowWithOptionalEmailTemplate);
}

export async function createBidTrades(
  projectId: string,
  trades: Array<{ trade_name: string; sort_order: number }>
): Promise<boolean> {
  if (!projectId || !trades.length) return true;
  const supabase = createClient();
  const { error } = await supabase.from("bid_trades").insert(
    trades.map((trade) => ({
      project_id: projectId,
      trade_name: trade.trade_name,
      sort_order: trade.sort_order,
    }))
  );

  if (error) {
    console.error("Failed to create bid trades", error);
    return false;
  }

  return true;
}

export async function updateBidTrades(
  projectId: string,
  trades: Array<{ id: string; trade_name: string; sort_order: number }>
): Promise<boolean> {
  if (!projectId || !trades.length) return true;
  const supabase = createClient();
  const results = await Promise.all(
    trades.map((trade) =>
      supabase
        .from("bid_trades")
        .update({
          trade_name: trade.trade_name.trim(),
          sort_order: trade.sort_order,
        })
        .eq("id", trade.id)
        .eq("project_id", projectId)
    )
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) {
    console.error("Failed to update bid trades", failed.error);
    return false;
  }

  return true;
}

export async function updateBidProject(
  projectId: string,
  payload: {
    project_name: string;
    package_number?: string | null;
    owner?: string | null;
    location?: string | null;
    budget?: number | null;
    due_date?: string | null;
    bid_email_subject?: string | null;
    bid_email_body_html?: string | null;
  }
): Promise<BidProjectSummary | null> {
  const supabase = createClient();
  const updatePayload = {
    project_name: payload.project_name.trim(),
    package_number: payload.package_number?.trim() || null,
    owner: payload.owner ?? null,
    location: payload.location ?? null,
    budget: payload.budget ?? null,
    due_date: payload.due_date ?? null,
    bid_email_subject: payload.bid_email_subject ?? null,
    bid_email_body_html: payload.bid_email_body_html ?? null,
  };
  const { data, error } = await supabase
    .from("bid_projects")
    .update(updatePayload)
    .eq("id", projectId)
    .select("id, project_name, package_number, owner, location, budget, due_date, bid_email_subject, bid_email_body_html")
    .single();

  if (!error && data) {
    return normalizeBidProjectRow(data as BidProjectRowWithOptionalEmailTemplate);
  }

  if (isMissingPackageNumberColumn(error) || isMissingBidEmailTemplateColumns(error)) {
    const fallbackUpdatePayload = omitMissingBidProjectColumns(updatePayload, error);
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("bid_projects")
      .update(fallbackUpdatePayload)
      .eq("id", projectId)
      .select("id, project_name, owner, location, budget, due_date")
      .single();

    if (fallbackError || !fallbackData) {
      console.error("Failed to update bid project", fallbackError);
      return null;
    }

    return normalizeBidProjectRow(fallbackData as BidProjectRowWithOptionalEmailTemplate);
  }

  if (error || !data) {
    console.error("Failed to update bid project", error);
    return null;
  }

  return normalizeBidProjectRow(data as BidProjectRowWithOptionalEmailTemplate);
}

export async function updateBidProjectEmailTemplate(
  projectId: string,
  payload: {
    bid_email_subject: string | null;
    bid_email_body_html: string | null;
  }
): Promise<boolean> {
  if (!projectId) return false;
  const supabase = createClient();
  const { error } = await supabase
    .from("bid_projects")
    .update({
      bid_email_subject: payload.bid_email_subject,
      bid_email_body_html: payload.bid_email_body_html,
    })
    .eq("id", projectId);

  if (!error) return true;
  if (isMissingBidEmailTemplateColumns(error)) return false;

  console.error("Failed to update bid email template", error);
  return false;
}

export async function getNextBidProjectPackageNumber(referenceDate = new Date()): Promise<string | null> {
  const supabase = createClient();
  const yearPrefix = String(referenceDate.getFullYear() % 100).padStart(2, "0");
  const { data, error } = await supabase.from("bid_projects").select("package_number");

  if (isMissingPackageNumberColumn(error)) {
    return `${yearPrefix}001`;
  }

  if (error || !data) {
    console.error("Failed to load bid project package numbers", error);
    return null;
  }

  let maxSequence = 0;
  for (const row of data as Array<{ package_number?: string | null }>) {
    const value = row.package_number?.trim() ?? "";
    if (!new RegExp(`^${yearPrefix}\\d{3}$`).test(value)) continue;
    const sequence = Number.parseInt(value.slice(2), 10);
    if (Number.isFinite(sequence)) {
      maxSequence = Math.max(maxSequence, sequence);
    }
  }

  return `${yearPrefix}${String(maxSequence + 1).padStart(3, "0")}`;
}

export async function isBidProjectPackageNumberAvailable(
  packageNumber: string,
  excludeProjectId?: string | null
): Promise<boolean> {
  const value = packageNumber.trim();
  if (!value) return true;

  const supabase = createClient();
  let query = supabase
    .from("bid_projects")
    .select("id")
    .eq("package_number", value)
    .limit(1);

  if (excludeProjectId) {
    query = query.neq("id", excludeProjectId);
  }

  const { data, error } = await query;
  if (isMissingPackageNumberColumn(error)) return true;
  if (error) {
    console.error("Failed to check bid project package number", error);
    return false;
  }

  return !data?.length;
}

export async function archiveBidProject(projectId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("bid_projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", projectId);

  if (error) {
    console.error("Failed to archive bid project", error);
    return false;
  }

  return true;
}

export async function reopenBidProject(projectId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("bid_projects")
    .update({ archived_at: null })
    .eq("id", projectId);

  if (error) {
    console.error("Failed to reopen bid project", error);
    return false;
  }

  return true;
}

export async function createBidSubcontractor(payload: {
  company_name: string;
  primary_contact?: string | null;
  email?: string | null;
  phone?: string | null;
}): Promise<{ id: string; company_name: string; primary_contact: string | null } | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bid_subcontractors")
    .insert({
      company_name: payload.company_name.trim(),
      primary_contact: payload.primary_contact ?? null,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
    })
    .select("id, company_name, primary_contact")
    .single();

  if (error || !data) {
    console.error("Failed to create subcontractor", error);
    return null;
  }

  return data as { id: string; company_name: string; primary_contact: string | null };
}

export async function inviteSubToProject(payload: {
  project_id: string;
  subcontractor_id: string;
  sort_order: number;
}): Promise<{ id: string } | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bid_project_subs")
    .insert({
      project_id: payload.project_id,
      subcontractor_id: payload.subcontractor_id,
      sort_order: payload.sort_order,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to invite subcontractor", error);
    return null;
  }

  return data as { id: string };
}

export async function createTradeBid(payload: {
  project_id: string;
  trade_id: string;
  project_sub_id: string;
  status: "submitted" | "bidding" | "declined" | "ghosted" | "invited";
  bid_amount?: number | null;
  contact_name?: string | null;
  notes?: string | null;
}): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("bid_trade_bids").insert({
    project_id: payload.project_id,
    trade_id: payload.trade_id,
    project_sub_id: payload.project_sub_id,
    status: payload.status,
    bid_amount: payload.bid_amount ?? null,
    contact_name: payload.contact_name ?? null,
    notes: payload.notes ?? null,
  });

  if (error) {
    console.error("Failed to create trade bid", error);
    return false;
  }

  return true;
}

export async function listBidSubcontractors(): Promise<
  Array<{ id: string; company_name: string; primary_contact: string | null; email: string | null; phone: string | null }>
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bid_subcontractors")
    .select("id, company_name, primary_contact, email, phone")
    .is("archived_at", null)
    .order("company_name", { ascending: true });

  if (error || !data) {
    console.error("Failed to load subcontractors", error);
    return [];
  }

  return data as Array<{
    id: string;
    company_name: string;
    primary_contact: string | null;
    email: string | null;
    phone: string | null;
  }>;
}

export async function updateTradeBid(payload: {
  id: string;
  status: "submitted" | "bidding" | "declined" | "ghosted" | "invited";
  bid_amount?: number | null;
  contact_name?: string | null;
  notes?: string | null;
}): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("bid_trade_bids")
    .update({
      status: payload.status,
      bid_amount: payload.bid_amount ?? null,
      contact_name: payload.contact_name ?? null,
      notes: payload.notes ?? null,
    })
    .eq("id", payload.id);

  if (error) {
    console.error("Failed to update trade bid", error);
    return false;
  }

  return true;
}

export async function updateBidSubcontractor(payload: {
  id: string;
  company_name: string;
  primary_contact?: string | null;
  email?: string | null;
  phone?: string | null;
}): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("bid_subcontractors")
    .update({
      company_name: payload.company_name.trim(),
      primary_contact: payload.primary_contact ?? null,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
    })
    .eq("id", payload.id);

  if (error) {
    console.error("Failed to update subcontractor", error);
    return false;
  }

  return true;
}

export async function countBidProjectSubs(projectIds: string[]): Promise<number> {
  if (!projectIds.length) return 0;
  const supabase = createClient();
  const { count, error } = await supabase
    .from("bid_project_subs")
    .select("id", { count: "exact", head: true })
    .in("project_id", projectIds);

  if (error) {
    console.error("Failed to count project subs", error);
    return 0;
  }

  return count ?? 0;
}

export async function countGhostedBids(projectIds: string[]): Promise<number> {
  if (!projectIds.length) return 0;
  const supabase = createClient();
  const { count, error } = await supabase
    .from("bid_trade_bids")
    .select("id", { count: "exact", head: true })
    .in("project_id", projectIds)
    .eq("status", "ghosted");

  if (error) {
    console.error("Failed to count ghosted bids", error);
    return 0;
  }

  return count ?? 0;
}

export async function getBidProjectDetail(projectId: string): Promise<BidProjectDetail | null> {
  if (!projectId) return null;
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("bid_projects")
    .select("id, project_name, package_number, owner, location, budget, due_date, bid_email_subject, bid_email_body_html")
    .eq("id", projectId)
    .maybeSingle();

  if (
    projectError &&
    (isMissingPackageNumberColumn(projectError) || isMissingBidEmailTemplateColumns(projectError))
  ) {
    const { data: fallbackProject, error: fallbackProjectError } = await supabase
      .from("bid_projects")
      .select("id, project_name, owner, location, budget, due_date")
      .eq("id", projectId)
      .maybeSingle();

    if (fallbackProjectError) {
      console.error("Failed to load bid project", fallbackProjectError);
      return null;
    }
    if (!fallbackProject) return null;

    const { data: trades, error: tradesError } = await supabase
      .from("bid_trades")
      .select("id, project_id, trade_name, sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true })
      .order("trade_name", { ascending: true });

    if (tradesError) {
      console.error("Failed to load bid trades", tradesError);
    }

    const { data: projectSubs, error: subsError } = await supabase
      .from("bid_project_subs")
      .select(
        "id, project_id, subcontractor_id, sort_order, invited_at, subcontractor:bid_subcontractors(id, company_name, primary_contact, email, phone)"
      )
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true })
      .order("invited_at", { ascending: true });

    if (subsError) {
      console.error("Failed to load project subs", subsError);
    }

    const { data: tradeBids, error: bidsError } = await supabase
      .from("bid_trade_bids")
      .select("id, project_id, trade_id, project_sub_id, status, bid_amount, contact_name, notes")
      .eq("project_id", projectId);

    if (bidsError) {
      console.error("Failed to load trade bids", bidsError);
    }

    return {
      project: normalizeBidProjectRow(fallbackProject as BidProjectRowWithOptionalEmailTemplate),
      trades: (trades ?? []) as BidTradeRow[],
      projectSubs: (projectSubs ?? []).map((row) => ({
        ...(row as Omit<BidProjectSubRow, "subcontractor">),
        subcontractor: normalizeSubcontractor(
          (row as BidProjectSubRow & { subcontractor: BidProjectSubRow["subcontractor"][] | null }).subcontractor
        ),
      })),
      tradeBids: (tradeBids ?? []) as BidTradeBidRow[],
    };
  }

  if (projectError) {
    console.error("Failed to load bid project", projectError);
    return null;
  }
  if (!project) return null;

  const { data: trades, error: tradesError } = await supabase
    .from("bid_trades")
    .select("id, project_id, trade_name, sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("trade_name", { ascending: true });

  if (tradesError) {
    console.error("Failed to load bid trades", tradesError);
  }

  const { data: projectSubs, error: subsError } = await supabase
    .from("bid_project_subs")
    .select(
      "id, project_id, subcontractor_id, sort_order, invited_at, subcontractor:bid_subcontractors(id, company_name, primary_contact, email, phone)"
    )
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("invited_at", { ascending: true });

  if (subsError) {
    console.error("Failed to load project subs", subsError);
  }

  const { data: tradeBids, error: bidsError } = await supabase
    .from("bid_trade_bids")
    .select("id, project_id, trade_id, project_sub_id, status, bid_amount, contact_name, notes")
    .eq("project_id", projectId);

  if (bidsError) {
    console.error("Failed to load trade bids", bidsError);
  }

  return {
    project: normalizeBidProjectRow(project as BidProjectRowWithOptionalEmailTemplate),
    trades: (trades ?? []) as BidTradeRow[],
    projectSubs: (projectSubs ?? []).map((row) => ({
      ...(row as Omit<BidProjectSubRow, "subcontractor">),
      subcontractor: normalizeSubcontractor(
        (row as BidProjectSubRow & { subcontractor: BidProjectSubRow["subcontractor"][] | null }).subcontractor
      ),
    })),
    tradeBids: (tradeBids ?? []) as BidTradeBidRow[],
  };
}
