import type { BidProjectSummary, BidTrade, BidProjectSub } from "@/lib/bidding/types";

export type LevelingBidStatus = "invited" | "bidding" | "submitted" | "declined" | "no_response";

export type UnitType =
  | "LF"
  | "SF"
  | "SY"
  | "CY"
  | "EA"
  | "HR"
  | "DAY"
  | "LS"
  | "ALLOW"
  | "UNIT"
  | "OTHER";

export type ProjectTradeBudget = {
  id: string;
  project_id: string;
  trade_id: string;
  budget_amount: number | null;
  budget_notes: string | null;
};

export type TradeBidLineItemType = "allowance" | "alternate" | "unit_price" | "clarifications";

export type TradeBidLineItem = {
  id: string;
  trade_bid_id: string;
  type: TradeBidLineItemType;
  label: string;
  amount: number | null;
  included: boolean;
  notes: string | null;
};

export type TradeBidItemKind = "base" | "alternate_item";

export type TradeBidItem = {
  id: string;
  bid_id: string;
  kind: TradeBidItemKind;
  description: string;
  qty: number | null;
  unit: UnitType;
  unit_price: number | null;
  amount_override: number | null;
  notes: string | null;
  sort_order: number;
};

export type TradeBidAlternate = {
  id: string;
  bid_id: string;
  title: string;
  accepted: boolean;
  amount: number;
  notes: string | null;
  sort_order: number;
};

export type BidBaseItemDraft = {
  id: string;
  description: string;
  qty: string;
  unit: UnitType;
  unitPrice: string;
  amountOverride: string;
  notes: string;
  sortOrder: number;
};

export type BidAlternateDraft = {
  id: string;
  title: string;
  accepted: boolean;
  amount: string;
  notes: string;
  sortOrder: number;
};

export type TradeBidScopeState = "included" | "excluded" | "unclear";

export type TradeScopeChecklistItem = {
  id: string;
  company_id: string;
  trade_id: string;
  scope_item: string;
  sort_order: number;
};

export type TradeBidScopeItem = {
  id: string;
  trade_bid_id: string;
  scope_item_id: string;
  included: TradeBidScopeState;
  notes: string | null;
};

export type LevelingSnapshot = {
  id: string;
  project_id: string;
  created_by: string | null;
  created_at: string;
  title: string;
  locked: boolean;
};

export type LevelingSnapshotItem = {
  id: string;
  snapshot_id: string;
  trade_id: string;
  sub_id: string;
  base_bid_amount: number | null;
  notes: string | null;
  included_json: Record<string, unknown> | null;
  line_items_json: Record<string, unknown> | null;
};

export type LevelingBid = {
  id: string;
  legacy_bid_id: string | null;
  project_id: string;
  trade_id: string;
  sub_id: string;
  status: LevelingBidStatus;
  base_bid_amount: number | null;
  received_at: string | null;
  is_low: boolean;
  notes: string | null;
};

export type BidLevelingProjectData = {
  project: BidProjectSummary;
  trades: BidTrade[];
  projectSubs: BidProjectSub[];
  bids: LevelingBid[];
  budgets: ProjectTradeBudget[];
  snapshots: LevelingSnapshot[];
};
