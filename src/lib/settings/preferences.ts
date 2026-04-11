"use client";

export type WorkspaceTimezone = "pst" | "mst" | "cst" | "est";

export const WORKSPACE_TIMEZONE_STORAGE_KEY = "builderos.settings.timezone";

export const WORKSPACE_TIMEZONE_OPTIONS: Array<{
  value: WorkspaceTimezone;
  label: string;
  shortLabel: string;
}> = [
  { value: "pst", label: "Pacific (PST)", shortLabel: "PST" },
  { value: "mst", label: "Mountain (MST)", shortLabel: "MST" },
  { value: "cst", label: "Central (CST)", shortLabel: "CST" },
  { value: "est", label: "Eastern (EST)", shortLabel: "EST" },
];

function isWorkspaceTimezone(value: string | null): value is WorkspaceTimezone {
  return WORKSPACE_TIMEZONE_OPTIONS.some((option) => option.value === value);
}

function inferWorkspaceTimezone(): WorkspaceTimezone {
  if (typeof Intl === "undefined") return "pst";
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  switch (browserTimeZone) {
    case "America/Anchorage":
    case "America/Los_Angeles":
    case "America/Tijuana":
    case "America/Vancouver":
      return "pst";
    case "America/Boise":
    case "America/Cambridge_Bay":
    case "America/Denver":
    case "America/Edmonton":
    case "America/Phoenix":
      return "mst";
    case "America/Chicago":
    case "America/Winnipeg":
      return "cst";
    case "America/Detroit":
    case "America/New_York":
    case "America/Toronto":
      return "est";
    default:
      return "pst";
  }
}

export function getWorkspaceTimezone(): WorkspaceTimezone {
  if (typeof window === "undefined") return "pst";
  const stored = window.localStorage.getItem(WORKSPACE_TIMEZONE_STORAGE_KEY);
  if (isWorkspaceTimezone(stored)) return stored;
  return inferWorkspaceTimezone();
}

export function setWorkspaceTimezone(value: WorkspaceTimezone) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WORKSPACE_TIMEZONE_STORAGE_KEY, value);
}

export function getWorkspaceTimezoneLabel(value: WorkspaceTimezone) {
  return (
    WORKSPACE_TIMEZONE_OPTIONS.find((option) => option.value === value)?.shortLabel ??
    value.toUpperCase()
  );
}
