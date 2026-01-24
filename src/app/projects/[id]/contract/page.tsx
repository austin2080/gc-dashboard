import Link from "next/link";
import { redirect } from "next/navigation";
import PrimeContractsTable, { type ContractRow } from "@/components/prime-contracts-table";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

export default async function ProjectContractPage({ params }: PageProps) {
  const resolved = await Promise.resolve(params);
  const projectId = resolved?.id ?? "";

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const companyId = await getMyCompanyId();
  const { data: project } = await supabase
    .from("projects")
    .select("id,project_number")
    .eq("id", projectId)
    .eq("company_id", companyId)
    .single();

  if (!project) {
    redirect("/projects");
  }

  const { data: contracts } = await supabase
    .from("prime_contracts")
    .select("id,title,status,executed,original_amount,owner_name,created_at,updated_at")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  const rows: ContractRow[] = (contracts ?? []).map((c) => ({
    ...c,
    project_number: project.project_number ?? "-",
    status: (c.status as ContractRow["status"]) ?? "draft",
  }));

  return (
    <main className="p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Prime Contracts</h1>
          <p className="text-sm opacity-80">
            Create and manage multiple prime contracts for this project.
          </p>
        </div>
        <Link className="border rounded px-3 py-2 text-sm" href={`/projects/${projectId}/contract/new`}>
          New Contract
        </Link>
      </header>

      <PrimeContractsTable projectId={projectId} contracts={rows} />
    </main>
  );
}
