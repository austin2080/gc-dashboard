"use client";

import { useMemo, useState } from "react";

type RiskStatus = "Healthy" | "At Risk" | "Critical";

type BidRiskProject = {
  id: string;
  projectName: string;
  clientName: string;
  dueDate: string;
  tradesTotal: number;
  tradesWith2PlusBids: number;
  tradesThin: string[];
  awaitingResponsesCount: number;
};

type BidRiskOverviewProps = {
  projects?: BidRiskProject[];
  onCreateFirstBid?: () => void;
  onOpenProject?: (projectId: string) => void;
};

type SortMode = "urgency" | "coverage" | "alphabetical";

type FilterMode = "all" | "Healthy" | "At Risk" | "Critical";

const KEY_TRADES = ["Electrical", "HVAC", "Plumbing"];

const mockProjects: BidRiskProject[] = [
  {
    id: "p-101",
    projectName: "Riverpoint Medical Pavilion",
    clientName: "Northline Health",
    dueDate: "2026-02-18",
    tradesTotal: 12,
    tradesWith2PlusBids: 7,
    tradesThin: ["HVAC", "Flooring"],
    awaitingResponsesCount: 4,
  },
  {
    id: "p-102",
    projectName: "Oak Harbor Mixed Use",
    clientName: "Summit Urban",
    dueDate: "2026-02-16",
    tradesTotal: 10,
    tradesWith2PlusBids: 6,
    tradesThin: ["Electrical", "Plumbing"],
    awaitingResponsesCount: 2,
  },
  {
    id: "p-103",
    projectName: "Juniper K-8 Expansion",
    clientName: "Metro Schools",
    dueDate: "2026-02-24",
    tradesTotal: 14,
    tradesWith2PlusBids: 12,
    tradesThin: ["Sitework"],
    awaitingResponsesCount: 1,
  },
  {
    id: "p-104",
    projectName: "Cedar Heights Renovation",
    clientName: "Parkview Living",
    dueDate: "2026-02-15",
    tradesTotal: 8,
    tradesWith2PlusBids: 5,
    tradesThin: ["Painting", "Drywall"],
    awaitingResponsesCount: 3,
  },
];

