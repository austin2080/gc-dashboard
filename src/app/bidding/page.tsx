"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  BidProjectDetail,
  BidProjectSummary,
  BidTradeBid,
  BidTradeStatus,
} from "@/lib/bidding/types";
import {
  countBidProjectSubs,
  createBidProject,
  createBidTrades,
  updateBidProject,
  archiveBidProject,
  countGhostedBids,
  getBidProjectDetail,
  listBidProjects,
} from "@/lib/bidding/store";

type TradeSubBid = {
  company: string;
  contact: string;
  status: BidTradeStatus;
  bidAmount?: number;
};

type TradeRow = {
  trade: string;
  bids: Array<TradeSubBid | null>;
};

type BidProjectView = {
  id: string;
  projectName: string;
  owner: string;
  location: string;
  budget: number | null;
  dueDate: string | null;
  trades: TradeRow[];
  subCount: number;
};

type Metrics = {
  activeBids: number;
  totalSubs: number;
  ghosted: number;
  nearestDueProject: BidProjectSummary | null;
};

type ProjectDraft = {
  project_name: string;
  owner: string;
  location: string;
  budget: string;
  due_date: string;
};

type CostCode = {
  id: string;
  code: string;
  description?: string | null;
  division?: string | null;
  is_active?: boolean | null;
};

function daysUntil(isoDate: string): number {
  if (!isoDate) return 0;
  const today = new Date();
  const due = new Date(`${isoDate}T00:00:00`);
  const msPerDay = 1000 * 60 * 60 * 24;
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.max(0, Math.ceil((due.getTime() - todayMidnight) / msPerDay));
}

