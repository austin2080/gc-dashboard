import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";
import EditProjectForm from "@/components/edit-project-form";

type FormState = { error?: string };

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

async function updateProject(
  projectId: string,
  _: FormState,
  formData: FormData
): Promise<FormState> {
  "use server";

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const companyId = await getMyCompanyId();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Project name is required." };

  const project_number = String(formData.get("project_number") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const health = String(formData.get("health") ?? "on_track");
  const start_date = String(formData.get("start_date") ?? "").trim() || null;
  const end_date = String(formData.get("end_date") ?? "").trim() || null;

  const contracted_value = Number(formData.get("contracted_value") ?? 0) || 0;
  const estimated_profit = Number(formData.get("estimated_profit") ?? 0) || 0;
  const estimated_buyout = Number(formData.get("estimated_buyout") ?? 0) || 0;

  const { error } = await supabase
    .from("projects")
    .update({
      name,
      project_number,
      city,
      health,
      start_date,
      end_date,
      contracted_value,
      estimated_profit,
      estimated_buyout,
    })
    .eq("id", projectId)
    .eq("company_id", companyId);

  if (error) return { error: error.message };

  redirect(`/projects/${projectId}`);
}

export default async function ProjectEditPage({ params }: PageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const companyId = await getMyCompanyId();
  const resolved = await Promise.resolve(params);
  const projectId = resolved?.id ?? "";

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id,project_number,name,city,health,start_date,end_date,contracted_value,estimated_profit,estimated_buyout"
    )
    .eq("id", projectId)
    .eq("company_id", companyId)
    .single();

  if (!project) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold">Project not found</h1>
        <p className="mt-2 opacity-80">This project may not exist or you may not have access.</p>
      </main>
    );
  }

  return <EditProjectForm action={updateProject.bind(null, projectId)} project={project} />;
}
