import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/db/tenant";

type Payload = {
  name?: string;
  city?: string | null;
};

function clean(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed.length ? trimmed : null;
}

export async function POST(req: Request) {
  try {
    const { supabase, companyId, userId } = await getTenantContext();
    const payload = (await req.json().catch(() => null)) as Payload | null;

    const name = clean(payload?.name);
    if (!name) {
      return NextResponse.json({ error: "Project name is required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("projects")
      .insert({
        name,
        city: clean(payload?.city),
        health: "on_track",
        start_date: null,
        end_date: null,
        contracted_value: 0,
        estimated_profit: 0,
        estimated_buyout: 0,
        company_id: companyId,
        created_by: userId,
      })
      .select("id,name")
      .single();

    if (error || !data?.id) {
      return NextResponse.json({ error: error?.message ?? "Failed to create project." }, { status: 500 });
    }

    return NextResponse.json({ project: { id: data.id, name: data.name } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    const status = message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
