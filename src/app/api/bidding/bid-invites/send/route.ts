import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/db/tenant";
import { createAndSendBidInvites } from "@/lib/bid-invites/service";
import { sanitizeEmailHtml } from "@/lib/email/html";

type SendBidInvitesRequestBody = {
  bidPackageId?: string;
  projectId?: string;
  subjectTemplate?: string;
  bodyTemplate?: string;
  templateContext?: {
    projectName?: string;
    bidPackageName?: string;
    bidDueDate?: string;
    prebidInfo?: string;
    contactName?: string;
    contactEmail?: string;
    projectAddress?: string;
    primaryBidContact?: string;
    secondaryBidContact?: string;
    primaryBidContactEmail?: string;
    secondaryBidContactEmail?: string;
    constructionStartDate?: string;
    constructionDuration?: string;
    projectSize?: string;
    projectSiteSize?: string;
    primaryBidContactSignature?: string;
  };
  recipients?: Array<{
    contactName?: string;
    companyName?: string;
    email?: string;
    tradeNames?: string[];
  }>;
};

export async function POST(request: Request) {
  try {
    const { companyId, userId } = await getTenantContext();
    const body = (await request.json().catch(() => null)) as SendBidInvitesRequestBody | null;

    if (!body?.bidPackageId) {
      return NextResponse.json({ error: "Missing bidPackageId." }, { status: 400 });
    }
    if (!body.subjectTemplate?.trim() || !body.bodyTemplate?.trim()) {
      return NextResponse.json({ error: "Subject and message templates are required." }, { status: 400 });
    }
    if (!body.templateContext) {
      return NextResponse.json({ error: "Missing template context." }, { status: 400 });
    }

    const recipients = (body.recipients ?? [])
      .map((recipient) => ({
        contactName: recipient.contactName?.trim() || "",
        companyName: recipient.companyName?.trim() || "",
        email: recipient.email?.trim() || "",
        tradeNames: Array.isArray(recipient.tradeNames) ? recipient.tradeNames.filter(Boolean) : [],
      }))
      .filter((recipient) => recipient.companyName && recipient.email);

    if (!recipients.length) {
      return NextResponse.json({ error: "Select at least one invite recipient." }, { status: 400 });
    }

    const result = await createAndSendBidInvites({
      tenantId: companyId,
      userId,
      origin: new URL(request.url).origin,
      bidPackageId: body.bidPackageId,
      projectId: body.projectId?.trim() || body.bidPackageId,
      subjectTemplate: body.subjectTemplate,
      bodyTemplate: sanitizeEmailHtml(body.bodyTemplate),
      templateContext: {
        projectName: body.templateContext.projectName?.trim() || "Project Name",
        bidPackageName: body.templateContext.bidPackageName?.trim() || "Bid Package Name",
        bidDueDate: body.templateContext.bidDueDate?.trim() || "TBD",
        prebidInfo: body.templateContext.prebidInfo?.trim() || "No pre-bid details available.",
        contactName: body.templateContext.contactName?.trim() || "Primary bidding contact",
        contactEmail: body.templateContext.contactEmail?.trim() || "",
        projectAddress: body.templateContext.projectAddress?.trim() || "Project address",
        primaryBidContact: body.templateContext.primaryBidContact?.trim() || "Primary bidding contact",
        secondaryBidContact: body.templateContext.secondaryBidContact?.trim() || "Secondary bidding contact",
        primaryBidContactEmail: body.templateContext.primaryBidContactEmail?.trim() || "",
        secondaryBidContactEmail: body.templateContext.secondaryBidContactEmail?.trim() || "",
        constructionStartDate: body.templateContext.constructionStartDate?.trim() || "TBD",
        constructionDuration: body.templateContext.constructionDuration?.trim() || "TBD",
        projectSize: body.templateContext.projectSize?.trim() || "TBD",
        projectSiteSize: body.templateContext.projectSiteSize?.trim() || "TBD",
        primaryBidContactSignature:
          body.templateContext.primaryBidContactSignature?.trim() || "Primary bidding contact",
      },
      recipients,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create bid invites.";
    const status = message === "Not authenticated" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
