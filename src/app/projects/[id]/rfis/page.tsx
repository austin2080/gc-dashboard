import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";
import RfiTable from "@/components/rfi-table";

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

export default async function ProjectRfisPage({ params }: PageProps) {
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

  const { data: rfis } = await supabase
    .from("rfis")
    .select(
      "id,rfi_number,subject,status,priority,ball_in_court,assignee,submitted_date,due_date,response_date,cost_impact,schedule_impact_days"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return (
    <main className="p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">RFIs</h1>
          <p className="text-sm opacity-80">Track requests for information for {project.name}.</p>
        </div>
        <Link
          href={`/projects/${projectId}/rfis/new`}
          className="rounded border border-black bg-black px-4 py-2 text-sm text-white"
        >
          New RFI
        </Link>
      </header>

      <RfiTable projectId={projectId} rfis={rfis ?? []} />
    </main>
  );
}
