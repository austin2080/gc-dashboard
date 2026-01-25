"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type RfiRow = {
  id: string;
  rfi_number: string | null;
  subject: string | null;
  status: string;
  priority: string;
  ball_in_court: string;
  due_date: string | null;
  cost_impact: number | null;
  schedule_impact_days: number | null;
};

type Props = {
  projectId: string;
  rfis: RfiRow[];
};

const STATUS_TABS = ["all", "open", "answered", "closed", "draft"] as const;

export default function RfiTable({ projectId, rfis }: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]>("open");

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rfis;
    return rfis.filter((rfi) => rfi.status === statusFilter);
  }, [rfis, statusFilter]);

  return (
    <section className="border rounded-lg">
      <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">RFI Log</h2>
          <p className="text-sm opacity-70">Click a row to open the RFI detail.</p>
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
              {tab === "all" ? "All" : tab}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[640px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-black/5 backdrop-blur border-b">
            <tr>
              <th className="text-left p-3">RFI #</th>
              <th className="text-left p-3">Subject</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Ball in Court</th>
              <th className="text-left p-3">Due</th>
              <th className="text-right p-3">Cost Impact</th>
              <th className="text-right p-3">Schedule Impact</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((rfi) => (
                <tr
                  key={rfi.id}
                  className="border-b last:border-b-0 hover:bg-black/[0.03] cursor-pointer"
                  onClick={() => router.push(`/projects/${projectId}/rfis/${rfi.id}`)}
                >
                  <td className="p-3">{rfi.rfi_number ?? "-"}</td>
                  <td className="p-3">{rfi.subject ?? "-"}</td>
                  <td className="p-3 capitalize">{rfi.status}</td>
                  <td className="p-3 capitalize">{rfi.ball_in_court}</td>
                  <td className="p-3">
                    {rfi.due_date ? new Date(rfi.due_date).toLocaleDateString() : "-"}
                  </td>
                  <td className="p-3 text-right">
                    {(rfi.cost_impact ?? 0).toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                    })}
                  </td>
                  <td className="p-3 text-right">{rfi.schedule_impact_days ?? 0}d</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-4 opacity-70" colSpan={7}>
                  No RFIs for this status.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
