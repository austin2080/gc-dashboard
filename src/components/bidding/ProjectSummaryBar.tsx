"use client";

type ProjectSummaryBarProps = {
  projectName: string;
  clientName: string;
  city: string;
  bidAmount: number | null;
  dueDate: string | null;
  coveragePct: number;
  tradesThin: number;
  awaitingResponses: number;
  onInviteSubs: () => void;
  onExport: () => void;
  onArchive: () => void;
};

function formatCurrency(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatDueDate(value: string | null) {
  if (!value) return "--";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ProjectSummaryBar({
  projectName,
  clientName,
  city,
  bidAmount,
  dueDate,
  coveragePct,
  tradesThin,
  awaitingResponses,
  onInviteSubs,
  onExport,
  onArchive,
}: ProjectSummaryBarProps) {
  return (
    <section className="sticky top-[8.75rem] z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur sm:top-[9.5rem] sm:p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{projectName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>Client: {clientName || "--"}</span>
            <span>City: {city || "--"}</span>
            <span>Bid Amount: {formatCurrency(bidAmount)}</span>
            <span>Due: {formatDueDate(dueDate)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">Coverage {coveragePct}%</span>
          <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Trades Thin {tradesThin}</span>
          <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">Awaiting {awaitingResponses}</span>
          <button
            type="button"
            onClick={onInviteSubs}
            className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            Invite Subs
          </button>
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Export
          </button>
          <button
            type="button"
            onClick={onArchive}
            className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
          >
            Archive
          </button>
        </div>
      </div>
    </section>
  );
}
