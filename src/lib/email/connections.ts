import { decryptMailboxToken, encryptMailboxToken } from "@/lib/email/token-crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type MailboxConnection = {
  id: string;
  provider: "microsoft_365";
  status: "active" | "inactive" | "error";
  email: string;
  displayName: string;
  tenantId: string | null;
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type StoredMailboxConnectionRow = {
  id: string;
  user_id: string;
  provider: "microsoft_365";
  email_address: string;
  display_name: string | null;
  tenant_id: string | null;
  refresh_token_encrypted: string | null;
  access_token_encrypted: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
  status: "active" | "inactive" | "error";
  created_at: string;
  updated_at: string;
};

export type MicrosoftMailboxCredential = {
  id: string;
  userId: string;
  provider: "microsoft_365";
  emailAddress: string;
  displayName: string;
  tenantId: string | null;
  refreshToken: string | null;
  accessToken: string | null;
  tokenExpiresAt: string | null;
  scopes: string[];
  status: "active" | "inactive" | "error";
};

function isMissingRelationError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return candidate.code === "42P01" || candidate.message?.includes("does not exist") === true;
}

export async function getMailboxConnection({
  tenantId,
  userId,
}: {
  tenantId: string;
  userId: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mailbox_connections")
    .select("id,user_id,provider,email_address,display_name,refresh_token_encrypted,access_token_encrypted,tenant_id,token_expires_at,scopes,status,created_at,updated_at")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("provider", "microsoft_365")
    .maybeSingle<StoredMailboxConnectionRow>();

  if (error) {
    if (isMissingRelationError(error)) return null;
    throw error;
  }

  if (!data) return null;

  return {
    id: data.id,
    provider: data.provider,
    status: data.status,
    email: data.email_address,
    displayName: data.display_name ?? "",
    tenantId: data.tenant_id,
    tokenExpiresAt: data.token_expires_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  } satisfies MailboxConnection;
}

export async function getMicrosoftMailboxCredential({
  tenantId,
  userId,
}: {
  tenantId: string;
  userId: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mailbox_connections")
    .select("id,user_id,provider,email_address,display_name,refresh_token_encrypted,access_token_encrypted,tenant_id,token_expires_at,scopes,status,created_at,updated_at")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("provider", "microsoft_365")
    .maybeSingle<StoredMailboxConnectionRow>();

  if (error) {
    if (isMissingRelationError(error)) return null;
    throw error;
  }

  if (!data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    provider: data.provider,
    emailAddress: data.email_address,
    displayName: data.display_name ?? "",
    tenantId: data.tenant_id,
    refreshToken: data.refresh_token_encrypted ? decryptMailboxToken(data.refresh_token_encrypted) : null,
    accessToken: data.access_token_encrypted ? decryptMailboxToken(data.access_token_encrypted) : null,
    tokenExpiresAt: data.token_expires_at,
    scopes: data.scopes ?? [],
    status: data.status,
  } satisfies MicrosoftMailboxCredential;
}

export async function upsertMicrosoftMailboxConnection({
  tenantId,
  userId,
  email,
  displayName,
  refreshToken,
  accessToken,
  tokenExpiresAt,
  scopes,
}: {
  tenantId: string;
  userId: string;
  email: string;
  displayName: string;
  refreshToken: string;
  accessToken: string | null;
  tokenExpiresAt: string | null;
  scopes: string[];
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("mailbox_connections").upsert(
    {
      user_id: userId,
      provider: "microsoft_365",
      email_address: email,
      display_name: displayName,
      tenant_id: tenantId,
      refresh_token_encrypted: encryptMailboxToken(refreshToken),
      access_token_encrypted: accessToken ? encryptMailboxToken(accessToken) : null,
      token_expires_at: tokenExpiresAt,
      scopes,
      status: "active",
    },
    {
      onConflict: "user_id,provider,tenant_id",
    }
  );

  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error(
        "Missing mailbox_connections schema. Apply docs/supabase/bid-invites-schema.sql before connecting Outlook."
      );
    }
    throw error;
  }
}

export async function disconnectMicrosoftMailboxConnection({
  tenantId,
  userId,
}: {
  tenantId: string;
  userId: string;
}) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("mailbox_connections")
    .update({
      status: "inactive",
      refresh_token_encrypted: null,
      access_token_encrypted: null,
      token_expires_at: null,
    })
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("provider", "microsoft_365");

  if (error) {
    if (isMissingRelationError(error)) return;
    throw error;
  }
}

export async function updateMicrosoftMailboxTokens({
  connectionId,
  accessToken,
  refreshToken,
  tokenExpiresAt,
  status,
}: {
  connectionId: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  status?: "active" | "inactive" | "error";
}) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("mailbox_connections")
    .update({
      access_token_encrypted: accessToken ? encryptMailboxToken(accessToken) : null,
      refresh_token_encrypted: refreshToken ? encryptMailboxToken(refreshToken) : null,
      token_expires_at: tokenExpiresAt,
      ...(status ? { status } : {}),
    })
    .eq("id", connectionId)
    .eq("provider", "microsoft_365");

  if (error) {
    if (isMissingRelationError(error)) return;
    throw error;
  }
}
