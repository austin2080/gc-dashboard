import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";

type FormState = { error?: string };

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

async function createPayApp(
  projectId: string,
  _: FormState,
  formData: FormData
): Promise<FormState> {
  "use server";

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const companyId = await getMyCompanyId();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("company_id", companyId)
    .single();

  if (!project) return { error: "Project not found." };

  const contractId = String(formData.get("contract_id") ?? "").trim() || null;
  const app_number = String(formData.get("app_number") ?? "").trim() || null;
  const submitted_date = String(formData.get("submitted_date") ?? "").trim() || null;
  const due_date = String(formData.get("due_date") ?? "").trim() || null;
  const amount = Number(formData.get("amount") ?? 0) || 0;
  const status = String(formData.get("status") ?? "submitted");

  const { error } = await supabase.from("pay_apps").insert({
    project_id: projectId,
    contract_id: contractId,
    app_number,
    submitted_date,
    due_date,
    amount,
    status,
  });

  if (error) return { error: error.message };
  return {};
}

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
    .select("id,title")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const { data: payApps } = await supabase
    .from("pay_apps")
    .select("id,app_number,submitted_date,due_date,amount,status,contract_id")
    .eq("project_id", projectId)
    .order("due_date", { ascending: true });

  return (
    <main className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Pay Apps</h1>
        <p className="text-sm opacity-80">
          Track owner pay applications for {project.name}.
        </p>
      </header>

      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Add Pay App</h2>
        <form action={createPayApp.bind(null, projectId)} className="grid grid-cols-1 md:grid-cols-6 gap-4 text-sm">
          <label className="space-y-1 md:col-span-2">
            <div className="opacity-70">Prime Contract</div>
            <select name="contract_id" className="w-full rounded border border-black/20 px-3 py-2">
              <option value="">Select contract (optional)</option>
              {contracts?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Pay App #</div>
            <input name="app_number" className="w-full rounded border border-black/20 px-3 py-2" placeholder="1" />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Submitted</div>
            <input type="date" name="submitted_date" className="w-full rounded border border-black/20 px-3 py-2" />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Due Date</div>
            <input type="date" name="due_date" className="w-full rounded border border-black/20 px-3 py-2" />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Amount</div>
            <input type="number" name="amount" step="0.01" className="w-full rounded border border-black/20 px-3 py-2" placeholder="0.00" />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Status</div>
            <select name="status" className="w-full rounded border border-black/20 px-3 py-2" defaultValue="submitted">
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          <div className="md:col-span-6">
            <button className="rounded border border-black bg-black px-4 py-2 text-sm text-white">Add Pay App</button>
          </div>
        </form>
      </section>

      <section className="border rounded-lg">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Pay App List</h2>
        </div>
        <div className="max-h-[640px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black/5 backdrop-blur border-b">
              <tr>
                <th className="text-left p-3">Pay App #</th>
                <th className="text-left p-3">Submitted</th>
                <th className="text-left p-3">Due Date</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {payApps && payApps.length > 0 ? (
                payApps.map((p) => (
                  <tr key={p.id} className="border-b last:border-b-0">
                    <td className="p-3">{p.app_number ?? "-"}</td>
                    <td className="p-3">
                      {p.submitted_date ? new Date(p.submitted_date).toLocaleDateString() : "-"}
                    </td>
                    <td className="p-3">
                      {p.due_date ? new Date(p.due_date).toLocaleDateString() : "-"}
                    </td>
                    <td className="p-3 text-right">
                      {p.amount?.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                    </td>
                    <td className="p-3">{p.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-4 opacity-70" colSpan={5}>
                    No pay apps yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
