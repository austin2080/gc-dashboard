"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SettingsCard } from "./SettingsCard";
import { SettingsSectionHeader } from "./SettingsSectionHeader";

type ConnectionPayload = {
  id: string;
  provider: "microsoft_365";
  status: "active" | "inactive" | "error";
  email: string;
  displayName: string;
  connectedAt: string | null;
  updatedAt: string | null;
  tokenExpiresAt: string | null;
};

function formatConnectionDate(value: string | null) {
  if (!value) return "Not connected";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Connected";
  return parsed.toLocaleString();
}

function getMailboxBadge(connection: ConnectionPayload | null, loading: boolean) {
  if (loading) {
    return {
      label: "Loading",
      className: "bg-slate-200 text-slate-700",
    };
  }

  if (!connection || connection.status === "inactive") {
    return {
      label: "Not Connected",
      className: "bg-slate-200 text-slate-700",
    };
  }

  const expiresAt = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt).getTime() : 0;
  const isExpired = connection.status === "error" || (!!expiresAt && expiresAt <= Date.now());
  if (isExpired) {
    return {
      label: "Expired",
      className: "bg-amber-100 text-amber-700",
    };
  }

  return {
    label: "Connected",
    className: "bg-emerald-100 text-emerald-700",
  };
}

export function EmailSendingSection() {
  const searchParams = useSearchParams();
  const [connection, setConnection] = useState<ConnectionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadConnection() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/integrations/microsoft/connection", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { connection?: ConnectionPayload | null; error?: string }
          | null;

        if (!active) return;

        if (!response.ok) {
          setConnection(null);
          setError(payload?.error ?? "Unable to load email sending settings.");
          return;
        }

        setConnection(payload?.connection ?? null);
      } catch {
        if (!active) return;
        setConnection(null);
        setError("Unable to load email sending settings.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadConnection();

    return () => {
      active = false;
    };
  }, []);

  async function disconnectMailbox() {
    setDisconnecting(true);
    setError(null);

    try {
      const response = await fetch("/api/integrations/microsoft/disconnect", {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to disconnect Microsoft 365 mailbox.");
        return;
      }

      setConnection((current) =>
        current
          ? {
              ...current,
              status: "inactive",
            }
          : null
      );
    } catch {
      setError("Unable to disconnect Microsoft 365 mailbox.");
    } finally {
      setDisconnecting(false);
    }
  }

  const microsoftStatus = searchParams.get("microsoft_status");
  const microsoftMessage = searchParams.get("microsoft_message");
  const badge = getMailboxBadge(connection, loading);
  const isConnected = badge.label === "Connected";
  const isExpired = badge.label === "Expired";

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Email Sending"
        description="Connect Microsoft 365 so BuilderOS can send bid package invites through the signed-in user mailbox."
      />

      {microsoftStatus === "connected" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Microsoft 365 mailbox connected successfully.
        </div>
      ) : null}

      {microsoftStatus === "error" ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {microsoftMessage || "Unable to connect Microsoft 365 mailbox."}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <SettingsCard
        title="Connect Microsoft 365"
        subtitle="Delegated Microsoft Graph auth with Mail.Send and offline_access. BuilderOS remains the system of record for invite workflows."
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Connection Status
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>
              <div className="mt-3 text-sm text-slate-600">
                {loading
                  ? "Checking Microsoft 365 connection..."
                  : isExpired
                    ? "Reconnect Microsoft 365 to refresh delegated sending access."
                    : "Send mail as the signed-in user via Microsoft Graph."}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Connected Mailbox
              </div>
              <div className="mt-2 text-sm font-medium text-slate-900">
                {connection?.displayName || "No mailbox connected"}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {connection?.email || "Connect Outlook to send from the user mailbox."}
              </div>
              <div className="mt-3 text-xs text-slate-500">
                Connected {formatConnectionDate(connection?.connectedAt ?? null)}
              </div>
              {connection?.tokenExpiresAt ? (
                <div className="mt-1 text-xs text-slate-500">
                  Token expires {formatConnectionDate(connection.tokenExpiresAt)}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            BuilderOS requests `openid`, `profile`, `email`, `offline_access`, and Microsoft Graph `Mail.Send`.
            Tokens are handled server-side only. Mail is not sent from the browser.
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              Outlook-first sending is scoped to the user&apos;s delegated mailbox connection.
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <button
                  type="button"
                  onClick={disconnectMailbox}
                  disabled={disconnecting}
                  className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </button>
              ) : null}
              <a
                href="/api/integrations/microsoft/start"
                className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                {connection && connection.status !== "inactive" ? "Reconnect" : "Connect Outlook"}
              </a>
            </div>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
