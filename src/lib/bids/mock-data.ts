import type {
  BidFollowUp,
  BidOpportunity,
  Customer,
  InviteEvent,
  Project,
  ProjectBid,
  ScopeLibraryItem,
  TradePackage,
  User,
  Vendor,
  BidSubmission,
  OutcomeMetrics,
} from "@/lib/bids/types";

const now = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(new Date(now.getTime() - n * 24 * 60 * 60 * 1000));
const daysAhead = (n: number) => iso(new Date(now.getTime() + n * 24 * 60 * 60 * 1000));

export const users: User[] = [
  { id: "u1", name: "Lena Cruz", role: "Estimator", city: "Austin" },
  { id: "u2", name: "Mason Lee", role: "PM", city: "Dallas" },
  { id: "u3", name: "Priya Patel", role: "Precon Manager", city: "Houston" },
  { id: "u4", name: "Drew Hunt", role: "Estimator", city: "San Antonio" },
];

export const customers: Customer[] = [
  { id: "c1", name: "Harbor Peak Development", segment: "Developer" },
  { id: "c2", name: "Westline Properties", segment: "Owner" },
  { id: "c3", name: "East County ISD", segment: "Institutional" },
  { id: "c4", name: "Apex Med Group", segment: "Owner" },
  { id: "c5", name: "Ridge Retail", segment: "Retail" },
  { id: "c6", name: "Skyline Ventures", segment: "Developer" },
  { id: "c7", name: "Summit Logistics", segment: "Owner" },
  { id: "c8", name: "Greenway Capital", segment: "Developer" },
];

const projectTypes = ["Healthcare", "Industrial", "Office", "Education", "Retail", "Multifamily"];
const cities = ["Austin", "Dallas", "Houston", "San Antonio"];
const stages: BidOpportunity["stage"][] = [
  "lead",
  "invited",
  "estimating",
  "submitted",
  "negotiation",
  "awarded",
  "lost",
  "no_decision",
];

export const bidOpportunities: BidOpportunity[] = Array.from({ length: 28 }).map((_, i) => {
  const customer = customers[i % customers.length];
  const stage = stages[i % stages.length];
  const submittedValue = 350000 + i * 55000;
  const isAwarded = stage === "awarded";
  const isLost = stage === "lost";
  return {
    id: `bo-${i + 1}`,
    customerId: customer.id,
    projectName: `${projectTypes[i % projectTypes.length]} Package ${i + 10}`,
    projectType: projectTypes[i % projectTypes.length],
    city: cities[i % cities.length],
    personId: users[i % users.length].id,
    dueDate: daysAhead((i % 40) + 3),
    submittedDate: ["submitted", "negotiation", "awarded", "lost", "no_decision"].includes(stage)
      ? daysAgo((i % 120) + 5)
      : undefined,
    createdAt: daysAgo((i % 180) + 12),
    stage,
    submittedValue,
    confidence: i % 3 === 0 ? "high" : i % 3 === 1 ? "medium" : "low",
    notes: "Scope and schedule assumptions captured for leadership review.",
    outcome:
      isAwarded || isLost
        ? {
            isAwarded,
            awardedValue: isAwarded ? Math.round(submittedValue * 0.96) : undefined,
            winReason: isAwarded ? "relationship" : undefined,
            lossReason: isLost ? "price" : undefined,
          }
        : undefined,
  };
});

export const bidFollowUps: BidFollowUp[] = bidOpportunities.slice(0, 14).map((bid, i) => ({
  id: `fu-${i + 1}`,
  bidOpportunityId: bid.id,
  timestamp: daysAgo(i * 3 + 1),
  note: i % 2 === 0 ? "Left voicemail with owner rep." : "Sent updated clarification log.",
}));

