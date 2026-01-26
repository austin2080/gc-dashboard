import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";

type PageProps = {
  params: { id: string; submittalId: string } | Promise<{ id: string; submittalId: string }>;
};

export default async function SubmittalDetailPage({ params }: PageProps) {
  const resolved = await Promise.resolve(params);
  const projectId = resolved?.id ?? "";
  const submittalId = resolved?.submittalId ?? "";

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

  const { data: submittal } = await supabase
    .from("submittals")
    .select(
      "id,submittal_number,title,spec_section,trade,type,status,priority,ball_in_court,assigned_to,distribution_list,date_created,date_submitted,due_date,latest_response_date,revision,notes"
    )
    .eq("id", submittalId)
    .eq("project_id", projectId)
    .single();

  if (!submittal) redirect(`/projects/${projectId}/submittals`);

  return (
    <main className="p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {submittal.submittal_number ?? "Submittal"} · {submittal.title ?? "Detail"}
          </h1>
          <p className="text-sm opacity-80">
            {project.name} · {submittal.status?.replace(/_/g, " ")}
          </p>
        </div>
        <Link className="border rounded px-3 py-2 text-sm" href={`/projects/${projectId}/submittals`}>
          Back to Submittals
        </Link>
      </header>

      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Key Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="opacity-70">Spec Section</div>
            <div>{submittal.spec_section ?? "-"}</div>
          </div>
          <div>
            <div className="opacity-70">Trade / Discipline</div>
            <div>{submittal.trade ?? "-"}</div>
          </div>
          <div>
            <div className="opacity-70">Type</div>
            <div>{submittal.type?.replace(/_/g, " ") ?? "-"}</div>
          </div>
          <div>
            <div className="opacity-70">Priority</div>
            <div className="capitalize">{submittal.priority}</div>
          </div>
          <div>
            <div className="opacity-70">Ball In Court</div>
            <div className="capitalize">{submittal.ball_in_court}</div>
          </div>
          <div>
            <div className="opacity-70">Assigned To</div>
            <div>{submittal.assigned_to ?? "-"}</div>
          </div>
          <div>
            <div className="opacity-70">Date Created</div>
            <div>{submittal.date_created ? new Date(submittal.date_created).toLocaleDateString() : "-"}</div>
          </div>
          <div>
            <div className="opacity-70">Date Submitted</div>
            <div>{submittal.date_submitted ? new Date(submittal.date_submitted).toLocaleDateString() : "-"}</div>
          </div>
          <div>
            <div className="opacity-70">Due Date</div>
            <div>{submittal.due_date ? new Date(submittal.due_date).toLocaleDateString() : "-"}</div>
          </div>
          <div>
            <div className="opacity-70">Latest Response</div>
            <div>{submittal.latest_response_date ? new Date(submittal.latest_response_date).toLocaleDateString() : "-"}</div>
          </div>
          <div>
            <div className="opacity-70">Revision</div>
            <div>{submittal.revision ?? "-"}</div>
          </div>
        </div>
      </section>

      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Description / Scope</h2>
        <div className="text-sm">{submittal.title ?? "-"}</div>
      </section>

      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Attachments</h2>
        <div className="text-sm opacity-70">No attachments uploaded yet.</div>
      </section>

      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Review History</h2>
        <div className="text-sm opacity-70">No review history yet.</div>
      </section>

      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Activity Timeline</h2>
        <div className="text-sm opacity-70">No activity yet.</div>
      </section>

      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Notes / Internal Comments</h2>
        <div className="text-sm">{submittal.notes ?? "-"}</div>
      </section>
    </main>
  );
}
