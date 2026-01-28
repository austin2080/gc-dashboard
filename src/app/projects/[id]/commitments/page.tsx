import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

export default async function ProjectCommitmentsPage({ params }: PageProps) {
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

  return (
    <main className="p-6 space-y-2">
      <h1 className="text-2xl font-semibold">Commitments</h1>
      <p className="text-sm opacity-80">
        Commitments for {project.name} (coming soon).
      </p>
    </main>
  );
}
