import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/db/tenant";
import {
  buildMicrosoftAuthUrl,
  createMicrosoftPkcePair,
  getMicrosoftStateCookieName,
} from "@/lib/oauth/microsoft";

export async function GET(request: NextRequest) {
  try {
    const { companyId, userId } = await getTenantContext();
    const state = randomUUID();
    const { verifier, challenge } = createMicrosoftPkcePair();
    const origin = request.nextUrl.origin;
    const authorizeUrl = buildMicrosoftAuthUrl({ origin, state, codeChallenge: challenge });

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set({
      name: getMicrosoftStateCookieName(),
      value: JSON.stringify({
        state,
        tenantId: companyId,
        userId,
        verifier,
      }),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 10,
      path: "/",
    });

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to start Microsoft 365 connection.";
    const redirectUrl = new URL("/settings", request.url);
    redirectUrl.searchParams.set("section", "email-sending");
    redirectUrl.searchParams.set("microsoft_status", "error");
    redirectUrl.searchParams.set("microsoft_message", message);
    return NextResponse.redirect(redirectUrl);
  }
}
