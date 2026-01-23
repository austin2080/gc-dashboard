"use client";

import type { KeyboardEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import HealthPill from "@/components/health-pill";
import type { ProjectRow } from "@/lib/db/projects";

type FilterKey = "all" | "active" | "at_risk" | "on_hold" | "complete";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function ProjectsTable({ projects }: { projects: ProjectRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");

  const counts = useMemo(() => {
    const active = projects.filter((p) => p.health !== "complete").length;
    const atRisk = projects.filter((p) => p.health === "at_risk").length;
    const onHold = projects.filter((p) => p.health === "on_hold").length;
    const complete = projects.filter((p) => p.health === "complete").length;
    return { all: projects.length, active, at_risk: atRisk, on_hold: onHold, complete };
  }, [projects]);

  const filtered = useMemo(() => {
    if (filter === "all") return projects;
    if (filter === "active") return projects.filter((p) => p.health !== "complete");
    return projects.filter((p) => p.health === filter);
  }, [projects, filter]);

  function onRowClick(id: string) {
    router.push(`/projects/${id}`);
  }

  function onRowKeyDown(id: string, e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(`/projects/${id}`);
    }
  }

  const filterButton = (key: FilterKey, label: string) => {
    const active = filter === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => setFilter(key)}
        className={`rounded-full border px-3 py-1 text-sm transition-colors ${
          active ? "border-black bg-black text-white" : "border-black/30 text-black hover:bg-black/5"
        }`}
      >
        {label} <span className="opacity-70">({counts[key]})</span>
      </button>
    );
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filterButton("all", "All")}
          {filterButton("active", "Active")}
          {filterButton("at_risk", "At Risk")}
          {filterButton("on_hold", "On Hold")}
          {filterButton("complete", "Complete")}
        </div>

        <button
          type="button"
          className="rounded border border-black px-3 py-2 text-sm opacity-60"
          disabled
          title="Add project flow coming soon"
        >
          New Project
        </button>
      </div>

      <section className="border rounded-lg">
        <div className="p-4 border-b">
          <h2 className="font-semibold">All Projects</h2>
          <p className="text-sm opacity-70">Select a project to open details.</p>
        </div>

        <div className="max-h-[640px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black/5 backdrop-blur border-b">
              <tr>
                <th className="text-left p-3">Project</th>
                <th className="text-left p-3">City</th>
                <th className="text-left p-3">Health</th>
                <th className="text-left p-3">Start</th>
                <th className="text-left p-3">End</th>
                <th className="text-right p-3">Contract</th>
                <th className="text-right p-3">Est Profit</th>
                <th className="text-right p-3">Est Buyout</th>
                <th className="text-left p-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td className="p-4 opacity-70" colSpan={9}>
                    No projects for this filter yet.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b last:border-b-0 cursor-pointer transition-colors hover:[&>td]:bg-black/[0.03] active:[&>td]:bg-black/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                    onClick={() => onRowClick(p.id)}
                    onKeyDown={(e) => onRowKeyDown(p.id, e)}
                    role="link"
                    tabIndex={0}
                  >
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3">{p.city ?? "-"}</td>
                    <td className="p-3">
                      <HealthPill projectId={p.id} initialHealth={p.health} />
                    </td>
                    <td className="p-3">{p.start_date ? new Date(p.start_date).toLocaleDateString() : "-"}</td>
                    <td className="p-3">{p.end_date ? new Date(p.end_date).toLocaleDateString() : "-"}</td>
                    <td className="p-3 text-right">{money(p.contracted_value || 0)}</td>
                    <td className="p-3 text-right">{money(p.estimated_profit || 0)}</td>
                    <td className="p-3 text-right">{money(p.estimated_buyout || 0)}</td>
                    <td className="p-3">
                      {p.updated_at ? new Date(p.updated_at).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
