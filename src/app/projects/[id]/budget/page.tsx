import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";
import BudgetTransferForm from "@/components/budget-transfer-form";
import BudgetModificationModal from "@/components/budget-modification-modal";

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
  searchParams?: { tab?: string };
};

type BudgetRow = {
  costCode: string;
  description: string;
  budget: number;
  committed: number;
  spent: number;
};

type TransferRow = {
  id: string;
  from_code: string;
  to_code: string;
  amount: number;
  note: string | null;
  created_at: string;
};

type ScheduleOfValuesItem = {
  cost_code?: string | null;
  description?: string | null;
  amount?: string | number | null;
};

async function createTransfer(
  projectId: string,
  _: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
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

  const from_code = String(formData.get("from_code") ?? "").trim();
  const to_code = String(formData.get("to_code") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0) || 0;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!from_code || !to_code) return { error: "From and To cost codes are required." };
  if (from_code === to_code) return { error: "From and To cost codes must be different." };
  if (amount <= 0) return { error: "Amount must be greater than 0." };

  const { error } = await supabase.from("budget_transfers").insert({
    project_id: projectId,
    from_code,
    to_code,
    amount,
    note,
    created_by: data.user.id,
  });

  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}/budget`);
  return {};
}

export default async function ProjectBudgetPage({ params, searchParams }: PageProps) {
  const resolved = await Promise.resolve(params);
  const projectId = resolved?.id ?? "";
  const activeTab = searchParams?.tab === "transfers" ? "transfers" : "budget";

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
    .select("schedule_of_values")
    .eq("project_id", projectId);

  const { data: transfers } = await supabase
    .from("budget_transfers")
    .select("id,from_code,to_code,amount,note,created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const rowsByCode = new Map<string, BudgetRow>();

  (contracts ?? []).forEach((contract) => {
    const items = Array.isArray(contract.schedule_of_values)
      ? (contract.schedule_of_values as ScheduleOfValuesItem[])
      : [];
    items.forEach((item) => {
      const costCode = String(item?.cost_code ?? "").trim();
      if (!costCode) return;
      const description = String(item?.description ?? "").trim();
      const amount = Number(String(item?.amount ?? "").replace(/[^\d.-]/g, ""));
      const budget = Number.isNaN(amount) ? 0 : amount;

      const existing = rowsByCode.get(costCode);
      if (existing) {
        existing.budget += budget;
        if (!existing.description && description) {
          existing.description = description;
        }
      } else {
        rowsByCode.set(costCode, {
          costCode,
          description,
          budget,
          committed: 0,
          spent: 0,
        });
      }
    });
  });

  const rows = Array.from(rowsByCode.values()).sort((a, b) =>
    a.costCode.localeCompare(b.costCode)
  );

  const adjustments = (transfers ?? []).reduce<Record<string, number>>((acc, transfer) => {
    acc[transfer.from_code] = (acc[transfer.from_code] ?? 0) - transfer.amount;
    acc[transfer.to_code] = (acc[transfer.to_code] ?? 0) + transfer.amount;
    return acc;
  }, {});

  const totals = rows.reduce(
    (acc, row) => {
      const adjusted = row.budget + (adjustments[row.costCode] ?? 0);
      acc.budget += adjusted;
      acc.committed += row.committed;
      acc.spent += row.spent;
      return acc;
    },
    { budget: 0, committed: 0, spent: 0 }
  );

  return (
    <main className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Budget</h1>
        <p className="text-sm opacity-80">
          Budget tracking for {project.name}. Built from the project Schedule of Values.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Link
            className={`rounded-full px-3 py-1 ${
              activeTab === "budget"
                ? "bg-black/10 text-black"
                : "text-black/70 hover:bg-black/5"
            }`}
            href={`/projects/${projectId}/budget`}
          >
            Budget
          </Link>
          <Link
            className={`rounded-full px-3 py-1 ${
              activeTab === "transfers"
                ? "bg-black/10 text-black"
                : "text-black/70 hover:bg-black/5"
            }`}
            href={`/projects/${projectId}/budget?tab=transfers`}
          >
            Transfers
          </Link>
        </div>
        <BudgetModificationModal
          action={createTransfer.bind(null, projectId)}
          costCodes={rows.map((row) => ({ code: row.costCode, description: row.description }))}
        />
      </div>

      {activeTab === "budget" ? (
        <section className="border rounded-lg">
        <div className="p-4 border-b flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Budget Summary</h2>
            <p className="text-sm opacity-70">
              Committed and spent will be wired once we add commitments.
            </p>
          </div>
        </div>
        <div className="max-h-[640px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black/5 backdrop-blur border-b">
              <tr>
                <th className="text-left p-3">Cost Code</th>
                <th className="text-left p-3">Description</th>
                <th className="text-right p-3">Budget</th>
                <th className="text-right p-3">Modifications</th>
                <th className="text-right p-3">Committed</th>
                <th className="text-right p-3">Spent</th>
                <th className="text-right p-3">Over / Under</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => {
                  const adjustedBudget = row.budget + (adjustments[row.costCode] ?? 0);
                  const modification = adjustments[row.costCode] ?? 0;
                  const overUnder = adjustedBudget - row.spent;
                  return (
                    <tr key={row.costCode} className="border-b last:border-b-0">
                      <td className="p-3">{row.costCode}</td>
                      <td className="p-3">{row.description || "-"}</td>
                      <td className="p-3 text-right">
                        {adjustedBudget.toLocaleString(undefined, {
                          style: "currency",
                          currency: "USD",
                        })}
                      </td>
                      <td className="p-3 text-right">
                        {modification.toLocaleString(undefined, {
                          style: "currency",
                          currency: "USD",
                        })}
                      </td>
                      <td className="p-3 text-right">
                        {row.committed.toLocaleString(undefined, {
                          style: "currency",
                          currency: "USD",
                        })}
                      </td>
                      <td className="p-3 text-right">
                        {row.spent.toLocaleString(undefined, {
                          style: "currency",
                          currency: "USD",
                        })}
                      </td>
                      <td className="p-3 text-right">
                        {overUnder.toLocaleString(undefined, {
                          style: "currency",
                          currency: "USD",
                        })}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="p-4 opacity-70" colSpan={7}>
                    No schedule of values found for this project.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr className="border-t bg-black/[0.02]">
                  <td className="p-3 font-medium" colSpan={2}>
                    Total
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {totals.budget.toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                    })}
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {Object.values(adjustments)
                      .reduce((sum, val) => sum + val, 0)
                      .toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                      })}
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {totals.committed.toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                    })}
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {totals.spent.toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                    })}
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {(totals.budget - totals.spent).toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                    })}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>
      ) : (
        <section className="border rounded-lg space-y-4">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Budget Transfers</h2>
            <p className="text-sm opacity-70">
              Move budget between cost codes. Total budget stays the same.
            </p>
          </div>
          <div className="p-4 border-b">
            <BudgetTransferForm
              action={createTransfer.bind(null, projectId)}
              costCodes={rows.map((row) => ({ code: row.costCode, description: row.description }))}
            />
          </div>
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-black/5 backdrop-blur border-b">
                <tr>
                  <th className="text-left p-3">From</th>
                  <th className="text-left p-3">To</th>
                  <th className="text-right p-3">Amount</th>
                  <th className="text-left p-3">Note</th>
                  <th className="text-left p-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {transfers && transfers.length > 0 ? (
                  transfers.map((transfer: TransferRow) => (
                    <tr key={transfer.id} className="border-b last:border-b-0">
                      <td className="p-3">{transfer.from_code}</td>
                      <td className="p-3">{transfer.to_code}</td>
                      <td className="p-3 text-right">
                        {transfer.amount.toLocaleString(undefined, {
                          style: "currency",
                          currency: "USD",
                        })}
                      </td>
                      <td className="p-3">{transfer.note ?? "-"}</td>
                      <td className="p-3">
                        {new Date(transfer.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-4 opacity-70" colSpan={5}>
                      No transfers yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
