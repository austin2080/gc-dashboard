import { createClient } from "@/lib/supabase/server";
import { getMyCompanyMember } from "@/lib/db/company";
import { listProjects } from "@/lib/db/projects";
import TopNavClient from "@/components/top-nav-client";

export const dynamic = "force-dynamic";

export default async function TopNav() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return <TopNavClient projects={[]} />;
  }

  try {
    const member = await getMyCompanyMember();
    const companyId = member.company_id;
    const canViewAll = member.can_view_all_projects ?? false;
    const projects = await listProjects(companyId, {
      createdBy: canViewAll ? undefined : data.user.id,
    });
    const activeProjects = projects.filter((p) => p.health !== "complete");
    return <TopNavClient projects={activeProjects} />;
  } catch {
    return <TopNavClient projects={[]} />;
  }
}
