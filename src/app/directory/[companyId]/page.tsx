import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CompanyDeleteForm from "@/components/company-delete-form";

type PageProps = {
  params: { companyId: string } | Promise<{ companyId: string }>;
};

async function inviteCompanyUser(
  companyId: string,
  formData: FormData
) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return;

  const role = "pm";
  const canViewAll = String(formData.get("can_view_all_projects") ?? "") === "on";

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
  if (error || !data.user) return;

  const { error: memberError } = await admin
    .from("company_members")
    .upsert({
      company_id: companyId,
      user_id: data.user.id,
      role,
      is_active: true,
      can_view_all_projects: canViewAll,
    });

  if (memberError) return;
}

async function deleteCompany(
  companyId: string,
  prevState: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  "use server";

  void prevState;
  void formData;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { data: hasProjects } = await supabase
    .from("projects")
    .select("id")
    .eq("company_id", companyId)
    .limit(1);

  if (hasProjects && hasProjects.length > 0) {
    return { error: "This company has projects. Remove them before deleting." };
  }

  const { error } = await supabase.from("companies").delete().eq("id", companyId);
  if (error) return { error: error.message };

  revalidatePath("/directory");
  redirect("/directory");
}

export default async function CompanyDirectoryPage({ params }: PageProps) {
  const resolved = await Promise.resolve(params);
  const companyId = resolved?.companyId ?? "";

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");

  const { data: company } = await supabase
    .from("companies")
    .select("id,name,mode,created_at")
    .eq("id", companyId)
    .single();

  if (!company) {
    return (
      <main className="p-6 space-y-2">
        <h1 className="text-2xl font-semibold">Company not found</h1>
        <Link className="text-sm underline" href="/directory">
          Back to Directory
        </Link>
      </main>
    );
  }

  const { data: members } = await supabase
    .from("company_members")
    .select("user_id,role,is_active,can_view_all_projects,profiles(full_name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  const admin = createAdminClient();
  const memberEmails = await Promise.all(
    (members ?? []).map(async (member) => {
      const { data } = await admin.auth.admin.getUserById(member.user_id);
      return {
        id: member.user_id,
        email: data.user?.email ?? "",
      };
    })
  );

  const emailByUserId = new Map(memberEmails.map((m) => [m.id, m.email]));

  const { data: projects } = await supabase
    .from("projects")
    .select("id,name,health")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{company.name}</h1>
          <p className="text-sm opacity-80">
            Mode: {company.mode ?? "company"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link className="border rounded px-3 py-2 text-sm" href={`/directory/${companyId}/edit`}>
            Edit Company
          </Link>
          <Link className="border rounded px-3 py-2 text-sm" href="/directory">
            Back to Directory
          </Link>
        </div>
      </header>

      <section className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Users &amp; Permissions</h2>
            <p className="text-sm opacity-70">
              Manage access for this company and assign permissions.
            </p>
          </div>
          <form action={inviteCompanyUser.bind(null, companyId)} className="flex flex-wrap items-end gap-2 text-sm">
            <label className="space-y-1">
              <div className="opacity-70">Invite email</div>
              <input
                name="email"
                type="email"
                className="rounded border border-black/20 px-3 py-2"
                placeholder="user@company.com"
              />
            </label>
            <label className="flex items-center gap-2 pb-2">
              <input type="checkbox" name="can_view_all_projects" className="h-4 w-4" />
              <span className="text-xs opacity-70">All projects</span>
            </label>
            <button className="rounded border border-black bg-black px-3 py-2 text-sm text-white">
              Invite User
            </button>
          </form>
        </div>
        <div className="border rounded-lg">
          <div className="p-3 border-b font-medium">Users</div>
          <table className="w-full text-sm">
            <thead className="bg-black/5 border-b">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Role</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Permissions</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members && members.length > 0 ? (
                members.map((member) => (
                  <tr key={member.user_id} className="border-b last:border-b-0">
                    <td className="p-3">{member.profiles?.[0]?.full_name ?? member.user_id}</td>
                    <td className="p-3 capitalize">{member.role}</td>
                    <td className="p-3">{emailByUserId.get(member.user_id) ?? "-"}</td>
                    <td className="p-3">{member.is_active ? "Active" : "Inactive"}</td>
                    <td className="p-3">
                      {member.can_view_all_projects ? "All projects" : "Assigned only"}
                    </td>
                    <td className="p-3 text-right">
                      <button className="text-xs underline">Edit</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-4 opacity-70" colSpan={6}>
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Projects</h2>
            <p className="text-sm opacity-70">
              Projects this company is active on.
            </p>
          </div>
          <button className="border rounded px-3 py-2 text-sm">Assign to Project</button>
        </div>
        <div className="max-h-[360px] overflow-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black/5 backdrop-blur border-b">
              <tr>
                <th className="text-left p-3">Project</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects && projects.length > 0 ? (
                projects.map((project) => (
                  <tr key={project.id} className="border-b last:border-b-0">
                    <td className="p-3">{project.name}</td>
                    <td className="p-3">{project.health ?? "Active"}</td>
                    <td className="p-3 text-right">
                      <Link className="text-xs underline" href={`/projects/${project.id}`}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-4 opacity-70" colSpan={3}>
                    No projects assigned yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">Danger Zone</h2>
        <CompanyDeleteForm action={deleteCompany.bind(null, companyId)} />
      </section>
    </main>
  );
}
