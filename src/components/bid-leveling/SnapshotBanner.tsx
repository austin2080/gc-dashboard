"use client";

type SnapshotBannerProps = {
  title: string;
  createdAt: string;
  onExit: () => void;
};

export default function SnapshotBanner({ title, createdAt, onExit }: SnapshotBannerProps) {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          Viewing Snapshot: <span className="font-semibold">{title}</span> created {new Date(createdAt).toLocaleString()}
        </div>
        <button
          type="button"
          onClick={onExit}
          className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900"
        >
          Exit snapshot view
        </button>
      </div>
    </section>
  );
}
