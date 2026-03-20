import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/db/tenant";
import {
  ensureSendgridMailboxConnection,
  getMailboxConnection,
  setPreferredMailboxProvider,
  type MailProvider,
} from "@/lib/email/connections";

export async function GET() {
  try {
    const { companyId, userId } = await getTenantContext();
    await ensureSendgridMailboxConnection({ tenantId: companyId, userId }).catch(() => null);
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

export async function POST(request: Request) {
  try {
    const { companyId, userId } = await getTenantContext();
    const payload = (await request.json().catch(() => null)) as
      | { provider?: MailProvider }
      | null;
    const provider = payload?.provider;

    if (provider !== "sendgrid_app" && provider !== "microsoft_365") {
      return NextResponse.json({ error: "Valid provider is required." }, { status: 400 });
    }

    const connection = await setPreferredMailboxProvider({
      tenantId: companyId,
      userId,
      provider,
    });

    return NextResponse.json({
      connection: {
        id: connection.id,
        provider: connection.provider,
        status: connection.status,
        email: connection.email,
        displayName: connection.displayName,
        connectedAt: connection.createdAt,
        updatedAt: connection.updatedAt,
        tokenExpiresAt: connection.tokenExpiresAt,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update email sending connection.";
    const status = message === "Not authenticated" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
