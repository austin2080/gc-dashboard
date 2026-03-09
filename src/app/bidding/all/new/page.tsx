"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createBidProject,
  createBidSubcontractor,
  createBidTrades,
  createTradeBid,
  getBidProjectDetail,
  inviteSubToProject,
  listBidSubcontractors,
  updateBidProject,
  updateBidTrades,
} from "@/lib/bidding/store";

type BidPackageDraft = {
  project_name: string;
  package_number: string;
  status: string;
  architect: string;
  bid_set_date: string;
  owner: string;
  location: string;
  budget: string;
  due_date: string;
  due_hour: string;
  due_minute: string;
  due_period: string;
  tbd_due_date: boolean;
  primary_bidding_contact: string;
  bidding_cc_group: string;
  bidding_instructions: string;
  rfi_deadline_enabled: boolean;
  rfi_deadline_date: string;
  rfi_deadline_hour: string;
  rfi_deadline_minute: string;
  rfi_deadline_period: string;
  site_walkthrough_enabled: boolean;
  site_walkthrough_date: string;
  site_walkthrough_hour: string;
  site_walkthrough_minute: string;
  site_walkthrough_period: string;
  anticipated_award_date: string;
  countdown_emails: boolean;
  accept_submissions_past_due: boolean;
  enable_blind_bidding: boolean;
  disable_electronic_submission: boolean;
  include_bid_documents: boolean;
  bid_submission_confirmation_message: string;
};

type FileSectionKey = "drawings" | "documents" | "specifications";

type UploadedBidFile = {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  section: FileSectionKey;
  url: string;
};

type CostCodeOption = {
  id: string;
  code: string;
  description: string | null;
};

type SelectedTrade = {
  id: string;
  code: string;
  description: string | null;
};

type SubOption = {
  id: string;
  company: string;
  email?: string | null;
};

type AssignedSub = SubOption & {
  invited: boolean;
  willBid: boolean;
  bidInviteEmail: string;
};

type InvitationEmailDraft = {
  subject: string;
  message: string;
  requireAcknowledgement: boolean;
};

type ToastState = {
  type: "success" | "error";
  message: string;
};

const INVITATION_EMAIL_DRAFT_STORAGE_KEY = "bidding-all-new-invitation-email-draft";
const TOKEN_LIST = [
  "{project_name}",
  "{bid_package_name}",
  "{bid_due_date}",
  "{prebid_info}",
  "{portal_link}",
  "{contact_name}",
  "{contact_email}",
] as const;

const DEFAULT_INVITATION_SUBJECT = "Invitation to Bid: {bid_package_name} for {project_name}";
const DEFAULT_INVITATION_MESSAGE = [
  "Hello,",
  "",
  "You are invited to bid on {bid_package_name} for {project_name}.",
  "Bid due date: {bid_due_date}",
  "",
  "Pre-bid information:",
  "{prebid_info}",
  "",
  "Submit your bid here: {portal_link}",
  "",
  "For questions, contact {contact_name} at {contact_email}.",
  "",
  "Thank you,",
  "{contact_name}",
].join("\n");

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function createDefaultDraft(): BidPackageDraft {
  return {
    project_name: "",
    package_number: "",
    status: "bidding",
    architect: "",
    bid_set_date: "",
    owner: "",
    location: "",
    budget: "",
    due_date: "",
    due_hour: "12",
    due_minute: "00",
    due_period: "am",
    tbd_due_date: false,
    primary_bidding_contact: "Project Manager",
    bidding_cc_group: "",
    bidding_instructions: "",
    rfi_deadline_enabled: true,
    rfi_deadline_date: "2024-11-30",
    rfi_deadline_hour: "12",
    rfi_deadline_minute: "00",
    rfi_deadline_period: "am",
    site_walkthrough_enabled: false,
    site_walkthrough_date: "",
    site_walkthrough_hour: "12",
    site_walkthrough_minute: "00",
    site_walkthrough_period: "am",
    anticipated_award_date: "",
    countdown_emails: false,
    accept_submissions_past_due: false,
    enable_blind_bidding: false,
    disable_electronic_submission: false,
    include_bid_documents: true,
    bid_submission_confirmation_message: "",
  };
}

function buildTradeLabel(trade: { code: string; description: string | null }): string {
  return `${trade.code}${trade.description ? ` ${trade.description}` : ""}`.trim();
}

