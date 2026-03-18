import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/db/tenant";
import { upsertMicrosoftMailboxConnection } from "@/lib/email/connections";
import {
  exchangeCodeForTokens,
  getMicrosoftMailboxAddress,
  getMicrosoftProfile,
  getMicrosoftStateCookieName,
} from "@/lib/oauth/microsoft";

type OAuthStateCookie = {
  state?: string;
  tenantId?: string;
  userId?: string;
  verifier?: string;
};

function buildSettingsRedirect(request: NextRequest, status: "connected" | "error", message?: string) {
  const redirectUrl = new URL("/settings", request.url);
  redirectUrl.searchParams.set("section", "email-sending");
  redirectUrl.searchParams.set("microsoft_status", status);
  if (message) {
    redirectUrl.searchParams.set("microsoft_message", message);
  }
  return redirectUrl;
}

export async function GET(request: NextRequest) {
  const requestUrl = request.nextUrl;
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const oauthError = requestUrl.searchParams.get("error_description") || requestUrl.searchParams.get("error");
  const redirectUrl = buildSettingsRedirect(request, "error");

  try {
    if (oauthError) {
      redirectUrl.searchParams.set("microsoft_message", oauthError);
      return NextResponse.redirect(redirectUrl);
    }

    if (!code || !state) {
      redirectUrl.searchParams.set("microsoft_message", "Microsoft callback is missing the authorization code.");
      return NextResponse.redirect(redirectUrl);
    }

    const { companyId, userId } = await getTenantContext();
    const stateCookie = request.cookies.get(getMicrosoftStateCookieName())?.value;
    const parsedState = stateCookie ? (JSON.parse(stateCookie) as OAuthStateCookie) : null;

    if (
      !parsedState ||
      parsedState.state !== state ||
      parsedState.tenantId !== companyId ||
      parsedState.userId !== userId ||
      !parsedState.verifier
    ) {
      redirectUrl.searchParams.set("microsoft_message", "Microsoft OAuth state validation failed.");
      const response = NextResponse.redirect(redirectUrl);
      response.cookies.delete(getMicrosoftStateCookieName());
      return response;
    }

    const tokenSet = await exchangeCodeForTokens({
      code,
      origin: requestUrl.origin,
      codeVerifier: parsedState.verifier,
    });
    const profile = await getMicrosoftProfile(tokenSet.accessToken);
    const email = getMicrosoftMailboxAddress(profile);

    if (!email) {
      throw new Error("Microsoft Graph did not return a mailbox address for the connected user.");
    }

    const tokenExpiresAt =
      tokenSet.expiresInSeconds > 0
        ? new Date(Date.now() + tokenSet.expiresInSeconds * 1000).toISOString()
        : null;

    await upsertMicrosoftMailboxConnection({
      tenantId: companyId,
      userId,
      email,
      displayName: profile.displayName?.trim() || email,
      refreshToken: tokenSet.refreshToken,
      accessToken: tokenSet.accessToken,
      tokenExpiresAt,
      scopes: tokenSet.scope.split(/\s+/).filter(Boolean),
    });

    const successRedirect = buildSettingsRedirect(request, "connected");
    const response = NextResponse.redirect(successRedirect);
    response.cookies.delete(getMicrosoftStateCookieName());
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to connect Microsoft 365 mailbox.";
    redirectUrl.searchParams.set("microsoft_message", message);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete(getMicrosoftStateCookieName());
    return response;
  }
}
