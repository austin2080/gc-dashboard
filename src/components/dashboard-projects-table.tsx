"use client";

import type { KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import HealthPill from "@/components/health-pill";

type ProjectRow = {
  id: string;
  project_number?: string | null;
  name: string;
  city: string | null;
  health: "on_track" | "at_risk" | "on_hold" | "complete";
  contracted_value: number | null;
  estimated_profit: number | null;
  estimated_buyout: number | null;
  updated_at: string | null;
};

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function DashboardProjectsTable({ projects }: { projects: ProjectRow[] }) {
  const router = useRouter();

  function onRowClick(id: string) {
    router.push(`/projects/${id}`);
  }

  function onRowKeyDown(id: string, e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(`/projects/${id}`);
    }
  }

  return (
    <section className="border rounded-lg">
      <div className="p-4 border-b">
        <h2 className="font-semibold">Projects</h2>
        <p className="text-sm opacity-70">Click a project to open details.</p>
      </div>

      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-black/5 backdrop-blur border-b">
              <tr>
                <th className="text-left p-3">Project #</th>
                <th className="text-left p-3">Project</th>
                <th className="text-left p-3">City</th>
                <th className="text-left p-3">Health</th>
                <th className="text-right p-3">Contract</th>
                <th className="text-right p-3">Est OH&P</th>
              <th className="text-right p-3">Est Buyout</th>
              <th className="text-left p-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
                <tr>
                  <td className="p-4 opacity-70" colSpan={8}>
                    No projects yet. Add a few rows in Supabase → projects table.
                  </td>
                </tr>
              ) : (
                projects.map((p) => (
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
  );
}
