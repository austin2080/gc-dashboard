"use client";

import { useMemo, useState } from "react";
import {
  assignCompanyToProject,
  getDirectoryData,
  removeCompany,
  setCompanyActive,
  upsertCompany,
} from "@/lib/directory/local-store";
import { Company } from "@/lib/directory/types";
import CompanyFormModal from "@/components/directory/company-form-modal";
import CompanyDetailPanel from "@/components/directory/company-detail-panel";

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
  const [store, setStore] = useState(() => getDirectoryData());
  const companies = store.companies;
  const projects = store.projects;
  const relations = store.projectCompanies;

  const [query, setQuery] = useState("");
  const [tradeFilter, setTradeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CompanyDraft>(EMPTY_DRAFT);
  const [formError, setFormError] = useState("");

  const [detailCompanyId, setDetailCompanyId] = useState<string | null>(null);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);

  function refresh() {
    setStore(getDirectoryData());
  }

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

  function saveCompany() {
    if (!draft.companyName.trim()) {
      setFormError("Company name is required.");
      return;
    }

    upsertCompany({
      id: editingCompanyId ?? undefined,
      name: draft.companyName.trim(),
      trade: draft.trade.trim() || undefined,
      primaryContact: draft.primaryContact.trim() || undefined,
      email: draft.email.trim() || undefined,
      phone: draft.phone.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      isActive: draft.isActive,
    });

    setModalOpen(false);
    refresh();
  }

  const selectedCompany = companies.find((company) => company.id === detailCompanyId) ?? null;
  const selectedCompanyProjects = useMemo(() => {
    if (!selectedCompany) return [];
    const projectIds = relations
      .filter((entry) => entry.companyId === selectedCompany.id)
      .map((entry) => entry.projectId);
    return projects.filter((project) => projectIds.includes(project.id));
  }, [projects, relations, selectedCompany]);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
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
          <button onClick={openAddModal} className="rounded border border-black bg-black px-4 py-2 text-sm text-white">Add Company</button>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-black/5 text-left">
              <tr>
                <th className="p-3">Company Name</th><th className="p-3">Trade</th><th className="p-3">Primary Contact</th><th className="p-3">Email</th><th className="p-3">Phone</th><th className="p-3">Status</th><th className="p-3">Projects</th><th className="p-3">Last Updated</th><th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-sm opacity-70">No companies found. Add your first company to start linking waiver records.</td></tr>
              ) : (
                filteredCompanies.map((company) => {
                  const projectCount = relations.filter((entry) => entry.companyId === company.id).length;
                  return (
                    <tr key={company.id} className="border-b last:border-b-0">
                      <td className="p-3 font-medium">{company.name}</td><td className="p-3">{company.trade ?? "-"}</td><td className="p-3">{company.primaryContact ?? "-"}</td><td className="p-3">{company.email ?? "-"}</td><td className="p-3">{company.phone ?? "-"}</td>
                      <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs ${company.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>{company.isActive ? "Active" : "Inactive"}</span></td>
                      <td className="p-3">{projectCount}</td><td className="p-3">{new Date(company.lastUpdated).toLocaleDateString()}</td>
                      <td className="p-3"><div className="flex justify-end gap-2 text-xs"><button onClick={() => setDetailCompanyId(company.id)} className="underline">View</button><button onClick={() => openEditModal(company)} className="underline">Edit</button><button onClick={() => { setCompanyActive(company.id, !company.isActive); refresh(); }} className="underline">{company.isActive ? "Deactivate" : "Activate"}</button><button onClick={() => { removeCompany(company.id); if (detailCompanyId === company.id) setDetailCompanyId(null); refresh(); }} className="underline text-red-600">Remove</button></div></td>
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
        onAssignProject={(projectId) => {
          if (!selectedCompany) return;
          assignCompanyToProject(projectId, selectedCompany.id);
          refresh();
          setProjectPickerOpen(false);
        }}
      />
    </div>
  );
}
