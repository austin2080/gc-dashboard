import type { ModuleKey } from "@/lib/access/modules";

export function getRequiredModuleForPath(pathname: string): ModuleKey | null {
  if (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/projects" ||
    pathname.startsWith("/projects/")
  ) {
    return "pm";
  }

  if (
    pathname === "/waivers" ||
    pathname.startsWith("/waivers/") ||
    pathname === "/waiverdesk" ||
    pathname.startsWith("/waiverdesk/")
  ) {
    return "waiverdesk";
  }

  if (
    pathname === "/bidding" ||
    pathname.startsWith("/bidding/") ||
    pathname === "/bids" ||
    pathname.startsWith("/bids/")
  ) {
    return "bidding";
  }

  return null;
}
