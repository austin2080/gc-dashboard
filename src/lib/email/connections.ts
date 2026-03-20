import { decryptMailboxToken, encryptMailboxToken } from "@/lib/email/token-crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type MailProvider = "microsoft_365" | "sendgrid_app";

export type MailboxConnection = {
  id: string;
  provider: MailProvider;
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
  provider: MailProvider;
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

function getSendgridVerifiedSender() {
  return process.env.SENDGRID_VERIFIED_SENDER?.trim() || "";
}

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
    .in("provider", ["sendgrid_app", "microsoft_365"])
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingRelationError(error)) return null;
    throw error;
  }

  const rows = (data ?? []) as StoredMailboxConnectionRow[];
  const activeRows = rows.filter((row) => row.status === "active");
  const preferred =
    activeRows.find((row) => row.provider === "sendgrid_app") ??
    activeRows.find((row) => row.provider === "microsoft_365") ??
    rows.find((row) => row.provider === "sendgrid_app") ??
    rows.find((row) => row.provider === "microsoft_365");

  if (!preferred) return null;

  return {
    id: preferred.id,
    provider: preferred.provider,
    status: preferred.status,
    email: preferred.email_address,
    displayName: preferred.display_name ?? "",
    tenantId: preferred.tenant_id,
    tokenExpiresAt: preferred.token_expires_at,
    createdAt: preferred.created_at,
    updatedAt: preferred.updated_at,
  } satisfies MailboxConnection;
}

export async function ensureSendgridMailboxConnection({
  tenantId,
  userId,
}: {
  tenantId: string;
  userId: string;
}) {
  const sender = getSendgridVerifiedSender();
  if (!sender) {
    throw new Error("Missing SENDGRID_VERIFIED_SENDER.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mailbox_connections")
    .upsert(
      {
        user_id: userId,
        provider: "sendgrid_app",
        email_address: sender,
        display_name: "BuildRight App",
        tenant_id: tenantId,
        refresh_token_encrypted: null,
        access_token_encrypted: null,
        token_expires_at: null,
        scopes: ["mail.send"],
        status: "active",
      },
      {
        onConflict: "user_id,provider,tenant_id",
      }
    )
    .select("id,user_id,provider,email_address,display_name,refresh_token_encrypted,access_token_encrypted,tenant_id,token_expires_at,scopes,status,created_at,updated_at")
    .single<StoredMailboxConnectionRow>();

  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error(
        "Missing mailbox_connections schema. Apply docs/supabase/bid-invites-schema.sql before using app email sending."
      );
    }
    throw error;
  }

  return {
    id: data.id,
    provider: data.provider,
    status: data.status,
    email: data.email_address,
    displayName: data.display_name ?? "BuildRight App",
    tenantId: data.tenant_id,
    tokenExpiresAt: data.token_expires_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  } satisfies MailboxConnection;
}

export async function setPreferredMailboxProvider({
  tenantId,
  userId,
  provider,
}: {
  tenantId: string;
  userId: string;
  provider: MailProvider;
}) {
  const admin = createAdminClient();

  if (provider === "sendgrid_app") {
    const connection = await ensureSendgridMailboxConnection({ tenantId, userId });
    await admin
      .from("mailbox_connections")
      .update({ status: "inactive" })
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .eq("provider", "microsoft_365");
    return connection;
  }

  const { data, error } = await admin
    .from("mailbox_connections")
    .update({ status: "active" })
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("provider", "microsoft_365")
    .select("id,user_id,provider,email_address,display_name,refresh_token_encrypted,access_token_encrypted,tenant_id,token_expires_at,scopes,status,created_at,updated_at")
    .maybeSingle<StoredMailboxConnectionRow>();

  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error(
        "Missing mailbox_connections schema. Apply docs/supabase/bid-invites-schema.sql before connecting Outlook."
      );
    }
    throw error;
  }

  if (!data) {
    throw new Error("Connect Outlook before selecting it as the sender.");
  }

  await admin
    .from("mailbox_connections")
    .update({ status: "inactive" })
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("provider", "sendgrid_app");

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
    provider: "microsoft_365",
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