function safeDaysUntil(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  return daysUntil(isoDate);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function StatusPill({ status }: { status: BidTradeStatus }) {
  const styles: Record<BidTradeStatus, string> = {
    submitted: "bg-emerald-100 text-emerald-800",
    bidding: "bg-blue-100 text-blue-800",
    declined: "bg-rose-100 text-rose-800",
    ghosted: "bg-amber-100 text-amber-800",
  };

  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold tracking-[0.08em] ${styles[status]}`}>
      {status.toUpperCase()}
    </span>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sublabel,
}: {
  icon: string;
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-xl" aria-hidden>
          {icon}
        </span>
        <div>
          <p className="text-3xl font-semibold leading-none text-slate-900">{value}</p>
          <p className="mt-2 text-sm font-medium text-slate-600">{label}</p>
          {sublabel ? <p className="mt-1 text-xs text-slate-500">{sublabel}</p> : null}
        </div>
      </div>
    </article>
  );
}

function ProjectTabs({
  projects,
  selectedId,
  onSelect,
}: {
  projects: BidProjectSummary[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-100/80 p-2">
      <div className="flex flex-wrap gap-2">
        {projects.map((project) => {
          const active = project.id === selectedId;
          const countdown = project.due_date ? `${daysUntil(project.due_date)}d` : "--";
          return (
            <button
              key={project.id}
              type="button"
              onClick={() => onSelect(project.id)}
              className={`inline-flex items-center gap-3 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "border-slate-300 bg-white text-slate-900 shadow-sm"
                  : "border-transparent bg-transparent text-slate-500 hover:border-slate-200 hover:bg-white/60"
              }`}
            >
              {project.project_name}
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
                {countdown}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BidComparisonGrid({ project }: { project: BidProjectView }) {
  const maxSubColumns = project.subCount;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-3xl font-semibold text-slate-900">{project.projectName}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
          <span>🏢 {project.owner}</span>
          <span>📍 {project.location}</span>
          <span>💲 {project.budget !== null ? formatCurrency(project.budget) : "—"}</span>
          <span>🗓️ Due {project.dueDate ?? "—"}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-left text-xl font-semibold text-slate-600">
                Trade
              </th>
              {Array.from({ length: maxSubColumns }).map((_, index) => (
                <th
                  key={`sub-header-${index}`}
                  className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-left text-xl font-semibold text-slate-600"
                >
                  Sub {index + 1}
                </th>
              ))}
              <th className="border-b border-slate-200 bg-slate-100 px-3 py-3 text-center text-sm font-semibold text-slate-600">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {project.trades.map((row) => (
              <tr key={row.trade} className="align-top">
                <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-5 text-left text-lg font-semibold text-slate-900">
                  {row.trade}
                </th>
                {Array.from({ length: maxSubColumns }).map((_, index) => {
                  const bid = row.bids[index] ?? null;
                  return (
                    <td key={`${row.trade}-sub-${index}`} className="border-b border-r border-slate-200 px-4 py-4">
                      {bid ? (
                        <div className="space-y-1">
                          <p className="text-xl font-semibold text-slate-900">{bid.company}</p>
                          <p className="text-sm text-slate-500">{bid.contact}</p>
                          <StatusPill status={bid.status} />
                          {bid.bidAmount ? <p className="text-2xl font-semibold text-slate-900">{formatCurrency(bid.bidAmount)}</p> : null}
                        </div>
                      ) : (
                        <div className="flex h-full min-h-24 items-center rounded-lg border border-dashed border-slate-200 px-3 text-sm text-slate-400">
                          No sub invited
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="border-b border-slate-200 px-2 text-center align-middle">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-xl text-slate-600 transition hover:bg-slate-50"
                    aria-label={`Add subcontractor for ${row.trade}`}
                  >
                    +
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const emptyMetrics: Metrics = {
  activeBids: 0,
  totalSubs: 0,
  ghosted: 0,
  nearestDueProject: null,
};

function buildProjectView(detail: BidProjectDetail | null): BidProjectView | null {
  if (!detail) return null;
  const subs = detail.projectSubs
    .map((sub) => ({
      id: sub.id,
      company: sub.subcontractor?.company_name ?? "Unknown subcontractor",
      contact: sub.subcontractor?.primary_contact ?? "—",
    }))
    .filter((sub) => sub.id);

  const bidsByTrade = new Map<string, Map<string, BidTradeBid>>();
  detail.tradeBids.forEach((bid) => {
    const tradeMap = bidsByTrade.get(bid.trade_id) ?? new Map<string, BidTradeBid>();
    tradeMap.set(bid.project_sub_id, bid);
    bidsByTrade.set(bid.trade_id, tradeMap);
  });

  const trades: TradeRow[] = detail.trades.map((trade) => {
    const tradeMap = bidsByTrade.get(trade.id) ?? new Map<string, BidTradeBid>();
    const bids = subs.map((sub) => {
      const bid = tradeMap.get(sub.id);
      if (!bid) return null;
      return {
        company: sub.company,
        contact: bid.contact_name ?? sub.contact,
        status: bid.status,
        bidAmount: bid.bid_amount ?? undefined,
      };
    });
    return {
      trade: trade.trade_name,
      bids,
    };
  });

  return {
    id: detail.project.id,
    projectName: detail.project.project_name,
    owner: detail.project.owner ?? "—",
    location: detail.project.location ?? "—",
    budget: detail.project.budget ?? null,
    dueDate: detail.project.due_date ?? null,
    trades,
    subCount: Math.max(subs.length, 1),
  };
}

export default function BiddingPage() {
  const [projects, setProjects] = useState<BidProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [detail, setDetail] = useState<BidProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [draft, setDraft] = useState<ProjectDraft>({
    project_name: "",
    owner: "",
    location: "",
    budget: "",
    due_date: "",
  });
  const [editDraft, setEditDraft] = useState<ProjectDraft>({
    project_name: "",
    owner: "",
    location: "",
    budget: "",
    due_date: "",
  });
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [selectedCostCodes, setSelectedCostCodes] = useState<CostCode[]>([]);
  const [costCodeQuery, setCostCodeQuery] = useState("");
  const [loadingCostCodes, setLoadingCostCodes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadProjects() {
      setLoading(true);
      const projectData = await listBidProjects();
      if (!active) return;
      setProjects(projectData);

      const nextSelected = projectData[0]?.id || "";
      setSelectedProjectId((prev) => prev || nextSelected);

      if (projectData.length) {
        const projectIds = projectData.map((project) => project.id);
        const [totalSubs, ghosted] = await Promise.all([
          countBidProjectSubs(projectIds),
          countGhostedBids(projectIds),
        ]);
        if (!active) return;

        const nearestDueProject =
          [...projectData]
            .filter((project) => project.due_date)
            .sort((a, b) => (safeDaysUntil(a.due_date) ?? 999999) - (safeDaysUntil(b.due_date) ?? 999999))[0] ?? null;

        setMetrics({
          activeBids: projectData.length,
          totalSubs,
          ghosted,
          nearestDueProject,
        });
      } else {
        setMetrics(emptyMetrics);
      }
      setLoading(false);
    }

    loadProjects();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadCostCodes() {
      if (!modalOpen) return;
      setLoadingCostCodes(true);
      try {
        const response = await fetch("/api/cost-codes");
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to load cost codes");
        }
        if (!active) return;
        setCostCodes(Array.isArray(payload.costCodes) ? payload.costCodes : []);
      } catch (err) {
        console.error("Failed to load cost codes", err);
        if (!active) return;
        setCostCodes([]);
      } finally {
        if (active) setLoadingCostCodes(false);
      }
    }

    loadCostCodes();
    return () => {
      active = false;
    };
  }, [modalOpen]);

  useEffect(() => {
    let active = true;
    async function loadDetail() {
      if (!selectedProjectId) {
        setDetail(null);
        return;
      }
      setLoadingDetail(true);
      const nextDetail = await getBidProjectDetail(selectedProjectId);
      if (!active) return;
      setDetail(nextDetail);
      setLoadingDetail(false);
    }

    loadDetail();
    return () => {
      active = false;
    };
  }, [selectedProjectId]);

  const projectView = useMemo(() => buildProjectView(detail), [detail]);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const openEditModal = () => {
    if (!selectedProject) return;
    setEditDraft({
      project_name: selectedProject.project_name ?? "",
      owner: selectedProject.owner ?? "",
      location: selectedProject.location ?? "",
      budget: selectedProject.budget !== null && selectedProject.budget !== undefined ? String(selectedProject.budget) : "",
      due_date: selectedProject.due_date ?? "",
    });
    setEditError(null);
    setEditModalOpen(true);
  };

  return (
    <main className="space-y-6 bg-slate-50 p-4 sm:p-6">
      <header className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold text-slate-900">Bid Management</h1>
            <p className="mt-1 text-lg text-slate-500">Track active bids, subcontractors &amp; due dates</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {selectedProject ? (
              <>
                <button
                  type="button"
                  onClick={openEditModal}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Edit Project
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedProject) return;
                    const confirmed = window.confirm(`Archive “${selectedProject.project_name}”? This will remove it from active bids.`);
                    if (!confirmed) return;
                    const ok = await archiveBidProject(selectedProject.id);
                    if (!ok) return;
                    setProjects((prev) => prev.filter((project) => project.id !== selectedProject.id));
                    setSelectedProjectId((prev) => {
                      if (prev !== selectedProject.id) return prev;
                      const next = projects.filter((project) => project.id !== selectedProject.id)[0]?.id ?? "";
                      return next;
                    });
                    setMetrics((prev) => ({
                      ...prev,
                      activeBids: Math.max(prev.activeBids - 1, 0),
                    }));
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100"
                >
                  Archive
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <span aria-hidden>＋</span>
              New Project
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon="📄" label="Active Bids" value={String(metrics.activeBids)} />
        <KpiCard icon="👷" label="Total Subs" value={String(metrics.totalSubs)} />
        <KpiCard icon="⏰" label="Ghosted" value={String(metrics.ghosted)} />
        <KpiCard
          icon="📅"
          label="Next Due"
          value={metrics.nearestDueProject?.due_date ? `${daysUntil(metrics.nearestDueProject.due_date)}d` : "--"}
          sublabel={metrics.nearestDueProject?.project_name ?? ""}
        />
      </section>

      {projects.length ? (
        <ProjectTabs projects={projects} selectedId={selectedProjectId} onSelect={setSelectedProjectId} />
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500 shadow-sm">
          No bid projects yet. Create your first bid to start tracking coverage.
        </section>
      )}

      {projects.length ? (
        loadingDetail ? (
          <section className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-500 shadow-sm">
            Loading bid details...
          </section>
        ) : projectView ? (
          <BidComparisonGrid project={projectView} />
        ) : (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500 shadow-sm">
            Select a project to view bid coverage.
          </section>
        )
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-2xl font-semibold text-slate-900">New Bid Project</h2>
              <p className="mt-1 text-sm text-slate-500">Create a project to start inviting subs.</p>
            </div>
            <form
              className="space-y-6 px-6 py-5"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!draft.project_name.trim()) {
                  setFormError("Project name is required.");
                  return;
                }
                setSaving(true);
                setFormError(null);
                const budgetValue = draft.budget.trim() ? Number(draft.budget) : null;
                const created = await createBidProject({
                  project_name: draft.project_name,
                  owner: draft.owner.trim() || null,
                  location: draft.location.trim() || null,
                  budget: Number.isFinite(budgetValue) ? budgetValue : null,
                  due_date: draft.due_date.trim() || null,
                });
                if (!created) {
                  setFormError("Unable to create the project. Check your Supabase permissions.");
                  setSaving(false);
                  return;
                }
                if (selectedCostCodes.length) {
                  const tradePayload = selectedCostCodes.map((code, index) => ({
                    trade_name: `${code.code}${code.description ? ` ${code.description}` : ""}`.trim(),
                    sort_order: index + 1,
                  }));
                  await createBidTrades(created.id, tradePayload);
                }
                setProjects((prev) => [created, ...prev]);
                setMetrics((prev) => {
                  const prevDays = safeDaysUntil(prev.nearestDueProject?.due_date ?? null);
                  const nextDays = safeDaysUntil(created.due_date ?? null);
                  const shouldReplace =
                    nextDays !== null && (prevDays === null || nextDays < prevDays);
                  return {
                    ...prev,
                    activeBids: prev.activeBids + 1,
                    nearestDueProject: shouldReplace ? created : prev.nearestDueProject,
                  };
                });
                setSelectedProjectId(created.id);
                setModalOpen(false);
                setSaving(false);
                setDraft({
                  project_name: "",
                  owner: "",
                  location: "",
                  budget: "",
                  due_date: "",
                });
                setSelectedCostCodes([]);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                  Project name
                  <input
                    value={draft.project_name}
                    onChange={(event) => setDraft((prev) => ({ ...prev, project_name: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    placeholder="Riverside Office Complex"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Owner / Client
                  <input
                    value={draft.owner}
                    onChange={(event) => setDraft((prev) => ({ ...prev, owner: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    placeholder="City of Houston"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Location
                  <input
                    value={draft.location}
                    onChange={(event) => setDraft((prev) => ({ ...prev, location: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    placeholder="Houston, TX"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Budget
                  <input
                    value={draft.budget}
                    onChange={(event) => setDraft((prev) => ({ ...prev, budget: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    placeholder="8200000"
                    inputMode="decimal"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Due date
                  <input
                    value={draft.due_date}
                    onChange={(event) => setDraft((prev) => ({ ...prev, due_date: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    type="date"
                  />
                </label>
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Cost Codes (Trades)</h3>
                    <p className="text-xs text-slate-500">Select cost codes to include as trades.</p>
                  </div>
                  <input
                    value={costCodeQuery}
                    onChange={(event) => setCostCodeQuery(event.target.value)}
                    className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    placeholder="Search cost codes"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50">
                    <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                      Available Cost Codes
                    </div>
                    <div className="max-h-56 overflow-auto p-2">
                      {loadingCostCodes ? (
                        <div className="px-3 py-4 text-sm text-slate-500">Loading cost codes...</div>
                      ) : costCodes.length ? (
                        costCodes
                          .filter((code) => {
                            const label = `${code.code} ${code.description ?? ""}`.toLowerCase();
                            return label.includes(costCodeQuery.toLowerCase());
                          })
                          .filter((code) => !selectedCostCodes.some((selected) => selected.id === code.id))
                          .map((code) => (
                            <button
                              key={code.id}
                              type="button"
                              onClick={() => setSelectedCostCodes((prev) => [...prev, code])}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-white"
                            >
                              <span className="font-medium">{code.code}</span>
                              <span className="ml-3 truncate text-xs text-slate-500">
                                {code.description ?? "No description"}
                              </span>
                            </button>
                          ))
                      ) : (
                        <div className="px-3 py-4 text-sm text-slate-500">No cost codes found.</div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                      Selected Trades
                    </div>
                    <div className="max-h-56 overflow-auto p-2">
                      {selectedCostCodes.length ? (
                        selectedCostCodes.map((code) => (
                          <button
                            key={code.id}
                            type="button"
                            onClick={() =>
                              setSelectedCostCodes((prev) => prev.filter((item) => item.id !== code.id))
                            }
                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <span className="font-medium">{code.code}</span>
                            <span className="ml-3 truncate text-xs text-slate-500">
                              {code.description ?? "No description"}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-4 text-sm text-slate-500">
                          Click cost codes on the left to add them here.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {formError ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p> : null}
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => {
                    setModalOpen(false);
                    setSelectedCostCodes([]);
                    setCostCodeQuery("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {editModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-2xl font-semibold text-slate-900">Edit Project</h2>
              <p className="mt-1 text-sm text-slate-500">Update project details.</p>
            </div>
            <form
              className="space-y-4 px-6 py-5"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!selectedProject) return;
                if (!editDraft.project_name.trim()) {
                  setEditError("Project name is required.");
                  return;
                }
                setSavingEdit(true);
                setEditError(null);
                const budgetValue = editDraft.budget.trim() ? Number(editDraft.budget) : null;
                const updated = await updateBidProject(selectedProject.id, {
                  project_name: editDraft.project_name,
                  owner: editDraft.owner.trim() || null,
                  location: editDraft.location.trim() || null,
                  budget: Number.isFinite(budgetValue) ? budgetValue : null,
                  due_date: editDraft.due_date.trim() || null,
                });
                if (!updated) {
                  setEditError("Unable to update the project. Check your Supabase permissions.");
                  setSavingEdit(false);
                  return;
                }
                setProjects((prev) => prev.map((project) => (project.id === updated.id ? updated : project)));
                setEditModalOpen(false);
                setSavingEdit(false);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                  Project name
                  <input
                    value={editDraft.project_name}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, project_name: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Owner / Client
                  <input
                    value={editDraft.owner}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, owner: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Location
                  <input
                    value={editDraft.location}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, location: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Budget
                  <input
                    value={editDraft.budget}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, budget: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    inputMode="decimal"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Due date
                  <input
                    value={editDraft.due_date}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, due_date: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    type="date"
                  />
                </label>
              </div>
              {editError ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{editError}</p> : null}
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => setEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
