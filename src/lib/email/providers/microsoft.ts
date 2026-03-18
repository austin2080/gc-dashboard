export type MicrosoftMailRecipient = {
  email: string;
  name?: string | null;
};

export type SendMicrosoftMailInput = {
  accessToken: string;
  subject: string;
  textBody: string;
  to: MicrosoftMailRecipient[];
};

export type SendMicrosoftMailResult = {
  providerMessageId: string | null;
  requestId: string | null;
};

export async function sendMicrosoftMail({
  accessToken,
  subject,
  textBody,
  to,
}: SendMicrosoftMailInput): Promise<SendMicrosoftMailResult> {
  const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject,
        body: {
          contentType: "Text",
          content: textBody,
        },
        toRecipients: to.map((recipient) => ({
          emailAddress: {
            address: recipient.email,
            ...(recipient.name?.trim() ? { name: recipient.name.trim() } : {}),
          },
        })),
      },
      saveToSentItems: true,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { code?: string; message?: string } }
      | null;
    throw new Error(
      payload?.error?.message ||
        payload?.error?.code ||
        `Microsoft sendMail failed with status ${response.status}.`
    );
  }

  return {
    providerMessageId: null,
    requestId: response.headers.get("request-id") || response.headers.get("client-request-id"),
  };
}
