"use client";

import { useMemo, useState } from "react";

import StatusPill from "@/components/waivers/StatusPill";
import { getProjectPayAppsData, upsertWaiverRecord } from "@/lib/pay-apps/store";
import type { WaiverRecord, WaiverStatus, WaiverType } from "@/lib/pay-apps/types";

const waiverTypes: WaiverType[] = [
  "conditional_progress",
  "unconditional_progress",
  "conditional_final",
  "unconditional_final",
];

const waiverTypeLabels: Record<WaiverType, string> = {
  conditional_progress: "Conditional Progress",
  unconditional_progress: "Unconditional Progress",
  conditional_final: "Conditional Final",
  unconditional_final: "Unconditional Final",
};

const statusOrder: Record<WaiverStatus, number> = {
  missing: 0,
  requested: 1,
  uploaded: 2,
  approved: 3,
};

const sortOptions = [
  { value: "lastUpdated", label: "Last Updated" },
  { value: "amount", label: "Amount" },
  { value: "status", label: "Status" },
] as const;

type SortKey = (typeof sortOptions)[number]["value"];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-black/50">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-black/90">{value}</div>
    </div>
  );
}

export default function ProjectLienWaiversWorkspace({ projectId }: { projectId: string }) {
  const [state, setState] = useState(() => getProjectPayAppsData(projectId));
  const [vendorFilter, setVendorFilter] = useState("all");
  const [payAppFilter, setPayAppFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<WaiverStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("lastUpdated");
  const [isSortDescending, setIsSortDescending] = useState(true);
  const [isGroupedView, setIsGroupedView] = useState(false);
  const [generatePayAppId, setGeneratePayAppId] = useState(state.payApps[0]?.id ?? "");
  const [selectedWaiverTypes, setSelectedWaiverTypes] = useState<WaiverType[]>(waiverTypes);

  const rows = useMemo(() => {
    return state.waiverRecords.map((record) => {
      const vendor = state.contractors.find((item) => item.id === record.contractorId);
      const payApp = state.payApps.find((item) => item.id === record.payAppId);
      return {
        record,
        vendorName: vendor?.name ?? "Unknown Vendor",
        payAppNumber: payApp?.number ?? "Unknown Pay App",
      };
    });
  }, [state]);

  const summary = useMemo(() => {
    const missing = rows.filter((row) => row.record.status === "missing");
    const requested = rows.filter((row) => row.record.status === "requested");
    const uploaded = rows.filter((row) => row.record.status === "uploaded");
    const approved = rows.filter((row) => row.record.status === "approved");

    const exposure = rows
      .filter((row) => row.record.status !== "approved")
      .reduce((acc, row) => acc + (row.record.amount ?? 0), 0);

    const vendorsAtRisk = new Set(
      rows.filter((row) => row.record.status !== "approved").map((row) => row.record.contractorId)
    ).size;

    return {
      missing: missing.length,
      requested: requested.length,
      uploaded: uploaded.length,
      approved: approved.length,
      exposure,
      vendorsAtRisk,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const next = rows.filter((row) => {
      const byVendor = vendorFilter === "all" || row.record.contractorId === vendorFilter;
      const byPayApp = payAppFilter === "all" || row.record.payAppId === payAppFilter;
      const byStatus = statusFilter === "all" || row.record.status === statusFilter;
      const bySearch = normalizedSearch.length === 0 || row.vendorName.toLowerCase().includes(normalizedSearch);

      return byVendor && byPayApp && byStatus && bySearch;
    });

    next.sort((a, b) => {
      const direction = isSortDescending ? -1 : 1;

      if (sortKey === "amount") {
        return ((a.record.amount ?? 0) - (b.record.amount ?? 0)) * direction;
      }

      if (sortKey === "status") {
        return (statusOrder[a.record.status] - statusOrder[b.record.status]) * direction;
      }

      return (
        (new Date(a.record.updatedAt).getTime() - new Date(b.record.updatedAt).getTime()) * direction
      );
    });

    return next;
  }, [isSortDescending, payAppFilter, rows, search, sortKey, statusFilter, vendorFilter]);

  const groupedRows = useMemo(() => {
    return filteredRows.reduce<Record<string, typeof filteredRows>>((acc, row) => {
      const bucket = acc[row.record.payAppId] ?? [];
      bucket.push(row);
      acc[row.record.payAppId] = bucket;
      return acc;
    }, {});
  }, [filteredRows]);

  const vendorSummary = useMemo(() => {
    if (vendorFilter === "all") return null;
    const vendorRows = rows.filter((row) => row.record.contractorId === vendorFilter);
    return {
      vendorName: vendorRows[0]?.vendorName ?? "Vendor",
      total: vendorRows.length,
      approved: vendorRows.filter((row) => row.record.status === "approved").length,
      exposure: vendorRows
        .filter((row) => row.record.status !== "approved")
        .reduce((acc, row) => acc + (row.record.amount ?? 0), 0),
    };
  }, [rows, vendorFilter]);

  const refreshState = () => setState(getProjectPayAppsData(projectId));

  const generateExpectedWaivers = () => {
    if (!generatePayAppId || selectedWaiverTypes.length === 0) return;

    state.contractors.forEach((contractor) => {
      selectedWaiverTypes.forEach((waiverType) => {
        const existing = state.waiverRecords.find(
          (record) =>
            record.payAppId === generatePayAppId &&
            record.contractorId === contractor.id &&
            record.waiverType === waiverType
        );

        const record: WaiverRecord = {
          id: `${generatePayAppId}-${contractor.id}-${waiverType}`,
          projectId,
          contractorId: contractor.id,
          payAppId: generatePayAppId,
          waiverType,
          status: existing?.status ?? "missing",
          amount: existing?.amount ?? 0,
          updatedAt: new Date().toISOString(),
        };

        upsertWaiverRecord(projectId, record);
      });
    });

    refreshState();
  };

  const tableRow = (row: (typeof filteredRows)[number]) => (
    <tr key={row.record.id} className="border-t border-black/10">
      <td className="p-3">
        <button
          type="button"
          onClick={() => setVendorFilter(row.record.contractorId)}
          className="font-medium text-sky-700 hover:underline"
        >
          {row.vendorName}
        </button>
      </td>
      <td className="p-3">{row.payAppNumber}</td>
      <td className="p-3">{waiverTypeLabels[row.record.waiverType]}</td>
      <td className="p-3 text-right">{currencyFormatter.format(row.record.amount ?? 0)}</td>
      <td className="p-3">
        <StatusPill status={row.record.status} />
      </td>
      <td className="p-3">{formatDate(row.record.updatedAt)}</td>
      <td className="p-3">
        <div className="flex gap-2">
          <button type="button" className="rounded border border-black/20 px-2 py-1 text-xs">
            View
          </button>
          <button type="button" className="rounded border border-black/20 px-2 py-1 text-xs">
            Upload
          </button>
          <button type="button" className="rounded border border-black/20 px-2 py-1 text-xs">
            Request
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <main className="space-y-6 p-6">
      <header>
        <p className="text-xs uppercase tracking-wide text-black/50">Project Workspace</p>
        <h1 className="text-2xl font-semibold">Lien Waivers</h1>
        <p className="text-sm text-black/60">Weekly waiver compliance workspace for one project.</p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Missing waivers" value={summary.missing} />
        <SummaryCard label="Awaiting upload" value={summary.requested} />
        <SummaryCard label="Awaiting approval" value={summary.uploaded} />
        <SummaryCard label="Approved" value={summary.approved} />
        <SummaryCard label="Total exposure" value={currencyFormatter.format(summary.exposure)} />
        <SummaryCard label="Vendors at risk" value={summary.vendorsAtRisk} />
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <h2 className="text-sm font-semibold">Add / Generate Expected Waivers</h2>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <label className="text-sm">
            Pay App
            <select
              className="mt-1 block rounded border border-black/20 px-3 py-2"
              value={generatePayAppId}
              onChange={(event) => setGeneratePayAppId(event.target.value)}
            >
              {state.payApps.map((payApp) => (
                <option key={payApp.id} value={payApp.id}>
                  {payApp.number}
                </option>
              ))}
            </select>
          </label>

          <div>
            <div className="text-sm">Waiver Types</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {waiverTypes.map((waiverType) => {
                const selected = selectedWaiverTypes.includes(waiverType);
                return (
                  <label key={waiverType} className="flex items-center gap-2 rounded border border-black/20 px-2 py-1 text-xs">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => {
                        setSelectedWaiverTypes((current) =>
                          selected ? current.filter((item) => item !== waiverType) : [...current, waiverType]
                        );
                      }}
                    />
                    {waiverTypeLabels[waiverType]}
                  </label>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={generateExpectedWaivers}
            className="rounded bg-black px-3 py-2 text-sm text-white"
          >
            Generate Rows
          </button>
        </div>
      </section>

      {vendorSummary ? (
        <section className="rounded-lg border border-sky-200 bg-sky-50/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Vendor Focus: {vendorSummary.vendorName}</h3>
            <button
              type="button"
              onClick={() => setVendorFilter("all")}
              className="rounded border border-sky-300 px-2 py-1 text-xs"
            >
              Clear focus
            </button>
          </div>
          <p className="mt-1 text-sm text-black/60">
            {vendorSummary.approved}/{vendorSummary.total} approved · Exposure {currencyFormatter.format(vendorSummary.exposure)}
          </p>
        </section>
      ) : null}

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs uppercase tracking-wide text-black/50">
            Vendor
            <select
              className="mt-1 block rounded border border-black/20 px-3 py-2 text-sm"
              value={vendorFilter}
              onChange={(event) => setVendorFilter(event.target.value)}
            >
              <option value="all">All vendors</option>
              {state.contractors.map((contractor) => (
                <option key={contractor.id} value={contractor.id}>
                  {contractor.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs uppercase tracking-wide text-black/50">
            Pay App
            <select
              className="mt-1 block rounded border border-black/20 px-3 py-2 text-sm"
              value={payAppFilter}
              onChange={(event) => setPayAppFilter(event.target.value)}
            >
              <option value="all">All pay apps</option>
              {state.payApps.map((payApp) => (
                <option key={payApp.id} value={payApp.id}>
                  {payApp.number}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs uppercase tracking-wide text-black/50">
            Status
            <select
              className="mt-1 block rounded border border-black/20 px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as WaiverStatus | "all")}
            >
              <option value="all">All statuses</option>
              <option value="missing">Missing</option>
              <option value="requested">Requested</option>
              <option value="uploaded">Uploaded</option>
              <option value="approved">Approved</option>
            </select>
          </label>

          <label className="text-xs uppercase tracking-wide text-black/50">
            Search vendor
            <input
              className="mt-1 block rounded border border-black/20 px-3 py-2 text-sm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search vendor name"
            />
          </label>

          <label className="text-xs uppercase tracking-wide text-black/50">
            Sort by
            <select
              className="mt-1 block rounded border border-black/20 px-3 py-2 text-sm"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setIsSortDescending((current) => !current)}
            className="rounded border border-black/20 px-3 py-2 text-sm"
          >
            {isSortDescending ? "Desc" : "Asc"}
          </button>

          <button
            type="button"
            onClick={() => setIsGroupedView((current) => !current)}
            className="rounded border border-black/20 px-3 py-2 text-sm"
          >
            {isGroupedView ? "Flat list" : "Group by pay app"}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-black/10 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-black/[0.03]">
            <tr>
              <th className="p-3 text-left">Vendor</th>
              <th className="p-3 text-left">Pay App #</th>
              <th className="p-3 text-left">Waiver Type</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Last Updated</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isGroupedView
              ? Object.entries(groupedRows).flatMap(([payAppId, payAppRows]) => {
                  const payApp = state.payApps.find((item) => item.id === payAppId);
                  return [
                    <tr key={`${payAppId}-header`} className="border-t border-black/10 bg-black/[0.02]">
                      <td className="p-3 font-semibold" colSpan={7}>
                        {payApp?.number ?? payAppId}
                      </td>
                    </tr>,
                    ...payAppRows.map((row) => tableRow(row)),
                  ];
                })
              : filteredRows.map((row) => tableRow(row))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
