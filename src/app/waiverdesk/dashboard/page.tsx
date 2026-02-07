"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import WaiverRiskBadge from "@/components/waiver-risk-badge";
import WaiverStatusPill from "@/components/waiver-status-pill";
import type { WaiverStatus, WaiverSubStatus } from "@/lib/waiver-status";

type Project = { id: string; name: string };
type Vendor = { id: string; name: string; email: string };
type ActionItem = {
  id: string;
  vendorId: string;
  projectId: string;
  payAppNumber: string;
  waiverType: string;
  status: WaiverStatus;
  subStatus?: WaiverSubStatus;
  daysOutstanding: number;
  createdAt: string;
  requestedAt?: string;
  uploadedAt?: string;
  approvedAt?: string;
  rejectionReason?: string;
};
type Activity = { id: string; projectId: string; label: string; occurredAt: string };

type RiskItem = { id: string; label: string; count: number };

const projects: Project[] = [
  { id: "proj-1", name: "North Campus Expansion" },
  { id: "proj-2", name: "Riverfront Tower" },
];

const vendors: Vendor[] = [
  { id: "vendor-1", name: "Summit Concrete", email: "ap@summitconcrete.com" },
  { id: "vendor-2", name: "Prime Steel", email: "billing@primestreel.com" },
  { id: "vendor-3", name: "Delta Electric", email: "ap@deltaelectric.com" },
];

const initialActivity: Activity[] = [
  {
    id: "act-1",
    projectId: "proj-1",
    label: "Received Conditional Progress — ABC Electric — Pay App 6",
    occurredAt: "2026-02-05T09:14:00Z",
  },
  {
    id: "act-2",
    projectId: "proj-2",
    label: "Approved Unconditional Progress — HVAC Co — Pay App 5",
    occurredAt: "2026-02-05T08:42:00Z",
  },
  {
    id: "act-3",
    projectId: "proj-1",
    label: "Rejected Conditional — Missing notary stamp — Summit Concrete",
    occurredAt: "2026-02-04T18:30:00Z",
  },
  {
    id: "act-4",
    projectId: "proj-2",
    label: "Received Unconditional Final — Prime Steel — Pay App 8",
    occurredAt: "2026-02-04T16:05:00Z",
  },
  {
    id: "act-5",
    projectId: "proj-2",
    label: "Request sent — Delta Electric — Pay App 7",
    occurredAt: "2026-02-04T12:22:00Z",
  },
  {
    id: "act-6",
    projectId: "proj-1",
    label: "Approved Conditional Progress — North Plumbing — Pay App 4",
    occurredAt: "2026-02-03T17:10:00Z",
  },
  {
    id: "act-7",
    projectId: "proj-1",
    label: "Received Conditional Progress — Skyline Masonry — Pay App 3",
    occurredAt: "2026-02-03T14:48:00Z",
  },
  {
    id: "act-8",
    projectId: "proj-2",
    label: "Rejected Conditional — Incorrect project number — Apex Glass",
    occurredAt: "2026-02-02T19:55:00Z",
  },
];

const riskItems: RiskItem[] = [
  { id: "risk-1", label: "Waivers overdue 14+ days", count: 6 },
  { id: "risk-2", label: "Pay apps due within 7 days with missing docs", count: 4 },
  { id: "risk-3", label: "Vendors with repeated late waivers", count: 2 },
];

const initialActionItems: ActionItem[] = [
  {
    id: "action-1",
    vendorId: "vendor-1",
    projectId: "proj-1",
    payAppNumber: "PA-102",
    waiverType: "Conditional Progress",
    status: "missing",
    daysOutstanding: 12,
    createdAt: "2026-01-25",
  },
  {
    id: "action-2",
    vendorId: "vendor-3",
    projectId: "proj-2",
    payAppNumber: "PA-087",
    waiverType: "Unconditional Final",
    status: "requested",
    daysOutstanding: 9,
    createdAt: "2026-01-28",
  },
  {
    id: "action-3",
    vendorId: "vendor-2",
    projectId: "proj-1",
    payAppNumber: "PA-099",
    waiverType: "Conditional Final",
    status: "uploaded",
    daysOutstanding: 6,
    createdAt: "2026-01-30",
  },
  {
    id: "action-4",
    vendorId: "vendor-1",
    projectId: "proj-2",
    payAppNumber: "PA-110",
    waiverType: "Conditional Progress",
    status: "approved",
    daysOutstanding: 4,
    createdAt: "2026-02-02",
  },
  {
    id: "action-5",
    vendorId: "vendor-3",
    projectId: "proj-1",
    payAppNumber: "PA-106",
    waiverType: "Unconditional Progress",
    status: "uploaded",
    subStatus: "rejected",
    daysOutstanding: 15,
    createdAt: "2026-01-22",
  },
];

