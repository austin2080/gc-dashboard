import DirectoryCompanyTable from "@/components/directory-company-table";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const companyId = await getMyCompanyId();

  const { data: companies } = await supabase
    .from("companies")
    .select("id,name,mode,created_at")
    .order("name", { ascending: true });

  const { data: members } = await supabase
    .from("company_members")
    .select("user_id,role,is_active,can_view_all_projects,profiles(full_name)")
    .eq("company_id", companyId)
    .eq("is_active", true);

  return (
    <main className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Directory</h1>
        <p className="text-sm opacity-80">
          Central place for subcontractors, vendors, and company users.
        </p>
      </header>

      <div className="flex justify-end">
        <Link className="rounded border border-black bg-black px-4 py-2 text-sm text-white" href="/directory/new">
          Add Company
        </Link>
      </div>

      <DirectoryCompanyTable companies={companies ?? []} />

      <section className="border rounded-lg">
        <div className="p-4 border-b flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Company Users</h2>
            <p className="text-sm opacity-70">
              Manage staff access, roles, and invitations.
            </p>
          </div>
          <div className="text-xs opacity-70">Manage on company page</div>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black/5 backdrop-blur border-b">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Role</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Permissions</th>
              </tr>
            </thead>
            <tbody>
              {members && members.length > 0 ? (
                members.map((member) => (
                  <tr key={member.user_id} className="border-b last:border-b-0">
                    <td className="p-3">
                      {member.profiles?.full_name ?? member.user_id}
                    </td>
                    <td className="p-3 capitalize">{member.role}</td>
                    <td className="p-3">{member.is_active ? "Active" : "Inactive"}</td>
                    <td className="p-3">
                      {member.can_view_all_projects ? "All projects" : "Assigned only"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-4 opacity-70" colSpan={4}>
                    No company users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
