"use client";

import { useMemo, useState } from "react";

import StatusPill from "@/components/waivers/StatusPill";
import {
  WAIVER_STATUS_VALUES,
  type WaiverStatus,
  getWaiverStatusLabel,
} from "@/lib/waivers/status";

type WaiverRecord = {
  id: string;
  projectName: string;
  contractorName: string;
  payAppNumber: number;
  waiverType: string;
  amount: number;
  status: WaiverStatus;
  updatedAt: string;
};

type SummaryCardProps = {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "neutral" | "info" | "warning" | "success" | "danger";
};

type FiltersRowProps = {
  projectOptions: string[];
  waiverTypeOptions: string[];
  selectedProject: string;
  selectedWaiverType: string;
  selectedStatuses: WaiverStatus[];
  searchValue: string;
  onProjectChange: (value: string) => void;
  onWaiverTypeChange: (value: string) => void;
  onStatusToggle: (status: WaiverStatus) => void;
  onSearchChange: (value: string) => void;
  onClear: () => void;
};

const waiverRecords: WaiverRecord[] = [
  {
    id: "WA-2201",
    projectName: "North Campus Expansion",
    contractorName: "Summit Concrete",
    payAppNumber: 18,
    waiverType: "Conditional Progress",
    amount: 48250,
    status: "missing",
    updatedAt: "2026-02-05",
  },
  {
    id: "WA-2202",
    projectName: "Riverfront Tower",
    contractorName: "Prime Steel",
    payAppNumber: 21,
    waiverType: "Unconditional Progress",
    amount: 112400,
    status: "requested",
    updatedAt: "2026-02-06",
  },
  {
    id: "WA-2203",
    projectName: "Civic Center Garage",
    contractorName: "Delta Electric",
    payAppNumber: 12,
    waiverType: "Conditional Final",
    amount: 28750,
    status: "uploaded",
    updatedAt: "2026-02-04",
  },
  {
    id: "WA-2204",
    projectName: "Harborview Labs",
    contractorName: "Skyline Masonry",
    payAppNumber: 9,
    waiverType: "Conditional Progress",
    amount: 19300,
    status: "approved",
    updatedAt: "2026-02-03",
  },
  {
    id: "WA-2205",
    projectName: "Riverfront Tower",
    contractorName: "North Plumbing",
    payAppNumber: 21,
    waiverType: "Unconditional Progress",
    amount: 36400,
    status: "uploaded",
    updatedAt: "2026-02-06",
  },
  {
    id: "WA-2206",
    projectName: "North Campus Expansion",
    contractorName: "Apex Glass",
    payAppNumber: 18,
    waiverType: "Conditional Progress",
    amount: 15800,
    status: "requested",
    updatedAt: "2026-02-05",
  },
  {
    id: "WA-2207",
    projectName: "Civic Center Garage",
    contractorName: "Prime Steel",
    payAppNumber: 12,
    waiverType: "Unconditional Final",
    amount: 72500,
    status: "approved",
    updatedAt: "2026-02-06",
  },
  {
    id: "WA-2208",
    projectName: "Harborview Labs",
    contractorName: "Horizon Roofing",
    payAppNumber: 9,
    waiverType: "Conditional Progress",
    amount: 22450,
    status: "missing",
    updatedAt: "2026-02-02",
  },
];