export const vendors: Vendor[] = [
  { id: "v1", companyName: "Summit Mechanical", trades: ["HVAC"], city: "Austin", contact: "Rob Hall" },
  { id: "v2", companyName: "Titan Electric", trades: ["Electrical"], city: "Dallas", contact: "Tia Grant" },
  { id: "v3", companyName: "Lone Star Plumbing", trades: ["Plumbing"], city: "Austin", contact: "Nick Roe" },
  { id: "v4", companyName: "Metro Framing", trades: ["Framing"], city: "Houston", contact: "Maya Bell" },
  { id: "v5", companyName: "BlueRock Roofing", trades: ["Roofing"], city: "Dallas", contact: "Elon Pace" },
  { id: "v6", companyName: "Precision Fireproofing", trades: ["Fire Protection"], city: "San Antonio", contact: "Mia Tran" },
  { id: "v7", companyName: "Axis Controls", trades: ["Controls"], city: "Houston", contact: "Kris Odom" },
  { id: "v8", companyName: "Red River Drywall", trades: ["Drywall"], city: "Austin", contact: "Paul Diaz" },
  { id: "v9", companyName: "Pioneer Sitework", trades: ["Sitework"], city: "Dallas", contact: "Zoe Park" },
  { id: "v10", companyName: "Sunline Concrete", trades: ["Concrete"], city: "Houston", contact: "Ira Dean" },
  { id: "v11", companyName: "Beacon Doors", trades: ["Doors/Hardware"], city: "Austin", contact: "Jules Ward" },
  { id: "v12", companyName: "Northpoint Millwork", trades: ["Millwork"], city: "Dallas", contact: "Abby Ng" },
];

export const projects: Project[] = [
  { id: "p1", name: "Riverbend Medical Office", city: "Austin", projectType: "Healthcare" },
  { id: "p2", name: "Skyline Logistics Hub", city: "Dallas", projectType: "Industrial" },
  { id: "p3", name: "Elm Street Tower TI", city: "Houston", projectType: "Office" },
];

export const projectBids: ProjectBid[] = projects.map((p, i) => ({
  id: `pb-${p.id}`,
  projectId: p.id,
  dueDate: daysAhead(10 + i * 7),
  createdAt: daysAgo(30 + i * 10),
  estimatorId: users[i % users.length].id,
  status: i === 0 ? "responses_rolling_in" : i === 1 ? "coverage_complete" : "leveling",
}));

const tradeSets = [
  ["Concrete", "Steel", "HVAC", "Electrical", "Plumbing", "Fire Protection", "Roofing", "Drywall"],
  ["Sitework", "Concrete", "Structural Steel", "Electrical", "Mechanical", "Plumbing", "Doors/Hardware"],
  ["Demolition", "Framing", "Drywall", "Ceilings", "Paint", "Controls", "Millwork"],
];

export const tradePackages: TradePackage[] = projectBids.flatMap((pb, i) =>
  tradeSets[i].map((trade, idx) => ({
    id: `${pb.id}-t${idx + 1}`,
    projectBidId: pb.id,
    tradeName: trade,
    scopeTagConfig: [
      "includes permits",
      "includes demo",
      "includes crane",
      "includes T&B",
      "includes controls",
      "after-hours",
      "long-lead equipment included",
    ],
    invitedVendorIds: vendors.slice((idx + i) % 6, ((idx + i) % 6) + 4).map((v) => v.id),
  })),
);

export const inviteEvents: InviteEvent[] = tradePackages.flatMap((trade, tIdx) =>
  trade.invitedVendorIds.map((vendorId, idx) => {
    const state = idx % 4;
    return {
      id: `ie-${trade.id}-${vendorId}`,
      tradePackageId: trade.id,
      vendorId,
      invitedAt: daysAgo(12 - (tIdx % 5)),
      viewedAt: state === 3 ? undefined : daysAgo(10 - (tIdx % 4)),
      respondedAt: state === 0 || state === 1 ? daysAgo(8 - (idx % 3)) : undefined,
      responseType: state === 0 ? "submitted" : state === 1 ? "declined" : state === 2 ? "ghosted" : "no_bid",
      followUps: [
        { id: `f-${trade.id}-${vendorId}-1`, timestamp: daysAgo(6), note: "Reminder email sent" },
      ],
    };
  }),
);

