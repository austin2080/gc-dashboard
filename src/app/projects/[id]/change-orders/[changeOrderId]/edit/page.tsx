import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";
import ChangeOrderLineItems from "@/components/change-order-line-items";

type FormState = { error?: string };

type PageProps = {
  params:
    | { id: string; changeOrderId: string }
    | Promise<{ id: string; changeOrderId: string }>;
};

async function updateChangeOrder(
  projectId: string,
  changeOrderId: string,
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
  const type = String(formData.get("type") ?? "owner");
  const status = String(formData.get("status") ?? "draft");
  const title = String(formData.get("title") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const submitted_date = String(formData.get("submitted_date") ?? "").trim() || null;
  const approved_date = String(formData.get("approved_date") ?? "").trim() || null;
  const itemsJson = String(formData.get("items_json") ?? "[]");
  const items = (() => {
    try {
      const parsed = JSON.parse(itemsJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  const amount = items.reduce((sum: number, item: any) => {
    const val = Number(item?.amount ?? 0);
    return sum + (Number.isNaN(val) ? 0 : val);
  }, 0);

  const { error } = await supabase
    .from("change_orders")
    .update({
      contract_id: contractId,
      type,
      status,
      title,
      description,
      amount,
      submitted_date,
      approved_date,
    })
    .eq("id", changeOrderId)
    .eq("project_id", projectId);

  if (error) return { error: error.message };

  const { error: deleteError } = await supabase
    .from("change_order_items")
    .delete()
    .eq("change_order_id", changeOrderId)
    .eq("project_id", projectId);

  if (deleteError) return { error: deleteError.message };

  if (items.length > 0) {
    const { error: itemError } = await supabase.from("change_order_items").insert(
      items.map((item: any) => ({
        change_order_id: changeOrderId,
        project_id: projectId,
        contract_id: contractId,
        cost_code: item?.cost_code ?? null,
        description: item?.description ?? null,
        amount: Number(item?.amount ?? 0) || 0,
      }))
    );

    if (itemError) return { error: itemError.message };
  }

  return {};
}

export default async function ChangeOrderEditPage({ params }: PageProps) {
  const resolved = await Promise.resolve(params);
  const projectId = resolved?.id ?? "";
  const changeOrderId = resolved?.changeOrderId ?? "";

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

  const { data: changeOrder } = await supabase
    .from("change_orders")
    .select("id,contract_id,type,status,title,description,submitted_date,approved_date,amount")
    .eq("id", changeOrderId)
    .eq("project_id", projectId)
    .single();

  if (!changeOrder) redirect(`/projects/${projectId}/change-orders`);

  const { data: contracts } = await supabase
    .from("prime_contracts")
    .select("id,title,schedule_of_values")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const sovOptions = (contracts ?? [])
    .flatMap((contract) => {
      const items = Array.isArray(contract.schedule_of_values) ? contract.schedule_of_values : [];
      return items.map((item: any) => ({
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

  const { data: items } = await supabase
    .from("change_order_items")
    .select("cost_code,description,amount")
    .eq("change_order_id", changeOrderId)
    .eq("project_id", projectId);

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Edit Change Order</h1>
          <p className="text-sm opacity-80">{project.name}</p>
        </div>
        <Link className="border rounded px-3 py-2 text-sm" href={`/projects/${projectId}/change-orders`}>
          Back to Change Orders
        </Link>
      </header>

      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Change Order Details</h2>
        <form
          action={updateChangeOrder.bind(null, projectId, changeOrderId)}
          className="space-y-4 text-sm"
        >
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <label className="space-y-1 md:col-span-2">
              <div className="opacity-70">Prime Contract</div>
              <select
                name="contract_id"
                className="w-full rounded border border-black/20 px-3 py-2"
                defaultValue={changeOrder.contract_id ?? ""}
              >
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
                defaultValue={changeOrder.type ?? "owner"}
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
                defaultValue={changeOrder.status ?? "draft"}
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
                defaultValue={changeOrder.title ?? ""}
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="CO-001"
              />
            </label>
            <label className="space-y-1 md:col-span-6">
              <div className="opacity-70">Description</div>
              <input
                name="description"
                defaultValue={changeOrder.description ?? ""}
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="Scope change details"
              />
            </label>
          </div>

          <ChangeOrderLineItems
            sovOptions={sovOptions}
            costCodeOptions={costCodes ?? []}
            initialItems={(items ?? []) as Array<{ cost_code?: string; description?: string; amount?: number }>}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="space-y-1">
              <div className="opacity-70">Submitted</div>
              <input
                type="date"
                name="submitted_date"
                defaultValue={changeOrder.submitted_date ?? ""}
                className="w-full rounded border border-black/20 px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Approved</div>
              <input
                type="date"
                name="approved_date"
                defaultValue={changeOrder.approved_date ?? ""}
                className="w-full rounded border border-black/20 px-3 py-2"
              />
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs opacity-60">
              Current total: {changeOrder.amount?.toLocaleString(undefined, { style: "currency", currency: "USD" })}
            </div>
            <button className="rounded border border-black bg-black px-4 py-2 text-sm text-white">
              Save Change Order
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
