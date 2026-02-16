"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBidManagementToolbar } from "@/components/bidding/bid-management-toolbar";
import BidRiskOverview, { type BidRiskProject } from "@/components/bidding/BidRiskOverview";
import ActiveBidSelector, { type ActiveBidProject } from "@/components/bidding/ActiveBidSelector";
import ProjectSummaryBar from "@/components/bidding/ProjectSummaryBar";
import TradeLevelingGrid, { type BidProjectView } from "@/components/bidding/TradeLevelingGrid";
import type { TradeRowData, TradeSubBid } from "@/components/bidding/TradeRow";
import type {
  BidProjectDetail,
  BidProjectSummary,
  BidTradeBid,
  BidTradeStatus,
} from "@/lib/bidding/types";
import { computeCoverageSnapshot, TARGET_BIDS_PER_TRADE } from "@/lib/bidding/metrics";
import {
  createBidProject,
  createBidTrades,
  createBidSubcontractor,
  inviteSubToProject,
  createTradeBid,
  updateTradeBid,
  updateBidSubcontractor,
  updateBidProject,
  updateBidTrades,
  archiveBidProject,
  getBidProjectDetail,
  listBidSubcontractors,
  listBidProjects,
} from "@/lib/bidding/store";

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
  notes: string;
};

type InviteDraft = {
  status: BidTradeStatus;
  bid_amount: string;
  contact_name: string;
  notes: string;
  invitee_mode: "existing" | "new";
  selected_sub_id: string;
};

type TradeEditDraft = {
  id: string | null;
  trade_name: string;
  sort_order: number;
};

type RiskStatus = "Healthy" | "At Risk" | "Critical";

function daysUntil(isoDate: string | null): number {
  if (!isoDate) return Number.POSITIVE_INFINITY;
  const today = new Date();
  const due = new Date(`${isoDate}T00:00:00`);
  const msPerDay = 1000 * 60 * 60 * 24;
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.max(0, Math.ceil((due.getTime() - todayMidnight) / msPerDay));
}

function getRiskStatus(dueInDays: number, coveragePct: number): RiskStatus {
  if (!Number.isFinite(dueInDays)) return coveragePct < 60 ? "At Risk" : "Healthy";
  if (dueInDays <= 3 && coveragePct < 65) return "Critical";
  if (dueInDays <= 7 && coveragePct < 75) return "At Risk";
  if (coveragePct < 45) return "Critical";
  if (coveragePct < 65) return "At Risk";
  return "Healthy";
}

function getNextSubSortOrder(projectSubs: BidProjectDetail["projectSubs"]): number {
  const used = new Set(
    projectSubs
      .map((sub) => sub.sort_order)
      .filter((value): value is number => typeof value === "number" && Number.isInteger(value) && value > 0)
  );

  let next = 1;
  while (used.has(next)) {
    next += 1;
  }
  return next;
}

