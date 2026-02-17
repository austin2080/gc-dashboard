import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyMember } from "@/lib/db/company";
import { listProjects } from "@/lib/db/projects";
import ProjectsTable from "@/components/projects-table";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const member = await getMyCompanyMember();
  const companyId = member.company_id;
  let projectsAll = [] as Awaited<ReturnType<typeof listProjects>>;
  let projectsMine = [] as Awaited<ReturnType<typeof listProjects>>;
  let canViewAll = true;

  try {
    projectsAll = await listProjects(companyId);
    projectsMine = projectsAll;
  } catch {
    projectsMine = await listProjects(companyId, { createdBy: data.user.id });
    projectsAll = projectsMine;
    canViewAll = false;
  }

  return (
    <main className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="text-sm opacity-80">Manage all projects for your company.</p>
      </header>

      <ProjectsTable
        projectsAll={projectsAll}
        projectsMine={projectsMine}
        canViewAll={canViewAll}
      />
    </main>
  );
}
