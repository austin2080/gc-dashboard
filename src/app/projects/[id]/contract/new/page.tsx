import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompanyId } from "@/lib/db/company";
import NewPrimeContractForm from "@/components/new-prime-contract-form";

type FormState = { error?: string };

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

async function createPrimeContract(
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

  if (!project) {
    return { error: "Project not found." };
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Contract title is required." };

  const owner_name = String(formData.get("owner_name") ?? "").trim() || null;
  const contractor_name = String(formData.get("contractor_name") ?? "").trim() || null;
  const architect_engineer = String(formData.get("architect_engineer") ?? "").trim() || null;
  const retention_percent = Number(formData.get("retention_percent") ?? 0) || 0;
  const status = String(formData.get("status") ?? "draft");
  const executed = formData.get("executed") === "on";

  const original_amount = Number(formData.get("original_amount") ?? 0) || 0;
  const change_orders_amount = Number(formData.get("change_orders_amount") ?? 0) || 0;
  const estimated_profit = Number(formData.get("estimated_profit") ?? 0) || 0;
  const estimated_buyout = Number(formData.get("estimated_buyout") ?? 0) || 0;

  const revised_amount = original_amount + change_orders_amount;
  const pay_app_status = String(formData.get("pay_app_status") ?? "").trim() || null;
  const payments_received = String(formData.get("payments_received") ?? "").trim() || null;

  const inclusions = String(formData.get("inclusions") ?? "").trim() || null;
  const exclusions = String(formData.get("exclusions") ?? "").trim() || null;

  const invoice_contact_name =
    String(formData.get("invoice_contact_name") ?? "").trim() || null;
  const invoice_contact_email =
    String(formData.get("invoice_contact_email") ?? "").trim() || null;
  const invoice_contact_phone =
    String(formData.get("invoice_contact_phone") ?? "").trim() || null;

  const schedule_of_values_raw = String(formData.get("schedule_of_values") ?? "[]");
  let schedule_of_values: unknown = [];
  try {
    schedule_of_values = JSON.parse(schedule_of_values_raw);
  } catch {
    schedule_of_values = [];
  }

  const { data: inserted, error } = await supabase
    .from("prime_contracts")
    .insert({
      project_id: projectId,
      title,
      owner_name,
      contractor_name,
      architect_engineer,
      retention_percent,
      status,
      executed,
      original_amount,
      revised_amount,
      change_orders_amount,
      estimated_profit,
      estimated_buyout,
      pay_app_status,
      payments_received,
      inclusions,
      exclusions,
      invoice_contact_name,
      invoice_contact_email,
      invoice_contact_phone,
      schedule_of_values,
    })
    .select("id")
    .single();

  if (error || !inserted?.id) {
    return { error: error?.message ?? "Failed to create contract." };
  }

  redirect(`/projects/${projectId}/contract/${inserted.id}`);
}

export default async function NewPrimeContractPage({ params }: PageProps) {
  const resolved = await Promise.resolve(params);
  const projectId = resolved?.id ?? "";

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const companyId = await getMyCompanyId();
  const { data: costCodes } = await supabase
    .from("cost_codes")
    .select("code,description")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("code", { ascending: true });

  return (
    <NewPrimeContractForm
      action={createPrimeContract.bind(null, projectId)}
      projectId={projectId}
      costCodes={costCodes ?? []}
    />
  );
}
