"use client";

import { Company, ProjectDirectoryEntry } from "@/lib/directory/types";

type Props = {
  company: Company | null;
  assignedProjects: ProjectDirectoryEntry[];
  allProjects: ProjectDirectoryEntry[];
  projectPickerOpen: boolean;
  onClose: () => void;
  onOpenProjectPicker: () => void;
  onAssignProject: (projectId: string) => void;
};

export default function CompanyDetailPanel({ company, assignedProjects, allProjects, projectPickerOpen, onClose, onOpenProjectPicker, onAssignProject }: Props) {
  if (!company) return null;
  const addressParts = [company.address, company.city, company.state, company.zip, company.country].filter(Boolean);
  const addressLabel = addressParts.length > 0 ? addressParts.join(", ") : "-";

  return (
    <section className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{company.name}</h2>
          <p className="text-sm opacity-70">Company detail view for waiver directory records.</p>
        </div>
        <button className="text-sm underline" onClick={onClose}>Close</button>
      </div>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div><span className="opacity-60">Trade:</span> {company.trade ?? "-"}</div>
        <div><span className="opacity-60">Primary contact:</span> {company.primaryContact ?? "-"}</div>
        <div><span className="opacity-60">Email:</span> {company.email ?? "-"}</div>
        <div><span className="opacity-60">Phone:</span> {company.phone ?? "-"}</div>
        <div><span className="opacity-60">Approved vendor:</span> {company.approvedVendor ? "Yes" : "No"}</div>
        <div className="md:col-span-2"><span className="opacity-60">Address:</span> {addressLabel}</div>
        <div><span className="opacity-60">Website:</span> {company.website ?? "-"}</div>
        <div><span className="opacity-60">Vendor type:</span> {company.vendorType ?? "-"}</div>
        <div><span className="opacity-60">License #:</span> {company.licenseNumber ?? "-"}</div>
        <div><span className="opacity-60">Tax ID:</span> {company.taxId ?? "-"}</div>
        <div><span className="opacity-60">Procore ID:</span> {company.procoreCompanyId ?? "-"}</div>
        <div className="md:col-span-2"><span className="opacity-60">Notes:</span> {company.notes ?? "-"}</div>
      </div>

      <div className="mt-4 rounded border p-3 text-sm">
        <div className="font-medium">Projects assigned</div>
        {assignedProjects.length === 0 ? <div className="mt-2 opacity-70">Not assigned to any projects yet.</div> : <ul className="mt-2 list-disc pl-5">{assignedProjects.map((project) => <li key={project.id}>{project.name}</li>)}</ul>}
      </div>

      <div className="mt-4 rounded border p-3 text-sm">
        <div className="font-medium">Recent waivers summary</div>
        <div className="mt-2 opacity-80">Pending: {company.waiverSummary?.pending ?? 0} · Requested: {company.waiverSummary?.requested ?? 0} · Received: {company.waiverSummary?.received ?? 0} · Approved: {company.waiverSummary?.approved ?? 0}</div>
      </div>

      <div className="mt-4"><button className="rounded border px-3 py-2 text-sm" onClick={onOpenProjectPicker}>Assign to Project</button></div>
      {projectPickerOpen ? <div className="mt-3 rounded border p-3 text-sm"><div className="mb-2 font-medium">Select a project</div><div className="flex flex-wrap gap-2">{allProjects.map((project) => <button key={project.id} className="rounded border px-3 py-1" onClick={() => onAssignProject(project.id)}>{project.name}</button>)}</div></div> : null}
    </section>
  );
}
