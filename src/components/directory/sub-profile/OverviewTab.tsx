"use client";

import Link from "next/link";
import type { SubAssignment, SubNote, SubProfileCompany } from "@/components/directory/sub-profile/types";

type Props = {
  company: SubProfileCompany;
  assignments: SubAssignment[];
  assignmentsSource: "directory_company_projects" | "company_projects" | "none";
  notes: SubNote[];
  notesSource: "company_notes" | "companies";
  noteInput: string;
  notesDraft: string;
  addingNote: boolean;
  savingNotes: boolean;
  onNoteInputChange: (value: string) => void;
  onNotesDraftChange: (value: string) => void;
  onAddNote: () => void;
  onSaveCompanyNotes: () => void;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleString();
}

function buildAddress(company: SubProfileCompany) {
  const lines = [company.address, company.city, company.state, company.zip, company.country].filter(Boolean);
  return lines.length > 0 ? lines.join(", ") : "Not set";
}

export default function OverviewTab({
  company,
  assignments,
  assignmentsSource,
  notes,
  notesSource,
  noteInput,
  notesDraft,
  addingNote,
  savingNotes,
  onNoteInputChange,
  onNotesDraftChange,
  onAddNote,
  onSaveCompanyNotes,
}: Props) {
  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-black/10 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-black/60">Total projects assigned</p>
          <p className="mt-2 text-2xl font-semibold">{assignments.length}</p>
        </article>
        <article className="rounded-xl border border-black/10 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-black/60">Waivers outstanding</p>
          <p className="mt-2 text-2xl font-semibold" title="Waiver integration coming soon">
            0
          </p>
        </article>
        <article className="rounded-xl border border-black/10 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-black/60">Last contacted</p>
          <p className="mt-2 text-sm font-medium">{formatDate(company.last_contacted)}</p>
        </article>
        <article className="rounded-xl border border-black/10 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-black/60">Last updated</p>
          <p className="mt-2 text-sm font-medium">{formatDate(company.updated_at)}</p>
        </article>
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Contacts</h2>
          <button type="button" disabled className="rounded-lg border border-black/10 px-3 py-1.5 text-sm text-black/40">
            Add secondary contact (coming soon)
          </button>
        </div>
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-black/60">Primary Contact</p>
            <p className="mt-1 font-medium">{company.primary_contact ?? "Not set"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-black/60">Email</p>
            {company.email ? (
              <a href={`mailto:${company.email}`} className="mt-1 inline-block font-medium text-blue-700 hover:underline">
                {company.email}
              </a>
            ) : (
              <p className="mt-1 font-medium">Not set</p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-black/60">Phone</p>
            {company.phone ? (
              <a href={`tel:${company.phone}`} className="mt-1 inline-block font-medium text-blue-700 hover:underline">
                {company.phone}
              </a>
            ) : (
              <p className="mt-1 font-medium">Not set</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-4">
        <h2 className="text-base font-semibold">Company Info</h2>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-black/60">Trade</p>
            <p className="mt-1 font-medium">{company.trade ?? "Not set"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-black/60">Address</p>
            <p className="mt-1 font-medium">{buildAddress(company)}</p>
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-black/60">Notes</p>
              <button
                type="button"
                onClick={onSaveCompanyNotes}
                disabled={savingNotes}
                className="rounded-md border border-black/15 px-3 py-1 text-xs disabled:opacity-60"
              >
                {savingNotes ? "Saving..." : "Save Notes"}
              </button>
            </div>
            <textarea
              rows={4}
              value={notesDraft}
              onChange={(event) => onNotesDraftChange(event.target.value)}
              className="w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Assigned Projects</h2>
          <button type="button" disabled className="rounded-lg border border-black/10 px-3 py-1.5 text-sm text-black/40">
            Assign to Project (coming soon)
          </button>
        </div>
        {assignmentsSource === "none" ? (
          <div className="rounded-lg border border-dashed border-black/20 p-8 text-center text-sm text-black/60">
            Assignments are coming soon.
          </div>
        ) : assignments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-black/20 p-8 text-center text-sm text-black/60">
            No project assignments yet.
          </div>
        ) : (
          <div className="overflow-auto rounded-lg border border-black/10">
            <table className="w-full text-sm">
              <thead className="border-b bg-black/[0.03] text-left">
                <tr>
                  <th className="p-3">Project</th>
                  <th className="p-3">City</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Last Activity</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((project) => (
                  <tr key={project.project_id} className="border-b last:border-b-0">
                    <td className="p-3">{project.project_name}</td>
                    <td className="p-3">{project.city ?? "-"}</td>
                    <td className="p-3">{project.status ?? "-"}</td>
                    <td className="p-3">{formatDate(project.last_activity)}</td>
                    <td className="p-3 text-right">
                      <Link href={`/projects/${project.project_id}`} className="text-xs underline">
                        View project
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-4">
        <h2 className="text-base font-semibold">Internal Notes / Follow-ups</h2>
        <p className="mt-1 text-sm text-black/60">
          {notesSource === "company_notes"
            ? "Saved as individual note entries."
            : "Using single company notes field until company_notes table is available."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={noteInput}
            onChange={(event) => onNoteInputChange(event.target.value)}
            placeholder="Add a follow-up note"
            className="min-w-[240px] flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={onAddNote}
            disabled={addingNote}
            className="rounded-lg border border-black bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {addingNote ? "Adding..." : "Add"}
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {notes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-black/20 p-4 text-sm text-black/60">No notes yet.</div>
          ) : (
            notes.map((note) => (
              <article key={note.id} className="rounded-lg border border-black/10 p-3">
                <p className="text-sm">{note.note}</p>
                <p className="mt-1 text-xs text-black/50">{formatDate(note.created_at)}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
