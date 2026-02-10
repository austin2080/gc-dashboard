import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";
import ChangeOrderLineItems from "@/components/change-order-line-items";

type ChangeOrderItemInput = {
  cost_code?: string | null;
  description?: string | null;
  amount?: string | number | null;
};

type ScheduleOfValuesItem = {
  cost_code?: string | null;
  description?: string | null;
};

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

async function createChangeOrder(projectId: string, formData: FormData): Promise<void> {
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

  if (!project) return;

  const contractId = String(formData.get("contract_id") ?? "").trim() || null;
  const type = String(formData.get("type") ?? "owner");
  const status = String(formData.get("status") ?? "draft");
  const title = String(formData.get("title") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const itemsJson = String(formData.get("items_json") ?? "[]");
  const items = (() => {
    try {
      const parsed = JSON.parse(itemsJson) as ChangeOrderItemInput[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  const amount = items.reduce((sum: number, item) => {
    const val = Number(item?.amount ?? 0);
    return sum + (Number.isNaN(val) ? 0 : val);
  }, 0);
  const submitted_date = String(formData.get("submitted_date") ?? "").trim() || null;
  const approved_date = String(formData.get("approved_date") ?? "").trim() || null;

  const { data: inserted, error } = await supabase
    .from("change_orders")
    .insert({
      project_id: projectId,
      contract_id: contractId,
      type,
      status,
      title,
      description,
      amount,
      submitted_date,
      approved_date,
    })
    .select("id")
    .single();

  if (error) return;
  if (!inserted) return;

  if (items.length > 0) {
    const { error: itemError } = await supabase.from("change_order_items").insert(
      items.map((item) => ({
        change_order_id: inserted.id,
        project_id: projectId,
        contract_id: contractId,
        cost_code: item?.cost_code ?? null,
        description: item?.description ?? null,
        amount: Number(item?.amount ?? 0) || 0,
      }))
    );

    if (itemError) return;
  }

  return;
}

export default async function ProjectChangeOrdersPage({ params }: PageProps) {
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
    .select("id,title,schedule_of_values")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const sovOptions = (contracts ?? [])
    .flatMap((contract) => {
      const items = Array.isArray(contract.schedule_of_values)
        ? (contract.schedule_of_values as ScheduleOfValuesItem[])
        : [];
      return items.map((item) => ({
        code: String(item?.cost_code ?? "").trim(),
        description: String(item?.description ?? "").trim(),
      }));
    })
    .filter((item) => item.code);

  const { data: costCodes } = await supabase
    .from("cost_codes")
    .select("code,description,division")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("code", { ascending: true });

  const { data: changeOrders } = await supabase
    .from("change_orders")
    .select(
      "id,type,status,title,amount,submitted_date,approved_date,contract_id"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return (
    <main className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Change Orders</h1>
        <p className="text-sm opacity-80">Track owner and subcontractor change orders for {project.name}.</p>
      </header>

      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Add Change Order</h2>
        <form action={createChangeOrder.bind(null, projectId)} className="space-y-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
              <div className="opacity-70">Type</div>
              <select
                name="type"
                className="w-full rounded border border-black/20 px-3 py-2"
                defaultValue="owner"
              >
                <option value="owner">Owner</option>
                <option value="subcontractor">Subcontractor</option>
              </select>
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Status</div>
              <select
                name="status"
                className="w-full rounded border border-black/20 px-3 py-2"
                defaultValue="draft"
              >
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <div className="opacity-70">Title</div>
              <input
                name="title"
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="CO-001"
              />
            </label>
            <label className="space-y-1 md:col-span-6">
              <div className="opacity-70">Description</div>
              <input
                name="description"
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="Scope change details"
              />
            </label>
          </div>

          <ChangeOrderLineItems sovOptions={sovOptions} costCodeOptions={costCodes ?? []} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="space-y-1">
              <div className="opacity-70">Submitted</div>
              <input
                type="date"
                name="submitted_date"
                className="w-full rounded border border-black/20 px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Approved</div>
              <input
                type="date"
                name="approved_date"
                className="w-full rounded border border-black/20 px-3 py-2"
              />
            </label>
          </div>
          <div>
            <button className="rounded border border-black bg-black px-4 py-2 text-sm text-white">
              Add Change Order
            </button>
          </div>
        </form>
      </section>

      <section className="border rounded-lg">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Change Orders</h2>
        </div>
        <div className="max-h-[640px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black/5 backdrop-blur border-b">
              <tr>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Title</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Submitted</th>
                <th className="text-left p-3">Approved</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {changeOrders && changeOrders.length > 0 ? (
                changeOrders.map((co) => (
                  <tr key={co.id} className="border-b last:border-b-0">
                    <td className="p-3 capitalize">{co.type}</td>
                    <td className="p-3">{co.title ?? "-"}</td>
                    <td className="p-3 capitalize">{co.status}</td>
                    <td className="p-3">
                      {co.submitted_date ? new Date(co.submitted_date).toLocaleDateString() : "-"}
                    </td>
                    <td className="p-3">
                      {co.approved_date ? new Date(co.approved_date).toLocaleDateString() : "-"}
                    </td>
                    <td className="p-3 text-right">
                      {co.amount?.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        className="text-xs underline"
                        href={`/projects/${projectId}/change-orders/${co.id}/edit`}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-4 opacity-70" colSpan={7}>
                    No change orders yet.
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
