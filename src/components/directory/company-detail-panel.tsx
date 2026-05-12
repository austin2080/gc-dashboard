"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Globe,
  Mail,
  MapPin,
  Phone,
  Plus,
  X,
} from "lucide-react";
import { Company, ProjectDirectoryEntry } from "@/lib/directory/types";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  company: Company | null;
  tradeOptions: string[];
  assignedProjects: ProjectDirectoryEntry[];
  allProjects: ProjectDirectoryEntry[];
  projectPickerOpen: boolean;
  onClose: () => void;
  onSaveCompanyInfo: (updates: {
    name: string;
    trade?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    website?: string;
    phone?: string;
    email?: string;
    isActive: boolean;
  }) => Promise<void>;
  onOpenProjectPicker: () => void;
  onAssignProject: (projectId: string) => void;
};

type DrawerTab = "company-info" | "contacts" | "bid-history" | "performance" | "notes" | "documents";

type CompanyInfoDraft = {
  name: string;
  trades: string[];
  primaryTrade: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  website: string;
  phone: string;
  email: string;
  isActive: boolean;
};

const TABS: Array<{ id: DrawerTab; label: string }> = [
  { id: "company-info", label: "Company Info" },
  { id: "contacts", label: "Contacts" },
  { id: "bid-history", label: "Bid History" },
  { id: "performance", label: "Performance" },
  { id: "notes", label: "Notes" },
  { id: "documents", label: "Documents" },
];

function stripTradeCodePrefix(value: string) {
  return value.replace(/^\d{2}(?:[-\s]\d{2}){0,3}\s*/, "").trim();
}

function getTradeTitles(value?: string) {
  if (!value?.trim()) return [];
  return value
    .split(/\s*\|\s*|\s*;\s*|\s*,\s*/)
    .map((entry) => stripTradeCodePrefix(entry.trim()))
    .filter(Boolean);
}

function toDraft(company: Company): CompanyInfoDraft {
  const trades = getTradeTitles(company.trade);
  return {
    name: company.name ?? "",
    trades,
    primaryTrade: trades[0] ?? "",
    address: company.address ?? "",
    city: company.city ?? "",
    state: company.state ?? "",
    zip: company.zip ?? "",
    website: company.website ?? "",
    phone: company.phone ?? "",
    email: company.email ?? "",
    isActive: company.isActive,
  };
}

