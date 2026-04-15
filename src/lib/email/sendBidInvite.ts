import { createAdminClient } from "@/lib/supabase/admin";
import { sendSendgridMail } from "@/lib/email/providers/sendgrid";
import {
  getMicrosoftMailboxCredential,
  updateMicrosoftMailboxTokens,
} from "@/lib/email/connections";
import { sendMicrosoftMail } from "@/lib/email/providers/microsoft";
import { refreshMicrosoftAccessToken } from "@/lib/oauth/microsoft";
import { emailHtmlToPlainText, normalizeEmailBodyHtml } from "@/lib/email/html";

type StoredInviteRecord = {
  id: string;
  mailbox_connection_id: string;
  email: string;
  contact_name: string;
  subject: string;
  body_snapshot: string;
};

async function insertInviteEvent({
  bidInviteId,
  eventType,
  metadata,
}: {
  bidInviteId: string;
  eventType:
    | "created"
    | "send_requested"
    | "sent"
    | "failed"
    | "opened"
    | "portal_viewed"
    | "reminder_sent"
    | "submitted"
    | "declined";
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  await admin.from("bid_invite_events").insert({
    bid_invite_id: bidInviteId,
    event_type: eventType,
    metadata: metadata ?? {},
  });
}

export async function sendBidInviteViaMicrosoft(inviteId: string, origin: string) {
  const admin = createAdminClient();
  const { data: invite, error: inviteError } = await admin
    .from("bid_invites")
    .select("id,mailbox_connection_id,email,contact_name,subject,body_snapshot")
    .eq("id", inviteId)
    .maybeSingle<StoredInviteRecord>();

  if (inviteError || !invite) {
    throw inviteError ?? new Error("Invite not found.");
  }

  const { data: mailboxRow, error: mailboxError } = await admin
    .from("mailbox_connections")
    .select("tenant_id,user_id")
    .eq("id", invite.mailbox_connection_id)
    .maybeSingle<{ tenant_id: string | null; user_id: string }>();

  if (mailboxError || !mailboxRow?.tenant_id) {
    throw mailboxError ?? new Error("Mailbox connection not found for invite.");
  }

  const mailbox = await getMicrosoftMailboxCredential({
    tenantId: mailboxRow.tenant_id,
    userId: mailboxRow.user_id,
  });

  if (!mailbox || mailbox.status !== "active" || !mailbox.refreshToken) {
    const message = "Active Microsoft mailbox connection is required to send invite.";
    await admin
      .from("bid_invites")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        failure_reason: message,
      })
      .eq("id", inviteId);
    await insertInviteEvent({
      bidInviteId: inviteId,
      eventType: "failed",
      metadata: { reason: message },
    });
    return { ok: false as const, error: message };
  }

  let accessToken = mailbox.accessToken;
  const expiresAt = mailbox.tokenExpiresAt ? new Date(mailbox.tokenExpiresAt).getTime() : 0;
  const isExpired = !accessToken || !expiresAt || expiresAt <= Date.now() + 60_000;

  if (isExpired) {
    const refreshed = await refreshMicrosoftAccessToken({
      refreshToken: mailbox.refreshToken,
      origin,
    });
    accessToken = refreshed.accessToken;
    await updateMicrosoftMailboxTokens({
      connectionId: mailbox.id,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      tokenExpiresAt:
        refreshed.expiresInSeconds > 0
          ? new Date(Date.now() + refreshed.expiresInSeconds * 1000).toISOString()
          : null,
      status: "active",
    });
  }

  if (!accessToken) {
    throw new Error("Microsoft access token is unavailable for invite sending.");
  }

  try {
    const htmlBody = normalizeEmailBodyHtml(invite.body_snapshot);
    const sendResult = await sendMicrosoftMail({
      accessToken,
      subject: invite.subject,
      textBody: emailHtmlToPlainText(htmlBody),
      htmlBody,
      to: [
        {
          email: invite.email,
          name: invite.contact_name || null,
        },
      ],
    });

    await admin
      .from("bid_invites")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        failed_at: null,
        failure_reason: null,
        provider_message_id: sendResult.providerMessageId,
      })
      .eq("id", inviteId);

    await insertInviteEvent({
      bidInviteId: inviteId,
      eventType: "sent",
      metadata: {
        provider: "microsoft_365",
        requestId: sendResult.requestId,
      },
    });

    return {
      ok: true as const,
      providerMessageId: sendResult.providerMessageId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send Microsoft invite.";
    await admin
      .from("bid_invites")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        failure_reason: message,
      })
      .eq("id", inviteId);

    await insertInviteEvent({
      bidInviteId: inviteId,
      eventType: "failed",
      metadata: {
        provider: "microsoft_365",
        reason: message,
      },
    });

    return {
      ok: false as const,
      error: message,
    };
  }
}

export async function sendBidInviteViaSendgrid(inviteId: string) {
  const admin = createAdminClient();
  const { data: invite, error: inviteError } = await admin
    .from("bid_invites")
    .select("id,mailbox_connection_id,email,contact_name,subject,body_snapshot")
    .eq("id", inviteId)
    .maybeSingle<StoredInviteRecord>();

  if (inviteError || !invite) {
    throw inviteError ?? new Error("Invite not found.");
  }

  try {
    const htmlBody = normalizeEmailBodyHtml(invite.body_snapshot);
    const sendResult = await sendSendgridMail({
      to: [
        {
          email: invite.email,
          name: invite.contact_name || null,
        },
      ],
      subject: invite.subject,
      textBody: emailHtmlToPlainText(htmlBody),
      htmlBody,
    });

    await admin
      .from("bid_invites")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        failed_at: null,
        failure_reason: null,
        provider_message_id: sendResult.providerMessageId,
      })
      .eq("id", inviteId);

    await insertInviteEvent({
      bidInviteId: inviteId,
      eventType: "sent",
      metadata: {
        provider: "sendgrid_app",
        statusCode: sendResult.statusCode,
      },
    });

    return {
      ok: true as const,
      providerMessageId: sendResult.providerMessageId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send SendGrid invite.";
    await admin
      .from("bid_invites")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        failure_reason: message,
      })
      .eq("id", inviteId);

    await insertInviteEvent({
      bidInviteId: inviteId,
      eventType: "failed",
      metadata: {
        provider: "sendgrid_app",
        reason: message,
      },
    });

    return {
      ok: false as const,
      error: message,
    };
  }
}
