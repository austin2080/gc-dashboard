import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMailboxConnection } from "@/lib/email/connections";
import { sendBidInviteViaMicrosoft } from "@/lib/email/sendBidInvite";

type BidInviteRecipientInput = {
  contactName: string;
  companyName: string;
  email: string;
  tradeNames: string[];
};

type BidInviteTemplateContext = {
  projectName: string;
  bidPackageName: string;
  bidDueDate: string;
  prebidInfo: string;
  contactName: string;
  contactEmail: string;
};

type CreateBidInvitesPayload = {
  tenantId: string;
  userId: string;
  origin: string;
  bidPackageId: string;
  projectId: string;
  subjectTemplate: string;
  bodyTemplate: string;
  templateContext: BidInviteTemplateContext;
  recipients: BidInviteRecipientInput[];
};

function createInviteToken() {
  return randomBytes(32).toString("base64url");
}

function renderInviteTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((result, [token, value]) => result.split(token).join(value), template);
}

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

export async function createAndSendBidInvites(payload: CreateBidInvitesPayload) {
  const admin = createAdminClient();
  const mailboxConnection = await getMailboxConnection({
    tenantId: payload.tenantId,
    userId: payload.userId,
  });

  if (!mailboxConnection || mailboxConnection.status !== "active") {
    throw new Error("Connect an active Microsoft mailbox before sending bid invites.");
  }

  const uniqueRecipients = new Map<string, BidInviteRecipientInput>();
  for (const recipient of payload.recipients) {
    const email = recipient.email.trim().toLowerCase();
    const company = recipient.companyName.trim().toLowerCase();
    if (!email) continue;
    const key = `${company}::${email}`;
    const existing = uniqueRecipients.get(key);
    if (!existing) {
      uniqueRecipients.set(key, {
        ...recipient,
        email,
        tradeNames: [...new Set(recipient.tradeNames.filter(Boolean))],
      });
      continue;
    }
    const mergedTradeNames = [...new Set([...existing.tradeNames, ...recipient.tradeNames.filter(Boolean)])];
    uniqueRecipients.set(key, {
      ...existing,
      tradeNames: mergedTradeNames,
    });
  }

  if (!uniqueRecipients.size) {
    throw new Error("No invite recipients were provided.");
  }

  const { data: bidProjectSubs } = await admin
    .from("bid_project_subs")
    .select(
      "subcontractor_id,subcontractor:bid_subcontractors(id,company_name,email,primary_contact)"
    )
    .eq("project_id", payload.bidPackageId);

  const subcontractorIdByRecipientKey = new Map<string, string>();
  for (const row of bidProjectSubs ?? []) {
    const rowWithSubcontractor = row as unknown as {
      subcontractor?:
        | Array<{ id: string; company_name: string; email: string | null }>
        | { id: string; company_name: string; email: string | null }
        | null;
    };
    const subcontractor = Array.isArray(rowWithSubcontractor.subcontractor)
      ? rowWithSubcontractor.subcontractor[0]
      : rowWithSubcontractor.subcontractor;
    if (!subcontractor) continue;
    const key = `${subcontractor.company_name.trim().toLowerCase()}::${(subcontractor.email ?? "").trim().toLowerCase()}`;
    subcontractorIdByRecipientKey.set(key, subcontractor.id);
  }

  const createdInviteIds: string[] = [];
  const results: Array<{ inviteId: string; ok: boolean; error?: string }> = [];

  for (const recipient of uniqueRecipients.values()) {
    const inviteToken = createInviteToken();
    const inviteUrl = new URL(`/bid-invite/${inviteToken}`, payload.origin).toString();
    const templateValues = {
      "{project_name}": payload.templateContext.projectName,
      "{bid_package_name}": payload.templateContext.bidPackageName,
      "{bid_due_date}": payload.templateContext.bidDueDate,
      "{prebid_info}": payload.templateContext.prebidInfo,
      "{portal_link}": inviteUrl,
      "{contact_name}": payload.templateContext.contactName,
      "{contact_email}": payload.templateContext.contactEmail,
    };

    const subject = renderInviteTemplate(payload.subjectTemplate, templateValues);
    const bodySnapshot = renderInviteTemplate(payload.bodyTemplate, templateValues);
    const recipientKey = `${recipient.companyName.trim().toLowerCase()}::${recipient.email.trim().toLowerCase()}`;
    const subcontractorId = subcontractorIdByRecipientKey.get(recipientKey) ?? null;

    const { data: inviteRow, error: inviteError } = await admin
      .from("bid_invites")
      .insert({
        project_id: payload.projectId,
        bid_package_id: payload.bidPackageId,
        subcontractor_id: subcontractorId,
        contact_name: recipient.contactName.trim() || recipient.companyName.trim(),
        company_name: recipient.companyName.trim(),
        email: recipient.email.trim(),
        trade_name: recipient.tradeNames.length ? recipient.tradeNames.join(", ") : null,
        invite_token: inviteToken,
        status: "queued",
        subject,
        body_snapshot: bodySnapshot,
        mailbox_connection_id: mailboxConnection.id,
        created_by: payload.userId,
      })
      .select("id")
      .single<{ id: string }>();

    if (inviteError || !inviteRow?.id) {
      throw inviteError ?? new Error("Unable to create bid invite row.");
    }

    createdInviteIds.push(inviteRow.id);
    await insertInviteEvent({
      bidInviteId: inviteRow.id,
      eventType: "created",
      metadata: { email: recipient.email.trim(), tradeNames: recipient.tradeNames },
    });
    await insertInviteEvent({
      bidInviteId: inviteRow.id,
      eventType: "send_requested",
      metadata: { provider: "microsoft_365" },
    });

    const sendResult = await sendBidInviteViaMicrosoft(inviteRow.id, payload.origin);
    results.push({
      inviteId: inviteRow.id,
      ok: sendResult.ok,
      ...(sendResult.ok ? {} : { error: sendResult.error }),
    });
  }

  return {
    inviteIds: createdInviteIds,
    results,
  };
}
