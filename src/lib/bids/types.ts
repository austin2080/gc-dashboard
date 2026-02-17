export type Id = string;

export type ConfidenceLevel = "low" | "medium" | "high";

export type BidStage =
  | "lead"
  | "invited"
  | "estimating"
  | "submitted"
  | "negotiation"
  | "awarded"
  | "lost"
  | "no_decision";

export type User = {
  id: Id;
  name: string;
  role: "Estimator" | "PM" | "Precon Manager";
  city: string;
};

export type Customer = {
  id: Id;
  name: string;
  segment: "Developer" | "Owner" | "Institutional" | "Retail";
};

export type Vendor = {
  id: Id;
  companyName: string;
  trades: string[];
  city: string;
  contact: string;
};

export type Project = {
  id: Id;
  name: string;
  city: string;
  projectType: string;
};

export type BidFollowUp = {
  id: Id;
  bidOpportunityId: Id;
  timestamp: string;
  note: string;
};

export type BidOutcome = {
  isAwarded: boolean;
  awardedValue?: number;
  winReason?: "relationship" | "price" | "schedule" | "technical";
  lossReason?: "price" | "scope_gap" | "schedule" | "qualification" | "no_decision";
};

export type BidOpportunity = {
  id: Id;
  customerId: Id;
  projectName: string;
  projectType: string;
  city: string;
  personId: Id;
  dueDate: string;
  submittedDate?: string;
  createdAt: string;
  stage: BidStage;
  submittedValue: number;
  confidence: ConfidenceLevel;
  notes: string;
  outcome?: BidOutcome;
};

export type BidMetrics = {
  submittedCount: number;
  submittedValue: number;
  awardedValue: number;
  winRate: number;
};

export type InviteResponseType = "submitted" | "declined" | "no_bid" | "ghosted";

export type InviteEvent = {
  id: Id;
  tradePackageId: Id;
  vendorId: Id;
  invitedAt: string;
  viewedAt?: string;
  respondedAt?: string;
  responseType: InviteResponseType;
  followUps: Array<{ id: Id; timestamp: string; note: string }>;
};

export type BidRevision = {
  id: Id;
  version: "v1" | "v2" | "v3";
  amount: number;
  submittedAt: string;
  notes: string;
};

export type BidSubmission = {
  id: Id;
  projectBidId: Id;
  tradePackageId: Id;
  vendorId: Id;
  status: "submitted" | "declined" | "ghosted";
  lumpSum?: number;
  receivedDate?: string;
  activeRevision: "v1" | "v2" | "v3";
  revisions: BidRevision[];
  scopeTags: Record<string, boolean>;
  inclusions: string[];
  exclusions: string[];
  clarifications: string[];
  alternates: Array<{ id: Id; name: string; deltaAmount: number; notes: string }>;
  attachments: Array<{ id: Id; fileName: string; fileType: string; date: string }>;
  internalNotes: string;
  confidence: ConfidenceLevel;
};

export type OutcomeMetrics = {
  tradePackageId: Id;
  vendorId?: Id;
  awarded: boolean;
  originalBidAmount?: number;
  executedContractAmount?: number;
  approvedCOAmount?: number;
  scheduleRating?: 1 | 2 | 3 | 4 | 5;
  qualityRating?: 1 | 2 | 3 | 4 | 5;
  wouldHireAgain?: boolean;
};

export type TradePackage = {
  id: Id;
  projectBidId: Id;
  tradeName: string;
  scopeTagConfig: string[];
  invitedVendorIds: Id[];
};

export type ProjectBid = {
  id: Id;
  projectId: Id;
  dueDate: string;
  createdAt: string;
  estimatorId: Id;
  status: "trades_created" | "invites_sent" | "responses_rolling_in" | "coverage_complete" | "leveling" | "selected_awarded";
};

export type ScopeLibraryItem = {
  id: Id;
  tradeName: string;
  category: "inclusion" | "exclusion" | "clarification";
  text: string;
};
