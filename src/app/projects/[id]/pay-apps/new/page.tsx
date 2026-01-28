import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";
import PayAppForm from "@/components/pay-app-form";

type FormState = { error?: string };

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

async function createPayApp(
  projectId: string,
  _: FormState,
  formData: FormData
): Promise<FormState> {
  "use server";

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const companyId = await getMyCompanyId();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("company_id", companyId)
    .single();

  if (!project) return { error: "Project not found." };

  const contractId = String(formData.get("contract_id") ?? "").trim() || null;
  const app_number = String(formData.get("app_number") ?? "").trim() || null;
  const submitted_date = String(formData.get("submitted_date") ?? "").trim() || null;
  const due_date = String(formData.get("due_date") ?? "").trim() || null;
  const amount = Number(formData.get("amount") ?? 0) || 0;
  const status = String(formData.get("status") ?? "submitted");

  const { error } = await supabase.from("pay_apps").insert({
    project_id: projectId,
    contract_id: contractId,
    app_number,
    submitted_date,
    due_date,
    amount,
    status,
  });

  if (error) return { error: error.message };
  redirect(`/projects/${projectId}/pay-apps`);
}

export default async function NewPayAppPage({ params }: PageProps) {
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

  const { data: contracts } = await supabase
    .from("prime_contracts")
    .select("id,title")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return (
    <main className="p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">New Pay App</h1>
          <p className="text-sm opacity-80">Create an invoice snapshot for {project.name}.</p>
        </div>
        <Link
          className="rounded border border-black px-4 py-2 text-sm"
          href={`/projects/${projectId}/pay-apps`}
        >
          Back to Pay Apps
        </Link>
      </header>

      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Pay App Details</h2>
        <PayAppForm action={createPayApp.bind(null, projectId)} contracts={contracts ?? []} />
      </section>
    </main>
  );
}