export default function NewBidPackagePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editingProjectId = searchParams.get("project");
  const isEditMode = Boolean(editingProjectId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingExistingProject, setLoadingExistingProject] = useState(false);
  const [activePanel, setActivePanel] = useState<"general" | "files" | "trade-coverage" | "invite-subs" | "bid-email">("general");
  const [activeFileSection, setActiveFileSection] = useState<FileSectionKey>("drawings");
  const [costCodes, setCostCodes] = useState<CostCodeOption[]>([]);
  const [loadingCostCodes, setLoadingCostCodes] = useState(false);
  const [costCodeLoadError, setCostCodeLoadError] = useState<string | null>(null);
  const [costCodeQuery, setCostCodeQuery] = useState("");
  const [selectedTrades, setSelectedTrades] = useState<SelectedTrade[]>([]);
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [subOptions, setSubOptions] = useState<SubOption[]>([]);
  const [loadingSubOptions, setLoadingSubOptions] = useState(false);
  const [manageQueryByTradeId, setManageQueryByTradeId] = useState<Record<string, string>>({});
  const [manageSearchActiveByTradeId, setManageSearchActiveByTradeId] = useState<Record<string, boolean>>({});
  const [assignedSubsByTradeId, setAssignedSubsByTradeId] = useState<Record<string, AssignedSub[]>>({});
  const [inviteQueryByTradeId, setInviteQueryByTradeId] = useState<Record<string, string>>({});
  const [expandedInviteTradeId, setExpandedInviteTradeId] = useState<string | null>(null);
  const [newSubDrawerTradeId, setNewSubDrawerTradeId] = useState<string | null>(null);
  const [newSubDraft, setNewSubDraft] = useState({
    company_name: "",
    primary_contact: "",
    email: "",
    phone: "",
  });
  const [newSubSaving, setNewSubSaving] = useState(false);
  const [newSubError, setNewSubError] = useState<string | null>(null);
  const [invitationEmailDraft, setInvitationEmailDraft] = useState<InvitationEmailDraft>({
    subject: DEFAULT_INVITATION_SUBJECT,
    message: DEFAULT_INVITATION_MESSAGE,
    requireAcknowledgement: false,
  });
  const [invitationDraftHydrated, setInvitationDraftHydrated] = useState(false);
  const [invitationSaving, setInvitationSaving] = useState(false);
  const [invitationSavedAt, setInvitationSavedAt] = useState<string | null>(null);
  const [focusedInvitationField, setFocusedInvitationField] = useState<"subject" | "message">("subject");
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [tokenValuesOpen, setTokenValuesOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testSendEmail, setTestSendEmail] = useState("");
  const [testSendLoading, setTestSendLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedBidFile[]>([]);
  const [draft, setDraft] = useState<BidPackageDraft>(createDefaultDraft());
  const subjectInputRef = useRef<HTMLInputElement | null>(null);
  const messageTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const filesInActiveSection = useMemo(
    () => uploadedFiles.filter((file) => file.section === activeFileSection),
    [activeFileSection, uploadedFiles]
  );

  const handleUploadFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next = Array.from(files);
    if (next.length > 25) {
      setFileError("Upload up to 25 files at a time.");
      return;
    }
    setFileError(null);
    const now = new Date().toISOString();
    const mapped = next.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      size: file.size,
      uploadedAt: now,
      section: activeFileSection,
      url: URL.createObjectURL(file),
    }));
    setUploadedFiles((prev) => [...mapped, ...prev]);
  };

  useEffect(() => {
    let active = true;
    async function loadCostCodes() {
      setLoadingCostCodes(true);
      setCostCodeLoadError(null);
      try {
        const response = await fetch("/api/cost-codes", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as { costCodes?: unknown; error?: string } | null;
        if (!active) return;
        if (!response.ok) {
          setCostCodeLoadError(payload?.error ?? "Unable to load cost codes.");
          setCostCodes([]);
          return;
        }
        const rows = Array.isArray(payload?.costCodes) ? payload.costCodes : [];
        const mapped = rows
          .map((row) => {
            if (!row || typeof row !== "object") return null;
            const raw = row as { id?: unknown; code?: unknown; description?: unknown };
            if (typeof raw.id !== "string" || typeof raw.code !== "string") return null;
            return {
              id: raw.id,
              code: raw.code,
              description: typeof raw.description === "string" ? raw.description : null,
            } satisfies CostCodeOption;
          })
          .filter((row): row is CostCodeOption => Boolean(row));
        setCostCodes(mapped);
      } catch {
        if (!active) return;
        setCostCodeLoadError("Unable to load cost codes.");
        setCostCodes([]);
      } finally {
        if (active) setLoadingCostCodes(false);
      }
    }
    loadCostCodes();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadSubOptions() {
      setLoadingSubOptions(true);
      try {
        const response = await fetch("/api/directory/overview", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | { companies?: Array<{ id?: string; name?: string; email?: string | null }>; error?: string }
          | null;
        if (!active) return;
        if (!response.ok) {
          setSubOptions([]);
          setLoadingSubOptions(false);
          return;
        }
        const mapped = Array.isArray(payload?.companies)
          ? payload.companies
              .map((company) => {
                if (!company?.id || !company?.name) return null;
                return { id: company.id, company: company.name, email: company.email ?? null };
              })
              .filter((item): item is SubOption => Boolean(item))
          : [];
        setSubOptions(mapped);
      } catch {
        if (!active) return;
        setSubOptions([]);
      } finally {
        if (active) setLoadingSubOptions(false);
      }
    }
    loadSubOptions();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!editingProjectId) return;
    let active = true;
    async function loadExistingProject() {
      setLoadingExistingProject(true);
      const detail = await getBidProjectDetail(editingProjectId);
      if (!active) return;
      if (!detail) {
        setError("Unable to load bid package for editing.");
        setLoadingExistingProject(false);
        return;
      }
      setDraft((prev) => ({
        ...prev,
        project_name: detail.project.project_name ?? "",
        status:
          detail.project.status === "open"
            ? "bidding"
            : detail.project.status === "closed"
              ? "submitted"
              : (detail.project.status ?? "bidding"),
        architect: "",
        bid_set_date: "",
        owner: detail.project.owner ?? "",
        location: detail.project.location ?? "",
        budget:
          detail.project.budget !== null && detail.project.budget !== undefined
            ? String(detail.project.budget)
            : "",
        due_date: detail.project.due_date ?? "",
        tbd_due_date: !detail.project.due_date,
      }));
      setSelectedTrades(
        detail.trades.map((trade) => ({
          id: trade.id,
          code: trade.trade_name ?? "",
          description: null,
        }))
      );
      setLoadingExistingProject(false);
    }
    loadExistingProject();
    return () => {
      active = false;
    };
  }, [editingProjectId]);

  const filteredCostCodes = useMemo(() => {
    const assigned = new Set(selectedTrades.map((trade) => trade.id));
    const query = costCodeQuery.trim().toLowerCase();
    return costCodes.filter((code) => {
      if (assigned.has(code.id)) return false;
      if (!query) return true;
      return `${code.code} ${code.description ?? ""}`.toLowerCase().includes(query);
    });
  }, [costCodeQuery, costCodes, selectedTrades]);

  const addTradeFromCostCode = (costCode: CostCodeOption) => {
    setSelectedTrades((prev) => {
      if (prev.some((trade) => trade.id === costCode.id)) return prev;
      return [...prev, { id: costCode.id, code: costCode.code, description: costCode.description }];
    });
  };

  const removeTrade = (tradeId: string) => {
    setSelectedTrades((prev) => prev.filter((trade) => trade.id !== tradeId));
    setExpandedTradeId((prev) => (prev === tradeId ? null : prev));
    setManageQueryByTradeId((prev) => {
      const next = { ...prev };
      delete next[tradeId];
      return next;
    });
    setManageSearchActiveByTradeId((prev) => {
      const next = { ...prev };
      delete next[tradeId];
      return next;
    });
    setAssignedSubsByTradeId((prev) => {
      const next = { ...prev };
      delete next[tradeId];
      return next;
    });
  };

  const addSubToTrade = (tradeId: string, sub: SubOption) => {
    setAssignedSubsByTradeId((prev) => {
      const current = prev[tradeId] ?? [];
      if (current.some((item) => item.id === sub.id)) return prev;
      return {
        ...prev,
        [tradeId]: [...current, { ...sub, invited: false, willBid: false, bidInviteEmail: sub.email ?? "" }],
      };
    });
  };

  const removeSubFromTrade = (tradeId: string, subId: string) => {
    setAssignedSubsByTradeId((prev) => ({
      ...prev,
      [tradeId]: (prev[tradeId] ?? []).filter((item) => item.id !== subId),
    }));
  };

  const setSubInviteEmail = (tradeId: string, subId: string, value: string) => {
    setAssignedSubsByTradeId((prev) => ({
      ...prev,
      [tradeId]: (prev[tradeId] ?? []).map((item) =>
        item.id === subId
          ? {
              ...item,
              bidInviteEmail: value,
            }
          : item
      ),
    }));
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(INVITATION_EMAIL_DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<InvitationEmailDraft>;
        setInvitationEmailDraft({
          subject: typeof parsed.subject === "string" ? parsed.subject : DEFAULT_INVITATION_SUBJECT,
          message: typeof parsed.message === "string" ? parsed.message : DEFAULT_INVITATION_MESSAGE,
          requireAcknowledgement: Boolean(parsed.requireAcknowledgement),
        });
      }
    } catch {
      setInvitationEmailDraft({
        subject: DEFAULT_INVITATION_SUBJECT,
        message: DEFAULT_INVITATION_MESSAGE,
        requireAcknowledgement: false,
      });
    } finally {
      setInvitationDraftHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!invitationDraftHydrated) return;
    setInvitationSaving(true);
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(INVITATION_EMAIL_DRAFT_STORAGE_KEY, JSON.stringify(invitationEmailDraft));
        const now = new Date().toISOString();
        setInvitationSavedAt(now);
      } finally {
        setInvitationSaving(false);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [invitationDraftHydrated, invitationEmailDraft]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const includedAttachments = useMemo(
    () => ({
      drawings: uploadedFiles.filter((file) => file.section === "drawings").length,
      documents: uploadedFiles.filter((file) => file.section === "documents").length,
      specifications: uploadedFiles.filter((file) => file.section === "specifications").length,
    }),
    [uploadedFiles]
  );

  const selectedSubsCount = useMemo(
    () =>
      Object.values(assignedSubsByTradeId).reduce((sum, subs) => {
        return sum + subs.length;
      }, 0),
    [assignedSubsByTradeId]
  );

  const tokenValues = useMemo(() => {
    const dueLabel = draft.due_date
      ? `${new Date(draft.due_date).toLocaleDateString()} ${draft.due_hour}:${draft.due_minute} ${draft.due_period.toUpperCase()}`
      : "TBD";
    const prebidParts: string[] = [];
    if (draft.rfi_deadline_enabled && draft.rfi_deadline_date) prebidParts.push(`RFI Deadline: ${draft.rfi_deadline_date}`);
    if (draft.site_walkthrough_enabled && draft.site_walkthrough_date) prebidParts.push(`Site Walkthrough: ${draft.site_walkthrough_date}`);
    const portalLink = typeof window !== "undefined" ? `${window.location.origin}/bidding/all` : "/bidding/all";
    return {
      "{project_name}": draft.project_name.trim() || "Project Name",
      "{bid_package_name}": draft.project_name.trim() || "Bid Package Name",
      "{bid_due_date}": dueLabel,
      "{prebid_info}": prebidParts.length ? prebidParts.join(" | ") : "No pre-bid details available.",
      "{portal_link}": portalLink,
      "{contact_name}": draft.primary_bidding_contact || "Primary bidding contact",
      "{contact_email}": "test@builderos.com",
    } as Record<(typeof TOKEN_LIST)[number], string>;
  }, [
    draft.due_date,
    draft.due_hour,
    draft.due_minute,
    draft.due_period,
    draft.primary_bidding_contact,
    draft.project_name,
    draft.rfi_deadline_date,
    draft.rfi_deadline_enabled,
    draft.site_walkthrough_date,
    draft.site_walkthrough_enabled,
  ]);

  const renderTokens = (input: string) =>
    TOKEN_LIST.reduce((text, token) => text.split(token).join(tokenValues[token]), input);

  const renderedSubject = renderTokens(invitationEmailDraft.subject);
  const renderedMessage = renderTokens(invitationEmailDraft.message);

  const insertTokenAtCursor = (token: (typeof TOKEN_LIST)[number]) => {
    const target = focusedInvitationField === "subject" ? subjectInputRef.current : messageTextareaRef.current;
    if (!target) return;
    const selectionStart = target.selectionStart ?? target.value.length;
    const selectionEnd = target.selectionEnd ?? selectionStart;
    const nextValue = `${target.value.slice(0, selectionStart)}${token}${target.value.slice(selectionEnd)}`;
    const nextCursor = selectionStart + token.length;

    if (focusedInvitationField === "subject") {
      setInvitationEmailDraft((prev) => ({ ...prev, subject: nextValue }));
      window.requestAnimationFrame(() => {
        subjectInputRef.current?.focus();
        subjectInputRef.current?.setSelectionRange(nextCursor, nextCursor);
      });
      return;
    }

    setInvitationEmailDraft((prev) => ({ ...prev, message: nextValue }));
    window.requestAnimationFrame(() => {
      messageTextareaRef.current?.focus();
      messageTextareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const saveInvitationDraftNow = () => {
    try {
      localStorage.setItem(INVITATION_EMAIL_DRAFT_STORAGE_KEY, JSON.stringify(invitationEmailDraft));
      const now = new Date().toISOString();
      setInvitationSavedAt(now);
      setToast({ type: "success", message: "Draft saved." });
    } catch {
      setToast({ type: "error", message: "Unable to save draft." });
    }
  };
  const activeDrawerTrade = newSubDrawerTradeId
    ? selectedTrades.find((trade) => trade.id === newSubDrawerTradeId) ?? null
    : null;
  const persistAssignedSubsForTrades = async (projectId: string): Promise<boolean> => {
    const allAssignedSubs = Object.values(assignedSubsByTradeId).flat();
    if (!allAssignedSubs.length) return true;

    const detail = await getBidProjectDetail(projectId);
    if (!detail) return false;

    const tradeIdByName = new Map(
      detail.trades.map((trade) => [trade.trade_name.trim().toLowerCase(), trade.id])
    );
    const existingBidPairs = new Set(
      detail.tradeBids.map((bid) => `${bid.trade_id}:${bid.project_sub_id}`)
    );

    const projectSubIdByBidSubId = new Map(
      detail.projectSubs.map((projectSub) => [projectSub.subcontractor_id, projectSub.id])
    );

    const bidSubcontractors = await listBidSubcontractors();
    const bidSubByCompany = new Map(
      bidSubcontractors.map((sub) => [sub.company_name.trim().toLowerCase(), sub])
    );
    let nextProjectSubSort =
      detail.projectSubs.reduce((max, sub) => Math.max(max, sub.sort_order ?? 0), 0) + 1;

    const projectSubIdByAssignedSubId = new Map<string, string>();
    const uniqueAssignedSubs = new Map<string, AssignedSub>();
    allAssignedSubs.forEach((sub) => {
      uniqueAssignedSubs.set(sub.id, sub);
    });

    for (const sub of uniqueAssignedSubs.values()) {
      const companyKey = sub.company.trim().toLowerCase();
      let bidSubId = bidSubByCompany.get(companyKey)?.id ?? null;
      if (!bidSubId) {
        const createdBidSub = await createBidSubcontractor({
          company_name: sub.company,
          email: sub.email ?? null,
        });
        if (!createdBidSub) return false;
        bidSubId = createdBidSub.id;
        bidSubByCompany.set(companyKey, {
          ...createdBidSub,
          email: sub.email ?? null,
          phone: null,
        });
      }

      let projectSubId = projectSubIdByBidSubId.get(bidSubId) ?? null;
      if (!projectSubId) {
        const invited = await inviteSubToProject({
          project_id: projectId,
          subcontractor_id: bidSubId,
          sort_order: nextProjectSubSort,
        });
        if (!invited) return false;
        projectSubId = invited.id;
        projectSubIdByBidSubId.set(bidSubId, projectSubId);
        nextProjectSubSort += 1;
      }

      projectSubIdByAssignedSubId.set(sub.id, projectSubId);
    }

    for (const trade of selectedTrades) {
      const tradeName = buildTradeLabel(trade).toLowerCase();
      const tradeId = tradeIdByName.get(tradeName);
      if (!tradeId) continue;

      const assignedForTrade = assignedSubsByTradeId[trade.id] ?? [];
      for (const sub of assignedForTrade) {
        const projectSubId = projectSubIdByAssignedSubId.get(sub.id);
        if (!projectSubId) continue;
        const pairKey = `${tradeId}:${projectSubId}`;
        if (existingBidPairs.has(pairKey)) continue;
        const createdBid = await createTradeBid({
          project_id: projectId,
          trade_id: tradeId,
          project_sub_id: projectSubId,
          status: sub.willBid ? "bidding" : "invited",
          contact_name: null,
          bid_amount: null,
          notes: null,
        });
        if (!createdBid) return false;
        existingBidPairs.add(pairKey);
      }
    }

    return true;
  };

  return (
    <main className="bg-slate-50 pl-4 pr-0 pb-8 sm:pl-6 sm:pr-0">
      <header className="-mx-4 border-b border-slate-200 bg-white sm:-mx-6">
        <div className="px-6 py-3">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            <Link href="/bidding/all" className="font-medium text-slate-700 hover:underline">
              Bid Packages
            </Link>
            <span aria-hidden>/</span>
            <span className="text-slate-500">{isEditMode ? "Edit Bid Package" : "New Bid Package"}</span>
          </div>
          <h1 className="text-[30px] font-semibold text-slate-900">
            {isEditMode ? "Edit Bid Package" : "Add Bid Package"}
          </h1>
        </div>
      </header>

      {loadingExistingProject ? (
        <div className="mx-4 mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 sm:mx-6">
          Loading bid package details...
        </div>
      ) : null}

      <form
        className=""
        onSubmit={async (event) => {
          event.preventDefault();
          if (loadingExistingProject) return;
          if (!draft.project_name.trim()) {
            setError("Project name is required.");
            return;
          }

          setSubmitting(true);
          setError(null);

          const budgetValue = draft.budget.trim() ? Number(draft.budget) : null;
          const tradePayload = selectedTrades.map((trade, index) => ({
            trade_name: buildTradeLabel(trade),
            sort_order: index + 1,
          }));

          if (editingProjectId) {
            const updated = await updateBidProject(editingProjectId, {
              project_name: draft.project_name.trim(),
              owner: draft.owner.trim() || null,
              location: draft.location.trim() || null,
              budget: Number.isFinite(budgetValue) ? budgetValue : null,
              due_date: draft.tbd_due_date ? null : draft.due_date.trim() || null,
            });
            if (!updated) {
              setError("Unable to save bid package changes. Please try again.");
              setSubmitting(false);
              return;
            }

            const currentDetail = await getBidProjectDetail(editingProjectId);
            const currentTrades = currentDetail?.trades ?? [];
            const byTradeName = new Map(
              currentTrades.map((trade) => [trade.trade_name.trim().toLowerCase(), trade])
            );
            const existingTradePayload = tradePayload
              .map((trade) => {
                const existing = byTradeName.get(trade.trade_name.trim().toLowerCase());
                if (!existing) return null;
                return {
                  id: existing.id,
                  trade_name: trade.trade_name,
                  sort_order: trade.sort_order,
                };
              })
              .filter((trade): trade is { id: string; trade_name: string; sort_order: number } => Boolean(trade));
            const newTradePayload = tradePayload.filter(
              (trade) => !byTradeName.has(trade.trade_name.trim().toLowerCase())
            );

            const updatedTrades = await updateBidTrades(editingProjectId, existingTradePayload);
            const createdTrades = await createBidTrades(editingProjectId, newTradePayload);
            if (!updatedTrades || !createdTrades) {
              setError("Project details were saved, but trades could not be fully updated.");
              setSubmitting(false);
              return;
            }

            const syncedAssignedSubs = await persistAssignedSubsForTrades(editingProjectId);
            if (!syncedAssignedSubs) {
              setError("Project details were saved, but assigned subs could not be synced to trade rows.");
              setSubmitting(false);
              return;
            }

            router.push(`/bidding?project=${editingProjectId}`);
            router.refresh();
            return;
          }

          const created = await createBidProject({
            project_name: draft.project_name.trim(),
            owner: draft.owner.trim() || null,
            location: draft.location.trim() || null,
            budget: Number.isFinite(budgetValue) ? budgetValue : null,
            due_date: draft.tbd_due_date ? null : draft.due_date.trim() || null,
          });

          if (!created) {
            setError("Unable to create bid package. Please try again.");
            setSubmitting(false);
            return;
          }

          const tradesCreated = await createBidTrades(created.id, tradePayload);
          if (!tradesCreated) {
            setError("Bid package was created, but selected trades could not be saved. Please add trades from Invites.");
            setSubmitting(false);
            return;
          }

          const syncedAssignedSubs = await persistAssignedSubsForTrades(created.id);
          if (!syncedAssignedSubs) {
            setError("Bid package was created, but assigned subs could not be synced to trade rows.");
            setSubmitting(false);
            return;
          }

          setDraft(createDefaultDraft());
          router.push(`/bidding?project=${created.id}`);
          router.refresh();
        }}
      >
        <div className="grid items-start gap-0 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4 pr-4 pb-24 pt-12 lg:px-12">
        {activePanel === "general" ? (
          <>
        <section id="general-information" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-[18px] font-semibold text-slate-900">General Information</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-6">
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
              <span className="inline-flex items-center gap-1">
                Project Name <span className="text-rose-600">*</span>
              </span>
              <input
                value={draft.project_name}
                onChange={(event) => setDraft((prev) => ({ ...prev, project_name: event.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                placeholder="VBC CO #4"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
              Project Number
              <input
                value={draft.package_number}
                onChange={(event) => setDraft((prev) => ({ ...prev, package_number: event.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                placeholder="8"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
              Status
              <div className="relative">
                <select
                  value={draft.status}
                  onChange={(event) => setDraft((prev) => ({ ...prev, status: event.target.value }))}
                  className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="bidding">Bidding</option>
                  <option value="submitted">Submitted</option>
                  <option value="awarded">Awarded</option>
                  <option value="lost">Lost</option>
                </select>
                <svg
                  viewBox="0 0 20 20"
                  className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M5 7l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700 sm:col-span-3">
              Client Name
              <input
                value={draft.owner}
                onChange={(event) => setDraft((prev) => ({ ...prev, owner: event.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                placeholder="Client name"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700 sm:col-span-3">
              Project Address
              <input
                value={draft.location}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, location: event.target.value }))
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                placeholder="Project address"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700 sm:col-span-3">
              Architect
              <input
                value={draft.architect}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, architect: event.target.value }))
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                placeholder="Architect"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700 sm:col-span-3">
              Bid Set Date
              <input
                type="date"
                value={draft.bid_set_date}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, bid_set_date: event.target.value }))
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <div className="sm:col-span-6">
              <div className="mb-2 text-sm font-semibold text-slate-700">
                Bid Due Date <span className="text-rose-600">*</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={draft.due_date}
                  onChange={(event) => setDraft((prev) => ({ ...prev, due_date: event.target.value }))}
                  disabled={draft.tbd_due_date}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
                <select
                  value={draft.due_hour}
                  onChange={(event) => setDraft((prev) => ({ ...prev, due_hour: event.target.value }))}
                  disabled={draft.tbd_due_date}
                  className="rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((hour) => (
                    <option key={hour} value={hour}>
                      {hour}
                    </option>
                  ))}
                </select>
                <select
                  value={draft.due_minute}
                  onChange={(event) => setDraft((prev) => ({ ...prev, due_minute: event.target.value }))}
                  disabled={draft.tbd_due_date}
                  className="rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {["00", "15", "30", "45"].map((minute) => (
                    <option key={minute} value={minute}>
                      {minute}
                    </option>
                  ))}
                </select>
                <select
                  value={draft.due_period}
                  onChange={(event) => setDraft((prev) => ({ ...prev, due_period: event.target.value }))}
                  disabled={draft.tbd_due_date}
                  className="rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="am">am</option>
                  <option value="pm">pm</option>
                </select>
                <span className="text-sm text-slate-600">America/Adak</span>
              </div>
              <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.tbd_due_date}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      tbd_due_date: event.target.checked,
                      due_date: event.target.checked ? "" : prev.due_date,
                    }))
                  }
                  className="size-4 rounded border-slate-300"
                />
                To be determined
              </label>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-[18px] font-semibold text-slate-900">Package Contacts</h3>
          <div className="mt-5 space-y-5">
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
              <span className="inline-flex items-center gap-2">
                Primary Bidding Contact <span className="text-rose-600">*</span>
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">i</span>
              </span>
              <div className="relative">
                <select
                  value={draft.primary_bidding_contact}
                  onChange={(event) => setDraft((prev) => ({ ...prev, primary_bidding_contact: event.target.value }))}
                  className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="Project Manager">Project Manager</option>
                  <option value="Estimator">Estimator</option>
                  <option value="Precon Manager">Precon Manager</option>
                </select>
                <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M5 7l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-sm font-normal text-slate-600">Emails will be sent from: test@builderos.com</span>
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
              <span className="inline-flex items-center gap-2">
                Bidding CC Group
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">i</span>
              </span>
              <div className="relative">
                <select
                  value={draft.bidding_cc_group}
                  onChange={(event) => setDraft((prev) => ({ ...prev, bidding_cc_group: event.target.value }))}
                  className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Choose a distribution group</option>
                  <option value="estimating-team">Estimating Team</option>
                  <option value="operations-leadership">Operations Leadership</option>
                  <option value="executive-updates">Executive Updates</option>
                </select>
                <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M5 7l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-[18px] font-semibold text-slate-900">Bidding Instructions</h3>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <button type="button" className="rounded px-2 py-1 font-semibold hover:bg-slate-200">B</button>
              <button type="button" className="rounded px-2 py-1 italic hover:bg-slate-200">I</button>
              <button type="button" className="rounded px-2 py-1 underline hover:bg-slate-200">U</button>
              <span className="mx-1 h-5 w-px bg-slate-300" />
              <button type="button" className="rounded px-2 py-1 hover:bg-slate-200">• List</button>
              <button type="button" className="rounded px-2 py-1 hover:bg-slate-200">1. List</button>
              <span className="mx-1 h-5 w-px bg-slate-300" />
              <button type="button" className="rounded px-2 py-1 hover:bg-slate-200">12pt</button>
              <button type="button" className="rounded px-2 py-1 hover:bg-slate-200">A</button>
            </div>
            <textarea
              value={draft.bidding_instructions}
              onChange={(event) => setDraft((prev) => ({ ...prev, bidding_instructions: event.target.value }))}
              className="min-h-56 w-full resize-y border-0 px-4 py-4 text-base leading-8 text-slate-800 focus:outline-none"
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-[18px] font-semibold text-slate-900">Pre-Bid Information</h3>
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={draft.rfi_deadline_enabled}
                onClick={() => setDraft((prev) => ({ ...prev, rfi_deadline_enabled: !prev.rfi_deadline_enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                  draft.rfi_deadline_enabled ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-slate-200"
                }`}
              >
                <span className={`inline-block size-5 transform rounded-full bg-white transition ${draft.rfi_deadline_enabled ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
              <span className="text-sm font-medium text-slate-800">RFI Deadline</span>
              {draft.rfi_deadline_enabled ? (
                <div className="ml-4 flex flex-wrap items-center gap-2">
                  <input type="date" value={draft.rfi_deadline_date} onChange={(event) => setDraft((prev) => ({ ...prev, rfi_deadline_date: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none" />
                  <select value={draft.rfi_deadline_hour} onChange={(event) => setDraft((prev) => ({ ...prev, rfi_deadline_hour: event.target.value }))} className="rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700">
                    {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((hour) => (
                      <option key={`rfi-hour-${hour}`} value={hour}>{hour}</option>
                    ))}
                  </select>
                  <select value={draft.rfi_deadline_minute} onChange={(event) => setDraft((prev) => ({ ...prev, rfi_deadline_minute: event.target.value }))} className="rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700">
                    {["00", "15", "30", "45"].map((minute) => (
                      <option key={`rfi-minute-${minute}`} value={minute}>{minute}</option>
                    ))}
                  </select>
                  <select value={draft.rfi_deadline_period} onChange={(event) => setDraft((prev) => ({ ...prev, rfi_deadline_period: event.target.value }))} className="rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700">
                    <option value="am">am</option>
                    <option value="pm">pm</option>
                  </select>
                  <span className="text-sm text-slate-600">America/Adak</span>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={draft.site_walkthrough_enabled}
                onClick={() => setDraft((prev) => ({ ...prev, site_walkthrough_enabled: !prev.site_walkthrough_enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                  draft.site_walkthrough_enabled ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-slate-200"
                }`}
              >
                <span className={`inline-block size-5 transform rounded-full bg-white transition ${draft.site_walkthrough_enabled ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
              <span className="text-sm font-medium text-slate-800">Site Walkthrough</span>
              {draft.site_walkthrough_enabled ? (
                <div className="ml-4 flex flex-wrap items-center gap-2">
                  <input type="date" value={draft.site_walkthrough_date} onChange={(event) => setDraft((prev) => ({ ...prev, site_walkthrough_date: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none" />
                  <select value={draft.site_walkthrough_hour} onChange={(event) => setDraft((prev) => ({ ...prev, site_walkthrough_hour: event.target.value }))} className="rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700">
                    {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((hour) => (
                      <option key={`walk-hour-${hour}`} value={hour}>{hour}</option>
                    ))}
                  </select>
                  <select value={draft.site_walkthrough_minute} onChange={(event) => setDraft((prev) => ({ ...prev, site_walkthrough_minute: event.target.value }))} className="rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700">
                    {["00", "15", "30", "45"].map((minute) => (
                      <option key={`walk-minute-${minute}`} value={minute}>{minute}</option>
                    ))}
                  </select>
                  <select value={draft.site_walkthrough_period} onChange={(event) => setDraft((prev) => ({ ...prev, site_walkthrough_period: event.target.value }))} className="rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700">
                    <option value="am">am</option>
                    <option value="pm">pm</option>
                  </select>
                  <span className="text-sm text-slate-600">America/Adak</span>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-[18px] font-semibold text-slate-900">Advanced Settings</h3>
          <div className="mt-4">
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
              Anticipated Award Date
              <input
                type="date"
                value={draft.anticipated_award_date}
                onChange={(event) => setDraft((prev) => ({ ...prev, anticipated_award_date: event.target.value }))}
                className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
          </div>

          <div className="mt-6 space-y-4">
            {[
              ["countdown_emails", "Countdown Email(s)"],
              ["accept_submissions_past_due", "Accept Submissions past Due Date"],
              ["enable_blind_bidding", "Enable Blind Bidding"],
              ["disable_electronic_submission", "Disable Electronic Submission of Bids"],
              ["include_bid_documents", "Include Bid Documents"],
            ].map(([key, label]) => {
              const typedKey = key as keyof BidPackageDraft;
              const enabled = Boolean(draft[typedKey]);
              return (
                <div key={key} className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        [typedKey]: !Boolean(prev[typedKey]),
                      }))
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                      enabled ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-slate-200"
                    }`}
                  >
                    <span className={`inline-block size-5 transform rounded-full bg-white transition ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                  <span className="text-sm font-medium text-slate-800">{label}</span>
                </div>
              );
            })}
          </div>

          <label className="mt-6 flex flex-col gap-2 text-sm font-semibold text-slate-700">
            Bid Submission Confirmation Message
            <textarea
              value={draft.bid_submission_confirmation_message}
              onChange={(event) => setDraft((prev) => ({ ...prev, bid_submission_confirmation_message: event.target.value }))}
              className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
              placeholder="Bid Submission Confirmation Message"
            />
          </label>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-[18px] font-semibold text-slate-900">Project Details</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Owner / Client
              <input
                value={draft.owner}
                onChange={(event) => setDraft((prev) => ({ ...prev, owner: event.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                placeholder="Owner name"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Location
              <input
                value={draft.location}
                onChange={(event) => setDraft((prev) => ({ ...prev, location: event.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                placeholder="City, State"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Budget
              <input
                value={draft.budget}
                onChange={(event) => setDraft((prev) => ({ ...prev, budget: event.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                placeholder="1000000"
                inputMode="decimal"
              />
            </label>
          </div>
        </section>

        {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-slate-50/85 sm:px-6 lg:px-12">
          <Link
            href="/bidding/all"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => setActivePanel("files")}
            className="rounded-md bg-orange-500 px-8 py-2 text-base font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue to Files
          </button>
        </div>
          </>
        ) : activePanel === "files" ? (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-[18px] font-semibold text-slate-900">Drawings</h3>
              <div className="mt-6 grid gap-6 md:grid-cols-[340px_minmax(0,1fr)]">
                <div>
                  <div className="space-y-1 border border-slate-200 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => setActiveFileSection("drawings")}
                      className={`flex w-full items-center px-4 py-3 text-left text-base ${
                        activeFileSection === "drawings"
                          ? "border-l-4 border-l-orange-400 bg-slate-100 font-semibold text-slate-800"
                          : "font-medium text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      Drawings
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFileSection("documents")}
                      className={`flex w-full items-center px-4 py-3 text-left text-base ${
                        activeFileSection === "documents"
                          ? "border-l-4 border-l-orange-400 bg-slate-100 font-semibold text-slate-800"
                          : "font-medium text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      Documents
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFileSection("specifications")}
                      className={`flex w-full items-center px-4 py-3 text-left text-base ${
                        activeFileSection === "specifications"
                          ? "border-l-4 border-l-orange-400 bg-slate-100 font-semibold text-slate-800"
                          : "font-medium text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      Specifications
                    </button>
                  </div>
                </div>
                <div className="min-h-[540px]">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="max-w-[220px]">
                      <select className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-700">
                        <option>Current</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                          handleUploadFiles(event.target.files);
                          event.currentTarget.value = "";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Upload files
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[18px] font-semibold text-slate-800">
                      {activeFileSection === "drawings"
                        ? "Drawings"
                        : activeFileSection === "documents"
                          ? "Documents"
                          : "Specifications"}
                    </div>
                    <div className="flex items-center gap-4 text-xl text-slate-400">
                      <span>☰</span>
                      <span>▦</span>
                    </div>
                  </div>
                  {fileError ? <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{fileError}</p> : null}
                  {filesInActiveSection.length ? (
                    <ul className="mt-4 space-y-3">
                      {filesInActiveSection.map((file) => (
                        <li key={file.id} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-semibold text-blue-700 hover:underline"
                          >
                            {file.name}
                          </a>
                          <div className="mt-1 text-xs text-slate-500">
                            {formatFileSize(file.size)} · Uploaded {new Date(file.uploadedAt).toLocaleString()}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                      No files uploaded in this section yet.
                    </div>
                  )}
                </div>
              </div>
            </section>

            {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

            <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-slate-50/85 sm:px-6 lg:px-12">
              <button
                type="button"
                onClick={() => setActivePanel("general")}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <Link
                href="/bidding/all"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-orange-500 px-8 py-2 text-base font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Creating..." : "Continue to Trades"}
              </button>
            </div>
          </>
        ) : activePanel === "trade-coverage" ? (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-[18px] font-semibold text-slate-900">Trade Coverage</h3>
              <p className="mt-2 text-sm text-slate-600">
                Configure trade-level bid coverage for this package.
              </p>

              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-800">Add Trades By Cost Code</div>
                <input
                  value={costCodeQuery}
                  onChange={(event) => setCostCodeQuery(event.target.value)}
                  placeholder="Search cost codes"
                  className="mt-3 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                />
                <div className="mt-3 max-h-52 overflow-auto rounded-md border border-slate-200 bg-white">
                  {loadingCostCodes ? (
                    <div className="px-3 py-3 text-sm text-slate-500">Loading cost codes...</div>
                  ) : filteredCostCodes.length ? (
                    filteredCostCodes.map((code) => (
                      <div key={code.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-800">{code.code}</div>
                          <div className="truncate text-xs text-slate-500">{code.description ?? "No description"}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => addTradeFromCostCode(code)}
                          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Add
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-sm text-slate-500">{costCodeLoadError ?? "No cost codes found."}</div>
                  )}
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
                <div className="grid grid-cols-[minmax(0,1fr)_120px_120px_132px] bg-slate-50 text-sm font-semibold text-slate-700">
                  <div className="border-r border-slate-200 px-4 py-3">Trade</div>
                  <div className="border-r border-slate-200 px-4 py-3 text-center">Invited</div>
                  <div className="border-r border-slate-200 px-4 py-3 text-center">Will Bid</div>
                  <div className="px-4 py-3 text-center">Actions</div>
                </div>
                <div className="divide-y divide-slate-200">
                  {selectedTrades.length ? (
                    selectedTrades.map((trade) => (
                      <div key={trade.id}>
                        <div className="grid grid-cols-[minmax(0,1fr)_120px_120px_132px] text-sm text-slate-700">
                          <div className="border-r border-slate-200 px-4 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate font-medium text-slate-800">{trade.code}</div>
                                <div className="truncate text-xs text-slate-500">{trade.description ?? "No description"}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeTrade(trade.id)}
                                className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                          <div className="border-r border-slate-200 px-4 py-3 text-center">0</div>
                          <div className="border-r border-slate-200 px-4 py-3 text-center">0</div>
                          <div className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => setExpandedTradeId((prev) => (prev === trade.id ? null : trade.id))}
                              className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Manage
                              <span className={`transition-transform ${expandedTradeId === trade.id ? "rotate-180" : ""}`}>▾</span>
                            </button>
                          </div>
                        </div>
                        {(assignedSubsByTradeId[trade.id] ?? []).map((sub) => (
                          <div key={`${trade.id}-sub-row-${sub.id}`}>
                            <div className="grid grid-cols-[minmax(0,1fr)_120px_120px_132px] border-t border-slate-200 bg-slate-50/40 text-sm text-slate-700">
                              <div className="border-r border-slate-200 px-4 py-2">
                                <span className="mr-2 text-slate-400">↳</span>
                                {sub.company}
                              </div>
                              <div className="border-r border-slate-200 px-4 py-2 text-center">
                                {sub.invited ? "Yes" : "No"}
                              </div>
                              <div className="border-r border-slate-200 px-4 py-2 text-center">
                                {sub.willBid ? "Yes" : "No"}
                              </div>
                              <div className="px-2 py-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeSubFromTrade(trade.id, sub.id)}
                                  className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                  aria-label={`Remove ${sub.company}`}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-[minmax(0,1fr)_120px_120px_132px] border-t border-slate-200 bg-white">
                              <div className="col-span-4 px-4 py-2">
                                <label className="flex items-center gap-3 text-sm text-slate-700">
                                  <span className="font-medium text-slate-600">Bid Invite Email</span>
                                  <input
                                    type="email"
                                    value={sub.bidInviteEmail}
                                    onChange={(event) => setSubInviteEmail(trade.id, sub.id, event.target.value)}
                                    placeholder="name@company.com"
                                    className="w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        ))}
                        {expandedTradeId === trade.id ? (
                          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Add Subcontractors
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <input
                                value={manageQueryByTradeId[trade.id] ?? ""}
                                onChange={(event) =>
                                  setManageQueryByTradeId((prev) => ({ ...prev, [trade.id]: event.target.value }))
                                }
                                onFocus={() =>
                                  setManageSearchActiveByTradeId((prev) => ({ ...prev, [trade.id]: true }))
                                }
                                placeholder="Search subcontractors"
                                className="w-full max-w-md flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setNewSubDrawerTradeId(trade.id);
                                  setNewSubDraft({
                                    company_name: "",
                                    primary_contact: "",
                                    email: "",
                                    phone: "",
                                  });
                                  setNewSubError(null);
                                }}
                                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                + New Contractor
                              </button>
                            </div>
                            <div className="mt-2 max-h-40 overflow-auto rounded-md border border-slate-200 bg-white">
                              {manageSearchActiveByTradeId[trade.id]
                                ? subOptions.filter((option) => {
                                    const query = (manageQueryByTradeId[trade.id] ?? "").trim().toLowerCase();
                                    const assignedIds = new Set((assignedSubsByTradeId[trade.id] ?? []).map((item) => item.id));
                                    if (assignedIds.has(option.id)) return false;
                                    if (!query) return true;
                                    return option.company.toLowerCase().includes(query);
                                  }).map((option) => (
                                    <div
                                      key={`${trade.id}-${option.id}`}
                                      className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0"
                                    >
                                      <div className="text-sm text-slate-700">{option.company}</div>
                                      <button
                                        type="button"
                                        onClick={() => addSubToTrade(trade.id, option)}
                                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                      >
                                        Add
                                      </button>
                                    </div>
                                  ))
                                : (
                                  <div className="px-3 py-3 text-sm text-slate-500">
                                    Click the search bar to view and add subcontractors.
                                  </div>
                                )}
                              {manageSearchActiveByTradeId[trade.id] && loadingSubOptions ? (
                                <div className="border-t border-slate-100 px-3 py-2 text-sm text-slate-500">Loading subcontractors...</div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-4 text-sm text-slate-500">Select one or more trades above to build coverage rows.</div>
                  )}
                </div>
              </div>
            </section>

            {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

            <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-slate-50/85 sm:px-6 lg:px-12">
              <button
                type="button"
                onClick={() => setActivePanel("files")}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <Link
                href="/bidding/all"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={() => {
                  setActivePanel("invite-subs");
                  setExpandedInviteTradeId(selectedTrades[0]?.id ?? null);
                }}
                className="rounded-md bg-orange-500 px-8 py-2 text-base font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Invite Subcontractors
              </button>
            </div>
          </>
        ) : activePanel === "invite-subs" ? (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-0">
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 className="text-[18px] font-semibold text-slate-900">Invite Subs</h3>
                <p className="mt-1 text-sm text-slate-600">Invite subcontractors by trade and track response status.</p>
              </div>

              <div className="p-4">
                {selectedTrades.length ? (
                  <div className="space-y-4">
                    {selectedTrades.map((trade) => {
                      const assigned = assignedSubsByTradeId[trade.id] ?? [];
                      const expanded = expandedInviteTradeId === trade.id;
                      const dueLabel = draft.due_date
                        ? `${new Date(draft.due_date).toLocaleDateString()} ${draft.due_hour}:${draft.due_minute} ${draft.due_period.toUpperCase()}`
                        : "No due date";
                      const recommended = subOptions.filter((option) => {
                        const assignedIds = new Set(assigned.map((item) => item.id));
                        if (assignedIds.has(option.id)) return false;
                        const query = (inviteQueryByTradeId[trade.id] ?? "").trim().toLowerCase();
                        if (!query) return true;
                        return option.company.toLowerCase().includes(query);
                      });
                      return (
                        <article key={`invite-${trade.id}`} className="overflow-hidden rounded-lg border border-slate-200">
                          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex size-7 items-center justify-center rounded-full bg-emerald-600 text-sm text-white">✓</span>
                              <div className="text-2xl font-semibold text-slate-900">
                                {trade.code}
                                {trade.description ? <span className="ml-2 text-lg font-medium text-slate-600">{trade.description}</span> : null}
                              </div>
                              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Selected</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-600">
                              <span>Due {dueLabel}</span>
                              <button
                                type="button"
                                onClick={() => setExpandedInviteTradeId((prev) => (prev === trade.id ? null : trade.id))}
                                className="inline-flex items-center rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                              >
                                {expanded ? "Hide" : "Manage"}
                              </button>
                            </div>
                          </div>

                          {expanded ? (
                            <>
                              <div className="border-t border-slate-200 px-4 py-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-2xl font-semibold text-slate-900">Invite subs to this trade</div>
                                  <button
                                    type="button"
                                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>

                              <div className="grid border-t border-slate-200 lg:grid-cols-2">
                                <div className="border-r border-slate-200 p-4">
                                  <input
                                    value={inviteQueryByTradeId[trade.id] ?? ""}
                                    onChange={(event) =>
                                      setInviteQueryByTradeId((prev) => ({ ...prev, [trade.id]: event.target.value }))
                                    }
                                    placeholder="Search all subs..."
                                    className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                                  />
                                  <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
                                    {recommended.length ? (
                                      recommended.slice(0, 8).map((sub) => (
                                        <div key={`${trade.id}-rec-${sub.id}`} className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0">
                                          <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold text-slate-800">{sub.company}</div>
                                            <div className="text-xs text-slate-500">{sub.email ?? "No email in directory"}</div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => addSubToTrade(trade.id, sub)}
                                            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                          >
                                            + Add
                                          </button>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="px-3 py-4 text-sm text-slate-500">No matching subcontractors.</div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNewSubDrawerTradeId(trade.id);
                                      setNewSubDraft({
                                        company_name: "",
                                        primary_contact: "",
                                        email: "",
                                        phone: "",
                                      });
                                      setNewSubError(null);
                                    }}
                                    className="mt-3 text-sm font-semibold text-blue-700 hover:underline"
                                  >
                                    + Add new subcontractor
                                  </button>
                                </div>

                                <div className="p-4">
                                  <div className="mb-3 flex items-center justify-between gap-2">
                                    <div className="text-3xl font-semibold text-slate-900">Invited subs</div>
                                    <div className="text-sm text-slate-600">
                                      Selected: <span className="font-semibold">{assigned.length}</span>
                                    </div>
                                  </div>
                                  <div className="overflow-hidden rounded-md border border-slate-200">
                                    <div className="grid grid-cols-[minmax(0,1fr)_130px_110px] bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                                      <div>Company</div>
                                      <div>Invite Status</div>
                                      <div>Status</div>
                                    </div>
                                    {assigned.length ? (
                                      assigned.map((sub) => (
                                        <div key={`${trade.id}-assigned-${sub.id}`} className="grid grid-cols-[minmax(0,1fr)_130px_110px] border-t border-slate-200 px-3 py-2">
                                          <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold text-slate-800">{sub.company}</div>
                                            <div className="text-xs text-slate-500">{sub.bidInviteEmail || "No invite email set"}</div>
                                          </div>
                                          <div className="text-sm text-slate-600">{sub.invited ? "Invited" : "Not Sent"}</div>
                                          <div>
                                            <span
                                              className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${
                                                sub.willBid
                                                  ? "bg-emerald-100 text-emerald-700"
                                                  : sub.invited
                                                    ? "bg-slate-100 text-slate-700"
                                                    : "bg-amber-100 text-amber-700"
                                              }`}
                                            >
                                              {sub.willBid ? "Bidding" : sub.invited ? "Viewed" : "Draft"}
                                            </span>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="border-t border-slate-200 px-3 py-4 text-sm text-slate-500">No subs added for this trade yet.</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                    No trades selected yet. Go to Trade Coverage and add trades first.
                  </div>
                )}
              </div>
            </section>

            {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

            <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-slate-50/85 sm:px-6 lg:px-12">
              <button
                type="button"
                onClick={() => setActivePanel("trade-coverage")}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <Link
                href="/bidding/all"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-orange-500 px-8 py-2 text-base font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Creating..." : "Review Email"}
              </button>
            </div>
          </>
        ) : (
          <>
            <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-4">
                <article className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="text-[18px] font-semibold text-slate-900">Invitation Email</h3>
                  <p className="mt-1 text-sm text-slate-600">Compose the email sent to selected subcontractors.</p>

                  <div className="mt-4 space-y-4">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">Subject</span>
                      <input
                        ref={subjectInputRef}
                        value={invitationEmailDraft.subject}
                        onFocus={() => setFocusedInvitationField("subject")}
                        onChange={(event) => setInvitationEmailDraft((prev) => ({ ...prev, subject: event.target.value }))}
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                        placeholder="Invitation subject"
                      />
                      <p className="mt-1 text-xs text-slate-500">Use tokens to auto-fill project details.</p>
                    </label>

                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">Message</span>
                      <textarea
                        ref={messageTextareaRef}
                        value={invitationEmailDraft.message}
                        onFocus={() => setFocusedInvitationField("message")}
                        onChange={(event) => setInvitationEmailDraft((prev) => ({ ...prev, message: event.target.value }))}
                        className="mt-2 min-h-52 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                        placeholder="Invitation message"
                      />
                      <p className="mt-1 text-xs text-slate-500">Use tokens to auto-fill project details.</p>
                    </label>
                  </div>
                </article>

                <article className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 text-sm font-semibold text-slate-700">Insert Tokens</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {TOKEN_LIST.map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => insertTokenAtCursor(token)}
                        className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        {token}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(tokenValues["{portal_link}"]);
                          setToast({ type: "success", message: "Portal link copied." });
                        } catch {
                          setToast({ type: "error", message: "Unable to copy portal link." });
                        }
                      }}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Copy portal link
                    </button>
                  </div>
                </article>

                <article className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-sm font-semibold text-slate-700">Included Attachments</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      Drawings: <span className="font-semibold">{includedAttachments.drawings || "None"}</span>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      Specs: <span className="font-semibold">{includedAttachments.specifications || "None"}</span>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      Documents: <span className="font-semibold">{includedAttachments.documents || "None"}</span>
                    </div>
                  </div>
                </article>

                <article className="rounded-xl border border-slate-200 bg-white p-5">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={invitationEmailDraft.requireAcknowledgement}
                      onChange={(event) =>
                        setInvitationEmailDraft((prev) => ({
                          ...prev,
                          requireAcknowledgement: event.target.checked,
                        }))
                      }
                      className="mt-0.5 size-4 rounded border-slate-300"
                    />
                    <span>
                      <span className="text-sm font-semibold text-slate-700">Require acknowledgement</span>
                      <span className="mt-1 block text-xs text-slate-500">
                        Subs must acknowledge receipt before submitting.
                      </span>
                    </span>
                  </label>
                </article>
              </div>

              <aside className="space-y-4 lg:sticky lg:top-24">
                <article className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-800">Preview</h4>
                    <button
                      type="button"
                      onClick={() => setTokenValuesOpen((open) => !open)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Show token values
                    </button>
                  </div>
                  {tokenValuesOpen ? (
                    <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                      {TOKEN_LIST.map((token) => (
                        <div key={`token-map-${token}`} className="flex items-start justify-between gap-2 py-0.5">
                          <span className="font-mono text-slate-700">{token}</span>
                          <span className="text-right">{tokenValues[token] || "—"}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <div>
                      <span className="font-semibold">From:</span> Primary bidding contact
                    </div>
                    <div>
                      <span className="font-semibold">To:</span> Selected subs across trades
                    </div>
                    <div>
                      <span className="font-semibold">Subject:</span> {renderedSubject || "—"}
                    </div>
                    <div>
                      <span className="font-semibold">Message:</span>
                      <p className="mt-1 whitespace-pre-wrap">{renderedMessage || "—"}</p>
                    </div>
                  </div>
                </article>

                <article className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setPreviewModalOpen(true)}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Preview Email
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTestDialogOpen(true);
                        setTestSendEmail("");
                      }}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Send test to myself
                    </button>
                    <button
                      type="button"
                      onClick={saveInvitationDraftNow}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Save Draft
                    </button>
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    {invitationSaving
                      ? "Saving draft..."
                      : invitationSavedAt
                        ? `Draft saved ${new Date(invitationSavedAt).toLocaleTimeString()}`
                        : "Draft not saved yet."}
                  </div>
                </article>
              </aside>
            </section>

            {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
            {selectedSubsCount === 0 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Select at least 1 subcontractor to invite, or choose Skip to create the bid package without invites.
              </p>
            ) : null}

            <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-slate-50/85 sm:px-6 lg:px-12">
              <button
                type="button"
                onClick={() => setActivePanel("invite-subs")}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <Link
                href="/bidding/all"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Creating..." : "Skip and Create Bid Package"}
              </button>
              <button
                type="submit"
                disabled={submitting || selectedSubsCount === 0}
                className="rounded-md bg-orange-500 px-8 py-2 text-base font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Creating..." : "Send Invites"}
              </button>
            </div>
          </>
        )}
          </div>

          <aside className="hidden -mt-[88px] h-[calc(100%+88px)] self-stretch border-l border-slate-200 bg-white pt-[88px] lg:block">
            <div className="sticky top-0 min-h-screen pt-2">
              <nav className="space-y-1 px-3">
                <button
                  type="button"
                  onClick={() => setActivePanel("general")}
                  className={`flex w-full items-center gap-3 rounded-md px-4 py-3 text-left text-base font-medium hover:bg-slate-100 ${
                    activePanel === "general" ? "bg-slate-100 text-slate-900" : "text-slate-700"
                  }`}
                >
                  <svg viewBox="0 0 20 20" className="size-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M6 2.75h6l3 3V17a1.25 1.25 0 0 1-1.25 1.25h-7.5A1.25 1.25 0 0 1 5 17V4a1.25 1.25 0 0 1 1-1.22Z" />
                    <path d="M12 2.75V6h3" />
                    <path d="M7.5 9.5h5M7.5 12h5M7.5 14.5h3.5" />
                  </svg>
                  General Information
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel("files")}
                  className={`flex w-full items-center gap-3 rounded-md px-4 py-3 text-left text-base font-medium hover:bg-slate-100 ${
                    activePanel === "files" ? "bg-slate-100 text-slate-900" : "text-slate-700"
                  }`}
                >
                  <svg viewBox="0 0 20 20" className="size-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M2.75 5.25A1.25 1.25 0 0 1 4 4h4.2l1.2 1.5H16A1.25 1.25 0 0 1 17.25 6.75v8.5A1.25 1.25 0 0 1 16 16.5H4a1.25 1.25 0 0 1-1.25-1.25z" />
                  </svg>
                  Files
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel("trade-coverage")}
                  className={`flex w-full items-center gap-3 rounded-md px-4 py-3 text-left text-base font-medium hover:bg-slate-100 ${
                    activePanel === "trade-coverage" ? "bg-slate-100 text-slate-900" : "text-slate-700"
                  }`}
                >
                  <svg viewBox="0 0 20 20" className="size-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M3.5 5.5h13v10h-13z" />
                    <path d="M7 8.5h6M7 11.5h6" />
                  </svg>
                  Trade Coverage
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel("invite-subs")}
                  className={`flex w-full items-center gap-3 rounded-md px-4 py-3 text-left text-base font-medium hover:bg-slate-100 ${
                    activePanel === "invite-subs" ? "bg-slate-100 text-slate-900" : "text-slate-700"
                  }`}
                >
                  <svg viewBox="0 0 20 20" className="size-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M4 6.5h12M4 10h12M4 13.5h12" />
                    <path d="M14.5 3.5v5m-2.5-2.5h5" />
                  </svg>
                  Invite Subs
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel("bid-email")}
                  className={`flex w-full items-center gap-3 rounded-md px-4 py-3 text-left text-base font-medium hover:bg-slate-100 ${
                    activePanel === "bid-email" ? "bg-slate-100 text-slate-900" : "text-slate-700"
                  }`}
                >
                  <svg viewBox="0 0 20 20" className="size-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <rect x="3" y="5" width="14" height="10" rx="1.5" />
                    <path d="m4 6 6 5 6-5" />
                  </svg>
                  Bid Email
                </button>
              </nav>
            </div>
          </aside>
        </div>
      </form>
      {previewModalOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50"
            aria-label="Close email preview"
            onClick={() => setPreviewModalOpen(false)}
          />
          <div className="absolute inset-x-6 top-8 mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Email Preview</h2>
            </div>
            <div className="space-y-3 px-6 py-5 text-sm text-slate-700">
              <div>
                <span className="font-semibold">From:</span> Primary bidding contact
              </div>
              <div>
                <span className="font-semibold">To:</span> Selected subs across trades
              </div>
              <div>
                <span className="font-semibold">Subject:</span> {renderedSubject}
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 whitespace-pre-wrap">{renderedMessage}</div>
            </div>
            <div className="flex justify-end border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {testDialogOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            aria-label="Close test send dialog"
            onClick={() => setTestDialogOpen(false)}
          />
          <div className="absolute left-1/2 top-24 w-full max-w-md -translate-x-1/2 rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">Send Test Email</h2>
            </div>
            <form
              className="space-y-4 px-5 py-4"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!testSendEmail.trim()) {
                  setToast({ type: "error", message: "Enter an email address." });
                  return;
                }
                setTestSendLoading(true);
                await new Promise((resolve) => window.setTimeout(resolve, 600));
                setTestSendLoading(false);
                setTestDialogOpen(false);
                setToast({ type: "success", message: `Test email queued to ${testSendEmail.trim()}.` });
              }}
            >
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Email address</span>
                <input
                  type="email"
                  value={testSendEmail}
                  onChange={(event) => setTestSendEmail(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  placeholder="you@company.com"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTestDialogOpen(false)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={testSendLoading}
                  className="rounded-md bg-orange-500 px-7 py-2 text-base font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {testSendLoading ? "Sending..." : "Send Test"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {toast ? (
        <div className="fixed bottom-5 right-5 z-50">
          <div
            className={`rounded-md border px-3 py-2 text-sm shadow-lg ${
              toast.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </div>
        </div>
      ) : null}
      {newSubDrawerTradeId ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            aria-label="Close new contractor drawer"
            onClick={() => {
              setNewSubDrawerTradeId(null);
              setNewSubError(null);
            }}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-2xl font-semibold text-slate-900">New Contractor</h2>
              <p className="mt-1 text-sm text-slate-500">
                {activeDrawerTrade ? `Add to ${activeDrawerTrade.code}` : "Add subcontractor to this trade"}
              </p>
            </div>
            <form
              className="space-y-4 px-6 py-5"
              onSubmit={async (event) => {
                event.preventDefault();
                const tradeId = newSubDrawerTradeId;
                if (!tradeId) return;
                const companyName = newSubDraft.company_name.trim();
                if (!companyName) {
                  setNewSubError("Company name is required.");
                  return;
                }
                setNewSubSaving(true);
                setNewSubError(null);

                const directoryResponse = await fetch("/api/directory/companies", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    companies: [
                      {
                        company_name: companyName,
                        trade: activeDrawerTrade?.code ?? null,
                        primary_contact: newSubDraft.primary_contact.trim() || null,
                        email: newSubDraft.email.trim() || null,
                        phone: newSubDraft.phone.trim() || null,
                        status: "Active",
                      },
                    ],
                  }),
                });
                if (!directoryResponse.ok) {
                  const payload = (await directoryResponse.json().catch(() => null)) as { error?: string } | null;
                  setNewSubError(payload?.error ?? "Unable to save contractor to directory.");
                  setNewSubSaving(false);
                  return;
                }
                const directoryPayload = (await directoryResponse.json().catch(() => null)) as
                  | { companies?: Array<{ id?: string; name?: string; email?: string | null }> }
                  | null;
                const directoryCompany = directoryPayload?.companies?.[0];
                if (!directoryCompany?.id || !directoryCompany?.name) {
                  setNewSubError("Contractor saved, but could not read directory record.");
                  setNewSubSaving(false);
                  return;
                }

                const created = await createBidSubcontractor({
                  company_name: companyName,
                  primary_contact: newSubDraft.primary_contact.trim() || null,
                  email: newSubDraft.email.trim() || null,
                  phone: newSubDraft.phone.trim() || null,
                });
                if (!created) {
                  setNewSubError("Unable to create subcontractor.");
                  setNewSubSaving(false);
                  return;
                }

                const newOption = {
                  id: directoryCompany.id,
                  company: directoryCompany.name,
                  email: directoryCompany.email ?? (newSubDraft.email.trim() || null),
                };
                setSubOptions((prev) => {
                  if (prev.some((item) => item.id === newOption.id)) return prev;
                  return [...prev, newOption].sort((a, b) => a.company.localeCompare(b.company));
                });
                addSubToTrade(tradeId, newOption);
                setManageSearchActiveByTradeId((prev) => ({ ...prev, [tradeId]: true }));
                setManageQueryByTradeId((prev) => ({ ...prev, [tradeId]: "" }));
                setNewSubDrawerTradeId(null);
                setNewSubSaving(false);
              }}
            >
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Company Name <span className="sr-only">required</span>
                <input
                  value={newSubDraft.company_name}
                  onChange={(event) => setNewSubDraft((prev) => ({ ...prev, company_name: event.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  placeholder="Company name"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Primary Contact
                <input
                  value={newSubDraft.primary_contact}
                  onChange={(event) => setNewSubDraft((prev) => ({ ...prev, primary_contact: event.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  placeholder="Primary contact"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Email
                  <input
                    value={newSubDraft.email}
                    onChange={(event) => setNewSubDraft((prev) => ({ ...prev, email: event.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                    placeholder="name@company.com"
                    type="email"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Phone
                  <input
                    value={newSubDraft.phone}
                    onChange={(event) => setNewSubDraft((prev) => ({ ...prev, phone: event.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                    placeholder="(555) 555-5555"
                  />
                </label>
              </div>
              {newSubError ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{newSubError}</p>
              ) : null}
              <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setNewSubDrawerTradeId(null);
                    setNewSubError(null);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newSubSaving}
                  className="rounded-md bg-orange-500 px-8 py-2 text-base font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {newSubSaving ? "Saving..." : "Save Contractor"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
