import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

type FormState = { error?: string };

async function createRfi(
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

  const rfi_number = String(formData.get("rfi_number") ?? "").trim() || null;
  const subject = String(formData.get("subject") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "draft");
  const priority = String(formData.get("priority") ?? "medium");
  const ball_in_court = String(formData.get("ball_in_court") ?? "owner");
  const assigned_to = String(formData.get("assigned_to") ?? "").trim() || null;
  const distribution_list = formData
    .getAll("distribution_list")
    .map((entry) => String(entry))
    .filter(Boolean);
  const submitted_date = String(formData.get("submitted_date") ?? "").trim() || null;
  const due_date = String(formData.get("due_date") ?? "").trim() || null;
  const date_created = String(formData.get("date_created") ?? "").trim() || null;
  const date_sent = String(formData.get("date_sent") ?? "").trim() || null;
  const response_date = String(formData.get("response_date") ?? "").trim() || null;
  const question = String(formData.get("question") ?? "").trim() || null;
  const response = String(formData.get("response") ?? "").trim() || null;
  const cost_impact_status = String(formData.get("cost_impact_status") ?? "none");
  const schedule_impact_status = String(formData.get("schedule_impact_status") ?? "none");
  const discipline = String(formData.get("discipline") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const spec_reference = String(formData.get("spec_reference") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const { error } = await supabase.from("rfis").insert({
    project_id: projectId,
    rfi_number,
    subject,
    discipline,
    location,
    spec_reference,
    status,
    priority,
    ball_in_court,
    assigned_to,
    distribution_list,
    date_created,
    date_sent,
    submitted_date,
    due_date,
    response_date,
    question,
    response,
    cost_impact_status,
    schedule_impact_status,
    notes,
    created_by: data.user.id,
  });

  if (error) return { error: error.message };

  redirect(`/projects/${projectId}/rfis`);
}

export default async function NewRfiPage({ params }: PageProps) {
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

  const { data: members } = await supabase
    .from("company_members")
    .select("user_id,profiles(full_name)")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  return (
    <main className="p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">New RFI</h1>
          <p className="text-sm opacity-80">Create a new RFI for {project.name}.</p>
        </div>
        <Link className="border rounded px-3 py-2 text-sm" href={`/projects/${projectId}/rfis`}>
          Back to RFIs
        </Link>
      </header>

      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">RFI Details</h2>
        <form
          action={createRfi.bind(null, projectId)}
          className="grid grid-cols-1 md:grid-cols-6 gap-4 text-sm"
        >
          <label className="space-y-1">
            <div className="opacity-70">Project</div>
            <input
              value={project.name}
              disabled
              className="w-full rounded border border-black/20 px-3 py-2 bg-black/[0.03]"
            />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">RFI #</div>
            <input name="rfi_number" className="w-full rounded border border-black/20 px-3 py-2" placeholder="RFI-001" />
          </label>
          <label className="space-y-1 md:col-span-2">
            <div className="opacity-70">Subject</div>
            <input name="subject" className="w-full rounded border border-black/20 px-3 py-2" placeholder="Scope clarification" />
          </label>
          <label className="space-y-1 md:col-span-3">
            <div className="opacity-70">Question / Description</div>
            <textarea
              name="question"
              className="w-full rounded border border-black/20 px-3 py-2"
              rows={3}
              placeholder="Describe the question"
            />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Status</div>
            <select name="status" className="w-full rounded border border-black/20 px-3 py-2" defaultValue="draft">
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="answered">Answered</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Priority</div>
            <select name="priority" className="w-full rounded border border-black/20 px-3 py-2" defaultValue="medium">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Discipline</div>
            <select name="discipline" className="w-full rounded border border-black/20 px-3 py-2">
              <option value="">Select</option>
              <option value="architectural">Architectural</option>
              <option value="structural">Structural</option>
              <option value="mep">MEP</option>
              <option value="civil">Civil</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Ball in Court</div>
            <select name="ball_in_court" className="w-full rounded border border-black/20 px-3 py-2" defaultValue="owner">
              <option value="owner">Owner</option>
              <option value="architect">Architect</option>
              <option value="engineer">Engineer</option>
              <option value="contractor">Contractor</option>
              <option value="subcontractor">Subcontractor</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Assigned To</div>
            <select name="assigned_to" className="w-full rounded border border-black/20 px-3 py-2">
              <option value="">Select user</option>
              {members?.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.profiles?.full_name ?? member.user_id}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <div className="opacity-70">Distribution List</div>
            <select
              name="distribution_list"
              multiple
              className="h-28 w-full rounded border border-black/20 px-3 py-2"
            >
              {members?.map((member) => (
                <option key={`dist-${member.user_id}`} value={member.user_id}>
                  {member.profiles?.full_name ?? member.user_id}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Date Created</div>
            <input type="date" name="date_created" className="w-full rounded border border-black/20 px-3 py-2" />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Date Sent</div>
            <input type="date" name="date_sent" className="w-full rounded border border-black/20 px-3 py-2" />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Submitted</div>
            <input type="date" name="submitted_date" className="w-full rounded border border-black/20 px-3 py-2" />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Due Date</div>
            <input type="date" name="due_date" className="w-full rounded border border-black/20 px-3 py-2" />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Response Date</div>
            <input type="date" name="response_date" className="w-full rounded border border-black/20 px-3 py-2" />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Cost Impact</div>
            <select name="cost_impact_status" className="w-full rounded border border-black/20 px-3 py-2" defaultValue="none">
              <option value="none">None</option>
              <option value="potential">Potential</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Schedule Impact</div>
            <select name="schedule_impact_status" className="w-full rounded border border-black/20 px-3 py-2" defaultValue="none">
              <option value="none">None</option>
              <option value="potential">Potential</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </label>
          <label className="space-y-1 md:col-span-3">
            <div className="opacity-70">Location</div>
            <input name="location" className="w-full rounded border border-black/20 px-3 py-2" placeholder="Area / floor / grid" />
          </label>
          <label className="space-y-1 md:col-span-3">
            <div className="opacity-70">Spec Section / Drawing Reference</div>
            <input name="spec_reference" className="w-full rounded border border-black/20 px-3 py-2" placeholder="Spec section or drawing ref" />
          </label>
          <label className="space-y-1 md:col-span-3">
            <div className="opacity-70">Response</div>
            <textarea name="response" className="w-full rounded border border-black/20 px-3 py-2" rows={3} placeholder="Response summary" />
          </label>
          <label className="space-y-1 md:col-span-3">
            <div className="opacity-70">Notes / Internal Comments</div>
            <textarea name="notes" className="w-full rounded border border-black/20 px-3 py-2" rows={3} placeholder="Internal notes" />
          </label>
          <div className="md:col-span-6">
            <div className="rounded border border-dashed border-black/20 p-4 text-sm">
              <div className="font-medium">Attachments</div>
              <div className="text-xs opacity-70">Upload files (coming soon)</div>
            </div>
          </div>
          <div className="md:col-span-6">
            <button className="rounded border border-black bg-black px-4 py-2 text-sm text-white">
              Create RFI
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
