import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";

type PageProps = {
  params: { id: string; payAppId: string } | Promise<{ id: string; payAppId: string }>;
};

const money = (value: number) =>
  value.toLocaleString(undefined, { style: "currency", currency: "USD" });

export default async function PayAppDetailPage({ params }: PageProps) {
  const resolved = await Promise.resolve(params);
  const projectId = resolved?.id ?? "";
  const payAppId = resolved?.payAppId ?? "";

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

  const { data: payApp } = await supabase
    .from("pay_apps")
    .select("id,app_number,submitted_date,due_date,amount,status,contract_id")
    .eq("project_id", projectId)
    .eq("id", payAppId)
    .single();

  if (!payApp) redirect(`/projects/${projectId}/pay-apps`);

  const { data: contract } = payApp.contract_id
    ? await supabase
        .from("prime_contracts")
        .select("title,retention_percent,schedule_of_values")
        .eq("id", payApp.contract_id)
        .single()
    : { data: null };

  const retentionPercent = contract?.retention_percent ?? 0;
  const retentionThisPeriod = (payApp.amount ?? 0) * (retentionPercent / 100);
  const netPayable = (payApp.amount ?? 0) - retentionThisPeriod;

  const sovItems = Array.isArray(contract?.schedule_of_values)
    ? contract?.schedule_of_values
    : [];

  return (
    <main className="p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm opacity-70">Pay App Details</div>
          <h1 className="text-2xl font-semibold">
            {payApp.app_number ? `Pay App ${payApp.app_number}` : "Pay App"} · {project.name}
          </h1>
          <p className="text-sm opacity-70">Status: {payApp.status ?? "draft"}</p>
        </div>
        <Link className="rounded border border-black px-4 py-2 text-sm" href={`/projects/${projectId}/pay-apps`}>
          Back to Pay Apps
        </Link>
      </header>

      <section className="border rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div>
          <div className="opacity-70">Pay App #</div>
          <div className="text-lg font-semibold mt-1">{payApp.app_number ?? "-"}</div>
        </div>
        <div>
          <div className="opacity-70">Billing Period</div>
          <div className="text-lg font-semibold mt-1">
            {payApp.submitted_date ? new Date(payApp.submitted_date).toLocaleDateString() : "-"}
            {payApp.due_date ? ` – ${new Date(payApp.due_date).toLocaleDateString()}` : ""}
          </div>
        </div>
        <div>
          <div className="opacity-70">Contract</div>
          <div className="text-lg font-semibold mt-1">{contract?.title ?? "Owner Prime Contract"}</div>
        </div>
        <div>
          <div className="opacity-70">Submitted Date</div>
          <div className="text-lg font-semibold mt-1">
            {payApp.submitted_date ? new Date(payApp.submitted_date).toLocaleDateString() : "-"}
          </div>
        </div>
        <div>
          <div className="opacity-70">Payment Status</div>
          <div className="text-lg font-semibold mt-1">{payApp.status === "paid" ? "Paid" : "Unpaid"}</div>
        </div>
        <div>
          <div className="opacity-70">Amount This Period</div>
          <div className="text-lg font-semibold mt-1">{money(payApp.amount ?? 0)}</div>
        </div>
      </section>

      <section className="border rounded-lg">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Schedule of Values</h2>
          <p className="text-sm opacity-70">Owner-style breakdown for this pay app.</p>
        </div>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black/5 backdrop-blur border-b">
              <tr>
                <th className="text-left p-3">Cost Code</th>
                <th className="text-left p-3">Description</th>
                <th className="text-right p-3">Scheduled Value</th>
                <th className="text-right p-3">Previous Billed</th>
                <th className="text-right p-3">This Period</th>
                <th className="text-right p-3">Total Completed</th>
                <th className="text-right p-3">Balance to Finish</th>
                <th className="text-right p-3">% Complete</th>
              </tr>
            </thead>
            <tbody>
              {sovItems.length > 0 ? (
                sovItems.map((item: any, index: number) => {
                  const scheduled = Number(String(item?.amount ?? "").replace(/[^\d.]/g, "")) || 0;
                  return (
                    <tr key={`${item?.cost_code ?? "code"}-${index}`} className="border-b last:border-b-0">
                      <td className="p-3">{item?.cost_code ?? "-"}</td>
                      <td className="p-3">{item?.description ?? "-"}</td>
                      <td className="p-3 text-right">{money(scheduled)}</td>
                      <td className="p-3 text-right">{money(0)}</td>
                      <td className="p-3 text-right">{money(0)}</td>
                      <td className="p-3 text-right">{money(0)}</td>
                      <td className="p-3 text-right">{money(scheduled)}</td>
                      <td className="p-3 text-right">0%</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="p-4 opacity-70" colSpan={8}>
                    No schedule of values items found for this contract.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Retention Summary</h2>
          <div className="text-sm opacity-70">Retention %</div>
          <div className="text-lg font-semibold">{retentionPercent.toFixed(2)}%</div>
          <div className="text-sm opacity-70">Retention This Period</div>
          <div className="text-lg font-semibold">{money(retentionThisPeriod)}</div>
          <div className="text-sm opacity-70">Retention Held to Date</div>
          <div className="text-lg font-semibold">{money(retentionThisPeriod)}</div>
          <div className="text-sm opacity-70">Net Payable</div>
          <div className="text-lg font-semibold">{money(netPayable)}</div>
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Backup & Attachments</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between border rounded px-3 py-2">
              <div>
                <div className="font-medium">Signed Pay App</div>
                <div className="text-xs opacity-60">PDF · Uploaded by PM</div>
              </div>
              <span className="text-xs opacity-60">Pending</span>
            </div>
            <div className="flex items-center justify-between border rounded px-3 py-2">
              <div>
                <div className="font-medium">Invoice</div>
                <div className="text-xs opacity-60">PDF · Uploaded by Accounting</div>
              </div>
              <span className="text-xs opacity-60">Pending</span>
            </div>
            <div className="flex items-center justify-between border rounded px-3 py-2">
              <div>
                <div className="font-medium">Lien Waivers</div>
                <div className="text-xs opacity-60">PDF · Uploaded by PM</div>
              </div>
              <span className="text-xs opacity-60">Pending</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border rounded-lg p-4">
        <h2 className="font-semibold">Approval Timeline</h2>
        <div className="mt-4 space-y-3 text-sm">
          {[
            { label: "Created", detail: "Pay app drafted", date: payApp.submitted_date },
            { label: "Submitted", detail: "Sent to owner", date: payApp.submitted_date },
            { label: "Reviewed", detail: "Under review", date: null },
            { label: "Approved", detail: "Awaiting approval", date: null },
            { label: "Paid", detail: "Pending payment", date: null },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-black" />
              <div>
                <div className="font-medium">{item.label}</div>
                <div className="text-xs opacity-60">
                  {item.detail}
                  {item.date ? ` · ${new Date(item.date).toLocaleDateString()}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
