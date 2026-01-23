import HealthPill from "@/components/health-pill";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";
import { listProjects } from "@/lib/db/projects";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function healthLabel(h: string) {
  if (h === "on_track") return "On Track";
  if (h === "at_risk") return "At Risk";
  if (h === "on_hold") return "On Hold";
  if (h === "complete") return "Complete";
  return h;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const companyId = await getMyCompanyId();
  const projects = await listProjects(companyId);

  const activeCount = projects.filter((p) => p.health !== "complete").length;
  const atRiskCount = projects.filter((p) => p.health === "at_risk").length;
  const totalContract = projects.reduce((sum, p) => sum + (p.contracted_value || 0), 0);
  const totalProfit = projects.reduce((sum, p) => sum + (p.estimated_profit || 0), 0);

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm opacity-80">Logged in as: {data.user.email}</p>
        </div>

        <div className="flex gap-2">
          <Link className="border rounded px-3 py-2 text-sm" href="/projects">
            Projects
          </Link>
          <Link className="border rounded px-3 py-2 text-sm" href="/bidding">
            Bidding
          </Link>
        </div>
      </header>

      {/* Summary cards */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Active Projects</div>
          <div className="text-xl font-semibold mt-1">{activeCount}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">At Risk</div>
          <div className="text-xl font-semibold mt-1">{atRiskCount}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Total Contracted</div>
          <div className="text-xl font-semibold mt-1">{money(totalContract)}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Total Est. Profit</div>
          <div className="text-xl font-semibold mt-1">{money(totalProfit)}</div>
        </div>
      </section>

      {/* Projects table (fixed height + internal scroll) */}
      <section className="border rounded-lg">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Projects</h2>
          <p className="text-sm opacity-70">Click a project later to open details.</p>
        </div>

        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black/5 backdrop-blur border-b">
              <tr>
                <th className="text-left p-3">Project</th>
                <th className="text-left p-3">City</th>
                <th className="text-left p-3">Health</th>
                <th className="text-right p-3">Contract</th>
                <th className="text-right p-3">Est Profit</th>
                <th className="text-right p-3">Est Buyout</th>
                <th className="text-left p-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td className="p-4 opacity-70" colSpan={7}>
                    No projects yet. Add a few rows in Supabase → projects table.
                  </td>
                </tr>
              ) : (
                projects.map((p) => (
                  <tr key={p.id} className="border-b last:border-b-0">
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
    </main>
  );
}
