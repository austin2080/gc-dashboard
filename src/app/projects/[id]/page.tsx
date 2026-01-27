import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";
import { listProjects } from "@/lib/db/projects";
import ProjectTeamTable from "@/components/project-team-table";

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

  const { data: primeContracts } = await supabase
    .from("prime_contracts")
    .select("estimated_buyout,change_orders_amount,schedule_of_values")
    .eq("project_id", project.id);

  const { data: changeOrders } = await supabase
    .from("change_orders")
    .select("id,type,status,amount")
    .eq("project_id", project.id);

  const { data: changeOrderItems } = await supabase
    .from("change_order_items")
    .select("change_order_id,cost_code,description,amount")
    .eq("project_id", project.id);

  const { data: payApps } = await supabase
    .from("pay_apps")
    .select("amount,due_date,status")
    .eq("project_id", project.id);

  const sovTotalsByContract = (primeContracts ?? []).map((c) => {
    const items = Array.isArray(c.schedule_of_values) ? c.schedule_of_values : [];
    return items.reduce((sum: number, item: any) => {
      const val = Number(String(item?.amount ?? "").replace(/[^\d.]/g, ""));
      return sum + (Number.isNaN(val) ? 0 : val);
    }, 0);
  });

  const contracted = sovTotalsByContract.reduce((sum, v) => sum + v, 0);
  const approvedOwnerCO = (changeOrders ?? []).reduce((sum, co) => {
    if (co.type !== "owner" || co.status !== "approved") return sum;
    return sum + (co.amount ?? 0);
  }, 0);
  const pendingOwnerCO = (changeOrders ?? []).reduce((sum, co) => {
    if (co.type !== "owner") return sum;
    if (co.status !== "draft" && co.status !== "submitted") return sum;
    return sum + (co.amount ?? 0);
  }, 0);
  const revisedContracted = contracted + approvedOwnerCO;
  const potentialRevised = revisedContracted + pendingOwnerCO;
  const buyout = (primeContracts ?? []).reduce(
    (sum, c) => sum + (c.estimated_buyout ?? 0),
    0
  );

  const baseOhp = (primeContracts ?? []).reduce((sum, c) => {
    const items = Array.isArray(c.schedule_of_values) ? c.schedule_of_values : [];
    const ohp = items.reduce((inner: number, item: any) => {
      const label = `${item?.cost_code ?? ""} ${item?.description ?? ""}`.toLowerCase();
      const isOhp =
        label.includes("oh&p") ||
        label.includes("ohp") ||
        label.includes("overhead") ||
        label.includes("profit");
      if (!isOhp) return inner;
      const val = Number(String(item?.amount ?? "").replace(/[^\d.]/g, ""));
      return inner + (Number.isNaN(val) ? 0 : val);
    }, 0);
    return sum + ohp;
  }, 0);
  const approvedOhp = (changeOrderItems ?? []).reduce((sum, item) => {
    const parent = (changeOrders ?? []).find((co) => co.id === item.change_order_id);
    if (!parent || parent.type !== "owner") return sum;
    if (parent.status !== "approved") return sum;
    const label = `${item?.cost_code ?? ""} ${item?.description ?? ""}`.toLowerCase();
    const isOhp =
      label.includes("oh&p") ||
      label.includes("ohp") ||
      label.includes("overhead") ||
      label.includes("profit");
    if (!isOhp) return sum;
    const val = Number(item?.amount ?? 0);
    return sum + (Number.isNaN(val) ? 0 : val);
  }, 0);
  const profit = baseOhp + approvedOhp;
  const pendingOhp = (changeOrderItems ?? []).reduce((sum, item) => {
    const parent = (changeOrders ?? []).find((co) => co.id === item.change_order_id);
    if (!parent || parent.type !== "owner") return sum;
    if (parent.status !== "draft" && parent.status !== "submitted") return sum;
    const label = `${item?.cost_code ?? ""} ${item?.description ?? ""}`.toLowerCase();
    const isOhp =
      label.includes("oh&p") ||
      label.includes("ohp") ||
      label.includes("overhead") ||
      label.includes("profit");
    if (!isOhp) return sum;
    const val = Number(item?.amount ?? 0);
    return sum + (Number.isNaN(val) ? 0 : val);
  }, 0);

  const marginBase = revisedContracted || contracted;
  const margin = marginBase ? ((profit + buyout) / marginBase) * 100 : 0;
  const now = new Date();
  const overdueTotals = (payApps ?? []).reduce(
    (acc, app) => {
      const due = app.due_date ? new Date(app.due_date) : null;
      if (!due || app.status === "paid") return acc;
      const daysLate = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLate > 30) acc.over30 += app.amount ?? 0;
      if (daysLate > 60) acc.over60 += app.amount ?? 0;
      return acc;
    },
    { over30: 0, over60: 0 }
  );
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
          <div className="text-sm opacity-70">
            {approvedOwnerCO !== 0 ? "Revised Contract Value" : "Original Contract Value"}
          </div>
          {approvedOwnerCO !== 0 ? (
            <>
              <div className="text-xl font-semibold mt-1">
                {revisedContracted.toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD",
                })}
              </div>
              <div className="text-xs opacity-60 mt-1">
                Original:{" "}
                {contracted.toLocaleString(undefined, { style: "currency", currency: "USD" })}
              </div>
              {pendingOwnerCO !== 0 ? (
                <div className="text-xs opacity-60 mt-1">
                  Potential Revised Contract Value:{" "}
                  {potentialRevised.toLocaleString(undefined, {
                    style: "currency",
                    currency: "USD",
                  })}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="text-xl font-semibold mt-1">
                {contracted.toLocaleString(undefined, { style: "currency", currency: "USD" })}
              </div>
              {pendingOwnerCO !== 0 ? (
                <div className="text-xs opacity-60 mt-1">
                  Potential Revised Contract Value:{" "}
                  {potentialRevised.toLocaleString(undefined, {
                    style: "currency",
                    currency: "USD",
                  })}
                </div>
              ) : null}
            </>
          )}
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Est. OH&P</div>
          <div className="text-xl font-semibold mt-1">
            {profit.toLocaleString(undefined, { style: "currency", currency: "USD" })}
          </div>
          {pendingOhp !== 0 ? (
            <div className="text-xs opacity-60 mt-1">
              Potential Revised OH&amp;P:{" "}
              {(profit + pendingOhp).toLocaleString(undefined, {
                style: "currency",
                currency: "USD",
              })}
            </div>
          ) : null}
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
          <div className="text-xl font-semibold mt-1">
            {(() => {
              const approved = (changeOrders ?? []).filter(
                (co) => co.type === "owner" && co.status === "approved"
              );
              const total = approved.reduce((sum, co) => sum + (co.amount ?? 0), 0);
              return total.toLocaleString(undefined, { style: "currency", currency: "USD" });
            })()}
          </div>
          <div className="text-xs opacity-60 mt-1">
            Pending:{" "}
            {(() => {
              const pending = (changeOrders ?? []).filter(
                (co) => co.type === "owner" && (co.status === "draft" || co.status === "submitted")
              );
              const total = pending.reduce((sum, co) => sum + (co.amount ?? 0), 0);
              return total.toLocaleString(undefined, { style: "currency", currency: "USD" });
            })()}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Subcontractor Change Orders</div>
          <div className="text-xl font-semibold mt-1">
            {(() => {
              const approved = (changeOrders ?? []).filter(
                (co) => co.type === "subcontractor" && co.status === "approved"
              );
              const total = approved.reduce((sum, co) => sum + (co.amount ?? 0), 0);
              return total.toLocaleString(undefined, { style: "currency", currency: "USD" });
            })()}
          </div>
          <div className="text-xs opacity-60 mt-1">
            Pending:{" "}
            {(() => {
              const pending = (changeOrders ?? []).filter(
                (co) =>
                  co.type === "subcontractor" &&
                  (co.status === "draft" || co.status === "submitted")
              );
              const total = pending.reduce((sum, co) => sum + (co.amount ?? 0), 0);
              return total.toLocaleString(undefined, { style: "currency", currency: "USD" });
            })()}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Owner Pay App Status</div>
          <div className="text-sm mt-2">
            Pay Apps &gt; 30 days:{" "}
            {overdueTotals.over30.toLocaleString(undefined, {
              style: "currency",
              currency: "USD",
            })}
          </div>
          <div className="text-sm mt-1">
            Pay Apps &gt; 60 days:{" "}
            {overdueTotals.over60.toLocaleString(undefined, {
              style: "currency",
              currency: "USD",
            })}
          </div>
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

      {/* Lien Waivers */}
      <section className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Lien Waivers</h2>
          <div className="text-xs opacity-60">Placeholder</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <div className="border rounded-lg p-3">
            <div className="opacity-70">Conditional</div>
            <div className="text-lg font-semibold mt-1">3 received</div>
            <div className="text-xs opacity-60">2 outstanding</div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="opacity-70">Unconditional</div>
            <div className="text-lg font-semibold mt-1">5 received</div>
            <div className="text-xs opacity-60">1 outstanding</div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="opacity-70">Last Waiver Date</div>
            <div className="text-lg font-semibold mt-1">—</div>
            <div className="text-xs opacity-60">Most recent waiver</div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="opacity-70">Total Waiver Amount</div>
            <div className="text-lg font-semibold mt-1">—</div>
            <div className="text-xs opacity-60">Placeholder total</div>
          </div>
        </div>
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

      {/* Project Team */}
      <ProjectTeamTable
        teamMembers={[
          {
            role: "Project Manager",
            name: "John Smith",
            email: "john.smith@company.com",
            office: "(555) 123-4567",
            mobile: "(555) 987-6543",
          },
          {
            role: "Superintendent",
            name: "Sarah Johnson",
            email: "sarah.johnson@company.com",
            office: "(555) 123-4568",
            mobile: "(555) 987-6544",
          },
          {
            role: "Safety Manager",
            name: "Mike Wilson",
            email: "mike.wilson@company.com",
            office: "(555) 123-4569",
            mobile: "(555) 987-6545",
          },
        ]}
      />
    </main>
  );
}
