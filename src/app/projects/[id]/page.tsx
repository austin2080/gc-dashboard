import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";

type PageProps = {
  params: { id: string };
};

export default async function ProjectDetailPage({ params }: PageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const companyId = await getMyCompanyId();

  const { data: project } = await supabase
    .from("projects")
    .select("id,name,city,health,contracted_value,estimated_profit,estimated_buyout,updated_at")
    .eq("id", params.id)
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

  return (
    <main className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="text-sm opacity-80">Project ID: {project.id}</p>
      </header>

      <section className="border rounded-lg p-4 space-y-2">
        <div className="text-sm">
          <span className="opacity-70">City:</span> {project.city ?? "-"}
        </div>
        <div className="text-sm">
          <span className="opacity-70">Health:</span> {project.health}
        </div>
        <div className="text-sm">
          <span className="opacity-70">Contracted:</span>{" "}
          {(project.contracted_value ?? 0).toLocaleString(undefined, {
            style: "currency",
            currency: "USD",
          })}
        </div>
        <div className="text-sm">
          <span className="opacity-70">Est Profit:</span>{" "}
          {(project.estimated_profit ?? 0).toLocaleString(undefined, {
            style: "currency",
            currency: "USD",
          })}
        </div>
        <div className="text-sm">
          <span className="opacity-70">Est Buyout:</span>{" "}
          {(project.estimated_buyout ?? 0).toLocaleString(undefined, {
            style: "currency",
            currency: "USD",
          })}
        </div>
        <div className="text-sm">
          <span className="opacity-70">Updated:</span>{" "}
          {project.updated_at ? new Date(project.updated_at).toLocaleString() : "-"}
        </div>
      </section>
    </main>
  );
}