function formatDueLabel(dueDate: string, dueInDays: number) {
  if (dueInDays < 0) return "Past Due";
  if (dueInDays === 0) return "Today";
  if (dueInDays === 1) return "Tomorrow";
  if (dueInDays <= 14) return `${dueInDays}d`;

  const due = new Date(dueDate);
  return due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function computeDueInDays(dueDate: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffMs = dueDay.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function getStatus(dueInDays: number, coveragePct: number): RiskStatus {
  if (dueInDays <= 3 && coveragePct < 70) return "Critical";
  if (dueInDays <= 7 && coveragePct < 80) return "At Risk";
  return "Healthy";
}

function getRiskChips(project: BidRiskProject) {
  const chips: string[] = [];
  const keyTradeMissing = KEY_TRADES.find((trade) => project.tradesThin.includes(trade));

  if (keyTradeMissing) {
    chips.push(`No ${keyTradeMissing} depth`);
  } else if (project.tradesThin.length > 0) {
    chips.push(`${project.tradesThin.length} trades thin`);
  }

  if (project.awaitingResponsesCount > 0) {
    chips.push(`${project.awaitingResponsesCount} awaiting responses`);
  }

  if (!keyTradeMissing && project.tradesThin.length > 0 && chips.length < 3) {
    chips.push(project.tradesThin.slice(0, 2).join(" + "));
  }

  return chips.slice(0, 3);
}

const statusStyles: Record<RiskStatus, string> = {
  Healthy: "border-emerald-200/80 bg-emerald-50/40",
  "At Risk": "border-amber-200/80 bg-amber-50/50",
  Critical: "border-rose-200/80 bg-rose-50/70",
};

const edgeStyles: Record<RiskStatus, string> = {
  Healthy: "bg-emerald-400/80",
  "At Risk": "bg-amber-400/90",
  Critical: "bg-rose-500",
};

const statusPillStyles: Record<RiskStatus, string> = {
  Healthy: "bg-emerald-100 text-emerald-700",
  "At Risk": "bg-amber-100 text-amber-700",
  Critical: "bg-rose-100 text-rose-700",
};

const dueStyles = {
  urgent: "text-rose-700",
  warning: "text-amber-700",
  normal: "text-slate-700",
};

export default function BidRiskOverview({ projects = mockProjects, onCreateFirstBid, onOpenProject }: BidRiskOverviewProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("urgency");

  const prepared = useMemo(() => {
    const mapped = projects.map((project) => {
      const coveragePct = project.tradesTotal > 0 ? Math.round((project.tradesWith2PlusBids / project.tradesTotal) * 100) : 0;
      const dueInDays = computeDueInDays(project.dueDate);
      const status = getStatus(dueInDays, coveragePct);
      const riskChips = getRiskChips(project);

      return {
        ...project,
        coveragePct,
        dueInDays,
        status,
        riskChips,
      };
    });

    return mapped
      .filter((project) => {
        const matchesSearch = `${project.projectName} ${project.clientName}`.toLowerCase().includes(search.toLowerCase());
        const matchesFilter = filter === "all" ? true : project.status === filter;
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        if (sortMode === "coverage") return a.coveragePct - b.coveragePct;
        if (sortMode === "alphabetical") return a.projectName.localeCompare(b.projectName);

        if (a.dueInDays !== b.dueInDays) return a.dueInDays - b.dueInDays;
        return a.coveragePct - b.coveragePct;
      });
  }, [filter, projects, search, sortMode]);

  const handleOpenProject = (projectId: string) => {
    if (onOpenProject) {
      onOpenProject(projectId);
      return;
    }

    console.log("TODO: route to project bid detail", projectId);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Bid Risk Overview</h3>
          <p className="text-sm text-slate-500">Quick scan of deadlines, coverage depth, and trade risk.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search project/client"
            className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none ring-slate-300 transition focus:ring-2"
          />
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as FilterMode)}
            className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-700"
          >
            <option value="all">All</option>
            <option value="Healthy">Healthy</option>
            <option value="At Risk">At Risk</option>
            <option value="Critical">Critical</option>
          </select>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-700"
          >
            <option value="urgency">Urgency</option>
            <option value="coverage">Coverage</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
          <p className="text-sm text-slate-500">No active bids yet—let&apos;s get your first package started.</p>
          <button
            type="button"
            onClick={() => onCreateFirstBid?.()}
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Create your first bid
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {prepared.map((project) => (
            <button
              type="button"
              key={project.id}
              onClick={() => handleOpenProject(project.id)}
              className={`group relative w-full overflow-hidden rounded-xl border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow ${statusStyles[project.status]}`}
            >
              <span className={`absolute inset-y-0 left-0 w-1 ${edgeStyles[project.status]}`} aria-hidden="true" />
              <div className="grid gap-3 pl-2 md:grid-cols-[minmax(220px,1.6fr)_90px_minmax(180px,1fr)_minmax(220px,1.4fr)_110px] md:items-center">
                <div>
                  <p className="font-semibold text-slate-900">{project.projectName}</p>
                  <p className="text-xs text-slate-500">{project.clientName}</p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Due</p>
                  <p
                    className={`text-sm font-semibold ${
                      project.dueInDays <= 3 ? dueStyles.urgent : project.dueInDays <= 7 ? dueStyles.warning : dueStyles.normal
                    }`}
                  >
                    {formatDueLabel(project.dueDate, project.dueInDays)}
                  </p>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>Coverage</span>
                    <span className="font-semibold text-slate-700">{project.coveragePct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div className="h-2 rounded-full bg-slate-700 transition-all" style={{ width: `${project.coveragePct}%` }} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {project.riskChips.length > 0 ? (
                    project.riskChips.map((chip) => (
                      <span key={chip} className="rounded-full border border-slate-200 bg-white/85 px-2.5 py-1 text-xs text-slate-600">
                        {chip}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">No immediate risks</span>
                  )}
                </div>

                <div className="flex md:justify-end">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusPillStyles[project.status]}`}>{project.status}</span>
                </div>
              </div>
            </button>
          ))}
          {prepared.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No projects match your filters.</p> : null}
        </div>
      )}
    </section>
  );
}
