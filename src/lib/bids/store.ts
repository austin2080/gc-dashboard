import { createClient } from "@/lib/supabase/client";
import type { BidOpportunity, BidStage, Customer, User } from "./types";

type OwnerBidAnalyticsRow = {
  id: string;
  name: string;
  client: string;
  project_type: string;
  address: string | null;
  due_date: string | null;
  status: "Draft" | "Submitted" | "Awarded" | "Lost";
  assigned_to: string | null;
  bid_amount: number | null;
  lost_notes: string | null;
  created_at: string;
  updated_at: string;
};

function statusToStage(status: OwnerBidAnalyticsRow["status"]): BidStage {
  switch (status) {
    case "Draft":
      return "estimating";
    case "Submitted":
      return "submitted";
    case "Awarded":
      return "awarded";
    case "Lost":
      return "lost";
    default:
      return "lead";
  }
}

function deriveCity(address: string | null): string {
  if (!address) return "Unknown";
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return "Unknown";
  if (parts.length >= 2) return parts[parts.length - 2];
  return parts[0];
}

export async function listBidAnalyticsData(): Promise<{
  opportunities: BidOpportunity[];
  users: User[];
  customers: Customer[];
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bid_owner_bids")
    .select(
      "id,name,client,project_type,address,due_date,status,assigned_to,bid_amount,lost_notes,created_at,updated_at"
    )
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (error || !data) {
    console.error("Failed to load bid analytics data", error);
    return { opportunities: [], users: [], customers: [] };
  }

  const rows = data as OwnerBidAnalyticsRow[];

  const customerIdByName = new Map<string, string>();
  const personIdByName = new Map<string, string>();
  const customers: Customer[] = [];
  const users: User[] = [];

  rows.forEach((row) => {
    const clientName = row.client?.trim() || "Unknown client";
    if (!customerIdByName.has(clientName)) {
      const id = `customer-${customerIdByName.size + 1}`;
      customerIdByName.set(clientName, id);
      customers.push({ id, name: clientName, segment: "Owner" });
    }

    const personName = row.assigned_to?.trim() || "Unassigned";
    if (!personIdByName.has(personName)) {
      const id = `user-${personIdByName.size + 1}`;
      personIdByName.set(personName, id);
      users.push({ id, name: personName, role: "Estimator", city: "—" });
    }
  });

  const opportunities: BidOpportunity[] = rows.map((row) => {
    const stage = statusToStage(row.status);
    const submittedValue = row.bid_amount ?? 0;
    const awarded = stage === "awarded";
    const lost = stage === "lost";
    return {
      id: row.id,
      customerId: customerIdByName.get(row.client?.trim() || "Unknown client") ?? "customer-unknown",
      projectName: row.name,
      projectType: row.project_type || "Other",
      city: deriveCity(row.address),
      personId: personIdByName.get(row.assigned_to?.trim() || "Unassigned") ?? "user-unassigned",
      dueDate: row.due_date ?? row.updated_at.slice(0, 10),
      submittedDate: ["submitted", "awarded", "lost", "negotiation"].includes(stage)
        ? row.updated_at.slice(0, 10)
        : undefined,
      createdAt: row.created_at,
      stage,
      submittedValue,
      confidence: "medium",
      notes: row.lost_notes ?? "",
      outcome:
        awarded || lost
          ? {
              isAwarded: awarded,
              awardedValue: awarded ? submittedValue : undefined,
              winReason: awarded ? "relationship" : undefined,
              lossReason: lost ? "no_decision" : undefined,
            }
          : undefined,
    };
  });

  return { opportunities, users, customers };
}

type BidProjectRow = {
  id: string;
  project_name: string;
  location: string | null;
  due_date: string | null;
};

type BidTradeRow = {
  id: string;
  project_id: string;
  trade_name: string;
};

type BidTradeBidRow = {
  id: string;
  project_id: string;
  trade_id: string;
  project_sub_id: string;
  status: "submitted" | "bidding" | "declined" | "ghosted" | "invited";
  created_at: string;
};

type BidProjectSubRow = {
  id: string;
  subcontractor_id: string;
};

