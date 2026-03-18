import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/db/tenant";
import { getMailboxConnection } from "@/lib/email/connections";

export async function GET() {
  try {
    const { companyId, userId } = await getTenantContext();
    const connection = await getMailboxConnection({ tenantId: companyId, userId });

    return NextResponse.json({
      connection: connection
        ? {
            id: connection.id,
            provider: connection.provider,
            status: connection.status,
            email: connection.email,
            displayName: connection.displayName,
            connectedAt: connection.createdAt,
            updatedAt: connection.updatedAt,
          }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load email sending connection.";
    const status = message === "Not authenticated" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
