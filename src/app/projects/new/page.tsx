import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";
import NewProjectForm from "@/components/new-project-form";

type FormState = { error?: string };

async function createProject(_: FormState, formData: FormData): Promise<FormState> {
  "use server";

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const companyId = await getMyCompanyId();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Project name is required." };
  }

  const project_number = String(formData.get("project_number") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim();
  const health = String(formData.get("health") ?? "on_track");
  const start_date = String(formData.get("start_date") ?? "").trim() || null;
  const end_date = String(formData.get("end_date") ?? "").trim() || null;

  const contracted_value = Number(formData.get("contracted_value") ?? 0) || 0;
  const estimated_profit = Number(formData.get("estimated_profit") ?? 0) || 0;
  const estimated_buyout = Number(formData.get("estimated_buyout") ?? 0) || 0;

  const { data: inserted, error } = await supabase
    .from("projects")
    .insert({
      name,
      project_number,
      city: city || null,
      health,
      start_date,
      end_date,
      contracted_value,
      estimated_profit,
      estimated_buyout,
      company_id: companyId,
      created_by: data.user.id,
    })
    .select("id")
    .single();

  if (error || !inserted?.id) {
    return { error: error?.message ?? "Failed to create project." };
  }

  redirect(`/projects/${inserted.id}`);
}

export default function NewProjectPage() {
  return <NewProjectForm action={createProject} />;
}
