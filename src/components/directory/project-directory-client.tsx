"use client";

import { useMemo, useState } from "react";
import { assignCompanyToProject, getDirectoryData, upsertCompany } from "@/lib/directory/local-store";
import { Company } from "@/lib/directory/types";

export default function ProjectDirectoryClient({ projectId }: { projectId: string }) {
  const [store, setStore] = useState(() => getDirectoryData());
  const [newCompany, setNewCompany] = useState("");

  const companies = store.companies;
  const projectCompanies = store.projectCompanies
    .filter((entry) => entry.projectId === projectId)
    .map((entry) => entry.companyId);

  function refresh() {
    setStore(getDirectoryData());
  }

  const assigned = useMemo(
    () => companies.filter((company) => projectCompanies.includes(company.id)),
    [companies, projectCompanies]
  );

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="font-semibold">Contractors for this Project</h2>
        <p className="text-sm opacity-70">Select from Directory records or create a new company.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {companies.map((company) => (
          <button
            key={company.id}
            className="rounded border px-3 py-1 text-sm"
            onClick={() => {
              assignCompanyToProject(projectId, company.id);
              refresh();
            }}
          >
            {company.name}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2 text-sm"
          placeholder="Create and assign new company"
          value={newCompany}
          onChange={(event) => setNewCompany(event.target.value)}
        />
        <button
          className="rounded border border-black bg-black px-3 py-2 text-sm text-white"
          onClick={() => {
            if (!newCompany.trim()) return;
            const company = upsertCompany({ name: newCompany.trim(), isActive: true });
            assignCompanyToProject(projectId, company.id);
            setNewCompany("");
            refresh();
          }}
        >
          Add
        </button>
      </div>

      <div className="overflow-auto rounded border">
        <table className="w-full text-sm">
          <thead className="border-b bg-black/5">
            <tr>
              <th className="p-3 text-left">Assigned Company</th>
              <th className="p-3 text-left">Trade</th>
              <th className="p-3 text-left">Contact</th>
              <th className="p-3 text-left">Email</th>
            </tr>
          </thead>
          <tbody>
            {assigned.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 opacity-70">
                  No contractors assigned yet.
                </td>
              </tr>
            ) : (
              assigned.map((company: Company) => (
                <tr key={company.id} className="border-b last:border-b-0">
                  <td className="p-3">{company.name}</td>
                  <td className="p-3">{company.trade ?? "-"}</td>
                  <td className="p-3">{company.primaryContact ?? "-"}</td>
                  <td className="p-3">{company.email ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
