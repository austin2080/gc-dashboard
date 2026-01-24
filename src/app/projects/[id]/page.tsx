import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";
import { listProjects } from "@/lib/db/projects";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

export default async function ProjectDetailPage({ params }: PageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const companyId = await getMyCompanyId();

  const projects = await listProjects(companyId);
  const resolvedParams = await Promise.resolve(params);
  const requestedId =
    typeof resolvedParams?.id === "string"
      ? resolvedParams.id.trim()
      : Array.isArray(resolvedParams?.id)
        ? resolvedParams.id[0]
        : "";
  const project = projects.find((p) => p.id === requestedId) ?? null;

  if (!project) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold">Project not found</h1>
        <p className="mt-2 opacity-80">This project may not exist or you may not have access.</p>
      </main>
    );
  }

  const contracted = project.contracted_value ?? 0;
  const profit = project.estimated_profit ?? 0;
  const buyout = project.estimated_buyout ?? 0;
  const margin = contracted ? ((profit + buyout) / contracted) * 100 : 0;
  const alerts = [
    {
      title: "Schedule milestone approaching",
      detail: "Foundations due in 5 days",
      severity: "warning",
    },
    {
      title: "Procurement item overdue",
      detail: "RTU delivery is 3 days late",
      severity: "critical",
    },
    {
      title: "RFI overdue",
      detail: "RFI-014 needs response (2 days overdue)",
      severity: "critical",
    },
    {
      title: "Submittal overdue",
      detail: "Submittal-22 pending approval (5 days)",
      severity: "warning",
    },
  ] as const;

  return (
    <main className="p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {project.project_number ? `${project.project_number} - ` : ""}
            {project.name}
          </h1>
          <div className="text-sm opacity-80">
            {project.city ?? "City TBD"} · Health: {project.health}
          </div>
          <div className="text-xs opacity-60">Project ID: {project.id}</div>
        </div>

        <div className="flex items-center gap-2">
          <Link className="border rounded px-3 py-2 text-sm" href="/projects">
            Back to Projects
          </Link>
          <Link className="border rounded px-3 py-2 text-sm" href={`/projects/${project.id}/edit`}>
            Edit Project
          </Link>
        </div>
      </header>

      {/* Key metrics */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Contracted</div>
          <div className="text-xl font-semibold mt-1">
            {contracted.toLocaleString(undefined, { style: "currency", currency: "USD" })}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Est. OH&P</div>
          <div className="text-xl font-semibold mt-1">
            {profit.toLocaleString(undefined, { style: "currency", currency: "USD" })}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Est. Buyout</div>
          <div className="text-xl font-semibold mt-1">
            {buyout.toLocaleString(undefined, { style: "currency", currency: "USD" })}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Est. Margin</div>
          <div className="text-xl font-semibold mt-1">{margin.toFixed(1)}%</div>
        </div>
      </section>

      {/* Change orders & pay apps */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Owner Change Orders</div>
          <div className="text-xl font-semibold mt-1">—</div>
          <div className="text-xs opacity-60 mt-1">Pending change orders: —</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Subcontractor Change Orders</div>
          <div className="text-xl font-semibold mt-1">—</div>
          <div className="text-xs opacity-60 mt-1">Pending change orders: —</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Owner Pay App Status</div>
          <div className="text-xl font-semibold mt-1">—</div>
          <div className="text-xs opacity-60 mt-1">Outstanding: —</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Payments Received</div>
          <div className="text-xl font-semibold mt-1">—</div>
          <div className="text-xs opacity-60 mt-1">Most recent: —</div>
        </div>
      </section>

      {/* Actions / alerts */}
      <section className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Action Needed / Alerts</h2>
          <div className="text-xs opacity-60">{alerts.length} items</div>
        </div>
        {alerts.length === 0 ? (
          <div className="text-sm opacity-70">
            No alerts yet. When deadlines approach or items go overdue, they’ll show up here.
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((a, idx) => (
              <div
                key={`${a.title}-${idx}`}
                className="flex items-center justify-between gap-4 rounded border border-black/10 px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{a.title}</div>
                  <div className="text-xs opacity-70">{a.detail}</div>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    a.severity === "critical"
                      ? "border border-red-500/40 text-red-700"
                      : "border border-yellow-500/40 text-yellow-700"
                  }`}
                >
                  {a.severity === "critical" ? "Critical" : "Warning"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Overview */}
      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div>
            <div className="opacity-70">Project Number</div>
            <div>{project.project_number ?? "-"}</div>
          </div>
          <div>
            <div className="opacity-70">City</div>
            <div>{project.city ?? "-"}</div>
          </div>
          <div>
            <div className="opacity-70">Start Date</div>
            <div>
              {project.start_date ? new Date(project.start_date).toLocaleDateString() : "-"}
            </div>
          </div>
          <div>
            <div className="opacity-70">End Date</div>
            <div>
              {project.end_date ? new Date(project.end_date).toLocaleDateString() : "-"}
            </div>
          </div>
          <div>
            <div className="opacity-70">Health</div>
            <div>{project.health}</div>
          </div>
          <div>
            <div className="opacity-70">Last Updated</div>
            <div>
              {project.updated_at ? new Date(project.updated_at).toLocaleString() : "-"}
            </div>
          </div>
        </div>
      </section>

      {/* Sections */}
      <section className="grid grid-cols-1 lg:grid-cols-1 gap-4">
        <div className="border rounded-lg p-4 space-y-2">
          <h3 className="font-semibold">Project Directory</h3>
          <p className="text-sm opacity-70">
            Key contacts, vendors, and project-specific subcontractors.
          </p>
          <div className="text-xs opacity-60">Coming soon</div>
        </div>
      </section>
    </main>
  );
}
