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

export async function listBidProjects(): Promise<BidProjectSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bid_projects")
    .select("id, project_name, owner, location, budget, due_date")
    .is("archived_at", null)
    .order("due_date", { ascending: true });

  if (error || !data) {
    console.error("Failed to load bid projects", error);
    return [];
  }

  return data as BidProjectRow[];
}

export async function createBidProject(payload: {
  project_name: string;
  owner?: string | null;
  location?: string | null;
  budget?: number | null;
  due_date?: string | null;
}): Promise<BidProjectSummary | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bid_projects")
    .insert({
      project_name: payload.project_name.trim(),
      owner: payload.owner ?? null,
      location: payload.location ?? null,
      budget: payload.budget ?? null,
      due_date: payload.due_date ?? null,
    })
    .select("id, project_name, owner, location, budget, due_date")
    .single();

  if (error || !data) {
    console.error("Failed to create bid project", error);
    return null;
  }

  return data as BidProjectRow;
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
    owner?: string | null;
    location?: string | null;
    budget?: number | null;
    due_date?: string | null;
  }
): Promise<BidProjectSummary | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bid_projects")
    .update({
      project_name: payload.project_name.trim(),
      owner: payload.owner ?? null,
      location: payload.location ?? null,
      budget: payload.budget ?? null,
      due_date: payload.due_date ?? null,
    })
    .eq("id", projectId)
    .select("id, project_name, owner, location, budget, due_date")
    .single();

  if (error || !data) {
    console.error("Failed to update bid project", error);
    return null;
  }

  return data as BidProjectRow;
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
}): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("bid_trade_bids").insert({
    project_id: payload.project_id,
    trade_id: payload.trade_id,
    project_sub_id: payload.project_sub_id,
    status: payload.status,
    bid_amount: payload.bid_amount ?? null,
    contact_name: payload.contact_name ?? null,
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
}): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("bid_trade_bids")
    .update({
      status: payload.status,
      bid_amount: payload.bid_amount ?? null,
      contact_name: payload.contact_name ?? null,
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
    .select("id, project_name, owner, location, budget, due_date")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    console.error("Failed to load bid project", projectError);
    return null;
  }

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
    .select("id, project_id, trade_id, project_sub_id, status, bid_amount, contact_name")
    .eq("project_id", projectId);

  if (bidsError) {
    console.error("Failed to load trade bids", bidsError);
  }

  return {
    project: project as BidProjectRow,
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
