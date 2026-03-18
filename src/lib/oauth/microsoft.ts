import { createHash, randomUUID } from "crypto";

const MICROSOFT_GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const MICROSOFT_AUTH_BASE_URL = "https://login.microsoftonline.com";
const MICROSOFT_STATE_COOKIE = "builderos_microsoft_oauth_state";

export const MICROSOFT_GRAPH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "https://graph.microsoft.com/Mail.Send",
] as const;

type MicrosoftTokenResponse = {
  token_type?: string;
  scope?: string;
  expires_in?: number;
  ext_expires_in?: number;
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

export type MicrosoftProfile = {
  id: string;
  displayName?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
};

function getMicrosoftTenantId() {
  return process.env.MICROSOFT_ENTRA_TENANT_ID?.trim() || "common";
}

export function getMicrosoftStateCookieName() {
  return MICROSOFT_STATE_COOKIE;
}

export function getMicrosoftScopes() {
  return [...MICROSOFT_GRAPH_SCOPES];
}

export function getMicrosoftCallbackUrl(origin: string) {
  const explicit = process.env.MICROSOFT_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return new URL("/api/integrations/microsoft/callback", origin).toString();
}

export function createMicrosoftPkcePair() {
  const verifier = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const hash = createHash("sha256").update(verifier).digest("base64");
  return {
    verifier,
    challenge: hash.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""),
  };
}

function getRequiredMicrosoftClientId() {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("Missing MICROSOFT_CLIENT_ID.");
  }
  return clientId;
}

function getRequiredMicrosoftClientSecret() {
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  if (!clientSecret) {
    throw new Error("Missing MICROSOFT_CLIENT_SECRET.");
  }
  return clientSecret;
}

export function buildMicrosoftAuthUrl({
  origin,
  state,
  codeChallenge,
}: {
  origin: string;
  state: string;
  codeChallenge: string;
}) {
  const authorizeUrl = new URL(
    `${MICROSOFT_AUTH_BASE_URL}/${getMicrosoftTenantId()}/oauth2/v2.0/authorize`
  );
  authorizeUrl.searchParams.set("client_id", getRequiredMicrosoftClientId());
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", getMicrosoftCallbackUrl(origin));
  authorizeUrl.searchParams.set("response_mode", "query");
  authorizeUrl.searchParams.set("scope", getMicrosoftScopes().join(" "));
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  return authorizeUrl;
}

export async function exchangeCodeForTokens({
  code,
  origin,
  codeVerifier,
}: {
  code: string;
  origin: string;
  codeVerifier: string;
}) {
  const tokenUrl = `${MICROSOFT_AUTH_BASE_URL}/${getMicrosoftTenantId()}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: getRequiredMicrosoftClientId(),
    client_secret: getRequiredMicrosoftClientSecret(),
    code,
    grant_type: "authorization_code",
    redirect_uri: getMicrosoftCallbackUrl(origin),
    code_verifier: codeVerifier,
    scope: getMicrosoftScopes().join(" "),
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as MicrosoftTokenResponse | null;
  if (!response.ok || !payload?.access_token || !payload?.refresh_token) {
    throw new Error(payload?.error_description || payload?.error || "Microsoft token exchange failed.");
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresInSeconds: payload.expires_in ?? 0,
    scope: payload.scope ?? getMicrosoftScopes().join(" "),
  };
}

export async function refreshMicrosoftAccessToken({
  refreshToken,
  origin,
}: {
  refreshToken: string;
  origin: string;
}) {
  const tokenUrl = `${MICROSOFT_AUTH_BASE_URL}/${getMicrosoftTenantId()}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: getRequiredMicrosoftClientId(),
    client_secret: getRequiredMicrosoftClientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    redirect_uri: getMicrosoftCallbackUrl(origin),
    scope: getMicrosoftScopes().join(" "),
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as MicrosoftTokenResponse | null;
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || payload?.error || "Microsoft token refresh failed.");
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? refreshToken,
    expiresInSeconds: payload.expires_in ?? 0,
    scope: payload.scope ?? getMicrosoftScopes().join(" "),
  };
}

export async function getMicrosoftProfile(accessToken: string) {
  const response = await fetch(
    `${MICROSOFT_GRAPH_BASE_URL}/me?$select=id,displayName,mail,userPrincipalName`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  const payload = (await response.json().catch(() => null)) as MicrosoftProfile | null;
  if (!response.ok || !payload?.id) {
    throw new Error("Unable to load Microsoft Graph profile.");
  }

  return payload;
}

export function getMicrosoftMailboxAddress(profile: MicrosoftProfile) {
  return profile.mail?.trim() || profile.userPrincipalName?.trim() || "";
}
