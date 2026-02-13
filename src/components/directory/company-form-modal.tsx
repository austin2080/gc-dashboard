"use client";

type CompanyDraft = {
  companyName: string;
  trade: string;
  primaryContact: string;
  email: string;
  phone: string;
  notes: string;
  isActive: boolean;
  approvedVendor: boolean;
};

type Props = {
  open: boolean;
  title: string;
  draft: CompanyDraft;
  error?: string;
  onClose: () => void;
  onChange: (draft: CompanyDraft) => void;
  onSave: () => void;
};

export default function CompanyFormModal({ open, title, draft, error, onClose, onChange, onSave }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm opacity-70">Manual directory entry for waiver tracking workflows.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <label className="md:col-span-2"><div className="mb-1 opacity-70">Company name *</div><input className="w-full rounded border px-3 py-2" value={draft.companyName} onChange={(event) => onChange({ ...draft, companyName: event.target.value })} /></label>
          <label><div className="mb-1 opacity-70">Trade</div><input className="w-full rounded border px-3 py-2" value={draft.trade} onChange={(event) => onChange({ ...draft, trade: event.target.value })} /></label>
          <label><div className="mb-1 opacity-70">Primary contact name</div><input className="w-full rounded border px-3 py-2" value={draft.primaryContact} onChange={(event) => onChange({ ...draft, primaryContact: event.target.value })} /></label>
          <label><div className="mb-1 opacity-70">Email</div><input className="w-full rounded border px-3 py-2" value={draft.email} onChange={(event) => onChange({ ...draft, email: event.target.value })} /></label>
          <label><div className="mb-1 opacity-70">Phone</div><input className="w-full rounded border px-3 py-2" value={draft.phone} onChange={(event) => onChange({ ...draft, phone: event.target.value })} /></label>
          <label className="md:col-span-2"><div className="mb-1 opacity-70">Notes</div><textarea className="w-full rounded border px-3 py-2" rows={3} value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} /></label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.isActive} onChange={(event) => onChange({ ...draft, isActive: event.target.checked })} />Active</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.approvedVendor} onChange={(event) => onChange({ ...draft, approvedVendor: event.target.checked })} />Approved Vendor</label>
        </div>
        {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded border px-3 py-2 text-sm" onClick={onClose}>Cancel</button>
          <button className="rounded border border-black bg-black px-3 py-2 text-sm text-white" onClick={onSave}>Save Company</button>
        </div>
      </div>
    </div>
  );
}
