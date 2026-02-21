"use client";

type LevelingFilterBarProps = {
  search: string;
  statusFilter: "all" | "missing" | "lt2" | "submitted";
  riskOnly: boolean;
  sortBy: "division" | "alphabetic" | "risk" | "due_soon";
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: "all" | "missing" | "lt2" | "submitted") => void;
  onRiskOnlyChange: (value: boolean) => void;
  onSortByChange: (value: "division" | "alphabetic" | "risk" | "due_soon") => void;
};

export default function LevelingFilterBar({
  search,
  statusFilter,
  riskOnly,
  sortBy,
  onSearchChange,
  onStatusFilterChange,
  onRiskOnlyChange,
  onSortByChange,
}: LevelingFilterBarProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="grid gap-3 md:grid-cols-4">
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search trades"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value as LevelingFilterBarProps["statusFilter"])}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="missing">Missing bids</option>
          <option value="lt2">Less than 2 submitted</option>
          <option value="submitted">Submitted only</option>
        </select>
        <select
          value={sortBy}
          onChange={(event) => onSortByChange(event.target.value as LevelingFilterBarProps["sortBy"])}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
        >
          <option value="division">Sort: division</option>
          <option value="alphabetic">Sort: alphabetic</option>
          <option value="risk">Sort: risk</option>
          <option value="due_soon">Sort: due soon</option>
        </select>
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
          <input type="checkbox" checked={riskOnly} onChange={(event) => onRiskOnlyChange(event.target.checked)} />
          Show only trades with risk
        </label>
      </div>
    </section>
  );
}
