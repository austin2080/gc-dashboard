import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

async function createSubmittal(
  projectId: string,
  formData: FormData
): Promise<void> {
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

  if (!project) return;

  const submittal_number = String(formData.get("submittal_number") ?? "").trim() || null;
  const title = String(formData.get("title") ?? "").trim() || null;
  const spec_section = String(formData.get("spec_section") ?? "").trim() || null;
  const trade = String(formData.get("trade") ?? "").trim() || null;
  const type = String(formData.get("type") ?? "other");
  const status = String(formData.get("status") ?? "draft");
  const priority = String(formData.get("priority") ?? "medium");
  const ball_in_court = String(formData.get("ball_in_court") ?? "gc");
  const assigned_to = String(formData.get("assigned_to") ?? "").trim() || null;
  const distribution_list = formData
    .getAll("distribution_list")
    .map((entry) => String(entry))
    .filter(Boolean);
  const date_created = String(formData.get("date_created") ?? "").trim() || null;
  const date_submitted = String(formData.get("date_submitted") ?? "").trim() || null;
  const due_date = String(formData.get("due_date") ?? "").trim() || null;
  const revision = String(formData.get("revision") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const { error } = await supabase.from("submittals").insert({
    project_id: projectId,
    submittal_number,
    title,
    spec_section,
    trade,
    type,
    status,
    priority,
    ball_in_court,
    assigned_to,
    distribution_list,
    date_created,
    date_submitted,
    due_date,
    revision,
    notes,
    created_by: data.user.id,
  });

  if (error) return;

  redirect(`/projects/${projectId}/submittals`);
}

export default async function NewSubmittalPage({ params }: PageProps) {
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
          <h1 className="text-2xl font-semibold">New Submittal</h1>
          <p className="text-sm opacity-80">Create a submittal for {project.name}.</p>
        </div>
        <Link className="border rounded px-3 py-2 text-sm" href={`/projects/${projectId}/submittals`}>
          Back to Submittals
        </Link>
      </header>

      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Submittal Details</h2>
        <form
          action={createSubmittal.bind(null, projectId)}
          className="grid grid-cols-1 md:grid-cols-6 gap-4 text-sm"
        >
          <label className="space-y-1 md:col-span-2">
            <div className="opacity-70">Project</div>
            <input
              value={project.name}
              disabled
              className="w-full rounded border border-black/20 px-3 py-2 bg-black/[0.03]"
            />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Submittal #</div>
            <input name="submittal_number" className="w-full rounded border border-black/20 px-3 py-2" placeholder="SUB-001" />
          </label>
          <label className="space-y-1 md:col-span-3">
            <div className="opacity-70">Title / Description</div>
            <input name="title" className="w-full rounded border border-black/20 px-3 py-2" placeholder="Product data for..." />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Spec Section</div>
            <input name="spec_section" className="w-full rounded border border-black/20 px-3 py-2" placeholder="03 30 00" />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Trade / Discipline</div>
            <select name="trade" className="w-full rounded border border-black/20 px-3 py-2">
              <option value="">Select</option>
              <option value="architectural">Architectural</option>
              <option value="structural">Structural</option>
              <option value="mep">MEP</option>
              <option value="civil">Civil</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Type</div>
            <select name="type" className="w-full rounded border border-black/20 px-3 py-2">
              <option value="product_data">Product Data</option>
              <option value="shop_drawings">Shop Drawings</option>
              <option value="samples">Samples</option>
              <option value="mockups">Mockups</option>
              <option value="om">O&amp;M</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Status</div>
            <select name="status" className="w-full rounded border border-black/20 px-3 py-2" defaultValue="draft">
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="submitted">Submitted</option>
              <option value="in_review">In Review</option>
              <option value="approved">Approved</option>
              <option value="approved_as_noted">Approved as Noted</option>
              <option value="revise_and_resubmit">Revise &amp; Resubmit</option>
              <option value="rejected">Rejected</option>
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
            <div className="opacity-70">Ball In Court</div>
            <select name="ball_in_court" className="w-full rounded border border-black/20 px-3 py-2" defaultValue="gc">
              <option value="gc">GC</option>
              <option value="architect">Architect</option>
              <option value="engineer">Engineer</option>
              <option value="owner">Owner</option>
              <option value="vendor">Vendor</option>
            </select>
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Assigned To</div>
            <select name="assigned_to" className="w-full rounded border border-black/20 px-3 py-2">
              <option value="">Select user</option>
              {members?.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.profiles?.[0]?.full_name ?? member.user_id}
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
                  {member.profiles?.[0]?.full_name ?? member.user_id}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Date Created</div>
            <input type="date" name="date_created" className="w-full rounded border border-black/20 px-3 py-2" />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Date Submitted</div>
            <input type="date" name="date_submitted" className="w-full rounded border border-black/20 px-3 py-2" />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Due Date</div>
            <input type="date" name="due_date" className="w-full rounded border border-black/20 px-3 py-2" />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Revision</div>
            <input name="revision" className="w-full rounded border border-black/20 px-3 py-2" placeholder="0" />
          </label>
          <label className="space-y-1 md:col-span-6">
            <div className="opacity-70">Notes / Internal Comments</div>
            <textarea name="notes" className="w-full rounded border border-black/20 px-3 py-2" rows={3} />
          </label>
          <div className="md:col-span-6">
            <div className="rounded border border-dashed border-black/20 p-4 text-sm">
              <div className="font-medium">Attachments</div>
              <div className="text-xs opacity-70">Upload files (coming soon)</div>
            </div>
          </div>
          <div className="md:col-span-6">
            <button className="rounded border border-black bg-black px-4 py-2 text-sm text-white">
              Create Submittal
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
