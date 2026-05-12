"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Activity, BadgeCheck, Building2, Download, Ellipsis, Filter, Plus, Search, Upload, UsersRound } from "lucide-react";
import { Company, ProjectCompany, ProjectDirectoryEntry } from "@/lib/directory/types";
import CompanyFormModal from "@/components/directory/company-form-modal";
import CompanyDetailPanel from "@/components/directory/company-detail-panel";
import { listCompanyCostCodesForCurrentCompany, type CompanyCostCode } from "@/lib/bidding/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TradeSelection = {
  type: "cost_code" | "custom";
  id?: string;
  code?: string;
  title: string;
  division?: string;
};

type CompanyDraft = {
  companyName: string;
  trades: TradeSelection[];
  contactTitle: string;
  primaryContact: string;
  email: string;
  cellPhone: string;
  officePhone: string;
  vendorType: "Approved Vendor" | "Bidding Only" | "";
  address: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
  isActive: boolean;
};

const EMPTY_DRAFT: CompanyDraft = {
  companyName: "",
  trades: [],
  contactTitle: "",
  primaryContact: "",
  email: "",
  cellPhone: "",
  officePhone: "",
  vendorType: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  notes: "",
  isActive: true,
};

function normalizeTradeValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function tradeSelectionKey(selection: TradeSelection): string {
  if (selection.type === "cost_code" && selection.id) return `cost_code:${selection.id}`;
  return `custom:${normalizeTradeValue(selection.code ? `${selection.code} ${selection.title}` : selection.title)}`;
}

function formatTradeSelectionLabel(selection: TradeSelection): string {
  if (selection.type === "cost_code") {
    return `${selection.code ?? ""}${selection.title ? ` ${selection.title}` : ""}`.trim();
  }
  return selection.title.trim();
}

function formatTradeFilterLabel(value: string): string {
  return value
    .split(/\s*\|\s*/)
    .map((entry) => entry.replace(/^\d{2}(?:[-\s]\d{2}){0,3}\s*/, "").trim())
    .filter(Boolean)
    .join(" | ");
}

function stripTradeCodePrefix(value: string) {
  return value.replace(/^\d{2}(?:[-\s]\d{2}){0,3}\s*/, "").trim();
}

function filterWidthStyle(label: string, minCh: number) {
  return { width: `${Math.max(minCh, label.length + 5)}ch` };
}

function getTradeTitles(value?: string) {
  return parseTradeSelectionsFromValue(value)
    .map((selection) => stripTradeCodePrefix(selection.title.trim()))
    .filter(Boolean);
}

function getPrimaryTradeLabel(value?: string) {
  return getTradeTitles(value)[0] ?? "—";
}

function getLocationLabel(company: Company) {
  const city = company.city?.trim();
  const state = company.state?.trim();
  if (city && state) return `${city}, ${state}`;
  if (state) return state;
  if (city) return city;
  return "—";
}