type BidSubcontractorRow = {
  id: string;
  company_name: string;
};

export type SubChartPoint = {
  month: string;
  responseRate: number;
  avgBids: number;
  ghostRate: number;
};

export type SubBreakdownRow = {
  trade: string;
  invited: number;
  submitted: number;
  declined: number;
  ghosted: number;
};

export type SubAtRiskTrade = {
  trade: string;
  dueDate: string;
  responseRate: number;
};

export type SubGhostVendor = {
  name: string;
  ghosts: number;
};

export type SubActivePackage = {
  id: string;
  projectName: string;
  location: string;
  dueDate: string | null;
};

export async function listSubBidAnalyticsData(): Promise<{
  kpis: {
    activePackages: number;
    tradesDueThisWeek: number;
    responseRate: number;
    ghostRate: number;
    avgBidsPerTrade: number;
    coverageComplete: number;
  };
  chartData: SubChartPoint[];
  breakdownRows: SubBreakdownRow[];
  atRiskTrades: SubAtRiskTrade[];
  ghostedVendors: SubGhostVendor[];
  activePackages: SubActivePackage[];
}> {
  const supabase = createClient();
  const [projectsRes, tradesRes, bidsRes, projectSubsRes, subsRes] = await Promise.all([
    supabase
      .from("bid_projects")
      .select("id,project_name,location,due_date")
      .is("archived_at", null)
      .order("due_date", { ascending: true }),
    supabase.from("bid_trades").select("id,project_id,trade_name"),
    supabase.from("bid_trade_bids").select("id,project_id,trade_id,project_sub_id,status,created_at"),
    supabase.from("bid_project_subs").select("id,subcontractor_id"),
    supabase.from("bid_subcontractors").select("id,company_name"),
  ]);

  if (projectsRes.error || tradesRes.error || bidsRes.error || projectSubsRes.error || subsRes.error) {
    console.error("Failed to load sub bid analytics data", {
      projectsError: projectsRes.error,
      tradesError: tradesRes.error,
      bidsError: bidsRes.error,
      projectSubsError: projectSubsRes.error,
      subsError: subsRes.error,
    });
    return {
      kpis: {
        activePackages: 0,
        tradesDueThisWeek: 0,
        responseRate: 0,
        ghostRate: 0,
        avgBidsPerTrade: 0,
        coverageComplete: 0,
      },
      chartData: [],
      breakdownRows: [],
      atRiskTrades: [],
      ghostedVendors: [],
      activePackages: [],
    };
  }

  const projects = (projectsRes.data ?? []) as BidProjectRow[];
  const trades = (tradesRes.data ?? []) as BidTradeRow[];
  const bids = (bidsRes.data ?? []) as BidTradeBidRow[];
  const projectSubs = (projectSubsRes.data ?? []) as BidProjectSubRow[];
  const subs = (subsRes.data ?? []) as BidSubcontractorRow[];

  const bidsByTrade = new Map<string, BidTradeBidRow[]>();
  bids.forEach((bid) => {
    const list = bidsByTrade.get(bid.trade_id) ?? [];
    list.push(bid);
    bidsByTrade.set(bid.trade_id, list);
  });

  const now = new Date();
  const weekAhead = new Date(now);
  weekAhead.setDate(now.getDate() + 7);

  const tradesDueThisWeek = trades.filter((trade) => {
    const project = projects.find((projectItem) => projectItem.id === trade.project_id);
    if (!project?.due_date) return false;
    const due = new Date(`${project.due_date}T00:00:00`);
    return due >= new Date(now.toDateString()) && due <= weekAhead;
  }).length;

  const invitedCount = bids.length;
  const submittedCount = bids.filter((bid) => bid.status === "submitted").length;
  const declinedCount = bids.filter((bid) => bid.status === "declined").length;
  const ghostedCount = bids.filter((bid) => bid.status === "ghosted").length;

  const tradesWithCoverage = trades.filter((trade) => (bidsByTrade.get(trade.id)?.length ?? 0) >= 3).length;

  const kpis = {
    activePackages: projects.length,
    tradesDueThisWeek,
    responseRate: invitedCount ? ((submittedCount + declinedCount) / invitedCount) * 100 : 0,
    ghostRate: invitedCount ? (ghostedCount / invitedCount) * 100 : 0,
    avgBidsPerTrade: trades.length ? invitedCount / trades.length : 0,
    coverageComplete: trades.length ? (tradesWithCoverage / trades.length) * 100 : 0,
  };

  const chartBuckets = new Map<string, { invited: number; responded: number; ghosted: number; trades: Set<string> }>();
  const monthLabels: string[] = [];
  for (let i = 4; i >= 0; i -= 1) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = month.toISOString().slice(0, 7);
    monthLabels.push(month.toLocaleString("en-US", { month: "short" }));
    chartBuckets.set(key, { invited: 0, responded: 0, ghosted: 0, trades: new Set<string>() });
  }

  bids.forEach((bid) => {
    const key = bid.created_at.slice(0, 7);
    const bucket = chartBuckets.get(key);
    if (!bucket) return;
    bucket.invited += 1;
    if (bid.status === "submitted" || bid.status === "declined") {
      bucket.responded += 1;
    }
    if (bid.status === "ghosted") {
      bucket.ghosted += 1;
    }
    bucket.trades.add(bid.trade_id);
  });

  const chartData: SubChartPoint[] = Array.from(chartBuckets.values()).map((bucket, index) => ({
    month: monthLabels[index] ?? "",
    responseRate: bucket.invited ? (bucket.responded / bucket.invited) * 100 : 0,
    avgBids: bucket.trades.size ? bucket.invited / bucket.trades.size : 0,
    ghostRate: bucket.invited ? (bucket.ghosted / bucket.invited) * 100 : 0,
  }));

  const breakdownRows: SubBreakdownRow[] = trades
    .map((trade) => {
      const tradeBids = bidsByTrade.get(trade.id) ?? [];
      return {
        trade: trade.trade_name,
        invited: tradeBids.length,
        submitted: tradeBids.filter((bid) => bid.status === "submitted").length,
        declined: tradeBids.filter((bid) => bid.status === "declined").length,
        ghosted: tradeBids.filter((bid) => bid.status === "ghosted").length,
      };
    })
    .sort((a, b) => b.invited - a.invited)
    .slice(0, 12);

  const atRiskTrades: SubAtRiskTrade[] = trades
    .map((trade) => {
      const tradeBids = bidsByTrade.get(trade.id) ?? [];
      const responses = tradeBids.filter((bid) => bid.status === "submitted" || bid.status === "declined").length;
      const responseRate = tradeBids.length ? (responses / tradeBids.length) * 100 : 0;
      const project = projects.find((projectItem) => projectItem.id === trade.project_id);
      return {
        trade: trade.trade_name,
        dueDate: project?.due_date ?? "",
        responseRate,
      };
    })
    .filter((trade) => trade.responseRate < 50)
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    })
    .slice(0, 9);

  const subcontractorIdByProjectSubId = new Map(projectSubs.map((row) => [row.id, row.subcontractor_id]));
  const subcontractorNameById = new Map(subs.map((row) => [row.id, row.company_name]));
  const ghostCounts = new Map<string, number>();
  bids
    .filter((bid) => bid.status === "ghosted")
    .forEach((bid) => {
      const subId = subcontractorIdByProjectSubId.get(bid.project_sub_id);
      if (!subId) return;
      const name = subcontractorNameById.get(subId) ?? "Unknown vendor";
      ghostCounts.set(name, (ghostCounts.get(name) ?? 0) + 1);
    });

  const ghostedVendors: SubGhostVendor[] = Array.from(ghostCounts.entries())
    .map(([name, ghosts]) => ({ name, ghosts }))
    .sort((a, b) => b.ghosts - a.ghosts)
    .slice(0, 5);

  const activePackages: SubActivePackage[] = projects.slice(0, 9).map((project) => ({
    id: project.id,
    projectName: project.project_name,
    location: project.location ?? "Unknown location",
    dueDate: project.due_date ?? null,
  }));

  return {
    kpis,
    chartData,
    breakdownRows,
    atRiskTrades,
    ghostedVendors,
    activePackages,
  };
}
