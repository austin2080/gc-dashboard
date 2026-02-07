"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  getWaiverDeskData,
  getVendorRecords,
  getProjectById,
} from "@/lib/waivers/data";
import { type WaiverStatus } from "@/lib/waiver-status";

const riskMeta = {
  high: "bg-rose-50 text-rose-700 border-rose-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const riskLabel = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

type VendorRow = {
  id: string;
  name: string;
  trade?: string;
  email?: string;
  openCount: number;
  exposure: number;
  projectsCount: number;
  riskStatus: WaiverStatus;
};

function getWorstStatus(records: { status: WaiverStatus }[]) {
  if (records.some((record) => record.status === "missing")) return "missing";
  if (records.some((record) => record.status === "requested")) return "requested";
  if (records.some((record) => record.status === "uploaded")) return "uploaded";
  return "approved";
}

function formatCurrency(value: number) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

type VendorComplianceHubProps = {
  basePath?: string;
};

export default function VendorComplianceHub({ basePath = "/waiverdesk/vendors" }: VendorComplianceHubProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const data = getWaiverDeskData();

  const statusFilter = useMemo(() => {
    const raw = searchParams.get("status");
    if (!raw) return null;
    const values = raw.split(",").map((value) => value.trim()).filter(Boolean);
    return values.length ? values : null;
  }, [searchParams]);

  const projectFilter = useMemo(() => searchParams.get("project"), [searchParams]);

  const vendorRows = useMemo(() => {
    return data.vendors.map((vendor): VendorRow => {
      const records = getVendorRecords(data, vendor.id);
      const openRecords = records.filter((record) => record.status !== "approved");
      const exposure = openRecords.reduce((total, record) => total + (record.amount ?? 0), 0);
      const projectCount = new Set(records.map((record) => record.projectId)).size;
      const riskStatus = getWorstStatus(records);

      return {
        id: vendor.id,
        name: vendor.name,
        trade: vendor.trade,
        email: vendor.email,
        openCount: openRecords.length,
        exposure,
        projectsCount: projectCount,
        riskStatus,
      };
    });
  }, [data]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return vendorRows.filter((vendor) => {
      const records = getVendorRecords(data, vendor.id);
      const matchesQuery =
        !term ||
        vendor.name.toLowerCase().includes(term) ||
        vendor.trade?.toLowerCase().includes(term) ||
        vendor.email?.toLowerCase().includes(term);

      const matchesStatus =
        !statusFilter ||
        records.some((record) => statusFilter.includes(record.status));

      const matchesProject =
        !projectFilter ||
        records.some((record) => record.projectId === projectFilter);

      return matchesQuery && matchesStatus && matchesProject;
    });
  }, [data, projectFilter, query, statusFilter, vendorRows]);

  const projectLabel = projectFilter
    ? getProjectById(data, projectFilter)?.name ?? "Selected project"
    : null;

  return (
    <main className="space-y-6 p-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Vendor Compliance Hub</h1>
            <p className="text-sm text-[color:var(--muted)]">
              Monitor vendor waiver compliance, exposure, and project impact across WaiverDesk.
            </p>
          </div>
          <Link
            className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
            href="/directory/new"
          >
            Add New Contractor
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex-1 min-w-[240px]">
            <span className="sr-only">Search vendors</span>
            <input
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
              placeholder="Search vendors by name, email, or trade"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {statusFilter ? (
            <div className="rounded-full border border-black/10 bg-black/5 px-3 py-1 text-xs text-black/70">
              Status filter: {statusFilter.join(", ")}
            </div>
          ) : null}
          {projectLabel ? (
            <div className="rounded-full border border-black/10 bg-black/5 px-3 py-1 text-xs text-black/70">
              Project filter: {projectLabel}
            </div>
          ) : null}
        </div>
      </header>

      <section className="overflow-hidden rounded-lg border border-black/10 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-black/[0.03]">
            <tr>
              <th className="p-3 text-left">Vendor</th>
              <th className="p-3 text-left">Trade</th>
              <th className="p-3 text-right">Open waivers</th>
              <th className="p-3 text-right">Total exposure</th>
              <th className="p-3 text-right">Projects impacted</th>
              <th className="p-3 text-left">Risk level</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((vendor) => {
              const riskClass =
                vendor.riskStatus === "missing"
                  ? riskMeta.high
                  : vendor.riskStatus === "approved"
                    ? riskMeta.low
                    : riskMeta.medium;
              const riskLevel =
                vendor.riskStatus === "missing"
                  ? "high"
                  : vendor.riskStatus === "approved"
                    ? "low"
                    : "medium";

              return (
                <tr key={vendor.id} className="border-t border-black/10">
                  <td className="p-3">
                    <div className="font-medium">{vendor.name}</div>
                    {vendor.email ? (
                      <div className="text-xs text-[color:var(--muted)]">{vendor.email}</div>
                    ) : null}
                  </td>
                  <td className="p-3">{vendor.trade ?? "—"}</td>
                  <td className="p-3 text-right">{vendor.openCount}</td>
                  <td className="p-3 text-right">{formatCurrency(vendor.exposure)}</td>
                  <td className="p-3 text-right">{vendor.projectsCount}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${riskClass}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {riskLabel[riskLevel]}
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium"
                      type="button"
                      onClick={() => router.push(`${basePath}/${vendor.id}`)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
