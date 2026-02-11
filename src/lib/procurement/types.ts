export const PROCUREMENT_STATUSES = [
  "awaiting_approval",
  "approved",
  "ordered",
  "in_production",
  "shipped",
  "delivered",
  "complete",
  "on_hold",
  "canceled",
] as const;

export type ProcurementStatus = (typeof PROCUREMENT_STATUSES)[number];

export const STATUS_ORDER: ProcurementStatus[] = [
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

export type ProcurementNoteEntry = {
  id: string;
  text: string;
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
  notes_history: ProcurementNoteEntry[];
  attachments: string[];
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProcurementItemPayload = Omit<
  ProcurementItem,
  "id" | "project_id" | "archived_at" | "created_at" | "updated_at"
>;

export type ProcurementSortKey =
  | "item_name"
  | "vendor_name"
  | "status"
  | "need_by_date"
  | "lead_time_days";
