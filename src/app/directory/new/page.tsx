import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import NewCompanyForm from "@/components/new-company-form";

type FormState = { error?: string };

async function createCompany(prevState: FormState, formData: FormData): Promise<FormState> {
  "use server";

  void prevState;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const mode = String(formData.get("mode") ?? "company");
  const trade = String(formData.get("trade") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const state = String(formData.get("state") ?? "").trim() || null;
  const zip = String(formData.get("zip") ?? "").trim() || null;

  if (!name) return { error: "Company name is required." };

  const { data: company, error } = await supabase
    .from("companies")
    .insert({
      name,
      mode,
      trade,
      address,
      city,
      state,
      zip,
      created_by: data.user.id,
    })
    .select("id")
    .single();

  if (error || !company) return { error: error?.message ?? "Failed to create company." };

  const { error: memberError } = await supabase.from("company_members").insert({
    company_id: company.id,
    user_id: data.user.id,
    role: "pm",
    is_active: true,
    can_view_all_projects: true,
  });

  if (memberError) return { error: memberError.message };

  revalidatePath("/directory");
  redirect("/directory");
}

export default function NewCompanyPage() {
  return (
    <main className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Add Company</h1>
          <p className="text-sm opacity-80">
            Create a company record to manage users, permissions, and assignments.
          </p>
        </div>
        <Link className="border rounded px-3 py-2 text-sm" href="/directory">
          Back to Directory
        </Link>
      </header>

      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Company Details</h2>
        <NewCompanyForm action={createCompany} />
      </section>
    </main>
  );
}
