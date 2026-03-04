"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createBidProject } from "@/lib/bidding/store";

type BidPackageDraft = {
  project_name: string;
  package_number: string;
  status: string;
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
};

type AssignedSub = SubOption & {
  invited: boolean;
  willBid: boolean;
};

const SUB_OPTIONS: SubOption[] = [
  { id: "sub-1", company: "Alpha Concrete LLC" },
  { id: "sub-2", company: "Delta Drywall Systems" },
  { id: "sub-3", company: "Summit Electric Inc." },
  { id: "sub-4", company: "Northwest Mechanical" },
  { id: "sub-5", company: "Pioneer Plumbing Co." },
  { id: "sub-6", company: "Skyline Roofing Group" },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function createDefaultDraft(): BidPackageDraft {
  return {
    project_name: "",
    package_number: "",
    status: "open",
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

export default function NewBidPackagePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"general" | "files" | "trade-coverage">("general");
  const [activeFileSection, setActiveFileSection] = useState<FileSectionKey>("drawings");
  const [costCodes, setCostCodes] = useState<CostCodeOption[]>([]);
  const [loadingCostCodes, setLoadingCostCodes] = useState(false);
  const [costCodeLoadError, setCostCodeLoadError] = useState<string | null>(null);
  const [costCodeQuery, setCostCodeQuery] = useState("");
  const [selectedTrades, setSelectedTrades] = useState<SelectedTrade[]>([]);
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [manageQueryByTradeId, setManageQueryByTradeId] = useState<Record<string, string>>({});
  const [manageSearchActiveByTradeId, setManageSearchActiveByTradeId] = useState<Record<string, boolean>>({});
  const [assignedSubsByTradeId, setAssignedSubsByTradeId] = useState<Record<string, AssignedSub[]>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedBidFile[]>([]);
  const [draft, setDraft] = useState<BidPackageDraft>(createDefaultDraft());
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
        [tradeId]: [...current, { ...sub, invited: false, willBid: false }],
      };
    });
  };

  const removeSubFromTrade = (tradeId: string, subId: string) => {
    setAssignedSubsByTradeId((prev) => ({
      ...prev,
      [tradeId]: (prev[tradeId] ?? []).filter((item) => item.id !== subId),
    }));
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
            <span className="text-slate-500">New Bid Package</span>
          </div>
          <h1 className="text-[30px] font-semibold text-slate-900">Add Bid Package</h1>
        </div>
      </header>

      <form
        className=""
        onSubmit={async (event) => {
          event.preventDefault();
          if (!draft.project_name.trim()) {
            setError("Project name is required.");
            return;
          }

          setSubmitting(true);
          setError(null);

          const budgetValue = draft.budget.trim() ? Number(draft.budget) : null;
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

          setDraft(createDefaultDraft());
          router.push("/bidding/all");
          router.refresh();
        }}
      >
        <div className="grid items-start gap-0 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4 pr-4 pt-12 lg:px-12">
        {activePanel === "general" ? (
          <>
        <section id="general-information" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-[18px] font-semibold text-slate-900">General Information</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-6">
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
              <span className="inline-flex items-center gap-1">
                Title of Package <span className="text-rose-600">*</span>
              </span>
              <input
                value={draft.project_name}
                onChange={(event) => setDraft((prev) => ({ ...prev, project_name: event.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                placeholder="VBC CO #4"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
              Number
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
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
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

        <div className="flex items-center justify-end gap-2 pt-2">
          <Link
            href="/bidding/all"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => setActivePanel("files")}
            className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add files
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

            <div className="flex items-center justify-end gap-2 pt-2">
              <Link
                href="/bidding/all"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Creating..." : "Create Bid Package"}
              </button>
            </div>
          </>
        ) : (
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
                          <div
                            key={`${trade.id}-sub-row-${sub.id}`}
                            className="grid grid-cols-[minmax(0,1fr)_120px_120px_132px] border-t border-slate-200 bg-slate-50/40 text-sm text-slate-700"
                          >
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
                                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                + New Contractor
                              </button>
                            </div>
                            <div className="mt-2 max-h-40 overflow-auto rounded-md border border-slate-200 bg-white">
                              {manageSearchActiveByTradeId[trade.id]
                                ? SUB_OPTIONS.filter((option) => {
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

            <div className="flex items-center justify-end gap-2 pt-2">
              <Link
                href="/bidding/all"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Creating..." : "Create Bid Package"}
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
              </nav>
            </div>
          </aside>
        </div>
      </form>
    </main>
  );
}
