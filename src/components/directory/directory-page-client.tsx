"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Company, ProjectCompany, ProjectDirectoryEntry } from "@/lib/directory/types";
import CompanyFormModal from "@/components/directory/company-form-modal";
import CompanyDetailPanel from "@/components/directory/company-detail-panel";
import { listCompanyCostCodesForCurrentCompany, type CompanyCostCode } from "@/lib/bidding/store";

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
      if (!modalOpen) return;
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
  }, [modalOpen]);

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
      return matchesQuery && matchesTrade && matchesStatus;
    });
  }, [companies, query, tradeFilter, statusFilter]);

  const directoryStats = useMemo(() => {
    const activeCount = companies.filter((company) => company.isActive).length;
    const inactiveCount = companies.length - activeCount;
    const assignedCount = new Set(relations.map((relation) => relation.companyId)).size;
    return {
      total: companies.length,
      active: activeCount,
      inactive: inactiveCount,
      assigned: assignedCount,
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
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-lg border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-black/60">Total subs</p>
          <p className="mt-2 text-2xl font-semibold">{directoryStats.total}</p>
        </article>
        <article className="rounded-lg border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-black/60">Active</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">{directoryStats.active}</p>
        </article>
        <article className="rounded-lg border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-black/60">Inactive</p>
          <p className="mt-2 text-2xl font-semibold text-slate-600">{directoryStats.inactive}</p>
        </article>
        <article className="rounded-lg border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-black/60">Assigned to projects</p>
          <p className="mt-2 text-2xl font-semibold">{directoryStats.assigned}</p>
        </article>
      </section>

      <section className="rounded-lg border">
        <div className="space-y-4 border-b p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Sub Directory</h2>
              <p className="text-sm text-black/70">Search, filter by trade, and jump into subcontractor profiles.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={openAddModal} className="rounded border border-black bg-black px-4 py-2 text-sm text-white">
                Add New Sub
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded border px-4 py-2 text-sm"
                disabled={importing}
              >
                {importing ? "Importing..." : "Import CSV"}
              </button>
              <button
                onClick={() => downloadCsv("directory-export.csv", buildCsv(companies))}
                className="rounded border px-4 py-2 text-sm"
                disabled={companies.length === 0}
              >
                Export CSV
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input className="min-w-[220px] flex-1 rounded border border-black/20 px-3 py-2 text-sm" placeholder="Search company, contact, or email" value={query} onChange={(event) => setQuery(event.target.value)} />
            <select className="rounded border border-black/20 px-3 py-2 text-sm" value={tradeFilter} onChange={(event) => setTradeFilter(event.target.value)}>
            <option value="all">All trades</option>
            {tradeOptions.map((trade) => (
              <option key={trade} value={trade}>
                {trade}
              </option>
            ))}
          </select>
          <select className="rounded border border-black/20 px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button
            onClick={() => downloadCsv("directory-template.csv", buildCsv([]))}
            className="rounded border px-4 py-2 text-sm"
          >
            Download Template
          </button>
          <p className="ml-auto text-xs text-black/60">{filteredCompanies.length} result(s)</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => handleImport(event.target.files?.[0])}
          />
        </div>
        </div>
        {toast ? (
          <div className={`border-b px-4 py-2 text-sm ${toast.type === "error" ? "text-red-600" : "text-emerald-700"}`}>
            {toast.message}
          </div>
        ) : null}
        {error ? <div className="border-b px-4 py-2 text-sm text-red-600">{error}</div> : null}
        {importError ? <div className="border-b px-4 py-2 text-sm text-red-600">{importError}</div> : null}

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-black/5 text-left">
              <tr>
                <th className="p-3">Company Name</th><th className="p-3">Trade</th><th className="p-3">Primary Contact</th><th className="p-3">Email</th><th className="p-3">Phone</th><th className="p-3">Projects</th><th className="p-3">Last Updated</th><th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-sm opacity-70">
                    Loading directory...
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-sm opacity-70">No companies found. Add your first company to start linking waiver records.</td></tr>
              ) : filteredCompanies.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-sm opacity-70">No companies match the current filters.</td></tr>
              ) : (
                filteredCompanies.map((company) => {
                  const projectCount = relations.filter((entry) => entry.companyId === company.id).length;
                  return (
                    <tr key={company.id} className="border-b last:border-b-0 transition-colors hover:bg-black/[0.03]">
                      <td className="p-3 font-medium">
                        <Link href={`/directory/${company.id}`} className="block underline-offset-2 hover:underline">
                          {company.name}
                        </Link>
                        {company.vendorType === "Approved Vendor" ? (
                          <span className="mt-1 inline-flex rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-semibold text-emerald-800">
                            Approved Vendor
                          </span>
                        ) : null}
                        {company.vendorType === "Bidding Only" ? (
                          <span className="mt-1 inline-flex rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-800">
                            Bidding Only
                          </span>
                        ) : null}
                      </td><td className="p-3">{company.trade ?? "-"}</td><td className="p-3">{company.primaryContact ?? "-"}</td><td className="p-3">{company.email ?? "-"}</td><td className="p-3">{company.phone ?? "-"}</td>
                      <td className="p-3">{projectCount}</td><td className="p-3">{new Date(company.lastUpdated).toLocaleDateString()}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2 text-xs">
                          <button onClick={() => setDetailCompanyId(company.id)} className="underline">View</button>
                          <button onClick={() => openEditModal(company)} className="underline">Edit</button>
                          <button
                            onClick={async () => {
                              await fetch(`/api/directory/companies${projectId ? `?project=${encodeURIComponent(projectId)}` : ""}`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  projectId: projectId ?? undefined,
                                  companies: [
                                    {
                                      id: company.id,
                                      name: company.name,
                                      trade: company.trade,
                                      contactTitle: company.contactTitle,
                                      contact_title: company.contactTitle,
                                      primaryContact: company.primaryContact,
                                      email: company.email,
                                      phone: company.phone,
                                      officePhone: company.officePhone,
                                      office_phone: company.officePhone,
                                      notes: company.notes,
                                      isActive: !company.isActive,
                                    },
                                  ],
                                }),
                              });
                              await fetchDirectory();
                            }}
                            className="underline"
                          >
                            {company.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => {
                              setPendingRemovalCompany({ id: company.id, name: company.name });
                            }}
                            className="underline text-red-600"
                          >
                            Remove
                          </button>
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

      <CompanyDetailPanel
        company={selectedCompany}
        assignedProjects={selectedCompanyProjects}
        allProjects={projects}
        projectPickerOpen={projectPickerOpen}
        onClose={() => setDetailCompanyId(null)}
        onOpenProjectPicker={() => setProjectPickerOpen(true)}
        onAssignProject={async (projectId) => {
          if (!selectedCompany) return;
          await fetch("/api/directory/assignments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId, companyId: selectedCompany.id }),
          });
          await fetchDirectory();
          setProjectPickerOpen(false);
        }}
      />
    </div>
  );
}
