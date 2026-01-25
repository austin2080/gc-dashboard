export type DirectoryCompany = {
  id: string;
  name: string;
  trade: string;
  location: string;
  status: "Active" | "Prequalified" | "Invited" | "Inactive";
  users: Array<{
    id: string;
    name: string;
    role: string;
    email: string;
    status: "Active" | "Invited" | "Inactive";
  }>;
  projects: Array<{
    id: string;
    name: string;
    status: "Active" | "At Risk" | "Starting Soon" | "Inactive";
  }>;
};

export const DIRECTORY_COMPANIES: DirectoryCompany[] = [
  {
    id: "summit-electric",
    name: "Summit Electric",
    trade: "Electrical",
    location: "Phoenix, AZ",
    status: "Active",
    users: [
      {
        id: "user-1",
        name: "Alex Ramos",
        role: "Owner",
        email: "alex@summitelectric.com",
        status: "Active",
      },
      {
        id: "user-2",
        name: "Jordan Lee",
        role: "Estimator",
        email: "jordan@summitelectric.com",
        status: "Invited",
      },
    ],
    projects: [
      { id: "proj-1", name: "Valle del Sol", status: "Active" },
      { id: "proj-2", name: "Casa Grande Spec Suit", status: "At Risk" },
    ],
  },
  {
    id: "copper-ridge-plumbing",
    name: "Copper Ridge Plumbing",
    trade: "Plumbing",
    location: "Mesa, AZ",
    status: "Active",
    users: [
      {
        id: "user-3",
        name: "Taylor Brooks",
        role: "PM",
        email: "taylor@copperridge.com",
        status: "Active",
      },
    ],
    projects: [{ id: "proj-3", name: "Dr Kelly Flagstaff", status: "Active" }],
  },
  {
    id: "ironline-steel",
    name: "Ironline Steel",
    trade: "Structural Steel",
    location: "Tempe, AZ",
    status: "Prequalified",
    users: [
      {
        id: "user-4",
        name: "Chris Patel",
        role: "Estimator",
        email: "chris@ironlinesteel.com",
        status: "Invited",
      },
    ],
    projects: [{ id: "proj-4", name: "Central Portfolio Phase 2", status: "Starting Soon" }],
  },
];
