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
  createBidSubcontractor,
  listBidSubcontractors,
  inviteSubToProject,
  createTradeBid,
  updateTradeBid,
  updateBidSubcontractor,
  updateBidProject,
  archiveBidProject,
  countGhostedBids,
  getBidProjectDetail,
  listBidProjects,
} from "@/lib/bidding/store";

type TradeSubBid = {
  bidId: string;
  subId: string;
  company: string;
  contact: string;
  email?: string;
  phone?: string;
  status: BidTradeStatus;
  bidAmount?: number;
};

type TradeRow = {
  tradeId: string;
  trade: string;
  bidsBySubId: Record<string, TradeSubBid | null>;
};

type BidProjectView = {
  id: string;
  projectName: string;
  owner: string;
  location: string;
  budget: number | null;
  dueDate: string | null;
  subs: Array<{ id: string; company: string; contact: string }>;
  trades: TradeRow[];
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

type NewSubDraft = {
  company_name: string;
  primary_contact: string;
  email: string;
  phone: string;
  status: BidTradeStatus;
  bid_amount: string;
  contact_name: string;
};

type EditBidDraft = {
  bid_id: string;
  sub_id: string;
  company_name: string;
  primary_contact: string;
  email: string;
  phone: string;
  status: BidTradeStatus;
  bid_amount: string;
  contact_name: string;
};

type InviteDraft = {
  status: BidTradeStatus;
  bid_amount: string;
  contact_name: string;
  invitee_mode: "existing" | "new";
  selected_sub_id: string;
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
    invited: "bg-slate-100 text-slate-700",
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

function BidComparisonGrid({
  project,
  onInviteExisting,
  onAddSubForTrade,
  onEditBid,
}: {
  project: BidProjectView;
  onInviteExisting: (payload: {
    tradeId: string;
    tradeName: string;
    projectSubId: string;
    company: string;
  }) => void;
  onAddSubForTrade: (payload: { tradeId: string; tradeName: string }) => void;
  onEditBid: (bid: TradeSubBid) => void;
}) {
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
              {project.subs.length ? (
                project.subs.map((sub, index) => (
                  <th
                    key={`sub-header-${sub.id}`}
                    className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-600"
                  >
                    <div className="text-base font-semibold text-slate-700">Sub {index + 1}</div>
                    <div className="text-xs font-medium text-slate-500">{sub.company}</div>
                  </th>
                ))
              ) : (
                <th
                  key="sub-header-placeholder"
                  className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-left text-xl font-semibold text-slate-600"
                >
                  Sub 1
                </th>
              )}
              <th className="border-b border-slate-200 bg-slate-100 px-3 py-3 text-center text-sm font-semibold text-slate-600">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {project.trades.map((row) => (
              <tr key={row.trade} className="align-top">
                <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-5 text-left text-lg font-semibold text-slate-900">
                  {row.trade}
                </th>
                {project.subs.length ? (
                  project.subs.map((sub) => {
                    const bid = row.bidsBySubId[sub.id] ?? null;
                    return (
                      <td key={`${row.trade}-${sub.id}`} className="border-b border-r border-slate-200 px-4 py-4">
                        {bid ? (
                          <button
                            type="button"
                            onClick={() => onEditBid(bid)}
                            className="group flex w-full flex-col items-start rounded-lg border border-transparent px-1 py-1 text-left transition hover:border-slate-200 hover:bg-slate-50"
                          >
                            <p className="text-xl font-semibold text-slate-900">{bid.company}</p>
                            <p className="text-sm text-slate-500">{bid.contact}</p>
                            <StatusPill status={bid.status} />
                            {bid.bidAmount ? <p className="text-2xl font-semibold text-slate-900">{formatCurrency(bid.bidAmount)}</p> : null}
                            <span className="mt-2 text-xs text-slate-400 opacity-0 transition group-hover:opacity-100">
                              Click to edit
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              onInviteExisting({
                                tradeId: row.tradeId,
                                tradeName: row.trade,
                                projectSubId: sub.id,
                                company: sub.company,
                              })
                            }
                            className="flex h-full min-h-24 w-full items-center rounded-lg border border-dashed border-slate-200 px-3 text-left text-sm text-slate-400 hover:border-slate-300 hover:bg-slate-50"
                          >
                            Not invited yet — click to add
                          </button>
                        )}
                      </td>
                    );
                  })
                ) : (
                  <td key={`${row.trade}-sub-empty`} className="border-b border-r border-slate-200 px-4 py-4">
                    <button
                      type="button"
                      onClick={() => onAddSubForTrade({ tradeId: row.tradeId, tradeName: row.trade })}
                      className="flex h-full min-h-24 w-full items-center rounded-lg border border-dashed border-slate-200 px-3 text-left text-sm text-slate-400 hover:border-slate-300 hover:bg-slate-50"
                    >
                      No subs yet — click to invite
                    </button>
                  </td>
                )}
                <td className="border-b border-slate-200 px-2 text-center align-middle">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-xl text-slate-600 transition hover:bg-slate-50"
                    aria-label={`Add subcontractor for ${row.trade}`}
                    onClick={() => onAddSubForTrade({ tradeId: row.tradeId, tradeName: row.trade })}
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

  const subByProjectSubId = new Map(detail.projectSubs.map((sub) => [sub.id, sub]));

  const trades: TradeRow[] = detail.trades.map((trade) => {
    const tradeMap = bidsByTrade.get(trade.id) ?? new Map<string, BidTradeBid>();
    const bidsBySubId: Record<string, TradeSubBid | null> = {};
    subs.forEach((sub) => {
      const bid = tradeMap.get(sub.id);
      if (!bid) {
        bidsBySubId[sub.id] = null;
        return;
      }
      const subRecord = subByProjectSubId.get(sub.id);
      bidsBySubId[sub.id] = {
        bidId: bid.id,
        subId: subRecord?.subcontractor_id ?? sub.id,
        company: sub.company,
        contact: bid.contact_name ?? sub.contact,
        email: subRecord?.subcontractor?.email ?? undefined,
        phone: subRecord?.subcontractor?.phone ?? undefined,
        status: bid.status,
        bidAmount: bid.bid_amount ?? undefined,
      };
    });
    return {
      tradeId: trade.id,
      trade: trade.trade_name,
      bidsBySubId,
    };
  });

  return {
    id: detail.project.id,
    projectName: detail.project.project_name,
    owner: detail.project.owner ?? "—",
    location: detail.project.location ?? "—",
    budget: detail.project.budget ?? null,
    dueDate: detail.project.due_date ?? null,
    subs,
    trades,
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
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteDraft, setInviteDraft] = useState<InviteDraft>({
    status: "bidding",
    bid_amount: "",
    contact_name: "",
    invitee_mode: "existing",
    selected_sub_id: "",
  });
  const [newSubDraft, setNewSubDraft] = useState<NewSubDraft>({
    company_name: "",
    primary_contact: "",
    email: "",
    phone: "",
    status: "bidding",
    bid_amount: "",
    contact_name: "",
  });
  const [inviteTarget, setInviteTarget] = useState<{
    tradeId: string;
    tradeName: string;
    projectSubId: string;
    company: string;
  } | null>(null);
  const [newSubTrade, setNewSubTrade] = useState<{ tradeId: string; tradeName: string } | null>(null);
  const [savingInvite, setSavingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [subList, setSubList] = useState<
    Array<{ id: string; company_name: string; primary_contact: string | null; email: string | null; phone: string | null }>
  >([]);
  const [subListLoading, setSubListLoading] = useState(false);
  const [subSearch, setSubSearch] = useState("");
  const [editBidModalOpen, setEditBidModalOpen] = useState(false);
  const [editBidDraft, setEditBidDraft] = useState<EditBidDraft | null>(null);
  const [savingBidEdit, setSavingBidEdit] = useState(false);
  const [editBidError, setEditBidError] = useState<string | null>(null);

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
    async function loadSubList() {
      if (!inviteModalOpen) return;
      setSubListLoading(true);
      const data = await listBidSubcontractors();
      if (!active) return;
      setSubList(data);
      setSubListLoading(false);
    }

    loadSubList();
    return () => {
      active = false;
    };
  }, [inviteModalOpen]);

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
  const invitedSubIds = useMemo(
    () => new Set(detail?.projectSubs.map((item) => item.subcontractor_id) ?? []),
    [detail]
  );
  const availableSubs = useMemo(
    () =>
      subList.filter(
        (sub) =>
          !invitedSubIds.has(sub.id) &&
          `${sub.company_name} ${sub.primary_contact ?? ""}`.toLowerCase().includes(subSearch.toLowerCase())
      ),
    [subList, invitedSubIds, subSearch]
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
          <BidComparisonGrid
            project={projectView}
            onInviteExisting={(payload) => {
              setInviteTarget(payload);
              setNewSubTrade(null);
              setInviteDraft({
                status: "bidding",
                bid_amount: "",
                contact_name: "",
                invitee_mode: "existing",
                selected_sub_id: "",
              });
              setInviteError(null);
              setInviteModalOpen(true);
            }}
            onAddSubForTrade={(payload) => {
              setNewSubTrade(payload);
              setNewSubDraft({
                company_name: "",
                primary_contact: "",
                email: "",
                phone: "",
                status: "bidding",
                bid_amount: "",
                contact_name: "",
              });
              setInviteTarget(null);
              setInviteDraft({
                status: "bidding",
                bid_amount: "",
                contact_name: "",
                invitee_mode: "existing",
                selected_sub_id: "",
              });
              setInviteError(null);
              setInviteModalOpen(true);
            }}
            onEditBid={(bid) => {
              setEditBidDraft({
                bid_id: bid.bidId,
                sub_id: bid.subId,
                company_name: bid.company,
                primary_contact: bid.contact,
                email: bid.email ?? "",
                phone: bid.phone ?? "",
                status: bid.status,
                bid_amount: bid.bidAmount ? String(bid.bidAmount) : "",
                contact_name: bid.contact ?? "",
              });
              setEditBidError(null);
              setEditBidModalOpen(true);
            }}
          />
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
      {inviteModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-2xl font-semibold text-slate-900">Invite Sub to Trade</h2>
              <p className="mt-1 text-sm text-slate-500">
                {inviteTarget ? `${inviteTarget.company} · ${inviteTarget.tradeName}` : newSubTrade ? `New invite · ${newSubTrade.tradeName}` : ""}
              </p>
            </div>
            <form
              className="space-y-4 px-6 py-5"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!selectedProject) return;
                setSavingInvite(true);
                setInviteError(null);
                const bidAmountValue = inviteDraft.bid_amount.trim() ? Number(inviteDraft.bid_amount) : null;
                if (inviteTarget) {
                  const ok = await createTradeBid({
                    project_id: selectedProject.id,
                    trade_id: inviteTarget.tradeId,
                    project_sub_id: inviteTarget.projectSubId,
                    status: inviteDraft.status,
                    bid_amount: Number.isFinite(bidAmountValue) ? bidAmountValue : null,
                    contact_name: inviteDraft.contact_name.trim() || null,
                  });
                  if (!ok) {
                    setInviteError("Unable to add this sub to the trade.");
                    setSavingInvite(false);
                    return;
                  }
                } else if (inviteDraft.invitee_mode === "existing") {
                  if (!inviteDraft.selected_sub_id) {
                    setInviteError("Select a subcontractor.");
                    setSavingInvite(false);
                    return;
                  }
                  if (!newSubTrade) {
                    setInviteError("Select a trade to invite.");
                    setSavingInvite(false);
                    return;
                  }
                  const tradeId = newSubTrade.tradeId;
                  let resolvedProjectSubId = "";
                  if (!resolvedProjectSubId) {
                    const sortOrder = detail?.projectSubs.length ? detail.projectSubs.length + 1 : 1;
                    const projectSub = await inviteSubToProject({
                      project_id: selectedProject.id,
                      subcontractor_id: inviteDraft.selected_sub_id,
                      sort_order: sortOrder,
                    });
                    if (!projectSub) {
                      setInviteError("Unable to invite subcontractor to project.");
                      setSavingInvite(false);
                      return;
                    }
                    resolvedProjectSubId = projectSub.id;
                  }
                  const ok = await createTradeBid({
                    project_id: selectedProject.id,
                    trade_id: tradeId,
                    project_sub_id: resolvedProjectSubId,
                    status: inviteDraft.status,
                    bid_amount: Number.isFinite(bidAmountValue) ? bidAmountValue : null,
                    contact_name: inviteDraft.contact_name.trim() || null,
                  });
                  if (!ok) {
                    setInviteError("Unable to add this sub to the trade.");
                    setSavingInvite(false);
                    return;
                  }
                } else {
                  if (!newSubDraft.company_name.trim()) {
                    setInviteError("Company name is required.");
                    setSavingInvite(false);
                    return;
                  }
                  if (!newSubTrade) {
                    setInviteError("Select a trade to invite.");
                    setSavingInvite(false);
                    return;
                  }
                  const tradeId = newSubTrade.tradeId;
                  const sub = await createBidSubcontractor({
                    company_name: newSubDraft.company_name,
                    primary_contact: newSubDraft.primary_contact.trim() || null,
                    email: newSubDraft.email.trim() || null,
                    phone: newSubDraft.phone.trim() || null,
                  });
                  if (!sub) {
                    setInviteError("Unable to create subcontractor.");
                    setSavingInvite(false);
                    return;
                  }
                  const sortOrder = detail?.projectSubs.length ? detail.projectSubs.length + 1 : 1;
                  const projectSub = await inviteSubToProject({
                    project_id: selectedProject.id,
                    subcontractor_id: sub.id,
                    sort_order: sortOrder,
                  });
                  if (!projectSub) {
                    setInviteError("Unable to invite subcontractor to project.");
                    setSavingInvite(false);
                    return;
                  }
                  const ok = await createTradeBid({
                    project_id: selectedProject.id,
                    trade_id: tradeId,
                    project_sub_id: projectSub.id,
                    status: inviteDraft.status,
                    bid_amount: Number.isFinite(bidAmountValue) ? bidAmountValue : null,
                    contact_name: inviteDraft.contact_name.trim() || null,
                  });
                  if (!ok) {
                    setInviteError("Unable to add this sub to the trade.");
                    setSavingInvite(false);
                    return;
                  }
                }
                const refreshed = await getBidProjectDetail(selectedProject.id);
                setDetail(refreshed);
                setInviteModalOpen(false);
                setInviteTarget(null);
                setNewSubTrade(null);
                setInviteDraft({ status: "bidding", bid_amount: "", contact_name: "", invitee_mode: "existing", selected_sub_id: "" });
                setSubSearch("");
                setSavingInvite(false);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {inviteTarget ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 sm:col-span-2">
                    Adding {inviteTarget.company} to {inviteTarget.tradeName}.
                  </div>
                ) : (
                  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                    Invitee
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setInviteDraft((prev) => ({ ...prev, invitee_mode: "existing" }))}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          inviteDraft.invitee_mode === "existing"
                            ? "border-slate-300 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        Existing Sub
                      </button>
                      <button
                        type="button"
                        onClick={() => setInviteDraft((prev) => ({ ...prev, invitee_mode: "new" }))}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          inviteDraft.invitee_mode === "new"
                            ? "border-slate-300 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        New Sub
                      </button>
                    </div>
                  </label>
                )}
                {!inviteTarget && inviteDraft.invitee_mode === "existing" ? (
                  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                    Subcontractor
                    <div className="flex flex-col gap-2">
                      <input
                        value={subSearch}
                        onChange={(event) => setSubSearch(event.target.value)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                        placeholder="Search subs"
                      />
                      <div className="max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white">
                        {subListLoading ? (
                          <div className="px-3 py-2 text-sm text-slate-500">Loading subs...</div>
                        ) : subList.length ? (
                          availableSubs.length ? (
                            availableSubs.map((sub) => (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => setInviteDraft((prev) => ({ ...prev, selected_sub_id: sub.id }))}
                                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                                  inviteDraft.selected_sub_id === sub.id ? "bg-slate-100 text-slate-900" : "hover:bg-slate-50"
                                }`}
                              >
                                <span className="font-medium">{sub.company_name}</span>
                                <span className="text-xs text-slate-500">{sub.primary_contact ?? "—"}</span>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-slate-500">All subs are already invited.</div>
                          )
                        ) : (
                          <div className="px-3 py-2 text-sm text-slate-500">No subs found.</div>
                        )}
                      </div>
                    </div>
                  </label>
                ) : !inviteTarget ? (
                  <>
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                      Company name
                      <input
                        value={newSubDraft.company_name}
                        onChange={(event) => setNewSubDraft((prev) => ({ ...prev, company_name: event.target.value }))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                      Primary contact
                      <input
                        value={newSubDraft.primary_contact}
                        onChange={(event) => setNewSubDraft((prev) => ({ ...prev, primary_contact: event.target.value }))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                      Email
                      <input
                        value={newSubDraft.email}
                        onChange={(event) => setNewSubDraft((prev) => ({ ...prev, email: event.target.value }))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                        type="email"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                      Phone
                      <input
                        value={newSubDraft.phone}
                        onChange={(event) => setNewSubDraft((prev) => ({ ...prev, phone: event.target.value }))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                      />
                    </label>
                  </>
                ) : null}
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Status
                  <select
                    value={inviteDraft.status}
                    onChange={(event) =>
                      setInviteDraft((prev) => ({ ...prev, status: event.target.value as BidTradeStatus }))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  >
                    <option value="invited">Invited</option>
                    <option value="bidding">Bidding</option>
                    <option value="submitted">Submitted</option>
                    <option value="declined">Declined</option>
                    <option value="ghosted">Ghosted</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Bid amount
                  <input
                    value={inviteDraft.bid_amount}
                    onChange={(event) => setInviteDraft((prev) => ({ ...prev, bid_amount: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    inputMode="decimal"
                    placeholder="e.g. 250000"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                  Contact name
                  <input
                    value={inviteDraft.contact_name}
                    onChange={(event) => setInviteDraft((prev) => ({ ...prev, contact_name: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    placeholder="Optional"
                  />
                </label>
              </div>
              {inviteError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {inviteError}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => {
                    setInviteModalOpen(false);
                    setInviteTarget(null);
                    setNewSubTrade(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingInvite}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingInvite ? "Adding..." : "Add to Trade"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {editBidModalOpen && editBidDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-2xl font-semibold text-slate-900">Edit Bid</h2>
              <p className="mt-1 text-sm text-slate-500">Update bid status, amount, and contractor info.</p>
            </div>
            <form
              className="space-y-4 px-6 py-5"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!editBidDraft) return;
                if (!editBidDraft.company_name.trim()) {
                  setEditBidError("Company name is required.");
                  return;
                }
                setSavingBidEdit(true);
                setEditBidError(null);
                const bidAmountValue = editBidDraft.bid_amount.trim() ? Number(editBidDraft.bid_amount) : null;
                const [bidOk, subOk] = await Promise.all([
                  updateTradeBid({
                    id: editBidDraft.bid_id,
                    status: editBidDraft.status,
                    bid_amount: Number.isFinite(bidAmountValue) ? bidAmountValue : null,
                    contact_name: editBidDraft.contact_name.trim() || null,
                  }),
                  updateBidSubcontractor({
                    id: editBidDraft.sub_id,
                    company_name: editBidDraft.company_name,
                    primary_contact: editBidDraft.primary_contact.trim() || null,
                    email: editBidDraft.email.trim() || null,
                    phone: editBidDraft.phone.trim() || null,
                  }),
                ]);
                if (!bidOk || !subOk) {
                  setEditBidError("Unable to save changes.");
                  setSavingBidEdit(false);
                  return;
                }
                if (selectedProject) {
                  const refreshed = await getBidProjectDetail(selectedProject.id);
                  setDetail(refreshed);
                }
                setEditBidModalOpen(false);
                setSavingBidEdit(false);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                  Company name
                  <input
                    value={editBidDraft.company_name}
                    onChange={(event) =>
                      setEditBidDraft((prev) => (prev ? { ...prev, company_name: event.target.value } : prev))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Primary contact
                  <input
                    value={editBidDraft.primary_contact}
                    onChange={(event) =>
                      setEditBidDraft((prev) => (prev ? { ...prev, primary_contact: event.target.value } : prev))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Email
                  <input
                    value={editBidDraft.email}
                    onChange={(event) =>
                      setEditBidDraft((prev) => (prev ? { ...prev, email: event.target.value } : prev))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    type="email"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Phone
                  <input
                    value={editBidDraft.phone}
                    onChange={(event) =>
                      setEditBidDraft((prev) => (prev ? { ...prev, phone: event.target.value } : prev))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Status
                  <select
                    value={editBidDraft.status}
                    onChange={(event) =>
                      setEditBidDraft((prev) => (prev ? { ...prev, status: event.target.value as BidTradeStatus } : prev))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  >
                    <option value="invited">Invited</option>
                    <option value="bidding">Bidding</option>
                    <option value="submitted">Submitted</option>
                    <option value="declined">Declined</option>
                    <option value="ghosted">Ghosted</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Bid amount
                  <input
                    value={editBidDraft.bid_amount}
                    onChange={(event) =>
                      setEditBidDraft((prev) => (prev ? { ...prev, bid_amount: event.target.value } : prev))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    inputMode="decimal"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                  Bid contact name
                  <input
                    value={editBidDraft.contact_name}
                    onChange={(event) =>
                      setEditBidDraft((prev) => (prev ? { ...prev, contact_name: event.target.value } : prev))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                </label>
              </div>
              {editBidError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {editBidError}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => setEditBidModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBidEdit}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingBidEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
