import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";
import SubmittalsTable from "@/components/submittals-table";

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

export default async function ProjectSubmittalsPage({ params }: PageProps) {
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

  const { data: members } = await supabase
    .from("company_members")
    .select("user_id,profiles(full_name)")
    .eq("company_id", companyId)
    .eq("is_active", true);

  const { data: submittals } = await supabase
    .from("submittals")
    .select(
      "id,submittal_number,title,spec_section,trade,project_id,status,priority,assigned_to,ball_in_court,date_created,date_submitted,due_date,latest_response_date,revision"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return (
    <main className="p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Submittals</h1>
          <p className="text-sm opacity-80">
            Document-focused submittals for {project.name}.
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/submittals/new`}
          className="rounded border border-black bg-black px-4 py-2 text-sm text-white"
        >
          New Submittal
        </Link>
      </header>

      <SubmittalsTable
        projectId={projectId}
        projectName={project.name}
        submittals={submittals ?? []}
        members={members ?? []}
      />
    </main>
  );
}
