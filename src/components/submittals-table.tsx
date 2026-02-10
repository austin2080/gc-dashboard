"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SubmittalRow = {
  id: string;
  submittal_number: string | null;
  title: string | null;
  spec_section: string | null;
  trade: string | null;
  project_id: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  ball_in_court: string;
  date_created: string | null;
  date_submitted: string | null;
  due_date: string | null;
  latest_response_date: string | null;
  revision: string | null;
};

type MemberRow = {
  user_id: string;
  profiles: { full_name: string | null }[] | null;
};

type Props = {
  projectId: string;
  projectName: string;
  submittals: SubmittalRow[];
  members: MemberRow[];
};

const STATUS_TABS = [
  "all",
  "draft",
  "open",
  "submitted",
  "in_review",
  "approved",
  "approved_as_noted",
  "revise_and_resubmit",
  "rejected",
  "closed",
] as const;

const statusLabel: Record<string, string> = {
  in_review: "In Review",
  approved_as_noted: "Approved as Noted",
  revise_and_resubmit: "Revise & Resubmit",
};

export default function SubmittalsTable({
  projectId,
  projectName,
  submittals,
  members,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]>("open");

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => {
      map.set(m.user_id, m.profiles?.[0]?.full_name ?? m.user_id);
    });
    return map;
  }, [members]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? submittals.filter((s) => {
          const haystack = `${s.submittal_number ?? ""} ${s.title ?? ""} ${
            s.spec_section ?? ""
          } ${s.trade ?? ""} ${s.status ?? ""} ${s.priority ?? ""}`.toLowerCase();
          return haystack.includes(q);
        })
      : submittals;

    if (statusFilter === "all") return list;
    return list.filter((s) => s.status === statusFilter);
  }, [submittals, query, statusFilter]);

  const formatStatus = (status: string) => statusLabel[status] ?? status.replace(/_/g, " ");

  const daysOpen = (created?: string | null) => {
    if (!created) return "-";
    const start = new Date(created);
    const today = new Date();
    const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? `${diff}d` : "—";
  };

  return (
    <section className="border rounded-lg">
      <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Submittal Log</h2>
          <p className="text-sm opacity-70">
            Document-centric review tracking for project teams and consultants.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`rounded-full px-3 py-1 capitalize ${
                statusFilter === tab ? "bg-black/10 text-black" : "text-black/70 hover:bg-black/5"
              }`}
              onClick={() => setStatusFilter(tab)}
            >
              {tab === "all" ? "All" : formatStatus(tab)}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 border-b">
        <input
          className="w-full rounded border border-black/20 px-3 py-2 text-sm"
          placeholder="Search submittals by number, title, spec section, trade, or status"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="max-h-[640px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-black/5 backdrop-blur border-b">
            <tr>
              <th className="text-left p-3">Submittal #</th>
              <th className="text-left p-3">Title / Description</th>
              <th className="text-left p-3">Spec Section</th>
              <th className="text-left p-3">Trade</th>
              <th className="text-left p-3">Project</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Priority</th>
              <th className="text-left p-3">Assigned To</th>
              <th className="text-left p-3">Ball In Court</th>
              <th className="text-left p-3">Date Created</th>
              <th className="text-left p-3">Date Submitted</th>
              <th className="text-left p-3">Due Date</th>
              <th className="text-left p-3">Latest Response</th>
              <th className="text-left p-3">Revision</th>
              <th className="text-left p-3">Days Open</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((s) => (
                <tr
                  key={s.id}
                  className="border-b last:border-b-0 hover:bg-black/[0.03] cursor-pointer"
                  onClick={() => router.push(`/projects/${projectId}/submittals/${s.id}`)}
                >
                  <td className="p-3">{s.submittal_number ?? "-"}</td>
                  <td className="p-3">{s.title ?? "-"}</td>
                  <td className="p-3">{s.spec_section ?? "-"}</td>
                  <td className="p-3">{s.trade ?? "-"}</td>
                  <td className="p-3">{projectName}</td>
                  <td className="p-3 capitalize">{formatStatus(s.status)}</td>
                  <td className="p-3 capitalize">{s.priority}</td>
                  <td className="p-3">{s.assigned_to ? memberMap.get(s.assigned_to) ?? "-" : "-"}</td>
                  <td className="p-3 capitalize">{s.ball_in_court}</td>
                  <td className="p-3">
                    {s.date_created ? new Date(s.date_created).toLocaleDateString() : "-"}
                  </td>
                  <td className="p-3">
                    {s.date_submitted ? new Date(s.date_submitted).toLocaleDateString() : "-"}
                  </td>
                  <td className="p-3">
                    {s.due_date ? new Date(s.due_date).toLocaleDateString() : "-"}
                  </td>
                  <td className="p-3">
                    {s.latest_response_date ? new Date(s.latest_response_date).toLocaleDateString() : "-"}
                  </td>
                  <td className="p-3">{s.revision ?? "-"}</td>
                  <td className="p-3">{daysOpen(s.date_created)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-4 opacity-70" colSpan={15}>
                  No submittals found for this status.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
