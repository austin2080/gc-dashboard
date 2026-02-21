"use client";

type SnapshotModalProps = {
  open: boolean;
  title: string;
  notes: string;
  saving: boolean;
  onClose: () => void;
  onChangeTitle: (value: string) => void;
  onChangeNotes: (value: string) => void;
  onSave: () => void;
};

export default function SnapshotModal({
  open,
  title,
  notes,
  saving,
  onClose,
  onChangeTitle,
  onChangeNotes,
  onSave,
}: SnapshotModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-slate-950/40" onClick={onClose} aria-label="Close snapshot modal" />
      <div className="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <h2 className="text-xl font-semibold text-slate-900">Create Snapshot</h2>
        <p className="mt-1 text-sm text-slate-600">Capture a locked leveling state for reporting.</p>
        <div className="mt-4 space-y-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Snapshot title
            <input
              value={title}
              onChange={(event) => onChangeTitle(event.target.value)}
              placeholder="Bid leveling - GMP review"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Notes (optional)
            <textarea
              value={notes}
              onChange={(event) => onChangeNotes(event.target.value)}
              rows={3}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !title.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? "Creating..." : "Create Snapshot"}
          </button>
        </div>
      </div>
    </div>
  );
}
