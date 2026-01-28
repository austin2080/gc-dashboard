import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";

type LayoutProps = {
  children: React.ReactNode;
  params: { id: string } | Promise<{ id: string }>;
};

export default async function ProjectLayout({ children, params }: LayoutProps) {
  const resolved = await Promise.resolve(params);
  const projectId = resolved?.id ?? "";
  let projectName: string | undefined;

  if (projectId) {
    try {
      const supabase = await createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const companyId = await getMyCompanyId();
        const { data: project } = await supabase
          .from("projects")
          .select("name")
          .eq("id", projectId)
          .eq("company_id", companyId)
          .single();
        projectName = project?.name ?? undefined;
      }
    } catch {
      projectName = undefined;
    }
  }

  return (
    <div>
      <div className="px-6 pt-4 text-sm text-black/60">
        <Link className="hover:text-black" href="/projects">
          Projects
        </Link>
        <span className="mx-2">/</span>
        <span className="text-black">{projectName ?? "Project"}</span>
      </div>
      {children}
    </div>
  );
}