export default function WaiverDeskDashboardPage() {
  const router = useRouter();
  const [projectFilter, setProjectFilter] = useState("all");
  const [dateRange, setDateRange] = useState("last-30");
  const [actions, setActions] = useState<ActionItem[]>(initialActionItems);
  const [activity, setActivity] = useState<Activity[]>(initialActivity);
  const [requestModal, setRequestModal] = useState<ActionItem | null>(null);
  const [requestEmail, setRequestEmail] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [uploadedModal, setUploadedModal] = useState<ActionItem | null>(null);
  const [uploadedSignedDate, setUploadedSignedDate] = useState("");
  const [uploadedNotes, setUploadedNotes] = useState("");
  const [approveModal, setApproveModal] = useState<ActionItem | null>(null);
  const [rejectModal, setRejectModal] = useState<ActionItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const now = new Date();
  const rangeStart = (() => {
    if (dateRange === "last-7") {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    if (dateRange === "this-month") {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
  })();

  const filteredActions = actions.filter((item) => {
    if (projectFilter !== "all" && item.projectId !== projectFilter) return false;
    return new Date(item.createdAt) >= rangeStart;
  });

  const filteredActivity = activity.filter((item) => {
    if (projectFilter !== "all" && item.projectId !== projectFilter) return false;
    return new Date(item.occurredAt) >= rangeStart;
  });

  const payAppsBlockedCount = new Set(
    filteredActions
      .filter((item) => item.status === "missing" || item.status === "requested")
      .map((item) => item.payAppNumber)
  ).size;
  const waiversMissingCount = filteredActions.filter(
    (item) => item.status === "missing" || item.status === "requested"
  ).length;
  const waiversReceived7Days = filteredActions.filter((item) => {
    if (item.status !== "uploaded") return false;
    return new Date(item.createdAt) >= rangeStart;
  }).length;
  const vendorsOutstandingCount = new Set(
    filteredActions
      .filter((item) => item.status === "missing" || item.status === "requested")
      .map((item) => item.vendorId)
  ).size;

  const vendorMap = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));
  const projectMap = new Map(projects.map((project) => [project.id, project.name]));

  const sortedActions = [...filteredActions].sort(
    (a, b) => b.daysOutstanding - a.daysOutstanding
  );

  const openRequestModal = (item: ActionItem) => {
    const vendor = vendorMap.get(item.vendorId) ?? "";
    const vendorEmail =
      vendors.find((v) => v.id === item.vendorId)?.email ?? "ap@vendor.com";
    setRequestEmail(vendorEmail);
    setRequestMessage(
      `Hello ${vendor},\\n\\nPlease provide the ${item.waiverType} waiver for Pay App ${item.payAppNumber}.\\n\\nThank you.`
    );
    setRequestModal(item);
  };

  const openUploadedModal = (item: ActionItem) => {
    setUploadedSignedDate("");
    setUploadedNotes("");
    setUploadedModal(item);
  };

  const openApproveModal = (item: ActionItem) => {
    setApproveModal(item);
  };

  const openRejectModal = (item: ActionItem) => {
    setRejectReason("");
    setRejectModal(item);
  };

  return (
    <main className="p-6 space-y-6">
      <section className="rounded-lg border border-black/10 bg-white p-6">
        <div className="text-xs uppercase tracking-wide text-[color:var(--muted)]">
          WaiverDesk
        </div>
        <h1 className="mt-2 text-2xl font-semibold">WaiverDesk Dashboard</h1>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Track what’s blocking payment and what needs attention today.
        </p>
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[color:var(--muted)]">
            <span className="text-xs uppercase tracking-wide">Project</span>
            <select
              className="rounded-full border border-black/10 px-3 py-2 text-sm text-black/80"
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
            >
              <option value="all">All Projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-[color:var(--muted)]">
            <span className="text-xs uppercase tracking-wide">Date range</span>
            <select
              className="rounded-full border border-black/10 px-3 py-2 text-sm text-black/80"
              value={dateRange}
              onChange={(event) => setDateRange(event.target.value)}
            >
              <option value="last-7">Last 7</option>
              <option value="last-30">Last 30</option>
              <option value="this-month">This Month</option>
            </select>
          </label>

          <button
            className="ml-auto rounded-full border border-black/10 px-4 py-2 text-xs text-black/70"
            type="button"
            onClick={() => {
              setProjectFilter("all");
              setDateRange("last-30");
            }}
          >
            Clear filters
          </button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              className="rounded-lg border border-black/10 bg-white p-4 text-left shadow-sm"
              style={{ borderLeft: "3px solid #3B82F6" }}
              onClick={() =>
                router.push(
                  `/waiverdesk/waivers?view=blocked-pay-apps&project=${projectFilter}&range=${dateRange}`
                )
              }
            >
              <div className="flex items-center justify-between">
                <div className="text-sm text-[color:var(--muted)]">Pay Apps Blocked</div>
                <div className="text-lg">⛔</div>
              </div>
              <div className="mt-2 text-3xl font-semibold">{payAppsBlockedCount}</div>
              <div className="mt-2 text-xs text-[color:var(--muted)]">View details</div>
            </button>

            <button
              type="button"
              className="rounded-lg border border-black/10 bg-white p-4 text-left shadow-sm"
              style={{ borderLeft: "3px solid #DC2626" }}
              onClick={() =>
                router.push(
                  `/waiverdesk/waivers?status=missing,requested&project=${projectFilter}&range=${dateRange}`
                )
              }
            >
              <div className="flex items-center justify-between">
                <div className="text-sm text-[color:var(--muted)]">Waivers Missing</div>
                <div className="text-lg">📄</div>
              </div>
              <div className="mt-2 text-3xl font-semibold">{waiversMissingCount}</div>
              <div className="mt-2 text-xs text-[color:var(--muted)]">View details</div>
            </button>

            <button
              type="button"
              className="rounded-lg border border-black/10 bg-white p-4 text-left shadow-sm"
              style={{ borderLeft: "3px solid #16A34A" }}
              onClick={() =>
                router.push(
                  `/waiverdesk/waivers?status=uploaded&project=${projectFilter}&range=${dateRange}`
                )
              }
            >
              <div className="flex items-center justify-between">
                <div className="text-sm text-[color:var(--muted)]">
                  Waivers Uploaded (7 days)
                </div>
                <div className="text-lg">✅</div>
              </div>
              <div className="mt-2 text-3xl font-semibold">{waiversReceived7Days}</div>
              <div className="mt-2 text-xs text-[color:var(--muted)]">View details</div>
            </button>

            <button
              type="button"
              className="rounded-lg border border-black/10 bg-white p-4 text-left shadow-sm"
              style={{ borderLeft: "3px solid #F59E0B" }}
              onClick={() =>
                router.push(
                  `/waiverdesk/vendors?status=missing&project=${projectFilter}&range=${dateRange}`
                )
              }
            >
              <div className="flex items-center justify-between">
                <div className="text-sm text-[color:var(--muted)]">Vendors Outstanding</div>
                <div className="text-lg">🏗️</div>
              </div>
              <div className="mt-2 text-3xl font-semibold">{vendorsOutstandingCount}</div>
              <div className="mt-2 text-xs text-[color:var(--muted)]">View details</div>
            </button>
          </section>

          <section className="rounded-lg border border-black/10 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Needs Attention Today</h2>
              <div className="text-sm text-[color:var(--muted)]">
                {sortedActions.length} items
              </div>
            </div>

            {sortedActions.length === 0 ? (
              <div className="mt-6 rounded-lg border border-dashed border-black/10 bg-[color:var(--hover)]/60 p-6 text-center">
                <div className="text-lg">✅</div>
                <div className="mt-2 text-sm font-semibold">
                  All waivers are up to date.
                </div>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left p-3">Vendor</th>
                      <th className="text-left p-3">Project</th>
                      <th className="text-left p-3">Pay App #</th>
                      <th className="text-left p-3">Waiver Type</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Days Outstanding</th>
                      <th className="text-left p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedActions.map((item) => (
                      <tr key={item.id} className="border-b last:border-b-0">
                        <td className="p-3">
                          {vendorMap.get(item.vendorId) ?? "Unknown vendor"}
                        </td>
                        <td className="p-3">
                          {projectMap.get(item.projectId) ?? "Unknown project"}
                        </td>
                        <td className="p-3">{item.payAppNumber}</td>
                        <td className="p-3">{item.waiverType}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <WaiverStatusPill
                              status={item.status}
                              subStatus={item.subStatus}
                            />
                            <WaiverRiskBadge
                              status={item.status}
                              showLabel={false}
                            />
                          </div>
                        </td>
                        <td className="p-3">{item.daysOutstanding} days</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="rounded-full border border-black/10 px-3 py-1 text-xs"
                              onClick={() => openRequestModal(item)}
                            >
                              Request Waiver
                            </button>
                            <button
                              className="rounded-full border border-black/10 px-3 py-1 text-xs"
                              onClick={() => openUploadedModal(item)}
                            >
                              Mark Uploaded
                            </button>
                            {item.status === "uploaded" ? (
                              <>
                                <button
                                  className="rounded-full border border-black/10 px-3 py-1 text-xs"
                                  onClick={() => openApproveModal(item)}
                                >
                                  Approve
                                </button>
                                <button
                                  className="rounded-full border border-black/10 px-3 py-1 text-xs"
                                  onClick={() => openRejectModal(item)}
                                >
                                  Reject
                                </button>
                              </>
                            ) : null}
                            <button className="rounded-full border border-black/10 px-3 py-1 text-xs">
                              Open
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-black/10 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">At-Risk Overview</h2>
              <div className="text-sm text-[color:var(--muted)]">Flagged items</div>
            </div>
            <div className="mt-4 grid gap-3">
              {riskItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-black/10 bg-[color:var(--hover)]/40 p-4"
                >
                  <div className="text-xs uppercase tracking-wide text-[color:var(--muted)]">
                    Risk
                  </div>
                  <div className="mt-2 text-sm font-semibold">{item.label}</div>
                  <div className="mt-2 text-2xl font-semibold text-[color:var(--warning)]">
                    {item.count}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-black/10 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent Activity</h2>
              <div className="text-sm text-[color:var(--muted)]">Last 8 updates</div>
            </div>
            <div className="mt-4 space-y-3">
              {filteredActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/10 bg-white px-4 py-3"
                >
                  <div className="text-sm text-black/80">{item.label}</div>
                  <div className="text-xs text-[color:var(--muted)]">
                    {new Date(item.occurredAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <footer className="overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/60">WaiverDesk</div>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              Great teams get paid faster when waiver follow-through is systematic. Keep owners,
              vendors, and accounting aligned by closing today’s highest-risk waiver tasks first.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-white/60">Portfolio health</div>
            <div className="mt-1 text-2xl font-semibold">{Math.max(0, 100 - waiversMissingCount * 6)}%</div>
            <div className="text-xs text-white/70">Based on missing + requested waivers</div>
          </div>
        </div>
      </footer>

      {requestModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="text-lg font-semibold">Request Waiver</div>
            <div className="mt-4 space-y-3 text-sm text-[color:var(--muted)]">
              <div>Vendor: {vendorMap.get(requestModal.vendorId) ?? "Unknown"}</div>
              <div>Project: {projectMap.get(requestModal.projectId) ?? "Unknown"}</div>
              <div>Pay App: {requestModal.payAppNumber}</div>
              <div>Waiver Type: {requestModal.waiverType}</div>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-xs uppercase tracking-wide text-[color:var(--muted)]">
                Recipient Email
                <input
                  className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                  value={requestEmail}
                  onChange={(event) => setRequestEmail(event.target.value)}
                />
              </label>
              <label className="block text-xs uppercase tracking-wide text-[color:var(--muted)]">
                Message
                <textarea
                  className="mt-2 min-h-[120px] w-full resize-none rounded-lg border border-black/10 px-3 py-2 text-sm"
                  value={requestMessage}
                  onChange={(event) => setRequestMessage(event.target.value)}
                />
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="rounded-full border border-black/10 px-4 py-2 text-xs"
                type="button"
                onClick={() => setRequestModal(null)}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-black"
                type="button"
                onClick={() => {
                  const now = new Date().toISOString();
                  setActions((prev) =>
                    prev.map((entry) =>
                      entry.id === requestModal.id
                        ? { ...entry, status: "requested", createdAt: now, requestedAt: now }
                        : entry
                    )
                  );
                  setActivity((prev) => [
                    {
                      id: `act-${Date.now()}`,
                      projectId: requestModal.projectId,
                      label: `Requested ${requestModal.waiverType} — ${vendorMap.get(
                        requestModal.vendorId
                      )} — Pay App ${requestModal.payAppNumber}`,
                      occurredAt: now,
                    },
                    ...prev,
                  ]);
                  setRequestModal(null);
                }}
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {uploadedModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="text-lg font-semibold">Mark Waiver Uploaded</div>
            <div className="mt-4 space-y-3 text-sm text-[color:var(--muted)]">
              <div>Vendor: {vendorMap.get(uploadedModal.vendorId) ?? "Unknown"}</div>
              <div>Project: {projectMap.get(uploadedModal.projectId) ?? "Unknown"}</div>
              <div>Pay App: {uploadedModal.payAppNumber}</div>
              <div>Waiver Type: {uploadedModal.waiverType}</div>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-xs uppercase tracking-wide text-[color:var(--muted)]">
                Upload PDF (optional)
                <input
                  className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                  type="file"
                  accept="application/pdf"
                />
              </label>
              <label className="block text-xs uppercase tracking-wide text-[color:var(--muted)]">
                Signed date
                <input
                  className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                  type="date"
                  value={uploadedSignedDate}
                  onChange={(event) => setUploadedSignedDate(event.target.value)}
                />
              </label>
              <label className="block text-xs uppercase tracking-wide text-[color:var(--muted)]">
                Notes
                <textarea
                  className="mt-2 min-h-[100px] w-full resize-none rounded-lg border border-black/10 px-3 py-2 text-sm"
                  value={uploadedNotes}
                  onChange={(event) => setUploadedNotes(event.target.value)}
                />
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="rounded-full border border-black/10 px-4 py-2 text-xs"
                type="button"
                onClick={() => setUploadedModal(null)}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-black"
                type="button"
                onClick={() => {
                  const now = new Date().toISOString();
                  setActions((prev) =>
                    prev.map((entry) =>
                      entry.id === uploadedModal.id
                        ? { ...entry, status: "uploaded", subStatus: "needs_review", createdAt: now, uploadedAt: now }
                        : entry
                    )
                  );
                  setActivity((prev) => [
                    {
                      id: `act-${Date.now()}`,
                      projectId: uploadedModal.projectId,
                      label: `Uploaded ${uploadedModal.waiverType} — ${vendorMap.get(
                        uploadedModal.vendorId
                      )} — Pay App ${uploadedModal.payAppNumber}`,
                      occurredAt: now,
                    },
                    ...prev,
                  ]);
                  setUploadedModal(null);
                }}
              >
                Mark Uploaded
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {approveModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <div className="text-lg font-semibold">Approve Waiver?</div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              This will mark the lien waiver as approved.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="rounded-full border border-black/10 px-4 py-2 text-xs"
                type="button"
                onClick={() => setApproveModal(null)}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-black"
                type="button"
                onClick={() => {
                  const now = new Date().toISOString();
                  setActions((prev) =>
                    prev.map((entry) =>
                      entry.id === approveModal.id
                        ? { ...entry, status: "approved", subStatus: undefined, approvedAt: now }
                        : entry
                    )
                  );
                  setActivity((prev) => [
                    {
                      id: `act-${Date.now()}`,
                      projectId: approveModal.projectId,
                      label: `Approved ${approveModal.waiverType} — ${vendorMap.get(
                        approveModal.vendorId
                      )} — Pay App ${approveModal.payAppNumber}`,
                      occurredAt: now,
                    },
                    ...prev,
                  ]);
                  setApproveModal(null);
                }}
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rejectModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="text-lg font-semibold">Reject Waiver</div>
            <div className="mt-3 space-y-3">
              <label className="block text-xs uppercase tracking-wide text-[color:var(--muted)]">
                Rejection reason
                <textarea
                  className="mt-2 min-h-[120px] w-full resize-none rounded-lg border border-black/10 px-3 py-2 text-sm"
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                />
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="rounded-full border border-black/10 px-4 py-2 text-xs"
                type="button"
                onClick={() => setRejectModal(null)}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-black disabled:opacity-50"
                type="button"
                disabled={!rejectReason.trim()}
                onClick={() => {
                  const now = new Date().toISOString();
                  setActions((prev) =>
                    prev.map((entry) =>
                      entry.id === rejectModal.id
                        ? {
                            ...entry,
                            status: "uploaded",
                            subStatus: "rejected",
                            rejectionReason: rejectReason.trim(),
                          }
                        : entry
                    )
                  );
                  setActivity((prev) => [
                    {
                      id: `act-${Date.now()}`,
                      projectId: rejectModal.projectId,
                      label: `Rejected ${rejectModal.waiverType} — ${vendorMap.get(
                        rejectModal.vendorId
                      )} — ${rejectReason.trim()}`,
                      occurredAt: now,
                    },
                    ...prev,
                  ]);
                  setRejectModal(null);
                }}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
