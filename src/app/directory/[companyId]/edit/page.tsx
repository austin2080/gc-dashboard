import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type FormState = { error?: string };

type PageProps = {
  params: { companyId: string } | Promise<{ companyId: string }>;
};

async function updateCompany(
  companyId: string,
  _: FormState,
  formData: FormData
): Promise<FormState> {
  "use server";

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const mode = String(formData.get("mode") ?? "company");
  if (!name) return { error: "Company name is required." };

  const { error } = await supabase
    .from("companies")
    .update({ name, mode })
    .eq("id", companyId);

  if (error) return { error: error.message };

  revalidatePath("/directory");
  revalidatePath(`/directory/${companyId}`);
  redirect(`/directory/${companyId}`);
}

export default async function EditCompanyPage({ params }: PageProps) {
  const resolved = await Promise.resolve(params);
  const companyId = resolved?.companyId ?? "";

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { data: company } = await supabase
    .from("companies")
    .select("id,name,mode,created_at")
    .eq("id", companyId)
    .single();

  if (!company) redirect("/directory");

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Edit Company</h1>
          <p className="text-sm opacity-80">{company.name}</p>
        </div>
        <Link className="border rounded px-3 py-2 text-sm" href={`/directory/${companyId}`}>
          Back to Company
        </Link>
      </header>

      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Company Details</h2>
        <form action={updateCompany.bind(null, companyId)} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <label className="space-y-1 md:col-span-2">
            <div className="opacity-70">Company Name</div>
            <input
              name="name"
              defaultValue={company.name}
              className="w-full rounded border border-black/20 px-3 py-2"
            />
          </label>
          <label className="space-y-1">
            <div className="opacity-70">Mode</div>
            <select
              name="mode"
              className="w-full rounded border border-black/20 px-3 py-2"
              defaultValue={company.mode ?? "company"}
            >
              <option value="company">Company</option>
              <option value="solo">Solo</option>
            </select>
          </label>
          <div className="md:col-span-2 flex justify-end">
            <button className="rounded border border-black bg-black px-4 py-2 text-sm text-white">
              Save Changes
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
