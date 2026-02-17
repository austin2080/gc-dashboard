import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ProfileLookup = {
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
};

function extractMessage(params: Record<string, string | string[] | undefined>, key: string): string | null {
  const value = params[key];
  if (typeof value === "string") return value;
  return null;
}

async function loadProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<{ row: ProfileLookup | null; key: "id" | "user_id" | null }> {
  const byId = await supabase
    .from("profiles")
    .select("first_name,last_name,full_name")
    .eq("id", userId)
    .maybeSingle();
  if (!byId.error) return { row: (byId.data as ProfileLookup | null) ?? null, key: "id" };

  const byUserId = await supabase
    .from("profiles")
    .select("first_name,last_name,full_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!byUserId.error) return { row: (byUserId.data as ProfileLookup | null) ?? null, key: "user_id" };

  return { row: null, key: null };
}

async function saveProfile(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) redirect("/login");

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const fullName = `${firstName} ${lastName}`.trim();

  const payload = {
    first_name: firstName || null,
    last_name: lastName || null,
    full_name: fullName || null,
  };

  const idUpdate = await supabase.from("profiles").update(payload).eq("id", user.id).select("first_name").limit(1);
  if (!idUpdate.error) {
    revalidatePath("/profile");
    redirect("/profile?saved=1");
  }

  const userIdUpdate = await supabase
    .from("profiles")
    .update(payload)
    .eq("user_id", user.id)
    .select("first_name")
    .limit(1);
  if (!userIdUpdate.error) {
    revalidatePath("/profile");
    redirect("/profile?saved=1");
  }

  const idInsert = await supabase.from("profiles").insert({
    id: user.id,
    ...payload,
  });
  if (!idInsert.error) {
    revalidatePath("/profile");
    redirect("/profile?saved=1");
  }

  const userIdInsert = await supabase.from("profiles").insert({
    user_id: user.id,
    ...payload,
  });
  if (!userIdInsert.error) {
    revalidatePath("/profile");
    redirect("/profile?saved=1");
  }

  const errorMessage =
    userIdInsert.error?.message ||
    idInsert.error?.message ||
    userIdUpdate.error?.message ||
    idUpdate.error?.message ||
    "Unable to update profile.";

  redirect(`/profile?error=${encodeURIComponent(errorMessage)}`);
}

export default async function ProfilePage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) redirect("/login");

  const params = searchParams ? await searchParams : {};
  const saved = extractMessage(params, "saved");
  const error = extractMessage(params, "error");

  const profile = await loadProfile(supabase, user.id);
  const existingFirst = profile.row?.first_name ?? "";
  const existingLast = profile.row?.last_name ?? "";

  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-5">
          <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>
          <p className="mt-1 text-sm text-slate-600">Update your name for assignments and project records.</p>
        </header>

        {saved ? (
          <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Profile updated.
          </p>
        ) : null}
        {error ? (
          <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <form action={saveProfile} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              value={user.email ?? ""}
              disabled
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">First name</span>
              <input
                name="first_name"
                defaultValue={existingFirst}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800"
                placeholder="First name"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Last name</span>
              <input
                name="last_name"
                defaultValue={existingLast}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800"
                placeholder="Last name"
              />
            </label>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Save Profile
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
