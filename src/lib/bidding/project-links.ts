const BID_PROJECT_LINKS_STORAGE_KEY = "bidProjectLinksByProjectId";

function readMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(BID_PROJECT_LINKS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.entries(parsed).reduce<Record<string, string>>((acc, [key, value]) => {
      if (typeof key === "string" && typeof value === "string") acc[key] = value;
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export function getBidProjectIdForProject(projectId: string | null): string | null {
  if (!projectId) return null;
  const links = readMap();
  return links[projectId] ?? null;
}

export function getProjectIdForBidProject(bidProjectId: string | null): string | null {
  if (!bidProjectId) return null;
  const links = readMap();
  for (const [projectId, mappedBidProjectId] of Object.entries(links)) {
    if (mappedBidProjectId === bidProjectId) return projectId;
  }
  return null;
}

export function setBidProjectLink(projectId: string, bidProjectId: string) {
  if (typeof window === "undefined") return;
  const links = readMap();
  links[projectId] = bidProjectId;
  localStorage.setItem(BID_PROJECT_LINKS_STORAGE_KEY, JSON.stringify(links));
}
