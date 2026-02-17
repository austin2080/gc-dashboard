"use client";

type SelectorStatus = "Healthy" | "At Risk" | "Critical";

export type ActiveBidProject = {
  id: string;
  projectName: string;
  dueInDays: number;
  coveragePct: number;
  status: SelectorStatus;
};

type ActiveBidSelectorProps = {
  projects: ActiveBidProject[];
  selectedProjectId: string;
  onSelect: (projectId: string) => void;
  onViewAll?: () => void;
};

const STATUS_STYLES: Record<SelectorStatus, string> = {
  Healthy: "bg-emerald-100 text-emerald-700",
  "At Risk": "bg-amber-100 text-amber-700",
  Critical: "bg-rose-100 text-rose-700",
};

function dueLabel(dueInDays: number) {
  if (!Number.isFinite(dueInDays)) return "No due date";
  if (dueInDays < 0) return "Past due";
  if (dueInDays === 0) return "Due today";
  if (dueInDays === 1) return "Due in 1 day";
  return `Due in ${dueInDays} days`;
}

export default function ActiveBidSelector({ projects, selectedProjectId, onSelect, onViewAll }: ActiveBidSelectorProps) {
  if (!projects.length) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Active Bid Selector</h3>
        {onViewAll ? (
          <button type="button" onClick={onViewAll} className="text-xs font-medium text-slate-500 hover:text-slate-700">
            View all
          </button>
        ) : null}
      </div>

      <div className="relative">
        <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1">
          {projects.map((project) => {
            const selected = selectedProjectId === project.id;
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => onSelect(project.id)}
                className={`min-w-64 rounded-xl border p-3 text-left transition ${
                  selected
                    ? "border-slate-300 bg-white shadow-sm ring-1 ring-slate-200"
                    : "border-slate-200 bg-white/90 hover:border-slate-300 hover:bg-white"
                }`}
              >
                <p className="truncate text-sm font-semibold text-slate-900">{project.projectName}</p>
                <p className="mt-1 text-xs text-slate-500">{dueLabel(project.dueInDays)}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Coverage</span>
                  <span className="font-semibold text-slate-700">{project.coveragePct}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-200">
                  <div className="h-1.5 rounded-full bg-slate-700" style={{ width: `${project.coveragePct}%` }} />
                </div>
                <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[project.status]}`}>
                  {project.status}
                </span>
              </button>
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-slate-50 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-slate-50 to-transparent" />
      </div>
    </section>
  );
}
