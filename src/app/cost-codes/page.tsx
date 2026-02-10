import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";

async function createCostCode(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const companyId = await getMyCompanyId();

  const code = String(formData.get("code") ?? "").trim();
  if (!code) return;

  const description = String(formData.get("description") ?? "").trim() || null;
  const division = String(formData.get("division") ?? "").trim() || null;
  const is_active = formData.get("is_active") === "on";

  const { error } = await supabase
    .from("cost_codes")
    .insert({
      company_id: companyId,
      code,
      description,
      division,
      is_active,
    });

  if (error) return;
}

export default async function CostCodesPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const companyId = await getMyCompanyId();
  const { data: costCodes } = await supabase
    .from("cost_codes")
    .select("id,code,description,division,is_active,created_at")
    .eq("company_id", companyId)
    .order("code", { ascending: true });

  return (
    <main className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Cost Codes</h1>
        <p className="text-sm opacity-80">
          Manage your company’s cost code list for SOVs, change orders, and pay apps.
        </p>
      </header>

      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Add Cost Code</h2>
        <form action={createCostCode} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <label className="space-y-1">
            <div className="opacity-70">Code</div>
            <input
              name="code"
              className="w-full rounded border border-black/20 px-3 py-2"
              placeholder="01-000"
              required
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <div className="opacity-70">Description</div>
            <input
              name="description"
              className="w-full rounded border border-black/20 px-3 py-2"
              placeholder="General Requirements"
            />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Division</div>
            <input
              name="division"
              className="w-full rounded border border-black/20 px-3 py-2"
              placeholder="01"
            />
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-4">
            <input type="checkbox" name="is_active" className="h-4 w-4" defaultChecked />
            <span>Active</span>
          </label>
          <div className="md:col-span-4">
            <button className="rounded border border-black bg-black px-4 py-2 text-sm text-white">
              Add Cost Code
            </button>
          </div>
        </form>
      </section>

      <section className="border rounded-lg">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Cost Code List</h2>
        </div>
        <div className="max-h-[640px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black/5 backdrop-blur border-b">
              <tr>
                <th className="text-left p-3">Code</th>
                <th className="text-left p-3">Description</th>
                <th className="text-left p-3">Active</th>
                <th className="text-left p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {costCodes && costCodes.length > 0 ? (
                Object.entries(
                  costCodes.reduce<
                    Record<string, { rows: typeof costCodes; minCode: number }>
                  >((acc, c) => {
                    const key = c.division ?? "Other";
                    const codeNum = Number(String(c.code ?? "").slice(0, 2)) || 999;
                    if (!acc[key]) {
                      acc[key] = { rows: [c], minCode: codeNum };
                    } else {
                      acc[key].rows = [...acc[key].rows, c];
                      acc[key].minCode = Math.min(acc[key].minCode, codeNum);
                    }
                    return acc;
                  }, {})
                )
                  .sort(([, a], [, b]) => a.minCode - b.minCode)
                  .map(([division, group]) => (
                    <>
                      <tr key={`division-${division}`} className="bg-black/[0.02]">
                        <td className="p-3 font-semibold" colSpan={4}>
                          {division}
                        </td>
                      </tr>
                      {group.rows.map((c) => (
                        <tr key={c.id} className="border-b last:border-b-0">
                          <td className="p-3 pl-6 font-medium">{c.code}</td>
                          <td className="p-3">{c.description ?? "-"}</td>
                          <td className="p-3">{c.is_active ? "Yes" : "No"}</td>
                          <td className="p-3">
                            {c.created_at ? new Date(c.created_at).toLocaleDateString() : "-"}
                          </td>
                        </tr>
                      ))}
                    </>
                  ))
              ) : (
                <tr>
                  <td className="p-4 opacity-70" colSpan={4}>
                    No cost codes yet. Add your first code above.
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