const summaryTones: Record<NonNullable<SummaryCardProps["tone"]>, string> = {
  neutral: "border-black/10 bg-white",
  info: "border-sky-200/60 bg-sky-50/40",
  warning: "border-amber-200/60 bg-amber-50/40",
  success: "border-emerald-200/60 bg-emerald-50/40",
  danger: "border-rose-200/60 bg-rose-50/40",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const uniqueValues = (items: WaiverRecord[], key: keyof WaiverRecord) => {
  return Array.from(new Set(items.map((item) => item[key]))).sort();
};

function SummaryCard({ label, value, helper, tone = "neutral" }: SummaryCardProps) {
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${summaryTones[tone]}`}>
      <div className="text-xs uppercase tracking-wide text-black/50">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-black/90">{value}</div>
      {helper ? <div className="mt-1 text-xs text-black/50">{helper}</div> : null}
    </div>
  );
}

function FiltersRow({
  projectOptions,
  waiverTypeOptions,
  selectedProject,
  selectedWaiverType,
  selectedStatuses,
  searchValue,
  onProjectChange,
  onWaiverTypeChange,
  onStatusToggle,
  onSearchChange,
  onClear,
}: FiltersRowProps) {
  return (
    <section className="rounded-lg border border-black/10 bg-white p-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-2 text-xs uppercase tracking-wide text-black/50">
          Project
          <select
            className="min-w-[180px] rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-black/80"
            value={selectedProject}
            onChange={(event) => onProjectChange(event.target.value)}
          >
            <option value="all">All projects</option>
            {projectOptions.map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2 text-xs uppercase tracking-wide text-black/50">
          Status
          <div className="flex flex-wrap gap-2">
            {WAIVER_STATUS_VALUES.map((status) => {
              const isActive = selectedStatuses.includes(status);
              return (
                <label
                  key={status}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
                    isActive
                      ? "border-black/20 bg-black/5 text-black/70"
                      : "border-black/10 text-black/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-3 w-3 accent-black"
                    checked={isActive}
                    onChange={() => onStatusToggle(status)}
                  />
                  {getWaiverStatusLabel(status)}
                </label>
              );
            })}
          </div>
        </div>

        <label className="flex flex-col gap-2 text-xs uppercase tracking-wide text-black/50">
          Waiver type
          <select
            className="min-w-[180px] rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-black/80"
            value={selectedWaiverType}
            onChange={(event) => onWaiverTypeChange(event.target.value)}
          >
            <option value="all">All types</option>
            {waiverTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-xs uppercase tracking-wide text-black/50">
          Search
          <input
            className="min-w-[220px] rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-black/80"
            placeholder="Contractor or project"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <button
          type="button"
          className="ml-auto rounded-full border border-black/10 px-4 py-2 text-xs font-medium text-black/70"
          onClick={onClear}
        >
          Clear filters
        </button>
      </div>
    </section>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-lg border border-black/5 bg-black/[0.02] px-4 py-3"
        >
          <div className="h-3 w-28 rounded-full bg-black/10" />
          <div className="h-3 w-32 rounded-full bg-black/10" />
          <div className="h-3 w-24 rounded-full bg-black/10" />
          <div className="h-3 w-20 rounded-full bg-black/10" />
          <div className="h-3 w-24 rounded-full bg-black/10" />
          <div className="h-3 w-20 rounded-full bg-black/10" />
          <div className="ml-auto h-7 w-32 rounded-full bg-black/10" />
        </div>
      ))}
    </div>
  );
}

export default function WaiverCenterPage() {
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedWaiverType, setSelectedWaiverType] = useState("all");
  const [selectedStatuses, setSelectedStatuses] = useState<WaiverStatus[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [isLoading] = useState(false);

  const projectOptions = useMemo(
    () => uniqueValues(waiverRecords, "projectName"),
    []
  );
  const waiverTypeOptions = useMemo(
    () => uniqueValues(waiverRecords, "waiverType"),
    []
  );

  const totals = useMemo(() => {
    const missing = waiverRecords.filter((item) => item.status === "missing");
    const requested = waiverRecords.filter((item) => item.status === "requested");
    const uploaded = waiverRecords.filter((item) => item.status === "uploaded");
    const approved = waiverRecords.filter((item) => item.status === "approved");
    const totalExposure = waiverRecords
      .filter((item) => item.status !== "approved")
      .reduce((sum, item) => sum + item.amount, 0);
    const projectsAtRisk = new Set(
      waiverRecords
        .filter((item) => item.status !== "approved")
        .map((item) => item.projectName)
    ).size;

    return {
      missing: missing.length,
      requested: requested.length,
      uploaded: uploaded.length,
      approved: approved.length,
      totalExposure,
      projectsAtRisk,
    };
  }, []);

  const filteredItems = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return waiverRecords.filter((item) => {
      if (selectedProject !== "all" && item.projectName !== selectedProject) {
        return false;
      }
      if (selectedWaiverType !== "all" && item.waiverType !== selectedWaiverType) {
        return false;
      }
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(item.status)) {
        return false;
      }
      if (query) {
        const haystack = `${item.projectName} ${item.contractorName}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [selectedProject, selectedWaiverType, selectedStatuses, searchValue]);

  const hasRecords = waiverRecords.length > 0;

  return (
    <main className="space-y-6 p-6">
      <header className="rounded-lg border border-black/10 bg-white p-6">
        <h1 className="text-2xl font-semibold">Waiver Center</h1>
        <p className="mt-2 text-sm text-black/60">
          Track lien waiver status across all projects.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          label="Missing Waivers"
          value={totals.missing}
          helper="No waiver received"
          tone="danger"
        />
        <SummaryCard
          label="Awaiting Upload"
          value={totals.requested}
          helper="Request sent"
          tone="warning"
        />
        <SummaryCard
          label="Awaiting Approval"
          value={totals.uploaded}
          helper="Needs review"
          tone="info"
        />
        <SummaryCard
          label="Approved (Current Period)"
          value={totals.approved}
          helper="Cleared this cycle"
          tone="success"
        />
        <SummaryCard
          label="Total Exposure"
          value={currencyFormatter.format(totals.totalExposure)}
          helper="Non-approved waivers"
          tone="neutral"
        />
        <SummaryCard
          label="Projects At Risk"
          value={totals.projectsAtRisk}
          helper="Open waivers"
          tone="neutral"
        />
      </section>

      <FiltersRow
        projectOptions={projectOptions}
        waiverTypeOptions={waiverTypeOptions}
        selectedProject={selectedProject}
        selectedWaiverType={selectedWaiverType}
        selectedStatuses={selectedStatuses}
        searchValue={searchValue}
        onProjectChange={setSelectedProject}
        onWaiverTypeChange={setSelectedWaiverType}
        onStatusToggle={(status) => {
          setSelectedStatuses((current) =>
            current.includes(status)
              ? current.filter((item) => item !== status)
              : [...current, status]
          );
        }}
        onSearchChange={setSearchValue}
        onClear={() => {
          setSelectedProject("all");
          setSelectedWaiverType("all");
          setSelectedStatuses([]);
          setSearchValue("");
        }}
      />

      <section className="rounded-lg border border-black/10 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Waiver Status</h2>
            <p className="mt-1 text-sm text-black/60">
              Review lien waiver compliance across active pay apps.
            </p>
          </div>
          <div className="text-sm text-black/50">{filteredItems.length} waivers</div>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <TableSkeleton />
          ) : !hasRecords ? (
            <div className="rounded-lg border border-dashed border-black/10 bg-black/[0.02] p-10 text-center">
              <div className="text-sm font-semibold text-black/70">No waivers yet</div>
              <p className="mt-2 text-sm text-black/50">
                Waiver requests will appear here once a pay app is issued.
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-black/10 bg-black/[0.02] p-10 text-center">
              <div className="text-sm font-semibold text-black/70">No matching waivers</div>
              <p className="mt-2 text-sm text-black/50">
                Try adjusting filters or clearing your search.
              </p>
              <button
                type="button"
                className="mt-4 rounded-full border border-black/10 px-4 py-2 text-xs font-medium text-black/70"
                onClick={() => {
                  setSelectedProject("all");
                  setSelectedWaiverType("all");
                  setSelectedStatuses([]);
                  setSearchValue("");
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-black/50">
                  <tr>
                    <th className="p-3">Project</th>
                    <th className="p-3">Contractor</th>
                    <th className="p-3">Pay App #</th>
                    <th className="p-3">Waiver Type</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Last Updated</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="border-b last:border-b-0">
                      <td className="p-3 font-medium">{item.projectName}</td>
                      <td className="p-3">{item.contractorName}</td>
                      <td className="p-3">#{item.payAppNumber}</td>
                      <td className="p-3">{item.waiverType}</td>
                      <td className="p-3">{currencyFormatter.format(item.amount)}</td>
                      <td className="p-3">
                        <StatusPill status={item.status} />
                      </td>
                      <td className="p-3">{dateFormatter.format(new Date(item.updatedAt))}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-full border border-black/10 px-3 py-1 text-xs"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-black/10 px-3 py-1 text-xs"
                          >
                            Upload
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-black/10 px-3 py-1 text-xs"
                          >
                            Request
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
