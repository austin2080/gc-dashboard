import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";

type PageProps = {
  params: { id: string; rfiId: string } | Promise<{ id: string; rfiId: string }>;
};

export default async function RfiDetailPage({ params }: PageProps) {
  const resolved = await Promise.resolve(params);
  const projectId = resolved?.id ?? "";
  const rfiId = resolved?.rfiId ?? "";

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

  const { data: rfi } = await supabase
    .from("rfis")
    .select(
      "id,rfi_number,subject,status,priority,ball_in_court,assignee,submitted_date,due_date,response_date,question,response,cost_impact,schedule_impact_days"
    )
    .eq("id", rfiId)
    .eq("project_id", projectId)
    .single();

  if (!rfi) redirect(`/projects/${projectId}/rfis`);

  return (
    <main className="p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {rfi.rfi_number ?? "RFI"} · {rfi.subject ?? "Detail"}
          </h1>
          <p className="text-sm opacity-80">{project.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link className="border rounded px-3 py-2 text-sm" href={`/projects/${projectId}/rfis`}>
            Back to RFIs
          </Link>
        </div>
      </header>

      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">RFI Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="opacity-70">Status</div>
            <div className="capitalize">{rfi.status}</div>
          </div>
          <div>
            <div className="opacity-70">Priority</div>
            <div className="capitalize">{rfi.priority}</div>
          </div>
          <div>
            <div className="opacity-70">Ball in Court</div>
            <div className="capitalize">{rfi.ball_in_court}</div>
          </div>
          <div>
            <div className="opacity-70">Assignee</div>
            <div>{rfi.assignee ?? "-"}</div>
          </div>
          <div>
            <div className="opacity-70">Submitted</div>
            <div>{rfi.submitted_date ? new Date(rfi.submitted_date).toLocaleDateString() : "-"}</div>
          </div>
          <div>
            <div className="opacity-70">Due Date</div>
            <div>{rfi.due_date ? new Date(rfi.due_date).toLocaleDateString() : "-"}</div>
          </div>
          <div>
            <div className="opacity-70">Response Date</div>
            <div>{rfi.response_date ? new Date(rfi.response_date).toLocaleDateString() : "-"}</div>
          </div>
          <div>
            <div className="opacity-70">Cost Impact</div>
            <div>
              {(rfi.cost_impact ?? 0).toLocaleString(undefined, {
                style: "currency",
                currency: "USD",
              })}
            </div>
          </div>
          <div>
            <div className="opacity-70">Schedule Impact</div>
            <div>{rfi.schedule_impact_days ?? 0} days</div>
          </div>
        </div>
      </section>

      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Question</h2>
        <div className="text-sm">{rfi.question ?? "-"}</div>
      </section>

      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Response</h2>
        <div className="text-sm">{rfi.response ?? "-"}</div>
      </section>
    </main>
  );
}
