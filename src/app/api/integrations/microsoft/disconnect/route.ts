import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/db/tenant";
import { disconnectMicrosoftMailboxConnection } from "@/lib/email/connections";

export async function POST() {
  try {
    const { companyId, userId } = await getTenantContext();
    await disconnectMicrosoftMailboxConnection({ tenantId: companyId, userId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to disconnect Microsoft 365 mailbox.";
    const status = message === "Not authenticated" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
