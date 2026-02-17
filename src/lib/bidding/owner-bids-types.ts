export type OwnerBidProjectType = "TI" | "Ground-Up" | "Design-Build" | "Budget" | "GMP" | "Other";
export type OwnerBidType = "Hard Bid" | "Negotiated" | "Budget" | "GMP";
export type OwnerBidStatus = "Draft" | "Submitted" | "Awarded" | "Lost";
export type OwnerBidLostReason =
  | "Price"
  | "Schedule"
  | "Qualifications"
  | "Client Ghosted"
  | "Competitor"
  | "Other";

export type OwnerBid = {
  id: string;
  name: string;
  client: string;
  projectType: OwnerBidProjectType;
  address: string;
  squareFeet: number | null;
  dueDate: string | null;
  bidType: OwnerBidType;
  status: OwnerBidStatus;
  assignedTo: string;
  probability: number;
  estCost: number | null;
  ohpAmount: number | null;
  markupPct: number | null;
  bidAmount: number | null;
  expectedProfit: number | null;
  marginPct: number | null;
  lostReason: OwnerBidLostReason | null;
  lostNotes: string;
  convertToProject: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NewOwnerBidInput = Omit<OwnerBid, "id" | "createdAt" | "updatedAt">;
