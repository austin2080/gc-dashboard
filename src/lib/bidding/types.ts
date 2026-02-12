export type BidTradeStatus = "submitted" | "bidding" | "declined" | "ghosted" | "invited";

export type BidProjectSummary = {
  id: string;
  project_name: string;
  owner: string | null;
  location: string | null;
  budget: number | null;
  due_date: string | null;
};

export type BidTrade = {
  id: string;
  project_id: string;
  trade_name: string;
  sort_order: number | null;
};

export type BidSubcontractor = {
  id: string;
  company_name: string;
  primary_contact: string | null;
  email: string | null;
  phone: string | null;
};

export type BidProjectSub = {
  id: string;
  project_id: string;
  subcontractor_id: string;
  sort_order: number | null;
  invited_at: string | null;
  subcontractor: BidSubcontractor | null;
};

export type BidTradeBid = {
  id: string;
  project_id: string;
  trade_id: string;
  project_sub_id: string;
  status: BidTradeStatus;
  bid_amount: number | null;
  contact_name: string | null;
};

export type BidProjectDetail = {
  project: BidProjectSummary;
  trades: BidTrade[];
  projectSubs: BidProjectSub[];
  tradeBids: BidTradeBid[];
};
