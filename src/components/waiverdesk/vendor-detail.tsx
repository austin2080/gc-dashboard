"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import WaiverStatusPill from "@/components/waiver-status-pill";
import {
  formatPayAppLabel,
  getPayAppsForProject,
  getProjectById,
  getRecordPayAppLabel,
  getVendorById,
  getVendorRecords,
  getWaiverDeskData,
} from "@/lib/waivers/data";
import { WAIVER_TYPE_META, type WaiverStatus, type WaiverType } from "@/lib/waiver-status";

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

type VendorDetailProps = {
  vendorsPath: string;
  waiversPath: string;
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

export default function VendorDetail({ vendorsPath, waiversPath }: VendorDetailProps) {
  const params = useParams();
  const router = useRouter();
  const data = getWaiverDeskData();
  const vendorId = Array.isArray(params.vendorId) ? params.vendorId[0] : params.vendorId;

  const vendor = getVendorById(data, vendorId ?? "");
  const records = getVendorRecords(data, vendorId ?? "");

  const summary = useMemo(() => {
    const missing = records.filter((record) => record.status === "missing").length;
    const requested = records.filter((record) => record.status === "requested").length;
    const approved = records.filter((record) => record.status === "approved").length;
    const exposure = records
      .filter((record) => record.status !== "approved")
      .reduce((total, record) => total + (record.amount ?? 0), 0);

    return { missing, requested, approved, exposure };
  }, [records]);

  const activeWaivers = useMemo(
    () =>
      records
        .filter((record) => record.status !== "approved")
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [records]
  );

  const approvedHistory = useMemo(
    () =>
      records
        .filter((record) => record.status === "approved")
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 4),
    [records]
  );

  const projectSummaries = useMemo(() => {
    const map = new Map(
      records.map((record) => [
        record.projectId,
        {
          projectId: record.projectId,
          openCount: 0,
          approvedCount: 0,
        },
      ])
    );

    records.forEach((record) => {
      const entry = map.get(record.projectId);
      if (!entry) return;
      if (record.status === "approved") entry.approvedCount += 1;
      else entry.openCount += 1;
    });

    return Array.from(map.values());
  }, [records]);

  const [requestOpen, setRequestOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [requestProjectId, setRequestProjectId] = useState(
    projectSummaries[0]?.projectId ?? ""
  );
  const [requestWaiverType, setRequestWaiverType] = useState<WaiverType>("conditional_progress");
  const [requestPayAppId, setRequestPayAppId] = useState("");

  const payAppsForProject = useMemo(
    () => getPayAppsForProject(data, requestProjectId),
    [data, requestProjectId]
  );

  const riskStatus = getWorstStatus(records);
  const riskLevel =
    riskStatus === "missing" ? "high" : riskStatus === "approved" ? "low" : "medium";

  if (!vendor) {
    return (
      <main className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Vendor not found</h1>
        <p className="text-sm text-[color:var(--muted)]">
          We could not locate this vendor in WaiverDesk.
        </p>
        <button
          className="rounded-full border border-black/10 px-4 py-2 text-sm"
          type="button"
          onClick={() => router.push(vendorsPath)}
        >
          Back to vendors
        </button>
      </main>
    );
  }

  return (
    <main className="space-y-6 p-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Vendor Compliance
            </div>
            <h1 className="mt-2 text-2xl font-semibold">{vendor.name}</h1>
            <p className="text-sm text-[color:var(--muted)]">{vendor.trade ?? "Trade not set"}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                riskMeta[riskLevel]
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {riskLabel[riskLevel]} risk
            </span>
            <button
              className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium"
              type="button"
              onClick={() => setRequestOpen(true)}
            >
              Request Waiver
            </button>
            <button
              className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium"
              type="button"
              onClick={() => setUploadOpen(true)}
            >
              Upload Waiver
            </button>
          </div>
        </div>

        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-black/10 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-[color:var(--muted)]">
              Missing waivers
            </div>
            <div className="mt-2 text-2xl font-semibold text-rose-600">{summary.missing}</div>
          </div>
          <div className="rounded-lg border border-black/10 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-[color:var(--muted)]">
              Awaiting upload
            </div>
            <div className="mt-2 text-2xl font-semibold text-amber-600">{summary.requested}</div>
          </div>
          <div className="rounded-lg border border-black/10 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-[color:var(--muted)]">
              Approved
            </div>
            <div className="mt-2 text-2xl font-semibold text-emerald-600">
              {summary.approved}
            </div>
          </div>
          <div className="rounded-lg border border-black/10 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-[color:var(--muted)]">
              Total exposure
            </div>
            <div className="mt-2 text-2xl font-semibold">{formatCurrency(summary.exposure)}</div>
          </div>
        </section>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Active Waivers</h2>
          <div className="text-sm text-[color:var(--muted)]">
            {activeWaivers.length} open records
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-black/10 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-black/[0.03]">
              <tr>
                <th className="p-3 text-left">Project</th>
                <th className="p-3 text-left">Pay App #</th>
                <th className="p-3 text-left">Waiver type</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Last updated</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeWaivers.map((record) => (
                <tr key={record.id} className="border-t border-black/10">
                  <td className="p-3">
                    {getProjectById(data, record.projectId)?.name ?? record.projectName}
                  </td>
                  <td className="p-3">{getRecordPayAppLabel(record)}</td>
                  <td className="p-3">{WAIVER_TYPE_META[record.waiverType].label}</td>
                  <td className="p-3 text-right">{formatCurrency(record.amount ?? 0)}</td>
                  <td className="p-3">
                    <WaiverStatusPill status={record.status} subStatus={record.subStatus} />
                  </td>
                  <td className="p-3">
                    {new Date(record.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="rounded-full border border-black/10 px-3 py-1 text-xs"
                        type="button"
                        onClick={() => router.push(waiversPath)}
                      >
                        View
                      </button>
                      <button
                        className="rounded-full border border-black/10 px-3 py-1 text-xs"
                        type="button"
                        onClick={() => setUploadOpen(true)}
                      >
                        Upload
                      </button>
                      <button
                        className="rounded-full border border-black/10 px-3 py-1 text-xs"
                        type="button"
                        onClick={() => setRequestOpen(true)}
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
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Projects</h2>
            <div className="text-sm text-[color:var(--muted)]">
              {projectSummaries.length} active assignments
            </div>
          </div>
          <div className="space-y-3">
            {projectSummaries.map((project) => (
              <div
                key={project.projectId}
                className="rounded-lg border border-black/10 bg-white p-4"
              >
                <div className="font-medium">
                  {getProjectById(data, project.projectId)?.name ?? project.projectId}
                </div>
                <div className="mt-2 flex items-center gap-4 text-sm text-[color:var(--muted)]">
                  <div>{project.openCount} open waivers</div>
                  <div>{project.approvedCount} approved</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">History</h2>
            <div className="text-sm text-[color:var(--muted)]">Recently approved</div>
          </div>
          <div className="space-y-3">
            {approvedHistory.length ? (
              approvedHistory.map((record) => (
                <div
                  key={record.id}
                  className="rounded-lg border border-black/10 bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">
                        {getProjectById(data, record.projectId)?.name ?? record.projectName}
                      </div>
                      <div className="text-xs text-[color:var(--muted)]">
                        {WAIVER_TYPE_META[record.waiverType].label} · {getRecordPayAppLabel(record)}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">
                      {formatCurrency(record.amount ?? 0)}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-[color:var(--muted)]">
                    Approved on {new Date(record.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-black/10 bg-white p-4 text-sm text-[color:var(--muted)]">
                No approved waivers yet.
              </div>
            )}
          </div>
        </div>
      </section>

      {requestOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="text-lg font-semibold">Request Waiver</div>
            <div className="mt-4 space-y-3 text-sm text-[color:var(--muted)]">
              <div>Vendor: {vendor.name}</div>
              <div>Trade: {vendor.trade ?? "Trade not set"}</div>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-xs uppercase tracking-wide text-[color:var(--muted)]">
                Project
                <select
                  className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                  value={requestProjectId}
                  onChange={(event) => {
                    setRequestProjectId(event.target.value);
                    setRequestPayAppId("");
                  }}
                >
                  {projectSummaries.map((project) => {
                    const projectName =
                      getProjectById(data, project.projectId)?.name ?? project.projectId;
                    return (
                      <option key={project.projectId} value={project.projectId}>
                        {projectName}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="block text-xs uppercase tracking-wide text-[color:var(--muted)]">
                Pay App
                <select
                  className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                  value={requestPayAppId}
                  onChange={(event) => setRequestPayAppId(event.target.value)}
                >
                  <option value="">Select pay app</option>
                  {payAppsForProject.map((payApp) => (
                    <option key={payApp.id} value={payApp.id}>
                      {formatPayAppLabel(payApp)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs uppercase tracking-wide text-[color:var(--muted)]">
                Waiver type
                <select
                  className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                  value={requestWaiverType}
                  onChange={(event) => setRequestWaiverType(event.target.value as WaiverType)}
                >
                  {Object.entries(WAIVER_TYPE_META).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="rounded-full border border-black/10 px-4 py-2 text-xs"
                type="button"
                onClick={() => setRequestOpen(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-black disabled:opacity-50"
                type="button"
                disabled={!requestProjectId || !requestPayAppId}
                onClick={() => setRequestOpen(false)}
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {uploadOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="text-lg font-semibold">Upload Waiver</div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Uploads are placeholder-only in this prototype. Attachments will be supported when
              backend storage is enabled.
            </p>
            <div className="mt-4 flex items-center justify-end">
              <button
                className="rounded-full border border-black/10 px-4 py-2 text-xs"
                type="button"
                onClick={() => setUploadOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
