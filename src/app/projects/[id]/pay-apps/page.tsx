import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";
import PayAppsTable from "@/components/pay-apps-table";

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

const money = (value: number) =>
  value.toLocaleString(undefined, { style: "currency", currency: "USD" });

export default async function ProjectPayAppsPage({ params }: PageProps) {
  const resolved = await Promise.resolve(params);
  const projectId = resolved?.id ?? "";

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const companyId = await getMyCompanyId();
  const { data: project } = await supabase
    .from("projects")
    .select("id,name")
    .eq("id", projectId)
    .eq("company_id", companyId)
    .single();

  if (!project) redirect("/projects");

  const { data: contracts } = await supabase
    .from("prime_contracts")
    .select("retention_percent,schedule_of_values")
    .eq("project_id", projectId);

  const { data: changeOrders } = await supabase
    .from("change_orders")
    .select("type,status,amount")
    .eq("project_id", projectId);

  const { data: payApps } = await supabase
    .from("pay_apps")
    .select("id,app_number,submitted_date,due_date,amount,status,contract_id")
    .eq("project_id", projectId)
    .order("submitted_date", { ascending: true });

  const retentionValues = (contracts ?? [])
    .map((c) => c.retention_percent)
    .filter((val) => typeof val === "number" && !Number.isNaN(val));
  const retentionPercent = retentionValues.length
    ? retentionValues.reduce((sum, val) => sum + val, 0) / retentionValues.length
    : 0;

  const originalContractValue = (contracts ?? []).reduce((sum, contract) => {
    const items = Array.isArray(contract.schedule_of_values) ? contract.schedule_of_values : [];
    const total = items.reduce((inner: number, item: any) => {
      const raw = Number(String(item?.amount ?? "").replace(/[^\d.]/g, ""));
      return inner + (Number.isNaN(raw) ? 0 : raw);
    }, 0);
    return sum + total;
  }, 0);

  const approvedChangeOrders = (changeOrders ?? []).reduce((sum, order) => {
    if (order.type !== "owner" || order.status !== "approved") return sum;
    return sum + (order.amount ?? 0);
  }, 0);

  const currentContractValue = originalContractValue + approvedChangeOrders;
  const totalBilled = (payApps ?? []).reduce((sum, app) => {
    if (app.status === "rejected" || app.status === "draft") return sum;
    return sum + (app.amount ?? 0);
  }, 0);
  const totalPaid = (payApps ?? []).reduce((sum, app) => {
    if (app.status !== "paid") return sum;
    return sum + (app.amount ?? 0);
  }, 0);
  const outstandingBalance = Math.max(currentContractValue - totalPaid, 0);
  const retentionHeld = totalBilled * (retentionPercent / 100);

  const underReview = (payApps ?? []).filter((app) => app.status === "under_review");
  const reviseResubmit = (payApps ?? []).filter((app) => app.status === "revise_and_resubmit");
  const approvedApps = (payApps ?? []).filter((app) => app.status === "approved");
  const underReviewAmount = underReview.reduce((sum, app) => sum + (app.amount ?? 0), 0);
  const reviseResubmitAmount = reviseResubmit.reduce((sum, app) => sum + (app.amount ?? 0), 0);
  const approvedAmount = approvedApps.reduce((sum, app) => sum + (app.amount ?? 0), 0);

  return (
    <main className="p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Invoicing / Pay Apps</h1>
          <p className="text-sm opacity-80">
            Instant clarity on billing, payments, and what is holding things up for {project.name}.
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/pay-apps/new`}
          className="rounded border border-black bg-black px-4 py-2 text-sm text-white"
        >
          New Pay App
        </Link>
      </header>

      <div className="flex items-center gap-2 text-sm">
        <button className="rounded-full border border-black bg-black px-3 py-1 text-white">
          Owner
        </button>
        <button className="rounded-full border border-black/20 px-3 py-1 text-black/70 hover:bg-black/5">
          Subcontractor
        </button>
        <button className="rounded-full border border-black/20 px-3 py-1 text-black/70 hover:bg-black/5">
          Billing Periods
        </button>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="border rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide opacity-60">Under Review</div>
          <div className="text-xl font-semibold mt-2">{money(underReviewAmount)}</div>
          <div className="text-xs opacity-60 mt-1">
            {underReview.length} invoice{underReview.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide opacity-60">Revise &amp; Resubmit</div>
          <div className="text-xl font-semibold mt-2">{money(reviseResubmitAmount)}</div>
          <div className="text-xs opacity-60 mt-1">
            {reviseResubmit.length} invoice{reviseResubmit.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide opacity-60">Approved</div>
          <div className="text-xl font-semibold mt-2">{money(approvedAmount)}</div>
        </div>
      </section>

      <PayAppsTable
        projectId={projectId}
        projectName={project.name}
        payApps={payApps ?? []}
        retentionPercent={retentionPercent}
      />
    </main>
  );
}