function buildProjectView(detail: BidProjectDetail | null): BidProjectView | null {
  if (!detail) return null;
  const sortedProjectSubs = [...detail.projectSubs].sort((a, b) => {
    const aOrder = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;

    const aInvitedAt = a.invited_at ?? "";
    const bInvitedAt = b.invited_at ?? "";
    return aInvitedAt.localeCompare(bInvitedAt);
  });

  const subs = sortedProjectSubs
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

  const subByProjectSubId = new Map(sortedProjectSubs.map((sub) => [sub.id, sub]));

  const trades: TradeRowData[] = detail.trades.map((trade) => {
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
        notes: bid.notes ?? undefined,
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
  const { setActions } = useBidManagementToolbar();
  const [projects, setProjects] = useState<BidProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [overviewProjects, setOverviewProjects] = useState<BidRiskProject[]>([]);
  const [detail, setDetail] = useState<BidProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTradesModalOpen, setEditTradesModalOpen] = useState(false);
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
  const [tradeCostCodeQuery, setTradeCostCodeQuery] = useState("");
  const [loadingCostCodes, setLoadingCostCodes] = useState(false);
  const [tradeDrafts, setTradeDrafts] = useState<TradeEditDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingTrades, setSavingTrades] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [tradeEditError, setTradeEditError] = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteDraft, setInviteDraft] = useState<InviteDraft>({
    status: "bidding",
    bid_amount: "",
    contact_name: "",
    notes: "",
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
    Array<{
      id: string;
      company_name: string;
      primary_contact: string | null;
      email: string | null;
      phone: string | null;
      approved_vendor: boolean;
    }>
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
      setLoading(false);
    }

    loadProjects();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadOverviewProjects() {
      if (!projects.length) {
        setOverviewProjects([]);
        return;
      }

      const details = await Promise.all(projects.map((project) => getBidProjectDetail(project.id)));
      if (!active) return;

      const mapped: BidRiskProject[] = details
        .filter((detail): detail is BidProjectDetail => Boolean(detail))
        .map((projectDetail) => {
          const coverage = computeCoverageSnapshot(projectDetail, TARGET_BIDS_PER_TRADE);
          const tradesTotal = projectDetail.trades.length;
          const tradesWith2PlusBids = Math.max(0, tradesTotal - coverage.tradesThin.length);

          return {
            id: projectDetail.project.id,
            projectName: projectDetail.project.project_name,
            clientName: projectDetail.project.owner ?? "Unknown owner",
            dueDate: projectDetail.project.due_date ?? null,
            tradesTotal,
            tradesWith2PlusBids,
            tradesThin: coverage.tradesThin,
            awaitingResponsesCount: coverage.awaitingResponsesCount,
            coveragePct: coverage.coveragePct,
            coverageNumerator: coverage.coverageNumerator,
            coverageDenominator: coverage.coverageDenominator,
            targetBidsPerTrade: coverage.targetBidsPerTrade,
          };
        });

      setOverviewProjects(mapped);
    }

    loadOverviewProjects();
    return () => {
      active = false;
    };
  }, [projects]);

  useEffect(() => {
    if (selectedProjectId || !projects.length) return;
    setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  useEffect(() => {
    let active = true;
    async function loadCostCodes() {
      if (!modalOpen && !editTradesModalOpen) return;
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
  }, [modalOpen, editTradesModalOpen]);

  useEffect(() => {
    let active = true;
    async function loadSubList() {
      if (!inviteModalOpen) return;
      setSubListLoading(true);
      try {
        const subs = await listBidSubcontractors();
        if (!active) return;
        setSubList(
          subs.map((sub) => ({
            id: String(sub.id),
            company_name: String(sub.company_name ?? "").trim(),
            primary_contact: sub.primary_contact ?? null,
            email: sub.email ?? null,
            phone: sub.phone ?? null,
            approved_vendor: Boolean(sub.approved_vendor),
          }))
        );
      } catch (err) {
        console.error("Failed to load subcontractors", err);
        if (!active) return;
        setSubList([]);
      } finally {
        if (active) setSubListLoading(false);
      }
    }

    loadSubList();
    return () => {
      active = false;
    };
  }, [inviteModalOpen]);

  useEffect(() => {
    const shouldLock =
      modalOpen || editModalOpen || editTradesModalOpen || inviteModalOpen || editBidModalOpen;
    const body = document.body;
    const html = document.documentElement;
    const previousOverflow = body.style.overflow;
    const previousPosition = body.style.position;
    const previousTop = body.style.top;
    const previousWidth = body.style.width;
    const previousPaddingRight = body.style.paddingRight;
    const previousHtmlOverflow = html.style.overflow;
    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - html.clientWidth;
    if (shouldLock) {
      body.style.overflow = "hidden";
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.width = "100%";
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
      html.style.overflow = "hidden";
    } else {
      body.style.overflow = "";
      body.style.position = "";
      body.style.top = "";
      body.style.width = "";
      body.style.paddingRight = "";
      html.style.overflow = "";
      window.scrollTo(0, scrollY);
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.position = previousPosition;
      document.body.style.top = previousTop;
      document.body.style.width = previousWidth;
      document.body.style.paddingRight = previousPaddingRight;
      document.documentElement.style.overflow = previousHtmlOverflow;
      if (!shouldLock) return;
      const top = Number.parseInt(previousTop || "0", 10);
      if (!Number.isNaN(top) && top !== 0) {
        window.scrollTo(0, -top);
      }
    };
  }, [modalOpen, editModalOpen, editTradesModalOpen, inviteModalOpen, editBidModalOpen]);

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
  const selectedRiskProject = useMemo(
    () => overviewProjects.find((project) => project.id === selectedProjectId) ?? null,
    [overviewProjects, selectedProjectId]
  );
  const activeBidProjects = useMemo<ActiveBidProject[]>(
    () =>
      overviewProjects.map((project) => ({
        id: project.id,
        projectName: project.projectName,
        dueInDays: daysUntil(project.dueDate),
        coveragePct: project.coveragePct ?? 0,
        status: getRiskStatus(daysUntil(project.dueDate), project.coveragePct ?? 0),
      })),
    [overviewProjects]
  );
  const selectedCoverage = useMemo(() => {
    if (!detail) return null;
    return computeCoverageSnapshot(detail, TARGET_BIDS_PER_TRADE);
  }, [detail]);
  const normalizeName = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const normalizeEmail = (value: string) => value.toLowerCase().trim();
  const normalizePhone = (value: string) => value.replace(/\D/g, "");

  const invitedCompanyKeys = useMemo(() => {
    const keys = new Set<string>();
    (detail?.projectSubs ?? []).forEach((item) => {
      const name = item.subcontractor?.company_name ? normalizeName(item.subcontractor.company_name) : "";
      const email = item.subcontractor?.email ? normalizeEmail(item.subcontractor.email) : "";
      const phone = item.subcontractor?.phone ? normalizePhone(item.subcontractor.phone) : "";
      if (name) keys.add(`name:${name}`);
      if (email) keys.add(`email:${email}`);
      if (phone) keys.add(`phone:${phone}`);
    });
    return keys;
  }, [detail]);
  const availableSubs = useMemo(
    () =>
      subList.filter((sub) => {
        const nameKey = `name:${normalizeName(sub.company_name)}`;
        const emailKey = sub.email ? `email:${normalizeEmail(sub.email)}` : "";
        const phoneKey = sub.phone ? `phone:${normalizePhone(sub.phone)}` : "";
        const isInvited =
          invitedCompanyKeys.has(nameKey) ||
          (emailKey && invitedCompanyKeys.has(emailKey)) ||
          (phoneKey && invitedCompanyKeys.has(phoneKey));
        if (isInvited) return false;
        return `${sub.company_name} ${sub.primary_contact ?? ""} ${sub.email ?? ""}`
          .toLowerCase()
          .includes(subSearch.toLowerCase());
      }),
    [subList, invitedCompanyKeys, subSearch]
  );
  const tradeNamesLower = useMemo(
    () => new Set(tradeDrafts.map((trade) => trade.trade_name.trim().toLowerCase()).filter(Boolean)),
    [tradeDrafts]
  );
  const exportProjectCsv = useCallback(() => {
    if (!projectView) return;
    const rows = [
      ["Trade", "Subcontractor", "Status", "Bid Amount", "Contact"],
      ...projectView.trades.flatMap((trade) =>
        Object.values(trade.bidsBySubId)
          .filter((bid): bid is TradeSubBid => Boolean(bid))
          .map((bid) => [trade.trade, bid.company, bid.status, String(bid.bidAmount ?? ""), bid.contact])
      ),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/\"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${projectView.projectName.replace(/\s+/g, "-").toLowerCase()}-bid-leveling.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [projectView]);

  const openEditModal = useCallback(() => {
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
  }, [selectedProject]);

  const openEditTradesModal = useCallback(() => {
    if (!detail) return;
    setTradeDrafts(
      detail.trades.map((trade, index) => ({
        id: trade.id,
        trade_name: trade.trade_name ?? "",
        sort_order: trade.sort_order ?? index + 1,
      }))
    );
    setTradeCostCodeQuery("");
    setTradeEditError(null);
    setEditTradesModalOpen(true);
  }, [detail]);

  const toolbarActions = useMemo(
    () => (
      <>
        {selectedProject ? (
          <>
            <button
              type="button"
              onClick={openEditModal}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Edit Project
            </button>
            <button
              type="button"
              onClick={openEditTradesModal}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Edit Trades
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          <span aria-hidden>＋</span>
          New Project
        </button>
      </>
    ),
    [openEditModal, openEditTradesModal, selectedProject, setFormError, setModalOpen]
  );

  useEffect(() => {
    setActions(toolbarActions);
    return () => setActions(null);
  }, [setActions, toolbarActions]);

  const openInviteForTrade = useCallback((payload: { tradeId: string; tradeName: string }) => {
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
      notes: "",
      invitee_mode: "existing",
      selected_sub_id: "",
    });
    setInviteError(null);
    setInviteModalOpen(true);
  }, []);

  const openBidEdit = useCallback((bid: TradeSubBid) => {
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
      notes: bid.notes ?? "",
    });
    setEditBidError(null);
    setEditBidModalOpen(true);
  }, []);

  const archiveSelectedProject = useCallback(async () => {
    if (!selectedProject) return;
    const confirmed = window.confirm(`Archive “${selectedProject.project_name}”? This will remove it from active bids.`);
    if (!confirmed) return;
    const ok = await archiveBidProject(selectedProject.id);
    if (!ok) return;
    const nextProjects = projects.filter((project) => project.id !== selectedProject.id);
    setProjects(nextProjects);
    setOverviewProjects((prev) => prev.filter((project) => project.id !== selectedProject.id));
    setSelectedProjectId(nextProjects[0]?.id ?? "");
  }, [projects, selectedProject]);

  return (
    <main className="space-y-6 bg-slate-50 p-4 sm:p-6">
      <section id="risk-overview">
        <BidRiskOverview
          projects={overviewProjects}
          onCreateFirstBid={() => {
            setFormError(null);
            setModalOpen(true);
          }}
          onOpenProject={setSelectedProjectId}
        />
      </section>

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-6 text-sm text-slate-500 shadow-sm">
          Loading bid projects...
        </section>
      ) : projects.length ? (
        <div className="space-y-3">
          <ActiveBidSelector
            projects={activeBidProjects}
            selectedProjectId={selectedProjectId}
            onSelect={setSelectedProjectId}
            onViewAll={() => document.getElementById("risk-overview")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          />

          {loadingDetail ? (
            <section className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-500 shadow-sm">
              Loading bid details...
            </section>
          ) : projectView ? (
            <div className="space-y-3">
              <ProjectSummaryBar
                projectName={projectView.projectName}
                clientName={projectView.owner}
                city={projectView.location}
                bidAmount={projectView.budget}
                dueDate={projectView.dueDate}
                coveragePct={selectedCoverage?.coveragePct ?? selectedRiskProject?.coveragePct ?? 0}
                tradesThin={selectedCoverage?.tradesThin.length ?? selectedRiskProject?.tradesThin.length ?? 0}
                awaitingResponses={selectedCoverage?.awaitingResponsesCount ?? selectedRiskProject?.awaitingResponsesCount ?? 0}
                onInviteSubs={() => {
                  if (projectView.trades[0]) {
                    openInviteForTrade({ tradeId: projectView.trades[0].tradeId, tradeName: projectView.trades[0].trade });
                    return;
                  }
                  openEditTradesModal();
                }}
                onExport={exportProjectCsv}
                onArchive={archiveSelectedProject}
              />
              <TradeLevelingGrid
                project={projectView}
                onAddSubForTrade={openInviteForTrade}
                onAddTrade={openEditTradesModal}
                onEditBid={openBidEdit}
              />
            </div>
          ) : (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500 shadow-sm">
              Select a project to view bid coverage.
            </section>
          )}
        </div>
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500 shadow-sm">
          No bid projects yet. Create your first bid to start tracking coverage.
        </section>
      )}

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
                setOverviewProjects((prev) => [
                  {
                    id: created.id,
                    projectName: created.project_name,
                    clientName: created.owner ?? "Unknown owner",
                    dueDate: created.due_date ?? null,
                    tradesTotal: 0,
                    tradesWith2PlusBids: 0,
                    tradesThin: [],
                    awaitingResponsesCount: 0,
                  },
                  ...prev,
                ]);
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
      {editTradesModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
          <div className="flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-xl sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl">
            <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
              <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Edit Trades / Cost Codes</h2>
              <p className="mt-1 text-sm text-slate-500">Rename existing trades and add more trades to this project.</p>
            </div>
            <form
              className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:gap-5 sm:px-6 sm:py-5"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!selectedProject) return;
                const normalizedDrafts = tradeDrafts.map((trade) => ({
                  ...trade,
                  trade_name: trade.trade_name.trim(),
                }));
                if (normalizedDrafts.some((trade) => trade.id && !trade.trade_name)) {
                  setTradeEditError("Existing trades cannot be blank.");
                  return;
                }
                const persistedDrafts = normalizedDrafts.filter((trade) => trade.id || trade.trade_name);
                if (!persistedDrafts.length) {
                  setTradeEditError("Add at least one trade.");
                  return;
                }

                const indexedDrafts = persistedDrafts.map((trade, index) => ({
                  ...trade,
                  sort_order: index + 1,
                }));
                const existingPayload = indexedDrafts
                  .filter((trade): trade is TradeEditDraft & { id: string } => Boolean(trade.id))
                  .map((trade) => ({
                    id: trade.id,
                    trade_name: trade.trade_name,
                    sort_order: trade.sort_order,
                  }));
                const newPayload = indexedDrafts
                  .filter((trade) => !trade.id)
                  .map((trade) => ({
                    trade_name: trade.trade_name,
                    sort_order: trade.sort_order,
                  }));

                setSavingTrades(true);
                setTradeEditError(null);
                const updated = await updateBidTrades(selectedProject.id, existingPayload);
                if (!updated) {
                  setTradeEditError("Unable to update existing trades.");
                  setSavingTrades(false);
                  return;
                }
                const created = await createBidTrades(selectedProject.id, newPayload);
                if (!created) {
                  setTradeEditError("Unable to add new trades.");
                  setSavingTrades(false);
                  return;
                }

                const refreshed = await getBidProjectDetail(selectedProject.id);
                setDetail(refreshed);
                setEditTradesModalOpen(false);
                setSavingTrades(false);
              }}
            >
              <div className="grid gap-3 md:grid-cols-2 sm:gap-4">
                <div className="rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                    Project Trades
                  </div>
                  <div className="max-h-64 space-y-2 overflow-auto p-3 sm:max-h-80">
                    {tradeDrafts.length ? (
                      tradeDrafts.map((trade, index) => (
                        <div key={`${trade.id ?? "new"}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                              value={trade.trade_name}
                              onChange={(event) =>
                                setTradeDrafts((prev) =>
                                  prev.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, trade_name: event.target.value } : item
                                  )
                                )
                              }
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none sm:flex-1"
                              placeholder="Trade name"
                            />
                            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  setTradeDrafts((prev) => {
                                    if (index === 0) return prev;
                                    const next = [...prev];
                                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                    return next;
                                  })
                                }
                                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                aria-label="Move trade up"
                              >
                                Up
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setTradeDrafts((prev) => {
                                    if (index >= prev.length - 1) return prev;
                                    const next = [...prev];
                                    [next[index], next[index + 1]] = [next[index + 1], next[index]];
                                    return next;
                                  })
                                }
                                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                aria-label="Move trade down"
                              >
                                Down
                              </button>
                              {!trade.id ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTradeDrafts((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                                  }
                                  className="col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 sm:col-span-1"
                                  aria-label="Remove new trade"
                                >
                                  Remove
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                        No trades yet. Add from cost codes or create a manual trade.
                      </div>
                    )}
                  </div>
                  <div className="border-t border-slate-200 p-3">
                    <button
                      type="button"
                      onClick={() =>
                        setTradeDrafts((prev) => [
                          ...prev,
                          { id: null, trade_name: "", sort_order: prev.length + 1 },
                        ])
                      }
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Add Manual Trade
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50">
                  <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                    Add From Cost Codes
                  </div>
                  <div className="space-y-2 p-3">
                    <input
                      value={tradeCostCodeQuery}
                      onChange={(event) => setTradeCostCodeQuery(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                      placeholder="Search cost codes"
                    />
                    <div className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white sm:max-h-72">
                      {loadingCostCodes ? (
                        <div className="px-3 py-4 text-sm text-slate-500">Loading cost codes...</div>
                      ) : costCodes.length ? (
                        costCodes
                          .filter((code) => {
                            const label = `${code.code} ${code.description ?? ""}`.toLowerCase();
                            return label.includes(tradeCostCodeQuery.toLowerCase());
                          })
                          .filter((code) => {
                            const tradeLabel = `${code.code}${code.description ? ` ${code.description}` : ""}`.trim().toLowerCase();
                            return !tradeNamesLower.has(tradeLabel);
                          })
                          .map((code) => {
                            const tradeLabel = `${code.code}${code.description ? ` ${code.description}` : ""}`.trim();
                            return (
                              <button
                                key={code.id}
                                type="button"
                                onClick={() =>
                                  setTradeDrafts((prev) => [
                                    ...prev,
                                    {
                                      id: null,
                                      trade_name: tradeLabel,
                                      sort_order: prev.length + 1,
                                    },
                                  ])
                                }
                                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <span className="font-medium">{code.code}</span>
                                <span className="ml-3 truncate text-xs text-slate-500">{code.description ?? "No description"}</span>
                              </button>
                            );
                          })
                      ) : (
                        <div className="px-3 py-4 text-sm text-slate-500">No cost codes found.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {tradeEditError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {tradeEditError}
                </p>
              ) : null}
              <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white pt-4">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => setEditTradesModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTrades}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingTrades ? "Saving..." : "Save Trades"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {inviteModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 py-6 overflow-y-auto overscroll-contain">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
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
                const notesValue = inviteDraft.notes.trim() || null;
                if (inviteTarget) {
                  const ok = await createTradeBid({
                    project_id: selectedProject.id,
                    trade_id: inviteTarget.tradeId,
                    project_sub_id: inviteTarget.projectSubId,
                    status: inviteDraft.status,
                    bid_amount: Number.isFinite(bidAmountValue) ? bidAmountValue : null,
                    contact_name: inviteDraft.contact_name.trim() || null,
                    notes: notesValue,
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
                  const selectedCompany = subList.find((sub) => sub.id === inviteDraft.selected_sub_id);
                  if (!selectedCompany) {
                    setInviteError("Selected subcontractor not found.");
                    setSavingInvite(false);
                    return;
                  }
                  const tradeId = newSubTrade.tradeId;
                  const sortOrder = getNextSubSortOrder(detail?.projectSubs ?? []);
                  const projectSub = await inviteSubToProject({
                    project_id: selectedProject.id,
                    subcontractor_id: selectedCompany.id,
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
                    notes: notesValue,
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
                    approved_vendor: false,
                  });
                  if (!sub) {
                    setInviteError("Unable to create subcontractor.");
                    setSavingInvite(false);
                    return;
                  }
                  setSubList((prev) => [
                    ...prev,
                    {
                      id: sub.id,
                      company_name: newSubDraft.company_name.trim(),
                      primary_contact: newSubDraft.primary_contact.trim() || null,
                      email: newSubDraft.email.trim() || null,
                      phone: newSubDraft.phone.trim() || null,
                      approved_vendor: false,
                    },
                  ]);
                  const sortOrder = getNextSubSortOrder(detail?.projectSubs ?? []);
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
                    notes: notesValue,
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
                setInviteDraft({
                  status: "bidding",
                  bid_amount: "",
                  contact_name: "",
                  notes: "",
                  invitee_mode: "existing",
                  selected_sub_id: "",
                });
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
                                onClick={() =>
                                  setInviteDraft((prev) => ({
                                    ...prev,
                                    selected_sub_id: sub.id,
                                    contact_name: prev.contact_name || sub.primary_contact || "",
                                  }))
                                }
                                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                                  inviteDraft.selected_sub_id === sub.id ? "bg-slate-100 text-slate-900" : "hover:bg-slate-50"
                                }`}
                              >
                                <span className="font-medium">{sub.company_name}</span>
                                <span className="flex items-center gap-2 text-xs text-slate-500">
                                  {sub.approved_vendor ? (
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                      Approved
                                    </span>
                                  ) : null}
                                  <span>{sub.primary_contact ?? "—"}</span>
                                </span>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-slate-500">All subs are already invited.</div>
                          )
                        ) : (
                          <div className="px-3 py-2 text-sm text-slate-500">No subs found.</div>
                        )}
                      </div>
                      {inviteDraft.selected_sub_id ? (
                        (() => {
                          const selected = subList.find((sub) => sub.id === inviteDraft.selected_sub_id);
                          if (!selected) return null;
                          return (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                              <div className="font-semibold text-slate-700">{selected.company_name}</div>
                              <div>
                                {selected.primary_contact ? `Contact: ${selected.primary_contact}` : "Contact: —"}
                                {" · "}
                                {selected.email ? `Email: ${selected.email}` : "Email: —"}
                                {" · "}
                                {selected.phone ? `Phone: ${selected.phone}` : "Phone: —"}
                              </div>
                              <label className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={selected.approved_vendor}
                                  onChange={async (event) => {
                                    const nextApproved = event.target.checked;
                                    const updated = await updateBidSubcontractor({
                                      id: selected.id,
                                      company_name: selected.company_name,
                                      primary_contact: selected.primary_contact ?? null,
                                      email: selected.email ?? null,
                                      phone: selected.phone ?? null,
                                      approved_vendor: nextApproved,
                                    });
                                    if (!updated) return;
                                    setSubList((prev) =>
                                      prev.map((item) =>
                                        item.id === selected.id ? { ...item, approved_vendor: nextApproved } : item
                                      )
                                    );
                                  }}
                                />
                                Approved Vendor
                              </label>
                            </div>
                          );
                        })()
                      ) : null}
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
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                  Notes
                  <textarea
                    value={inviteDraft.notes}
                    onChange={(event) => setInviteDraft((prev) => ({ ...prev, notes: event.target.value }))}
                    className="min-h-[96px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    placeholder="Add bid notes, scope clarifications, or special terms."
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
                    notes: editBidDraft.notes.trim() || null,
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
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                  Notes
                  <textarea
                    value={editBidDraft.notes}
                    onChange={(event) =>
                      setEditBidDraft((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                    }
                    className="min-h-[96px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    placeholder="Add bid notes, scope clarifications, or special terms."
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
