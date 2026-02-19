"use client";

import { useState } from "react";
import type { SubProfileCompany } from "@/components/directory/sub-profile/types";

type EditDraft = {
  company_name: string;
  trade: string;
  primary_contact: string;
  email: string;
  phone: string;
  status: "Active" | "Inactive";
  notes: string;
};

type Props = {
  open: boolean;
  company: SubProfileCompany | null;
  error: string;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: EditDraft) => void;
};

export type { EditDraft };

const EMPTY_DRAFT: EditDraft = {
  company_name: "",
  trade: "",
  primary_contact: "",
  email: "",
  phone: "",
  status: "Active",
  notes: "",
};

function toDraft(company: SubProfileCompany | null): EditDraft {
  if (!company) return EMPTY_DRAFT;
  return {
    company_name: company.company_name ?? "",
    trade: company.trade ?? "",
    primary_contact: company.primary_contact ?? "",
    email: company.email ?? "",
    phone: company.phone ?? "",
    status: company.status,
    notes: company.notes ?? "",
  };
}

export default function EditSubModal({ open, company, error, saving, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<EditDraft>(() => toDraft(company));

  if (!open || !company) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-black/10 bg-white p-5">
        <h2 className="text-xl font-semibold">Edit Sub</h2>
        <p className="mt-1 text-sm text-black/60">Update subcontractor details used across BuilderOS workflows.</p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm text-black/70">Company Name</span>
            <input
              value={draft.company_name}
              onChange={(event) => setDraft((prev) => ({ ...prev, company_name: event.target.value }))}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm text-black/70">Trade</span>
            <input
              value={draft.trade}
              onChange={(event) => setDraft((prev) => ({ ...prev, trade: event.target.value }))}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm text-black/70">Status</span>
            <select
              value={draft.status}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, status: event.target.value as "Active" | "Inactive" }))
              }
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm text-black/70">Primary Contact</span>
            <input
              value={draft.primary_contact}
              onChange={(event) => setDraft((prev) => ({ ...prev, primary_contact: event.target.value }))}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm text-black/70">Email</span>
            <input
              type="email"
              value={draft.email}
              onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm text-black/70">Phone</span>
            <input
              value={draft.phone}
              onChange={(event) => setDraft((prev) => ({ ...prev, phone: event.target.value }))}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm text-black/70">Notes</span>
            <textarea
              rows={4}
              value={draft.notes}
              onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
            />
          </label>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-black/15 px-3 py-2 text-sm disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(draft)}
            className="rounded-lg border border-black bg-black px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
