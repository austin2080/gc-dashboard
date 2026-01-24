"use client";

import type { KeyboardEvent } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HealthPill from "@/components/health-pill";
import type { ProjectRow } from "@/lib/db/projects";

type FilterKey = "all" | "active" | "at_risk" | "on_hold" | "complete";
type ScopeKey = "my" | "all";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function ProjectsTable({
  projectsAll,
  projectsMine,
  canViewAll,
}: {
  projectsAll: ProjectRow[];
  projectsMine: ProjectRow[];
  canViewAll: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("active");
  const [scope, setScope] = useState<ScopeKey>("my");

  const scopedProjects =
    scope === "all" && canViewAll ? projectsAll : projectsMine;

  const counts = useMemo(() => {
    const active = scopedProjects.filter((p) => p.health !== "complete").length;
    const atRisk = scopedProjects.filter((p) => p.health === "at_risk").length;
    const onHold = scopedProjects.filter((p) => p.health === "on_hold").length;
    const complete = scopedProjects.filter((p) => p.health === "complete").length;
    return {
      all: scopedProjects.length,
      active,
      at_risk: atRisk,
      on_hold: onHold,
      complete,
    };
  }, [scopedProjects]);

  const filtered = useMemo(() => {
    if (filter === "all") return scopedProjects;
    if (filter === "active") return scopedProjects.filter((p) => p.health !== "complete");
    return scopedProjects.filter((p) => p.health === filter);
  }, [scopedProjects, filter]);

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

  const totalContracted = scopedProjects.reduce(
    (sum, p) => sum + (p.contracted_value || 0),
    0
  );
  const totalOhp = scopedProjects.reduce(
    (sum, p) => sum + (p.estimated_profit || 0),
    0
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="text-lg font-semibold">
            {scope === "all" && canViewAll ? "All Projects" : "My Projects"}
          </div>
          <div className="text-sm opacity-70">
            {scope === "all" && canViewAll
              ? "Company-wide view of all projects."
              : "Your personal workspace for assigned projects."}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canViewAll ? (
            <div className="inline-flex items-center rounded-full border border-black/20 p-1">
              <button
                type="button"
                onClick={() => setScope("my")}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  scope === "my"
                    ? "bg-black text-white"
                    : "text-black/70 hover:bg-black/5"
                }`}
              >
                My Projects
              </button>
              <button
                type="button"
                onClick={() => setScope("all")}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  scope === "all"
                    ? "bg-black text-white"
                    : "text-black/70 hover:bg-black/5"
                }`}
              >
                All Projects
              </button>
            </div>
          ) : null}

          <Link
            href="/projects/new"
            className="rounded border border-black px-3 py-2 text-sm hover:bg-black/5"
          >
            New Project
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Active Projects</div>
          <div className="text-xl font-semibold mt-1">{counts.active}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">At Risk</div>
          <div className="text-xl font-semibold mt-1">{counts.at_risk}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Total Contracted</div>
          <div className="text-xl font-semibold mt-1">{money(totalContracted)}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Total Est. OH&P</div>
          <div className="text-xl font-semibold mt-1">{money(totalOhp)}</div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filterButton("all", "All")}
          {filterButton("active", "Active")}
          {filterButton("at_risk", "At Risk")}
          {filterButton("on_hold", "Starting Soon")}
          {filterButton("complete", "Inactive")}
        </div>
      </div>

      <section className="border rounded-lg">
        <div className="p-4 border-b">
          <h2 className="font-semibold">
            {scope === "all" && canViewAll ? "All Projects" : "My Projects"}
          </h2>
          <p className="text-sm opacity-70">Select a project to open details.</p>
        </div>

        <div className="max-h-[640px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black/5 backdrop-blur border-b">
              <tr>
                <th className="text-left p-3">Project #</th>
                <th className="text-left p-3">Project</th>
                <th className="text-left p-3">City</th>
                <th className="text-left p-3">Health</th>
                <th className="text-left p-3">Start</th>
                <th className="text-left p-3">End</th>
                <th className="text-right p-3">Contract</th>
                <th className="text-right p-3">Est OH&P</th>
                <th className="text-right p-3">Est Buyout</th>
                <th className="text-left p-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td className="p-4 opacity-70" colSpan={10}>
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
                    <td className="p-3">{p.project_number ?? "-"}</td>
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