function TradeSearchSelect({
  value,
  placeholder,
  options,
  onSelect,
}: {
  value: string;
  placeholder: string;
  options: string[];
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="mt-2 flex h-10 w-full items-center justify-between rounded-[20px] border border-slate-200 bg-slate-100/40 px-5 text-left text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none transition-colors hover:border-slate-300"
        >
          <span className={value ? "" : "text-slate-400"}>{value || placeholder}</span>
          <ChevronDown className="h-5 w-5 text-slate-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={8}
        collisionPadding={16}
        className="w-[var(--radix-popover-trigger-width)] rounded-2xl border border-slate-200 bg-white p-2 shadow-soft-md"
      >
        <Command>
          <CommandInput placeholder="Search trades..." />
          <CommandList>
            <CommandEmpty>No trade found.</CommandEmpty>
            {options.map((option) => (
              <CommandItem
                key={option}
                value={option}
                onSelect={() => {
                  onSelect(option);
                  setOpen(false);
                }}
                className="cursor-pointer rounded-xl text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
              >
                <span className="flex items-center gap-2">
                  {value === option ? <Check className="h-4 w-4" /> : <span className="h-4 w-4" />}
                  {option}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function CompanyDetailPanel({
  company,
  tradeOptions,
  assignedProjects,
  allProjects,
  projectPickerOpen,
  onClose,
  onSaveCompanyInfo,
  onOpenProjectPicker,
  onAssignProject,
}: Props) {
  const [activeTab, setActiveTab] = useState<DrawerTab>("company-info");
  const [isEditingCompanyInfo, setIsEditingCompanyInfo] = useState(false);
  const [isSavingCompanyInfo, setIsSavingCompanyInfo] = useState(false);
  const [companyInfoError, setCompanyInfoError] = useState("");
  const [pendingClose, setPendingClose] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [pendingTrade, setPendingTrade] = useState("");
  const [customTradeInput, setCustomTradeInput] = useState("");
  const [companyInfoDraft, setCompanyInfoDraft] = useState<CompanyInfoDraft>({
    name: "",
    trades: [],
    primaryTrade: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    website: "",
    phone: "",
    email: "",
    isActive: true,
  });

  useEffect(() => {
    if (!company) return;
    setActiveTab("company-info");
    setIsEditingCompanyInfo(false);
    setCompanyInfoError("");
    setPendingClose(false);
    setIsClosing(false);
    setPendingTrade("");
    setCustomTradeInput("");
    setCompanyInfoDraft(toDraft(company));
  }, [company]);

  const tradeTitles = useMemo(() => getTradeTitles(company?.trade), [company?.trade]);

  const allTradeTitles = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const entry of [...tradeOptions.map(stripTradeCodePrefix), ...tradeTitles]) {
      const value = entry.trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      ordered.push(value);
    }
    return ordered;
  }, [tradeOptions, tradeTitles]);

  const orderedDraftTrades = useMemo(() => {
    const primary = companyInfoDraft.primaryTrade.trim();
    const remainder = companyInfoDraft.trades.filter((trade) => trade !== primary);
    return primary ? [primary, ...remainder] : companyInfoDraft.trades;
  }, [companyInfoDraft.primaryTrade, companyInfoDraft.trades]);
  const baselineDraft = company ? toDraft(company) : null;
  const hasUnsavedCompanyInfoChanges =
    Boolean(company) &&
    isEditingCompanyInfo &&
    Boolean(
      baselineDraft &&
      (
        companyInfoDraft.name !== baselineDraft.name ||
        companyInfoDraft.primaryTrade !== baselineDraft.primaryTrade ||
        companyInfoDraft.address !== baselineDraft.address ||
        companyInfoDraft.city !== baselineDraft.city ||
        companyInfoDraft.state !== baselineDraft.state ||
        companyInfoDraft.zip !== baselineDraft.zip ||
        companyInfoDraft.website !== baselineDraft.website ||
        companyInfoDraft.phone !== baselineDraft.phone ||
        companyInfoDraft.email !== baselineDraft.email ||
        companyInfoDraft.isActive !== baselineDraft.isActive ||
        orderedDraftTrades.join(" | ") !== baselineDraft.trades.join(" | ") ||
        Boolean(pendingTrade) ||
        Boolean(customTradeInput.trim())
      )
    );

  function requestClose() {
    if (isClosing) return;
    if (hasUnsavedCompanyInfoChanges) {
      setPendingClose(true);
      return;
    }
    setIsClosing(true);
  }

  function resetCompanyInfoDraft() {
    if (!company) return;
    setCompanyInfoError("");
    setIsEditingCompanyInfo(false);
    setPendingClose(false);
    setIsClosing(false);
    setPendingTrade("");
    setCustomTradeInput("");
    setCompanyInfoDraft(toDraft(company));
  }

  useEffect(() => {
    if (!company) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [company, hasUnsavedCompanyInfoChanges]);

  useEffect(() => {
    if (!company || !isClosing) return;
    const timeout = window.setTimeout(() => {
      onClose();
    }, 260);
    return () => window.clearTimeout(timeout);
  }, [company, isClosing, onClose]);

  if (!company) return null;

  const subtitleParts = [tradeTitles[0], company.city, company.state].filter(Boolean);
  const subtitle = subtitleParts.length ? subtitleParts.join(" · ") : "Subcontractor profile";
  const addressParts = [company.address, company.city, company.state, company.zip].filter(Boolean);
  const addressLabel = addressParts.length ? addressParts.join(", ") : "—";
  const displayIsActive = isEditingCompanyInfo ? companyInfoDraft.isActive : company.isActive;

  function addTradeToDraft(nextTrade: string) {
    const cleanedTrade = stripTradeCodePrefix(nextTrade).trim();
    if (!cleanedTrade) return;
    setCompanyInfoDraft((current) => {
      if (current.trades.includes(cleanedTrade)) {
        return current.primaryTrade ? current : { ...current, primaryTrade: cleanedTrade };
      }
      return {
        ...current,
        trades: [...current.trades, cleanedTrade],
        primaryTrade: current.primaryTrade || cleanedTrade,
      };
    });
  }

  async function handleSaveCompanyInfo() {
    if (!companyInfoDraft.name.trim()) {
      setCompanyInfoError("Company name is required.");
      return;
    }
    if (!orderedDraftTrades.length) {
      setCompanyInfoError("At least one trade is required.");
      return;
    }
    if (!companyInfoDraft.email.trim()) {
      setCompanyInfoError("Email is required.");
      return;
    }
    if (!companyInfoDraft.phone.trim()) {
      setCompanyInfoError("Phone is required.");
      return;
    }

    setCompanyInfoError("");
    setIsSavingCompanyInfo(true);
    try {
      await onSaveCompanyInfo({
        name: companyInfoDraft.name.trim(),
        trade: orderedDraftTrades.join(" | "),
        address: companyInfoDraft.address.trim() || undefined,
        city: companyInfoDraft.city.trim() || undefined,
        state: companyInfoDraft.state.trim() || undefined,
        zip: companyInfoDraft.zip.trim() || undefined,
        website: companyInfoDraft.website.trim() || undefined,
        phone: companyInfoDraft.phone.trim() || undefined,
        email: companyInfoDraft.email.trim() || undefined,
        isActive: companyInfoDraft.isActive,
      });
      setIsEditingCompanyInfo(false);
    } catch (error) {
      setCompanyInfoError(error instanceof Error ? error.message : "Failed to update company.");
    } finally {
      setIsSavingCompanyInfo(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close subcontractor profile"
        className={`absolute inset-0 bg-black/80 duration-300 ${
          isClosing ? "animate-out fade-out-0" : "animate-in fade-in-0"
        }`}
        onClick={requestClose}
      />

      <aside
        className={`absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col overflow-hidden border-l border-slate-200 bg-[#F8F8F7] shadow-2xl duration-300 ease-out sm:max-w-3xl ${
          isClosing ? "animate-out slide-out-to-right-full" : "animate-in slide-in-from-right-full"
        }`}
      >
        <div className="flex items-start justify-between gap-6 border-b border-slate-200 bg-white px-9 pb-0 pt-7">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[22px] font-semibold leading-none tracking-tight text-slate-950">
                {company.name}
              </h2>
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-semibold ${
                  displayIsActive
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                {displayIsActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>

            <div className="mt-7 flex flex-wrap items-center gap-3 pb-7">
              <button
                type="button"
                onClick={onOpenProjectPicker}
                className="inline-flex h-11 items-center gap-2 rounded-[16px] bg-[#356DFF] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#2456dc]"
              >
                Invite to Project
              </button>
              {isEditingCompanyInfo ? (
                <>
                  <button
                    type="button"
                    onClick={resetCompanyInfoDraft}
                    className="inline-flex h-11 items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm hover:border-accent hover:bg-accent hover:text-accent-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCompanyInfo}
                    disabled={isSavingCompanyInfo}
                    className="inline-flex h-11 items-center gap-2 rounded-[16px] bg-[#356DFF] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#2456dc] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingCompanyInfo ? "Saving..." : "Save Changes"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("company-info");
                    setCompanyInfoError("");
                    setIsEditingCompanyInfo(true);
                  }}
                  className="inline-flex h-11 items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm hover:border-accent hover:bg-accent hover:text-accent-foreground"
                >
                  Edit
                </button>
              )}
              <a
                href={company.email ? `mailto:${company.email}` : undefined}
                className="inline-flex h-11 items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm hover:border-accent hover:bg-accent hover:text-accent-foreground"
              >
                <Mail className="h-5 w-5" />
                Email
              </a>
            </div>

            <div className="flex flex-wrap items-end gap-8">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`border-b-[3px] pb-1 text-[15px] font-semibold transition-colors ${
                      isActive
                        ? "border-[#356DFF] text-[#356DFF]"
                        : "border-transparent text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={requestClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close drawer"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-9 py-8">
          {activeTab === "company-info" ? (
            <div className="space-y-8">
              {companyInfoError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                  {companyInfoError}
                </div>
              ) : null}

              <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-soft-sm">
                {isEditingCompanyInfo ? (
                  <div className="space-y-6">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Company Details</div>

                    <div className="space-y-3">
                      <label className="text-[13px] font-semibold text-slate-950">Company name</label>
                      <input
                        value={companyInfoDraft.name}
                        onChange={(event) =>
                          setCompanyInfoDraft((current) => ({ ...current, name: event.target.value }))
                        }
                        className="h-10 w-full rounded-[20px] mt-2 border border-slate-200 bg-slate-100/40 px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
                      <div className="space-y-3">
                        <label className="text-[13px] font-semibold text-slate-950">Primary trade</label>
                        <TradeSearchSelect
                          value={companyInfoDraft.primaryTrade}
                          placeholder="Select trade"
                          options={allTradeTitles}
                          onSelect={(value) =>
                            setCompanyInfoDraft((current) => ({
                              ...current,
                              primaryTrade: value,
                              trades: current.trades.includes(value)
                                ? current.trades
                                : [value, ...current.trades],
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-[13px] font-semibold text-slate-950">Status</label>
                        <Select
                          value={companyInfoDraft.isActive ? "active" : "inactive"}
                          onValueChange={(value) =>
                            setCompanyInfoDraft((current) => ({ ...current, isActive: value === "active" }))
                          }
                        >
                          <SelectTrigger
                            size="field"
                            className="mt-2 h-10 w-full rounded-[20px] border border-slate-200 bg-white px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="min-w-[220px] rounded-2xl border border-slate-200 bg-white p-1 shadow-soft-md">
                            <SelectItem value="active" className="rounded-xl text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
                              Active
                            </SelectItem>
                            <SelectItem value="inactive" className="rounded-xl text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
                              Inactive
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[13px] font-semibold text-slate-950">Address</label>
                      <input
                        value={companyInfoDraft.address}
                        onChange={(event) =>
                          setCompanyInfoDraft((current) => ({ ...current, address: event.target.value }))
                        }
                        className="mt-2 h-10 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-3">
                        <label className="text-[13px] font-semibold text-slate-950">City</label>
                        <input
                          value={companyInfoDraft.city}
                          onChange={(event) =>
                            setCompanyInfoDraft((current) => ({ ...current, city: event.target.value }))
                          }
                          className="mt-2 h-10 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-[13px] font-semibold text-slate-950">State</label>
                        <input
                          value={companyInfoDraft.state}
                          onChange={(event) =>
                            setCompanyInfoDraft((current) => ({ ...current, state: event.target.value }))
                          }
                          className="mt-2 h-10 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-3">
                        <label className="text-[13px] font-semibold text-slate-950">Website</label>
                        <input
                          value={companyInfoDraft.website}
                          onChange={(event) =>
                            setCompanyInfoDraft((current) => ({ ...current, website: event.target.value }))
                          }
                          className="mt-2 h-10 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-[13px] font-semibold text-slate-950">Phone</label>
                        <input
                          value={companyInfoDraft.phone}
                          onChange={(event) =>
                            setCompanyInfoDraft((current) => ({ ...current, phone: event.target.value }))
                          }
                          className="mt-2 h-10 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[13px] font-semibold text-slate-950">Email</label>
                      <input
                        value={companyInfoDraft.email}
                        onChange={(event) =>
                          setCompanyInfoDraft((current) => ({ ...current, email: event.target.value }))
                        }
                        className="mt-2 h-10 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Company</div>
                      <div className="mt-2 flex items-start gap-3 text-slate-950">
                        <Building2 className="mt-1 h-4 w-4 text-slate-400" />
                        <span className="text-[16px] font-medium leading-7">{company.name}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Status</div>
                      <div className="mt-2 text-[16px] font-medium leading-7 text-slate-950">
                        {company.isActive ? "Active" : "Inactive"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Address</div>
                      <div className="mt-2 flex items-start gap-3 text-slate-950">
                        <MapPin className="mt-1 h-4 w-4 text-slate-400" />
                        <span className="text-[16px] font-medium leading-7">{addressLabel}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Website</div>
                      <div className="mt-2 flex items-start gap-3 text-slate-950">
                        <Globe className="mt-1 h-4 w-4 text-slate-400" />
                        <span className="text-[16px] font-medium leading-7">{company.website || "—"}</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Phone</div>
                      <div className="mt-2 flex items-start gap-3 text-slate-950">
                        <Phone className="mt-1 h-4 w-4 text-slate-400" />
                        <span className="text-[16px] font-medium leading-7">{company.phone || "—"}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Email</div>
                      <div className="mt-2 flex items-start gap-3 text-slate-950">
                        <Mail className="mt-1 h-4 w-4 text-slate-400" />
                        <span className="text-[16px] font-medium leading-7">{company.email || "—"}</span>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {isEditingCompanyInfo ? (
                <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-soft-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Additional Trades Performed</div>
                    <div className="text-sm font-medium text-slate-500">{orderedDraftTrades.length} selected</div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2.5">
                    {orderedDraftTrades.map((trade) => {
                      const isPrimary = trade === companyInfoDraft.primaryTrade;
                      return (
                        <span
                          key={trade}
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold leading-none ${
                            isPrimary ? "bg-[#356DFF] text-white" : "bg-slate-100 text-[#356DFF]"
                          }`}
                        >
                          <span>{trade}</span>
                          {isPrimary ? (
                            <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                              Primary
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              setCompanyInfoDraft((current) => {
                                const nextTrades = current.trades.filter((entry) => entry !== trade);
                                return {
                                  ...current,
                                  trades: nextTrades,
                                  primaryTrade:
                                    current.primaryTrade === trade ? nextTrades[0] ?? "" : current.primaryTrade,
                                };
                              })
                            }
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
                              isPrimary ? "text-white/90 hover:bg-white/15" : "text-[#356DFF] hover:bg-slate-200"
                            }`}
                            aria-label={`Remove ${trade}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-[minmax(280px,0.95fr)_minmax(0,1.05fr)_128px]">
                    <TradeSearchSelect
                      value={pendingTrade}
                      placeholder="Add from list..."
                      options={allTradeTitles.filter((trade) => !companyInfoDraft.trades.includes(trade))}
                      onSelect={(trade) => {
                        addTradeToDraft(trade);
                        setPendingTrade("");
                      }}
                    />

                    <input
                      value={customTradeInput}
                      onChange={(event) => setCustomTradeInput(event.target.value)}
                      placeholder="Or type a custom trade..."
                      className="h-10 mt-2 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-5 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        if (pendingTrade) {
                          addTradeToDraft(pendingTrade);
                          setPendingTrade("");
                          return;
                        }
                        if (customTradeInput.trim()) {
                          addTradeToDraft(customTradeInput);
                          setCustomTradeInput("");
                        }
                      }}
                      className="inline-flex h-10 mt-2 items-center justify-center gap-2 rounded-[20px] border border-slate-200 bg-white px-5 text-[15px] font-semibold text-slate-900 shadow-soft-sm hover:border-accent hover:bg-accent hover:text-accent-foreground"
                    >
                      <Plus className="h-5 w-5" />
                      Add
                    </button>
                  </div>
                </section>
              ) : (
                <section>
                  <div className="tmb-2 text-[14px] font-medium uppercase tracking-wider text-slate-500">Trades</div>
                  <div className="mt-1 flex flex-wrap gap-3">
                    {tradeTitles.length ? (
                      tradeTitles.map((trade) => (
                        <span
                          key={`${company.id}-${trade}`}
                          className="inline-flex rounded-full bg-[#EEF2FF] px-3 py-2 text-[14px] font-semibold leading-none text-[#356DFF]"
                        >
                          {trade}
                        </span>
                      ))
                    ) : (
                      <span className="text-[16px] text-slate-500">No trades listed.</span>
                    )}
                  </div>
                </section>
              )}

              {projectPickerOpen ? (
                <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-soft-sm">
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Assign to Project</div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {allProjects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => onAssignProject(project.id)}
                        className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${
                          assignedProjects.some((entry) => entry.id === project.id)
                            ? "border-[#356DFF] bg-[#EEF2FF] text-[#356DFF]"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {project.name}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : (
            <section className="rounded-[24px] border border-slate-200 bg-white p-8 text-center shadow-soft-sm">
              <div className="text-lg font-semibold text-slate-900">{TABS.find((tab) => tab.id === activeTab)?.label}</div>
              <p className="mt-2 text-sm text-slate-500">This section is not wired yet in the drawer.</p>
            </section>
          )}
        </div>
      </aside>

      {pendingClose ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Leave without saving?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              You have unsaved company changes. If you leave now, those changes will be lost.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                onClick={() => setPendingClose(false)}
              >
                Stay
              </button>
              <button
                type="button"
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
                onClick={() => {
                  setPendingClose(false);
                  resetCompanyInfoDraft();
                  setIsClosing(true);
                }}
              >
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
