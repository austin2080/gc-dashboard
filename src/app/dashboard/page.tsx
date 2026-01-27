import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";
import { listProjects } from "@/lib/db/projects";
import DashboardProjectsTable from "@/components/dashboard-projects-table";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function healthLabel(h: string) {
  if (h === "on_track") return "Active";
  if (h === "at_risk") return "At Risk";
  if (h === "on_hold") return "On Hold";
  if (h === "complete") return "Inactive";
  return h;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const companyId = await getMyCompanyId();
  const projects = await listProjects(companyId);

  const projectIds = projects.map((p) => p.id);
  const { data: primeContracts } = await supabase
    .from("prime_contracts")
    .select("project_id,estimated_buyout,schedule_of_values")
    .in("project_id", projectIds);

  const aggregates = (primeContracts ?? []).reduce<Record<string, { contract: number; ohp: number; buyout: number }>>(
    (acc, c) => {
      const items = Array.isArray(c.schedule_of_values) ? c.schedule_of_values : [];
      const contractTotal = items.reduce((sum: number, item: any) => {
        const val = Number(String(item?.amount ?? "").replace(/[^\d.]/g, ""));
        return sum + (Number.isNaN(val) ? 0 : val);
      }, 0);
      const ohpTotal = items.reduce((sum: number, item: any) => {
        const label = `${item?.cost_code ?? ""} ${item?.description ?? ""}`.toLowerCase();
        const isOhp =
          label.includes("oh&p") ||
          label.includes("ohp") ||
          label.includes("overhead") ||
          label.includes("profit");
        if (!isOhp) return sum;
        const val = Number(String(item?.amount ?? "").replace(/[^\d.]/g, ""));
        return sum + (Number.isNaN(val) ? 0 : val);
      }, 0);
      const buyout = c.estimated_buyout ?? 0;
      const key = c.project_id as string;
      const prev = acc[key] ?? { contract: 0, ohp: 0, buyout: 0 };
      acc[key] = {
        contract: prev.contract + contractTotal,
        ohp: prev.ohp + ohpTotal,
        buyout: prev.buyout + buyout,
      };
      return acc;
    },
    {}
  );

  const totalContract = Object.values(aggregates).reduce((sum, v) => sum + v.contract, 0);
  const totalProfit = Object.values(aggregates).reduce((sum, v) => sum + v.ohp, 0);
  const totalBuyout = Object.values(aggregates).reduce((sum, v) => sum + v.buyout, 0);
  const totalMargin = totalContract ? ((totalProfit + totalBuyout) / totalContract) * 100 : 0;

  const activeProjectIds = projects
    .filter((p) => p.health !== "complete")
    .map((p) => p.id);

  const { data: payApps } = await supabase
    .from("pay_apps")
    .select("project_id,due_date,amount,status")
    .in("project_id", activeProjectIds);

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const overdue30 = (payApps ?? []).filter((p) => {
    if (!p.due_date) return false;
    const due = new Date(p.due_date);
    return due < thirtyDaysAgo && p.status !== "paid";
  });

  const overdue60 = (payApps ?? []).filter((p) => {
    if (!p.due_date) return false;
    const due = new Date(p.due_date);
    return due < sixtyDaysAgo && p.status !== "paid";
  });

  const overdue30Count = overdue30.length;
  const overdue30Amount = overdue30.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const overdue60Count = overdue60.length;
  const overdue60Amount = overdue60.reduce((sum, p) => sum + (p.amount ?? 0), 0);

  const paymentsReceived = (payApps ?? [])
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const projectsWithAggregates = projects.map((p) => {
    const agg = aggregates[p.id] ?? { contract: 0, ohp: 0, buyout: 0 };
    return {
      ...p,
      contracted_value: agg.contract,
      estimated_profit: agg.ohp,
      estimated_buyout: agg.buyout,
    };
  });

  return (
    <main className="p-6 space-y-6">
      <section className="border rounded-2xl p-4 md:p-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide opacity-60">Homepage</div>
          <h1 className="text-2xl md:text-3xl font-semibold mt-1">Welcome back</h1>
          <div className="text-sm opacity-70">Logged in as: {data.user.email}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="border rounded-lg px-3 py-2 text-sm">Notifications</button>
          <button className="border rounded-lg px-3 py-2 text-sm">Quick Actions</button>
          <Link className="border rounded-lg px-3 py-2 text-sm" href="/projects/new">
            New Project
          </Link>
        </div>
      </section>

      {/* Summary cards */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Total Contracted</div>
          <div className="text-xl font-semibold mt-1">{money(totalContract)}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Total Est. OH&P</div>
          <div className="text-xl font-semibold mt-1">{money(totalProfit)}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Total Est. Buyout</div>
          <div className="text-xl font-semibold mt-1">{money(totalBuyout)}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Est. Margin</div>
          <div className="text-xl font-semibold mt-1">{totalMargin.toFixed(1)}%</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Pay Apps &gt; 30 Days</div>
          <div className="text-xl font-semibold mt-1">{overdue30Count}</div>
          <div className="text-xs opacity-60 mt-1">{money(overdue30Amount)}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Pay Apps &gt; 60 Days</div>
          <div className="text-xl font-semibold mt-1">{overdue60Count}</div>
          <div className="text-xs opacity-60 mt-1">{money(overdue60Amount)}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Payments Received</div>
          <div className="text-xl font-semibold mt-1">{money(paymentsReceived)}</div>
        </div>
        <div className="border rounded-lg p-4 space-y-1">
          <div className="text-sm opacity-70">Lien Waivers</div>
          <div className="text-sm">Conditional: 3</div>
          <div className="text-sm">Unconditional: 5</div>
        </div>
      </section>

      <DashboardProjectsTable projects={projectsWithAggregates} />
    </main>
  );
}
