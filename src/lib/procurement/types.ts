export type ProcurementStatus =
  | "awaiting_approval"
  | "approved"
  | "ordered"
  | "in_production"
  | "shipped"
  | "delivered"
  | "complete"
  | "on_hold"
  | "canceled";

export const PROCUREMENT_STATUS_ORDER: ProcurementStatus[] = [
  "awaiting_approval",
  "approved",
  "ordered",
  "in_production",
  "shipped",
  "delivered",
  "complete",
  "on_hold",
  "canceled",
];

export const PROCUREMENT_STATUS_LABELS: Record<ProcurementStatus, string> = {
  awaiting_approval: "Awaiting Approval",
  approved: "Approved",
  ordered: "Ordered",
  in_production: "In Production",
  shipped: "Shipped",
  delivered: "Delivered",
  complete: "Complete",
  on_hold: "On Hold",
  canceled: "Canceled",
};

export type ProcurementNoteEntry = {
  note: string;
  created_at: string;
};

export type ProcurementItem = {
  id: string;
  project_id: string;
  item_name: string;
  vendor_name: string;
  status: ProcurementStatus;
  approved_date: string | null;
  ordered_date: string | null;
  lead_time_days: number | null;
  need_by_date: string | null;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  po_number: string | null;
  notes: string | null;
  received_by: string | null;
  received_date: string | null;
  qc_status: "pass" | "fail" | "hold" | "needs_review" | null;
  qc_notes: string | null;
  qc_match_submittals: boolean | null;
  notes_history?: ProcurementNoteEntry[];
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type ProcurementItemInput = Omit<
  ProcurementItem,
  "id" | "project_id" | "created_at" | "updated_at" | "archived_at"
>;
