import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";
import { listProjects } from "@/lib/db/projects";
import TopNavClient from "@/components/top-nav-client";

export default async function TopNav() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return <TopNavClient projects={[]} />;
  }

  try {
    const companyId = await getMyCompanyId();
    const projects = await listProjects(companyId);
    const activeProjects = projects.filter((p) => p.health !== "complete");
    return <TopNavClient projects={activeProjects} />;
  } catch {
    return <TopNavClient projects={[]} />;
  }
}
