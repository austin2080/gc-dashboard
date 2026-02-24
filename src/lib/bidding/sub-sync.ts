import { getProjectIdForBidProject } from "@/lib/bidding/project-links";

export type SyncBidSubToDirectoryPayload = {
  bidProjectId: string;
  companyName: string;
  tradeName: string | null;
  primaryContact: string | null;
  email: string | null;
  phone: string | null;
};

export type SyncBidSubToDirectoryResult = {
  directoryCompanyId: string | null;
};

export async function syncBidSubToDirectory(
  payload: SyncBidSubToDirectoryPayload
): Promise<SyncBidSubToDirectoryResult> {
  const linkedProjectId = getProjectIdForBidProject(payload.bidProjectId);
  const query = linkedProjectId ? `?project=${encodeURIComponent(linkedProjectId)}` : "";
  const response = await fetch(`/api/directory/companies${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: linkedProjectId ?? undefined,
      bidProjectId: payload.bidProjectId,
      companies: [
        {
          company_name: payload.companyName,
          trade: payload.tradeName,
          primary_contact: payload.primaryContact,
          email: payload.email,
          phone: payload.phone,
          status: "Active",
        },
      ],
    }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(data?.error ?? "Directory sync failed");
  }

  const data = (await response.json().catch(() => null)) as
    | { companies?: Array<{ id?: string | null }> }
    | null;
  const directoryCompanyId = data?.companies?.[0]?.id ?? null;
  return { directoryCompanyId };
}

export function getDirectoryNewPrefillUrl(companyName: string): string {
  const query = new URLSearchParams({ name: companyName.trim() });
  return `/directory/new?${query.toString()}`;
}

export function getDirectoryCompanyProfileUrl(companyId: string): string {
  return `/directory/${encodeURIComponent(companyId)}`;
}
