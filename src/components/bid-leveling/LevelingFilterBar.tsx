"use client";

type LevelingFilterBarProps = {
  search: string;
  statusFilter: "all" | "missing" | "lt2" | "submitted";
  riskOnly: boolean;
  sortBy: "division" | "alphabetic" | "risk" | "due_soon";
  quickFilters: Array<"over_budget" | "no_bids" | "only_submitted" | "high_risk" | "two_plus_bids">;
  activeFilterCount: number;
  presetName: string;
  savedViews: string[];
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: "all" | "missing" | "lt2" | "submitted") => void;
  onRiskOnlyChange: (value: boolean) => void;
  onSortByChange: (value: "division" | "alphabetic" | "risk" | "due_soon") => void;
  onToggleQuickFilter: (value: LevelingFilterBarProps["quickFilters"][number]) => void;
  onClearAll: () => void;
  onPresetNameChange: (value: string) => void;
  onSaveView: () => void;
  onRestoreView: (name: string) => void;
};

export default function LevelingFilterBar({
  search,
  statusFilter,
  riskOnly,
  sortBy,
  quickFilters,
  activeFilterCount,
  presetName,
  savedViews,
  onSearchChange,
  onStatusFilterChange,
  onRiskOnlyChange,
  onSortByChange,
  onToggleQuickFilter,
  onClearAll,
  onPresetNameChange,
  onSaveView,
  onRestoreView,
}: LevelingFilterBarProps) {
  const quickFilterOptions: Array<{ key: LevelingFilterBarProps["quickFilters"][number]; label: string }> = [
    { key: "over_budget", label: "Over budget" },
    { key: "no_bids", label: "No bids" },
    { key: "only_submitted", label: "Only submitted" },
    { key: "high_risk", label: "High risk" },
    { key: "two_plus_bids", label: "2+ bids" },
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {quickFilterOptions.map((option) => {
            const active = quickFilters.includes(option.key);
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onToggleQuickFilter(option.key)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span>{activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}</span>
          <button type="button" onClick={onClearAll} className="font-semibold text-slate-800 underline">
            Clear all
          </button>
        </div>
      </div>
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
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={presetName}
          onChange={(event) => onPresetNameChange(event.target.value)}
          placeholder="Save view as..."
          className="w-52 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={onSaveView}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
        >
          Save view
        </button>
        {savedViews.length ? (
          <select
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) onRestoreView(event.target.value);
              event.target.value = "";
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
          >
            <option value="">Restore saved view...</option>
            {savedViews.map((viewName) => (
              <option key={viewName} value={viewName}>
                {viewName}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </section>
  );
}
