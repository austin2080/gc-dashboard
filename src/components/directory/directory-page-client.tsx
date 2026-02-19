"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Company } from "@/lib/directory/types";
import CompanyFormModal from "@/components/directory/company-form-modal";
import CompanyDetailPanel from "@/components/directory/company-detail-panel";
import { useDirectoryData } from "@/components/directory/use-directory-data";

type CompanyDraft = {
  companyName: string;
  trade: string;
  primaryContact: string;
  email: string;
  phone: string;
  notes: string;
  isActive: boolean;
};

const EMPTY_DRAFT: CompanyDraft = {
  companyName: "",
  trade: "",
  primaryContact: "",
  email: "",
  phone: "",
  notes: "",
  isActive: true,
};

function toDraft(company?: Company): CompanyDraft {
  if (!company) return EMPTY_DRAFT;
  return {
    companyName: company.name,
    trade: company.trade ?? "",
    primaryContact: company.primaryContact ?? "",
    email: company.email ?? "",
    phone: company.phone ?? "",
    notes: company.notes ?? "",
    isActive: company.isActive,
  };
}

export default function DirectoryPageClient() {
  const searchParams = useSearchParams();
  const [storedProjectId, setStoredProjectId] = useState<string | null>(null);
  const queryProjectId = searchParams.get("project");
  const projectId = queryProjectId ?? storedProjectId;
  const { data, loading, error, refresh } = useDirectoryData();
  const companies = useMemo(() => data?.companies ?? [], [data?.companies]);
  const projects = useMemo(() => data?.projects ?? [], [data?.projects]);
  const relations = useMemo(() => data?.projectCompanies ?? [], [data?.projectCompanies]);

  const [query, setQuery] = useState("");
  const [tradeFilter, setTradeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CompanyDraft>(EMPTY_DRAFT);
  const [formError, setFormError] = useState("");

  const [detailCompanyId, setDetailCompanyId] = useState<string | null>(null);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);

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
    if (!draft.companyName.trim()) {
      setFormError("Company name is required.");
      return;
    }
    setFormError("");
    const payload = {
      projectId: projectId ?? undefined,
      companies: [
        {
          id: editingCompanyId ?? undefined,
          name: draft.companyName.trim(),
          trade: draft.trade.trim() || undefined,
          primaryContact: draft.primaryContact.trim() || undefined,
          email: draft.email.trim() || undefined,
          phone: draft.phone.trim() || undefined,
          notes: draft.notes.trim() || undefined,
          isActive: draft.isActive,
        },
      ],
    };

    const res = await fetch(`/api/directory/companies${projectId ? `?project=${encodeURIComponent(projectId)}` : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setFormError(payload?.error ?? "Failed to save company.");
      return;
    }

    setModalOpen(false);
    await refresh();
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
          primaryContact: row.primary_contact || row.primarycontact || row.contact || "",
          email: row.email || "",
          phone: row.phone || "",
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

      await refresh();
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
      "primary_contact",
      "email",
      "phone",
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
      company.primaryContact ?? "",
      company.email ?? "",
      company.phone ?? "",
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
        {error ? <div className="border-b px-4 py-2 text-sm text-red-600">{error}</div> : null}
        {importError ? <div className="border-b px-4 py-2 text-sm text-red-600">{importError}</div> : null}

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-black/5 text-left">
              <tr>
                <th className="p-3">Company Name</th><th className="p-3">Trade</th><th className="p-3">Primary Contact</th><th className="p-3">Email</th><th className="p-3">Phone</th><th className="p-3">Status</th><th className="p-3">Projects</th><th className="p-3">Last Updated</th><th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-sm opacity-70">
                    Loading directory...
                  </td>
                </tr>
              ) : filteredCompanies.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-sm opacity-70">No companies found. Add your first company to start linking waiver records.</td></tr>
              ) : (
                filteredCompanies.map((company) => {
                  const projectCount = relations.filter((entry) => entry.companyId === company.id).length;
                  return (
                    <tr key={company.id} className="border-b last:border-b-0 transition-colors hover:bg-black/[0.03]">
                      <td className="p-3 font-medium">
                        <Link href={`/directory/${company.id}`} className="block underline-offset-2 hover:underline">
                          {company.name}
                        </Link>
                      </td><td className="p-3">{company.trade ?? "-"}</td><td className="p-3">{company.primaryContact ?? "-"}</td><td className="p-3">{company.email ?? "-"}</td><td className="p-3">{company.phone ?? "-"}</td>
                      <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs ${company.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>{company.isActive ? "Active" : "Inactive"}</span></td>
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
                                      primaryContact: company.primaryContact,
                                      email: company.email,
                                      phone: company.phone,
                                      notes: company.notes,
                                      isActive: !company.isActive,
                                    },
                                  ],
                                }),
                              });
                              await refresh();
                            }}
                            className="underline"
                          >
                            {company.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={async () => {
                              await fetch(`/api/directory/companies/${company.id}`, { method: "DELETE" });
                              if (detailCompanyId === company.id) setDetailCompanyId(null);
                              await refresh();
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
        error={formError}
        onClose={() => setModalOpen(false)}
        onChange={setDraft}
        onSave={saveCompany}
      />

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
          await refresh();
          setProjectPickerOpen(false);
        }}
      />
    </div>
  );
}
