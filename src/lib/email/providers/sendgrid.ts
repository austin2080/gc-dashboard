import sgMail from "@sendgrid/mail";

export type SendgridMailRecipient = {
  email: string;
  name?: string | null;
};

export type SendSendgridMailInput = {
  to: SendgridMailRecipient[];
  fromEmail?: string | null;
  fromName?: string | null;
  subject: string;
  textBody: string;
  htmlBody?: string | null;
};

let sendgridConfigured = false;

function ensureSendgridConfigured() {
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing SENDGRID_API_KEY.");
  }
  if (!sendgridConfigured) {
    sgMail.setApiKey(apiKey);
    sendgridConfigured = true;
  }
}

export async function sendSendgridMail({
  to,
  fromEmail,
  fromName,
  subject,
  textBody,
  htmlBody,
}: SendSendgridMailInput) {
  ensureSendgridConfigured();

  const resolvedFromEmail =
    fromEmail?.trim() || process.env.SENDGRID_VERIFIED_SENDER?.trim() || "";
  if (!resolvedFromEmail) {
    throw new Error("Missing verified sender. Set SENDGRID_VERIFIED_SENDER or provide fromEmail.");
  }

  const [response] = await sgMail.send({
    to: to.map((recipient) => ({
      email: recipient.email,
      ...(recipient.name?.trim() ? { name: recipient.name.trim() } : {}),
    })),
    from: {
      email: resolvedFromEmail,
      ...(fromName?.trim() ? { name: fromName.trim() } : {}),
    },
    subject,
    text: textBody,
    ...(htmlBody?.trim() ? { html: htmlBody } : {}),
  });

  return {
    providerMessageId: response.headers["x-message-id"] ?? null,
    statusCode: response.statusCode,
  };
}
