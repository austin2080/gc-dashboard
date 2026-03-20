import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/db/tenant";
import { sendSendgridMail } from "@/lib/email/providers/sendgrid";

type SendgridTestPayload = {
  to?: string;
  from?: string;
  fromName?: string;
  subject?: string;
  text?: string;
  html?: string;
};

function clean(value: unknown) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: Request) {
  try {
    await getTenantContext();

    const payload = (await request.json().catch(() => null)) as SendgridTestPayload | null;
    const to = clean(payload?.to);
    const from = clean(payload?.from);
    const fromName = clean(payload?.fromName);
    const subject = clean(payload?.subject) ?? "Sending with SendGrid is Fun";
    const text =
      clean(payload?.text) ?? "and easy to do anywhere, even with Node.js";
    const html =
      clean(payload?.html) ?? "<strong>and easy to do anywhere, even with Node.js</strong>";

    if (!to) {
      return NextResponse.json({ error: "`to` is required." }, { status: 400 });
    }

    const result = await sendSendgridMail({
      to: [{ email: to }],
      fromEmail: from,
      fromName,
      subject,
      textBody: text,
      htmlBody: html,
    });

    return NextResponse.json({
      ok: true,
      provider: "sendgrid",
      statusCode: result.statusCode,
      messageId: result.providerMessageId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send SendGrid email.";
    const status = message === "Not authenticated" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
