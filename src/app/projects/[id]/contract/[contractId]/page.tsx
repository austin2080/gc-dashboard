import ContractStatusPill from "@/components/contract-status-pill";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";

type PageProps = {
  params: { id: string; contractId: string } | Promise<{ id: string; contractId: string }>;
};

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default async function ContractDetailPage({ params }: PageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const resolved = await Promise.resolve(params);
  const projectId = resolved?.id ?? "";
  const contractId = resolved?.contractId ?? "";

  const companyId = await getMyCompanyId();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("company_id", companyId)
    .single();

  if (!project) redirect("/projects");

  const { data: contract } = await supabase
    .from("prime_contracts")
    .select(
      "id,title,owner_name,contractor_name,architect_engineer,retention_percent,status,executed,original_amount,revised_amount,estimated_profit,estimated_buyout,change_orders_amount,pay_app_status,payments_received,inclusions,exclusions,invoice_contact_name,invoice_contact_email,invoice_contact_phone"
    )
    .eq("id", contractId)
    .eq("project_id", projectId)
    .single();

  if (!contract) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold">Contract not found</h1>
        <p className="mt-2 opacity-80">This contract may not exist or you may not have access.</p>
      </main>
    );
  }

  const originalAmount = contract.original_amount ?? 0;
  const changeOrdersAmount = contract.change_orders_amount ?? 0;
  const revisedAmount = originalAmount + changeOrdersAmount;
  const estOHP = contract.estimated_profit ?? 0;
  const estBuyout = contract.estimated_buyout ?? 0;
  const margin = originalAmount ? ((estOHP + estBuyout) / originalAmount) * 100 : 0;
  const status = (contract.status as "draft" | "out_for_signature" | "approved") ?? "draft";

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {contract.title || "Prime Contract"}
          </h1>
          <p className="text-sm opacity-80">
            Contract details, line items, and attachments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            className="border rounded px-3 py-2 text-sm"
            href={`/projects/${projectId}/contract/${contractId}/edit`}
          >
            Edit Contract
          </Link>
        </div>
      </header>

      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">General Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="opacity-70">Owner Name</div>
            <div>{contract.owner_name ?? "—"}</div>
          </div>
          <div>
            <div className="opacity-70">Contractor</div>
            <div>{contract.contractor_name ?? "—"}</div>
          </div>
          <div>
            <div className="opacity-70">Architect/Engineer</div>
            <div>{contract.architect_engineer ?? "—"}</div>
          </div>
          <div>
            <div className="opacity-70">Retention (%)</div>
            <div>{(contract.retention_percent ?? 0).toFixed(2)}%</div>
          </div>
          <div>
            <div className="opacity-70">Status</div>
            <ContractStatusPill initialStatus={status} />
          </div>
          <div>
            <div className="opacity-70">Executed</div>
            <div>{contract.executed ? "Yes" : "No"}</div>
          </div>
          <div className="md:col-span-4">
            <div className="opacity-70">Contract Documents</div>
            <label className="mt-2 flex items-center justify-center rounded border border-dashed border-black/20 px-4 py-6 text-xs text-black/60">
              <input type="file" className="hidden" />
              Attach files or drag & drop (placeholder)
            </label>
          </div>
        </div>
      </section>

      {/* Project-level cards */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Original Contract Value</div>
          <div className="text-xl font-semibold mt-1">{money(originalAmount)}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Est. OH&P</div>
          <div className="text-xl font-semibold mt-1">{money(estOHP)}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Est. Buyout</div>
          <div className="text-xl font-semibold mt-1">{money(estBuyout)}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Est. Margin</div>
          <div className="text-xl font-semibold mt-1">{margin.toFixed(1)}%</div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Revised Contract Value</div>
          <div className="text-xl font-semibold mt-1">{money(revisedAmount)}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Change Orders</div>
          <div className="text-xl font-semibold mt-1">{money(changeOrdersAmount)}</div>
          <div className="text-xs opacity-60 mt-1">Can be negative</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Pay App Status</div>
          <div className="text-xl font-semibold mt-1">—</div>
          <div className="text-xs opacity-60 mt-1">
            {contract.pay_app_status ?? "Outstanding: —"}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm opacity-70">Payments Received</div>
          <div className="text-xl font-semibold mt-1">—</div>
          <div className="text-xs opacity-60 mt-1">
            {contract.payments_received ?? "Most recent: —"}
          </div>
        </div>
      </section>

      <section className="border rounded-lg">
        <div className="p-4 border-b flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Schedule of Values</h2>
            <p className="text-sm opacity-70">
              Cost codes, descriptions, and values used to bill the owner.
            </p>
          </div>
          <button className="border rounded px-3 py-2 text-sm">Add Line Item</button>
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black/5 backdrop-blur border-b">
              <tr>
                <th className="text-left p-3">Cost Code</th>
                <th className="text-left p-3">Description</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-right p-3">% of Contract</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-4 opacity-70" colSpan={4}>
                  No line items yet. Click “Add Line Item” to start your schedule of values.
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t bg-black/[0.02]">
                <td className="p-3 font-medium" colSpan={2}>
                  Total
                </td>
                <td className="p-3 text-right font-semibold">$0.00</td>
                <td className="p-3 text-right">—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Inclusions / Exclusions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <label className="space-y-1">
            <div className="opacity-70">Inclusions</div>
            <textarea
              className="w-full rounded border border-black/20 px-3 py-2"
              rows={5}
              placeholder="List what is included..."
              defaultValue={contract.inclusions ?? ""}
            />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Exclusions</div>
            <textarea
              className="w-full rounded border border-black/20 px-3 py-2"
              rows={5}
              placeholder="List what is excluded..."
              defaultValue={contract.exclusions ?? ""}
            />
          </label>
        </div>
      </section>

      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Invoicing Contact</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <label className="space-y-1">
            <div className="opacity-70">Name</div>
            <input
              className="w-full rounded border border-black/20 px-3 py-2"
              placeholder="Contact name"
              defaultValue={contract.invoice_contact_name ?? ""}
            />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Email</div>
            <input
              type="email"
              className="w-full rounded border border-black/20 px-3 py-2"
              placeholder="email@company.com"
              defaultValue={contract.invoice_contact_email ?? ""}
            />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Phone</div>
            <input
              className="w-full rounded border border-black/20 px-3 py-2"
              placeholder="(555) 555-5555"
              defaultValue={contract.invoice_contact_phone ?? ""}
            />
          </label>
        </div>
      </section>

    </main>
  );
}