function getMetricSeed(value: string) {
  return value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function getDirectoryRating(company: Company) {
  const seed = getMetricSeed(company.id || company.name);
  return (4 + (seed % 10) / 10).toFixed(1);
}

function getDirectoryResponseRate(company: Company) {
  const seed = getMetricSeed(company.name);
  return 78 + (seed % 19);
}

function getResponseTone(rate: number) {
  if (rate >= 90) return "bg-emerald-500";
  if (rate >= 85) return "bg-emerald-400";
  return "bg-amber-500";
}

function dedupeTradeSelections(selections: TradeSelection[]): TradeSelection[] {
  const seen = new Set<string>();
  const next: TradeSelection[] = [];
  for (const selection of selections) {
    const key = tradeSelectionKey(selection);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(selection);
  }
  return next;
}

function parseTradeSelectionsFromValue(value?: string): TradeSelection[] {
  if (!value?.trim()) return [];
  return dedupeTradeSelections(
    value
      .split(/\s*\|\s*|\s*;\s*|\s*,\s*/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => ({
        type: "custom" as const,
        title: entry,
      }))
  );
}

function alignSelectionsToCostCodes(
  selections: TradeSelection[],
  costCodes: CompanyCostCode[]
): TradeSelection[] {
  if (!selections.length || !costCodes.length) return selections;
  const byLabel = new Map(
    costCodes.map((code) => [
      normalizeTradeValue(`${code.code}${code.title ? ` ${code.title}` : ""}`.trim()),
      code,
    ])
  );

  return dedupeTradeSelections(
    selections.map((selection) => {
      if (selection.type === "cost_code" && selection.id) return selection;
      const label = formatTradeSelectionLabel(selection);
      const matchedCode = byLabel.get(normalizeTradeValue(label));
      if (!matchedCode) return selection;
      return {
        type: "cost_code",
        id: matchedCode.id,
        code: matchedCode.code,
        title: matchedCode.title ?? "",
        division: matchedCode.division ?? undefined,
      };
    })
  );
}

function toDraft(company?: Company): CompanyDraft {
  if (!company) return EMPTY_DRAFT;
  return {
    companyName: company.name,
    trades: parseTradeSelectionsFromValue(company.trade),
    contactTitle: company.contactTitle ?? "",
    primaryContact: company.primaryContact ?? "",
    email: company.email ?? "",
    cellPhone: company.phone ?? "",
    officePhone: company.officePhone ?? "",
    vendorType:
      company.vendorType === "Approved Vendor" || company.vendorType === "Bidding Only"
        ? company.vendorType
        : "",
    address: company.address ?? "",
    city: company.city ?? "",
    state: company.state ?? "",
    zip: company.zip ?? "",
    notes: company.notes ?? "",
    isActive: company.isActive,
  };
}

export default function DirectoryPageClient() {
  const searchParams = useSearchParams();
  const [storedProjectId, setStoredProjectId] = useState<string | null>(null);
  const queryProjectId = searchParams.get("project");
  const projectId = queryProjectId ?? storedProjectId;
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<ProjectDirectoryEntry[]>([]);
  const [relations, setRelations] = useState<ProjectCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [tradeFilter, setTradeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [locationFilter, setLocationFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CompanyDraft>(EMPTY_DRAFT);
  const [formError, setFormError] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [costCodeOptions, setCostCodeOptions] = useState<CompanyCostCode[]>([]);
  const [loadingCostCodes, setLoadingCostCodes] = useState(false);
  const [costCodeError, setCostCodeError] = useState("");

  const [detailCompanyId, setDetailCompanyId] = useState<string | null>(null);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [pendingRemovalCompany, setPendingRemovalCompany] = useState<{ id: string; name: string } | null>(null);
  const [removingCompany, setRemovingCompany] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const shouldLoadCostCodes = modalOpen || Boolean(detailCompanyId);

  useEffect(() => {
    const refreshStoredProject = () => {
      try {
        const value = localStorage.getItem("activeProjectId");
        setStoredProjectId(value);
      } catch {
        setStoredProjectId(null);
      }
    };
    refreshStoredProject();
    window.addEventListener("storage", refreshStoredProject);
    return () => {
      window.removeEventListener("storage", refreshStoredProject);
    };
  }, []);

  const showToast = useCallback((message: string, type: "error" | "success" = "error") => {
    setToast({ message, type });
  }, []);

  const fetchDirectory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/directory/overview", { cache: "no-store" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const message = payload?.error ?? "Failed to load directory.";
        if (typeof message === "string" && message.toLowerCase().includes("membership")) {
          setCompanies([]);
          setProjects([]);
          setRelations([]);
          return;
        }
        throw new Error(message);
      }
      const payload = (await res.json()) as {
        companies?: Company[];
        projects?: ProjectDirectoryEntry[];
        projectCompanies?: ProjectCompany[];
      };
      setCompanies(payload.companies ?? []);
      setProjects(payload.projects ?? []);
      setRelations(payload.projectCompanies ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load directory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDirectory();
  }, [fetchDirectory]);

  useEffect(() => {
    let active = true;
    async function loadCostCodes() {
      if (!shouldLoadCostCodes) return;
      setLoadingCostCodes(true);
      setCostCodeError("");
      try {
        const codes = await listCompanyCostCodesForCurrentCompany({ includeInactive: true });
        if (!active) return;
        setCostCodeOptions(codes);
      } catch {
        if (!active) return;
        setCostCodeOptions([]);
        setCostCodeError("Unable to load cost codes from Settings.");
      } finally {
        if (active) setLoadingCostCodes(false);
      }
    }

    void loadCostCodes();
    return () => {
      active = false;
    };
  }, [shouldLoadCostCodes]);

  useEffect(() => {
    if (!modalOpen || !costCodeOptions.length) return;
    setDraft((prev) => ({
      ...prev,
      trades: alignSelectionsToCostCodes(prev.trades, costCodeOptions),
    }));
  }, [modalOpen, costCodeOptions]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const tradeOptions = useMemo(() => {
    const set = new Set(companies.map((c) => c.trade).filter(Boolean));
    return Array.from(set) as string[];
  }, [companies]);

  const selectedTradeFilterLabel = tradeFilter === "all" ? "All Trades" : formatTradeFilterLabel(tradeFilter);
  const selectedStatusFilterLabel =
    statusFilter === "all" ? "All Status" : statusFilter === "active" ? "Active" : "Inactive";
  const selectedLocationFilterLabel = locationFilter === "all" ? "All Locations" : locationFilter;
  const selectedRatingFilterLabel = ratingFilter === "all" ? "Any Rating" : ratingFilter;

  const locationOptions = useMemo(() => {
    const values = new Set(
      companies
        .map((company) => {
          const city = company.city?.trim();
          const state = company.state?.trim();
          if (city && state) return `${city}, ${state}`;
          if (state) return state;
          if (city) return city;
          return null;
        })
        .filter(Boolean)
    );
    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter((company) => {
      const matchesQuery =
        !q ||
        `${company.name} ${company.primaryContact ?? ""} ${company.email ?? ""}`
          .toLowerCase()
          .includes(q);
      const matchesTrade = tradeFilter === "all" || (company.trade ?? "") === tradeFilter;
      const matchesStatus =
        statusFilter === "all" || (statusFilter === "active" ? company.isActive : !company.isActive);
      const companyLocation = (() => {
        const city = company.city?.trim();
        const state = company.state?.trim();
        if (city && state) return `${city}, ${state}`;
        if (state) return state;
        if (city) return city;
        return "";
      })();
      const matchesLocation = locationFilter === "all" || companyLocation === locationFilter;
      const matchesRating = ratingFilter === "all";
      return matchesQuery && matchesTrade && matchesStatus && matchesLocation && matchesRating;
    });
  }, [companies, locationFilter, query, ratingFilter, statusFilter, tradeFilter]);

  const directoryStats = useMemo(() => {
    const activeCount = companies.filter((company) => company.isActive).length;
    const inactiveCount = companies.length - activeCount;
    const assignedCount = new Set(relations.map((relation) => relation.companyId)).size;
    const uniqueTrades = new Set(
      companies.flatMap((company) =>
        parseTradeSelectionsFromValue(company.trade).map((selection) => normalizeTradeValue(selection.title))
      )
    ).size;
    const activeShare = companies.length ? Math.round((activeCount / companies.length) * 100) : 0;
    return {
      total: companies.length,
      active: activeCount,
      inactive: inactiveCount,
      assigned: assignedCount,
      uniqueTrades,
      activeShare,
    };
  }, [companies, relations]);

  function openAddModal() {
    setFormError("");
    setEditingCompanyId(null);
    setDraft(EMPTY_DRAFT);
    setModalOpen(true);
  }

  function openEditModal(company: Company) {
    setFormError("");
    setEditingCompanyId(company.id);
    setDraft(toDraft(company));
    setModalOpen(true);
  }

  async function updateCompanyRecord(
    company: Company,
    overrides: Partial<{
      name: string;
      trade: string;
      contactTitle: string | undefined;
      primaryContact: string | undefined;
      email: string | undefined;
      phone: string | undefined;
      officePhone: string | undefined;
      address: string | undefined;
      city: string | undefined;
      state: string | undefined;
      zip: string | undefined;
      website: string | undefined;
      notes: string | undefined;
      vendorType: string | undefined;
      isActive: boolean;
    }>
  ) {
    const nowIso = new Date().toISOString();
    const payload = {
      projectId: projectId ?? undefined,
      companies: [
        {
          id: company.id,
          name: overrides.name ?? company.name,
          company_name: overrides.name ?? company.name,
          trade: overrides.trade ?? company.trade,
          contactTitle: overrides.contactTitle ?? company.contactTitle,
          contact_title: overrides.contactTitle ?? company.contactTitle,
          primaryContact: overrides.primaryContact ?? company.primaryContact,
          primary_contact: overrides.primaryContact ?? company.primaryContact,
          email: overrides.email ?? company.email,
          phone: overrides.phone ?? company.phone,
          officePhone: overrides.officePhone ?? company.officePhone,
          office_phone: overrides.officePhone ?? company.officePhone,
          vendorType: overrides.vendorType ?? company.vendorType,
          vendor_type: overrides.vendorType ?? company.vendorType,
          address: overrides.address ?? company.address,
          city: overrides.city ?? company.city,
          state: overrides.state ?? company.state,
          zip: overrides.zip ?? company.zip,
          website: overrides.website ?? company.website,
          status: (overrides.isActive ?? company.isActive) ? "Active" : "Inactive",
          notes: overrides.notes ?? company.notes,
          isActive: overrides.isActive ?? company.isActive,
          updated_at: nowIso,
        },
      ],
    };

    const res = await fetch(`/api/directory/companies${projectId ? `?project=${encodeURIComponent(projectId)}` : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const raw = await res.text();
      let responsePayload: { error?: string } = {};
      try {
        responsePayload = raw ? (JSON.parse(raw) as { error?: string }) : {};
      } catch {
        responsePayload = {};
      }
      throw new Error(
        responsePayload?.error ??
          (raw ? `Failed to update company (${res.status}): ${raw}` : `Failed to update company (${res.status}).`)
      );
    }
  }

  async function saveCompany() {
    if (!draft.companyName.trim()) return setFormError("Company name is required.");
    if (!draft.trades.length) return setFormError("At least one trade is required.");
    if (!draft.primaryContact.trim()) return setFormError("Primary contact is required.");
    if (!draft.email.trim()) return setFormError("Email is required.");
    if (!draft.cellPhone.trim()) return setFormError("Cell is required.");

    setFormError("");
    setSavingCompany(true);

    try {
      const nowIso = new Date().toISOString();
      const payload = {
        projectId: projectId ?? undefined,
        companies: [
          {
            id: editingCompanyId ?? undefined,
            name: draft.companyName.trim(),
            company_name: draft.companyName.trim(),
            trade: dedupeTradeSelections(draft.trades).map(formatTradeSelectionLabel).join(" | "),
            contactTitle: draft.contactTitle.trim() || undefined,
            contact_title: draft.contactTitle.trim() || undefined,
            primaryContact: draft.primaryContact.trim(),
            primary_contact: draft.primaryContact.trim(),
            email: draft.email.trim(),
            phone: draft.cellPhone.trim(),
            officePhone: draft.officePhone.trim() || undefined,
            office_phone: draft.officePhone.trim() || undefined,
            vendorType: draft.vendorType || undefined,
            vendor_type: draft.vendorType || undefined,
            address: draft.address.trim() || undefined,
            city: draft.city.trim() || undefined,
            state: draft.state.trim() || undefined,
            zip: draft.zip.trim() || undefined,
            status: draft.isActive ? "Active" : "Inactive",
            notes: draft.notes.trim() || undefined,
            isActive: draft.isActive,
            created_at: editingCompanyId ? undefined : nowIso,
            updated_at: nowIso,
          },
        ],
      };

      const res = await fetch(`/api/directory/companies${projectId ? `?project=${encodeURIComponent(projectId)}` : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const raw = await res.text();
        let responsePayload: { error?: string } = {};
        try {
          responsePayload = raw ? (JSON.parse(raw) as { error?: string }) : {};
        } catch {
          responsePayload = {};
        }
        const message =
          responsePayload?.error ??
          (raw ? `Failed to save company (${res.status}): ${raw}` : `Failed to save company (${res.status}).`);
        console.error("Failed to save company", { status: res.status, responsePayload, raw });
        setFormError(message);
        showToast(message, "error");
        return;
      }
      setModalOpen(false);
      await fetchDirectory();
      showToast(editingCompanyId ? "Company updated." : "Company added.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save company.";
      console.error("Failed to save company", err);
      setFormError(message);
      showToast(message, "error");
    } finally {
      setSavingCompany(false);
    }
  }

  const selectedCompany = companies.find((company) => company.id === detailCompanyId) ?? null;
  const selectedCompanyProjects = useMemo(() => {
    if (!selectedCompany) return [];
    const projectIds = relations
      .filter((entry) => entry.companyId === selectedCompany.id)
      .map((entry) => entry.projectId);
    return projects.filter((project) => projectIds.includes(project.id));
  }, [projects, relations, selectedCompany]);

  function normalizeHeader(value: string) {
    return value
      .replace(/\uFEFF/g, "")
      .replace(/\u00A0/g, " ")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  }

  function parseCsvRow(line: string, delimiter: string) {
    const output: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];
      if (char === '"' && inQuotes && next === '"') {
        current += '"';
        i += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === delimiter && !inQuotes) {
        output.push(current);
        current = "";
        continue;
      }
      current += char;
    }
    output.push(current);
    return output.map((value) => value.trim());
  }

  function parseCsv(text: string) {
    const rows = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter((line) => line.trim().length > 0);
    if (rows.length === 0) return { headers: [], entries: [] };

    const firstLine = rows[0].trim().toLowerCase();
    const cleanedRows =
      firstLine === "directory-template" || firstLine === "directory template" ? rows.slice(1) : rows;

    if (cleanedRows.length === 0) return { headers: [], entries: [] };

    const headerLine = cleanedRows[0];
    const commaCount = (headerLine.match(/,/g) ?? []).length;
    const tabCount = (headerLine.match(/\t/g) ?? []).length;
    const semiCount = (headerLine.match(/;/g) ?? []).length;
    const delimiter =
      tabCount >= commaCount && tabCount >= semiCount ? "\t" : semiCount > commaCount ? ";" : ",";
    const headers = parseCsvRow(cleanedRows[0], delimiter).map(normalizeHeader);
    const entries = cleanedRows.slice(1).map((line) => {
      const values = parseCsvRow(line, delimiter);
      const record: Record<string, string> = {};
      headers.forEach((header, idx) => {
        record[header] = values[idx] ?? "";
      });
      return record;
    });
    return { headers, entries };
  }

  function toBoolean(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (["true", "1", "yes", "y", "active"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "inactive"].includes(normalized)) return false;
    return undefined;
  }

  async function handleImport(file?: File | null) {
    if (!file) return;
    setImportError("");
    setImporting(true);
    try {
      const text = await file.text();
      const { entries } = parseCsv(text);
      if (entries.length === 0) {
        throw new Error("CSV is empty.");
      }

      const mapped = entries
        .map((row) => ({
          name: row.name || row.company_name || row.company || "",
          trade: row.trade || "",
          contactTitle: row.contact_title || row.title || "",
          contact_title: row.contact_title || row.title || "",
          primaryContact: row.primary_contact || row.primarycontact || row.contact || "",
          email: row.email || "",
          phone: row.phone || "",
          officePhone: row.office_phone || "",
          office_phone: row.office_phone || "",
          address: row.address || "",
          city: row.city || "",
          state: row.state || "",
          zip: row.zip || row.postal_code || "",
          country: row.country || "",
          website: row.website || "",
          licenseNumber: row.license_number || "",
          taxId: row.tax_id || "",
          vendorType: row.vendor_type || "",
          procoreCompanyId: row.procore_company_id || "",
          notes: row.notes || "",
          isActive: toBoolean(row.is_active ?? row.active ?? ""),
        }))
        .filter((row) => row.name && row.name.trim().length > 0);

      if (mapped.length === 0) {
        throw new Error("No valid company rows found.");
      }

      const res = await fetch(`/api/directory/companies${projectId ? `?project=${encodeURIComponent(projectId)}` : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies: mapped, projectId: projectId ?? undefined }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Import failed.");
      }

      await fetchDirectory();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function escapeCsv(value: string) {
    if (value.includes('"')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    if (value.includes(",") || value.includes("\n") || value.includes("\r")) {
      return `"${value}"`;
    }
    return value;
  }

  function buildCsv(rows: Company[]) {
    const headers = [
      "name",
      "trade",
      "contact_title",
      "primary_contact",
      "email",
      "phone",
      "office_phone",
      "address",
      "city",
      "state",
      "zip",
      "country",
      "website",
      "license_number",
      "tax_id",
      "vendor_type",
      "procore_company_id",
      "notes",
      "is_active",
    ];
    const dataRows = rows.map((company) => [
      company.name,
      company.trade ?? "",
      company.contactTitle ?? "",
      company.primaryContact ?? "",
      company.email ?? "",
      company.phone ?? "",
      company.officePhone ?? "",
      company.address ?? "",
      company.city ?? "",
      company.state ?? "",
      company.zip ?? "",
      company.country ?? "",
      company.website ?? "",
      company.licenseNumber ?? "",
      company.taxId ?? "",
      company.vendorType ?? "",
      company.procoreCompanyId ?? "",
      company.notes ?? "",
      company.isActive ? "true" : "false",
    ]);

    return [headers.join(","), ...dataRows.map((row) => row.map(escapeCsv).join(","))].join("\n");
  }

  function downloadCsv(filename: string, contents: string) {
    const blob = new Blob([contents], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function removeCompany(companyId: string) {
    const res = await fetch(`/api/directory/companies/${companyId}`, { method: "DELETE" });
    if (!res.ok) {
      const raw = await res.text();
      let payload: { error?: string } = {};
      try {
        payload = raw ? (JSON.parse(raw) as { error?: string }) : {};
      } catch {
        payload = {};
      }
      const message =
        payload.error ??
        (raw ? `Failed to remove company (${res.status}): ${raw}` : `Failed to remove company (${res.status}).`);
      showToast(message, "error");
      return false;
    }
    if (detailCompanyId === companyId) setDetailCompanyId(null);
    await fetchDirectory();
    showToast("Company removed.", "success");
    return true;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold leading-none text-slate-950 [font-family:'Plus_Jakarta_Sans',Inter,sans-serif]">
            Subs Directory
          </h1>
          <p className="max-w-4xl text-[16px] leading-7 text-slate-500">
            Manage subcontractors, contacts, trades, bid history, and performance across all projects.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-11 items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
            disabled={importing}
          >
            <Upload className="h-5 w-5" />
            {importing ? "Importing..." : "Import CSV"}
          </button>
          <button
            onClick={() => downloadCsv("directory-export.csv", buildCsv(companies))}
            className="inline-flex h-11 items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={companies.length === 0}
          >
            <Download className="h-5 w-5" />
            Export
          </button>
          <button
            onClick={openAddModal}
            className="inline-flex h-11 items-center gap-2 rounded-[16px] bg-[#356DFF] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#2456dc]"
          >
            <Plus className="h-5 w-5" />
            Add Subcontractor
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Subs",
            value: String(directoryStats.total),
            helper: "",
            icon: Building2,
          },
          {
            label: "Active Subs",
            value: String(directoryStats.active),
            helper: `${directoryStats.activeShare}% of directory`,
            icon: BadgeCheck,
          },
          {
            label: "Trades Covered",
            value: String(directoryStats.uniqueTrades),
            helper: "Unique trades",
            icon: UsersRound,
          },
          {
            label: "Avg Response Rate",
            value: "—",
            helper: "No ratings yet",
            icon: Activity,
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-[24px] border border-slate-200 bg-white px-6 py-4 shadow-soft-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{card.label}</p>
                  <p className="mt-3 text-3xl font-bold leading-none tracking-tight text-slate-950">{card.value}</p>
                  {card.helper ? <p className="mt-3 text-xs font-medium text-slate-500">{card.helper}</p> : null}
                </div>
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[18px] bg-[#EEF2FF] text-[#356DFF]">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-soft-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative min-w-[360px] flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                className="h-10 w-full rounded-[20px] border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-700 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="Search subs, contacts, trades, or email..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="shrink-0" style={filterWidthStyle(selectedTradeFilterLabel, 14)}>
              <Select value={tradeFilter} onValueChange={setTradeFilter}>
                <SelectTrigger
                  size="field"
                  className="h-10 w-full rounded-[20px] border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm hover:border-accent hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-current" />
                    <SelectValue placeholder="All Trades" />
                  </span>
                </SelectTrigger>
                <SelectContent className="min-w-[220px] rounded-2xl border border-slate-200 bg-white p-1 shadow-soft-md">
                  <SelectItem value="all" className="rounded-xl text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
                    All Trades
                  </SelectItem>
                  {tradeOptions.map((trade) => (
                    <SelectItem
                      key={trade}
                      value={trade}
                      className="rounded-xl text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                    >
                      {formatTradeFilterLabel(trade)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="shrink-0" style={filterWidthStyle(selectedStatusFilterLabel, 12)}>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger
                  size="field"
                  className="h-10 w-full rounded-[20px] border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm hover:border-accent hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-current" />
                    <SelectValue placeholder="All Status" />
                  </span>
                </SelectTrigger>
                <SelectContent className="min-w-[220px] rounded-2xl border border-slate-200 bg-white p-1 shadow-soft-md">
                  <SelectItem value="all" className="rounded-xl text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
                    All Status
                  </SelectItem>
                  <SelectItem value="active" className="rounded-xl text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
                    Active
                  </SelectItem>
                  <SelectItem value="inactive" className="rounded-xl text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
                    Inactive
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="shrink-0" style={filterWidthStyle(selectedLocationFilterLabel, 15)}>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger
                  size="field"
                  className="h-10 w-full rounded-[20px] border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm hover:border-accent hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-current" />
                    <SelectValue placeholder="All Locations" />
                  </span>
                </SelectTrigger>
                <SelectContent className="min-w-[240px] rounded-2xl border border-slate-200 bg-white p-1 shadow-soft-md">
                  <SelectItem value="all" className="rounded-xl text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
                    All Locations
                  </SelectItem>
                  {locationOptions.map((location) => (
                    <SelectItem
                      key={location}
                      value={location}
                      className="rounded-xl text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                    >
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="shrink-0" style={filterWidthStyle(selectedRatingFilterLabel, 17)}>
              <Select value={ratingFilter} onValueChange={setRatingFilter}>
                <SelectTrigger
                  size="field"
                  className="h-10 w-full rounded-[20px] border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm hover:border-accent hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-current" />
                    <SelectValue placeholder="Any Rating" />
                  </span>
                </SelectTrigger>
                <SelectContent className="min-w-[220px] rounded-2xl border border-slate-200 bg-white p-1 shadow-soft-md">
                  <SelectItem value="all" className="rounded-xl text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
                    Any Rating
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm font-medium text-slate-500">{filteredCompanies.length} of {companies.length}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => handleImport(event.target.files?.[0])}
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-soft-sm">
        {toast ? (
          <div className={`border-b px-4 py-2 text-sm ${toast.type === "error" ? "text-red-600" : "text-emerald-700"}`}>
            {toast.message}
          </div>
        ) : null}
        {error ? <div className="border-b px-4 py-2 text-sm text-red-600">{error}</div> : null}
        {importError ? <div className="border-b px-4 py-2 text-sm text-red-600">{importError}</div> : null}

        <div className="overflow-x-hidden">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[17%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[18%]" />
              <col className="w-[11%]" />
              <col className="w-[10%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
              <col className="w-[11%]" />
              <col className="w-[6%]" />
            </colgroup>
            <thead className="border-b border-slate-200 bg-slate-50/70 text-left">
              <tr>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Subcontractor</th>
                <th className="px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Primary Trade</th>
                <th className="px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Contact</th>
                <th className="px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Email</th>
                <th className="px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Phone</th>
                <th className="px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Status</th>
                <th className="px-1 py-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Rating</th>
                <th className="px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Response</th>
                <th className="px-6 py-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Last Invited</th>
                <th className="w-10 px-2 py-3 text-right text-xs font-bold uppercase tracking-[0.08em] text-slate-500" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-sm opacity-70">
                    Loading directory...
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center text-sm opacity-70">No companies found. Add your first company to start linking waiver records.</td></tr>
              ) : filteredCompanies.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center text-sm opacity-70">No companies match the current filters.</td></tr>
              ) : (
                filteredCompanies.map((company) => {
                  const tradeTitles = getTradeTitles(company.trade);
                  const primaryTrade = getPrimaryTradeLabel(company.trade);
                  const rating = getDirectoryRating(company);
                  const responseRate = getDirectoryResponseRate(company);
                  const responseTone = getResponseTone(responseRate);
                  const openCompanyDrawer = () => {
                    setDetailCompanyId(company.id);
                    setProjectPickerOpen(false);
                  };
                  return (
                    <tr
                      key={company.id}
                      role="button"
                      tabIndex={0}
                      onClick={openCompanyDrawer}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openCompanyDrawer();
                        }
                      }}
                      className="cursor-pointer border-b last:border-b-0 transition-colors hover:bg-black/[0.03]"
                    >
                      <td className="px-5 py-3 align-top">
                        <div className="truncate text-[15px] font-bold tracking-tight text-slate-950">{company.name}</div>
                        <div className="mt-3 flex flex-wrap gap-1">
                          {tradeTitles.slice(1, 3).map((trade) => (
                            <span
                              key={`${company.id}-${trade}`}
                              className="inline-flex max-w-full truncate rounded-full bg-[#EEF2FF] px-2.5 py-1 text-xs font-semibold text-[#356DFF]"
                            >
                              {trade}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-[14px] font-medium text-slate-900"><div className="whitespace-normal break-words">{primaryTrade}</div></td>
                      <td className="px-3 py-3 align-top text-[14px] font-medium text-slate-900"><div className="truncate">{company.primaryContact ?? "—"}</div></td>
                      <td className="px-3 py-3 align-top text-[14px] font-medium text-slate-500"><div className="truncate">{company.email ?? "—"}</div></td>
                      <td className="px-3 py-3 align-top text-[14px] font-medium text-slate-500"><div className="truncate">{company.phone ?? "—"}</div></td>
                      <td className="px-3 py-3 align-top">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                            company.isActive
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-50 text-slate-500"
                          }`}
                        >
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${company.isActive ? "bg-emerald-500" : "bg-slate-400"}`}
                          />
                          {company.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-1 py-3 align-top">
                        <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-900">
                          <span className="whitespace-normal text-amber-400">★★★★★</span>
                          <span>{rating}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="text-right text-sm font-bold text-slate-900">{responseRate}%</div>
                        <div className="mt-2 ml-auto h-1.5 w-20 rounded-full bg-slate-100">
                          <div className={`h-1.5 rounded-full ${responseTone}`} style={{ width: `${responseRate}%` }} />
                        </div>
                      </td>
                      <td className="px-6 py-3 align-top text-sm font-medium text-slate-500">
                        {new Date(company.lastUpdated).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td
                        className="px-4 py-3 align-top"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                aria-label={`More actions for ${company.name}`}
                              >
                                <Ellipsis className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="min-w-[220px] rounded-2xl border border-slate-200 bg-white p-1 shadow-soft-md"
                            >
                              <DropdownMenuItem
                                onClick={() => {
                                  openCompanyDrawer();
                                }}
                                className="h-11 cursor-pointer rounded-xl px-4 py-3 text-sm font-medium text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                              >
                                View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openEditModal(company)}
                                className="h-11 cursor-pointer rounded-xl px-4 py-3 text-sm font-medium text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setDetailCompanyId(company.id);
                                  setProjectPickerOpen(true);
                                }}
                                className="h-11 cursor-pointer rounded-xl px-4 py-3 text-sm font-medium text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                              >
                                Invite to Project
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openEditModal(company)}
                                className="h-11 cursor-pointer rounded-xl px-4 py-3 text-sm font-medium text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                              >
                                Add Contact
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="my-1 bg-slate-200" />
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    await updateCompanyRecord(company, { isActive: false });
                                    await fetchDirectory();
                                    showToast(`${company.name} archived.`, "success");
                                  } catch (err) {
                                    showToast(err instanceof Error ? err.message : "Failed to archive company.", "error");
                                  }
                                }}
                                className="h-11 cursor-pointer rounded-xl px-4 py-3 text-sm font-medium text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                              >
                                Archive
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    const nextNotes = company.notes?.includes("DO NOT USE")
                                      ? company.notes
                                      : [company.notes?.trim(), "DO NOT USE"].filter(Boolean).join("\n");
                                    await updateCompanyRecord(company, {
                                      isActive: false,
                                      notes: nextNotes || "DO NOT USE",
                                    });
                                    await fetchDirectory();
                                    showToast(`${company.name} marked do not use.`, "success");
                                  } catch (err) {
                                    showToast(err instanceof Error ? err.message : "Failed to mark company do not use.", "error");
                                  }
                                }}
                                className="h-11 cursor-pointer rounded-xl px-4 py-3 text-sm font-medium text-rose-600 data-[highlighted]:bg-rose-50 data-[highlighted]:text-rose-600"
                              >
                                Mark Do Not Use
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <CompanyFormModal
        open={modalOpen}
        title={editingCompanyId ? "Edit Company" : "Add Company"}
        draft={draft}
        costCodeOptions={costCodeOptions}
        loadingCostCodes={loadingCostCodes}
        costCodeError={costCodeError}
        error={formError}
        saving={savingCompany}
        onClose={() => setModalOpen(false)}
        onChange={setDraft}
        onSave={saveCompany}
      />

      {pendingRemovalCompany ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900">Remove from Subs Directory?</h3>
            <p className="mt-2 text-sm text-slate-600">
              {pendingRemovalCompany.name} will be removed from the directory.
              This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={removingCompany}
                onClick={() => setPendingRemovalCompany(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removingCompany}
                onClick={async () => {
                  setRemovingCompany(true);
                  const ok = await removeCompany(pendingRemovalCompany.id);
                  setRemovingCompany(false);
                  if (!ok) return;
                  setPendingRemovalCompany(null);
                }}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white disabled:bg-rose-300"
              >
                {removingCompany ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedCompany ? (
        <CompanyDetailPanel
          company={selectedCompany}
          tradeOptions={costCodeOptions
            .filter((code) => Boolean(code.title) && !code.code?.trim().startsWith("01"))
            .map((code) => code.title)
            .filter(Boolean)}
          assignedProjects={selectedCompanyProjects}
          allProjects={projects}
          projectPickerOpen={projectPickerOpen}
          onClose={() => {
            setDetailCompanyId(null);
            setProjectPickerOpen(false);
          }}
          onSaveCompanyInfo={async (updates) => {
            const previousCompanies = companies;
            setCompanies((current) =>
              current.map((company) =>
                company.id === selectedCompany.id
                  ? {
                      ...company,
                      name: updates.name,
                      trade: updates.trade ?? company.trade,
                      address: updates.address,
                      city: updates.city,
                      state: updates.state,
                      zip: updates.zip,
                      website: updates.website,
                      phone: updates.phone,
                      email: updates.email,
                      isActive: updates.isActive,
                    }
                  : company
              )
            );

            try {
              await updateCompanyRecord(selectedCompany, updates);
              await fetchDirectory();
              showToast("Company updated.", "success");
            } catch (error) {
              setCompanies(previousCompanies);
              throw error;
            }
          }}
          onAssignProject={async (projectId) => {
            await fetch("/api/directory/assignments", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId, companyId: selectedCompany.id }),
            });
            await fetchDirectory();
            setProjectPickerOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