export const bidSubmissions: BidSubmission[] = inviteEvents
  .filter((event) => event.responseType === "submitted")
  .map((event, i) => ({
    id: `bs-${i + 1}`,
    projectBidId: tradePackages.find((t) => t.id === event.tradePackageId)!.projectBidId,
    tradePackageId: event.tradePackageId,
    vendorId: event.vendorId,
    status: "submitted",
    lumpSum: 45000 + i * 3250,
    receivedDate: event.respondedAt,
    activeRevision: i % 3 === 0 ? "v3" : i % 2 === 0 ? "v2" : "v1",
    revisions: [
      { id: `r-${i}-1`, version: "v1", amount: 43000 + i * 3200, submittedAt: daysAgo(9), notes: "Initial bid." },
      { id: `r-${i}-2`, version: "v2", amount: 44500 + i * 3250, submittedAt: daysAgo(6), notes: "Added clarifications." },
      { id: `r-${i}-3`, version: "v3", amount: 45000 + i * 3250, submittedAt: daysAgo(3), notes: "Final rev after addendum." },
    ],
    scopeTags: {
      "includes permits": i % 2 === 0,
      "includes demo": i % 3 !== 0,
      "includes crane": i % 4 === 0,
      "includes T&B": true,
      "includes controls": i % 5 === 0,
      "after-hours": i % 3 === 0,
      "long-lead equipment included": i % 2 === 1,
    },
    inclusions: ["Startup and commissioning included", "All required safety plans included"],
    exclusions: ["Permit fees by owner", "Weekend premium labor excluded"],
    clarifications: ["Pricing assumes uninterrupted access", "Lead times based on current market conditions"],
    alternates: [
      { id: `a-${i}-1`, name: "Premium controls package", deltaAmount: 12500, notes: "Add for enhanced BAS integration" },
      { id: `a-${i}-2`, name: "Value-engineered fixture package", deltaAmount: -8200, notes: "Deduct with approved substitution" },
    ],
    attachments: [
      { id: `att-${i}-1`, fileName: "proposal.pdf", fileType: "PDF", date: daysAgo(5) },
      { id: `att-${i}-2`, fileName: "clarification-log.xlsx", fileType: "XLSX", date: daysAgo(4) },
    ],
    internalNotes: "Scope gap detected on turnover training line item.",
    confidence: i % 3 === 0 ? "high" : i % 3 === 1 ? "medium" : "low",
  }));

export const outcomes: OutcomeMetrics[] = tradePackages.map((trade, i) => {
  const submission = bidSubmissions.find((b) => b.tradePackageId === trade.id);
  const awarded = i % 3 === 0 && Boolean(submission);
  return {
    tradePackageId: trade.id,
    vendorId: submission?.vendorId,
    awarded,
    originalBidAmount: submission?.lumpSum,
    executedContractAmount: awarded && submission?.lumpSum ? submission.lumpSum + 3500 : undefined,
    approvedCOAmount: awarded ? 2400 : undefined,
    scheduleRating: awarded ? 4 : undefined,
    qualityRating: awarded ? 4 : undefined,
    wouldHireAgain: awarded ? true : undefined,
  };
});

export const scopeLibrary: ScopeLibraryItem[] = [
  { id: "sl-1", tradeName: "HVAC", category: "inclusion", text: "TAB report and startup included" },
  { id: "sl-2", tradeName: "HVAC", category: "exclusion", text: "BMS graphics by controls contractor" },
  { id: "sl-3", tradeName: "Electrical", category: "clarification", text: "Temporary power by GC" },
  { id: "sl-4", tradeName: "Concrete", category: "inclusion", text: "Slab vapor barrier included" },
  { id: "sl-5", tradeName: "Plumbing", category: "exclusion", text: "Backflow permit fees excluded" },
  { id: "sl-6", tradeName: "Drywall", category: "clarification", text: "Level-5 finish only in lobby" },
  { id: "sl-7", tradeName: "Sitework", category: "inclusion", text: "Erosion control maintenance included" },
  { id: "sl-8", tradeName: "Framing", category: "exclusion", text: "Firestopping by separate trade" },
  { id: "sl-9", tradeName: "Controls", category: "clarification", text: "Point mapping based on DD set" },
];
