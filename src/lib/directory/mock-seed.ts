import { DirectoryData } from "@/lib/directory/types";

export const DIRECTORY_SEED_DATA: DirectoryData = {
  companies: [
    {
      id: "comp-summit-electric",
      name: "Summit Electric",
      trade: "Electrical",
      primaryContact: "Alex Ramos",
      email: "alex@summitelectric.com",
      phone: "(602) 555-0148",
      notes: "Prefers waiver reminders via email.",
      isActive: true,
      approvedVendor: true,
      lastUpdated: "2026-01-11T14:20:00.000Z",
      waiverSummary: { pending: 2, requested: 4, received: 10, approved: 9 },
    },
    {
      id: "comp-copper-ridge",
      name: "Copper Ridge Plumbing",
      trade: "Plumbing",
      primaryContact: "Taylor Brooks",
      email: "taylor@copperridge.com",
      phone: "(480) 555-0107",
      isActive: true,
      approvedVendor: false,
      lastUpdated: "2026-01-15T16:42:00.000Z",
      waiverSummary: { pending: 1, requested: 3, received: 8, approved: 7 },
    },
    {
      id: "comp-ironline-steel",
      name: "Ironline Steel",
      trade: "Structural Steel",
      primaryContact: "Chris Patel",
      email: "chris@ironlinesteel.com",
      isActive: false,
      approvedVendor: false,
      lastUpdated: "2026-01-09T09:12:00.000Z",
      waiverSummary: { pending: 0, requested: 1, received: 2, approved: 2 },
    },
  ],
  projects: [
    { id: "proj-valle-sol", name: "Valle del Sol" },
    { id: "proj-casa-grande", name: "Casa Grande Spec Suite" },
    { id: "proj-central-phase-2", name: "Central Portfolio Phase 2" },
  ],
  projectCompanies: [
    {
      id: "pc-1",
      companyId: "comp-summit-electric",
      projectId: "proj-valle-sol",
      assignedAt: "2026-01-04T12:00:00.000Z",
    },
    {
      id: "pc-2",
      companyId: "comp-summit-electric",
      projectId: "proj-casa-grande",
      assignedAt: "2026-01-10T12:00:00.000Z",
    },
    {
      id: "pc-3",
      companyId: "comp-copper-ridge",
      projectId: "proj-central-phase-2",
      assignedAt: "2026-01-12T12:00:00.000Z",
    },
  ],
};
