export const WAIVER_STATUS = {
  MISSING: "missing",
  REQUESTED: "requested",
  UPLOADED: "uploaded",
  APPROVED: "approved",
} as const;

export const WAIVER_SUB_STATUS = {
  REJECTED: "rejected",
  NEEDS_REVIEW: "needs_review",
} as const;

export const WAIVER_RISK_LEVEL = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
} as const;

export type WaiverStatus = (typeof WAIVER_STATUS)[keyof typeof WAIVER_STATUS];
export type WaiverSubStatus =
  (typeof WAIVER_SUB_STATUS)[keyof typeof WAIVER_SUB_STATUS];
export type WaiverRiskLevel =
  (typeof WAIVER_RISK_LEVEL)[keyof typeof WAIVER_RISK_LEVEL];

type WaiverStatusMeta = {
  label: string;
  className: string;
  riskLevel: WaiverRiskLevel;
  description: string;
};

export const waiverStatusMeta: Record<WaiverStatus, WaiverStatusMeta> = {
  missing: {
    label: "Missing",
    className: "border-red-200 bg-red-50 text-red-700",
    riskLevel: WAIVER_RISK_LEVEL.HIGH,
    description: "No lien waiver has been received for this pay app.",
  },
  requested: {
    label: "Requested",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    riskLevel: WAIVER_RISK_LEVEL.MEDIUM,
    description: "Waiver request sent; document has not been uploaded yet.",
  },
  uploaded: {
    label: "Uploaded",
    className: "border-sky-200 bg-sky-50 text-sky-700",
    riskLevel: WAIVER_RISK_LEVEL.MEDIUM,
    description: "Lien waiver was uploaded and is waiting on final review.",
  },
  approved: {
    label: "Approved",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    riskLevel: WAIVER_RISK_LEVEL.LOW,
    description: "Lien waiver is approved and compliance risk is low.",
  },
};

export const waiverSubStatusMeta: Record<WaiverSubStatus, { label: string }> = {
  rejected: { label: "Rejected" },
  needs_review: { label: "Needs Review" },
};

// ---- Suggested shared types & helpers (add below your existing exports) ----

export type WaiverType =
  | "conditional_progress"
  | "unconditional_progress"
  | "conditional_final"
  | "unconditional_final";

export const WAIVER_TYPE_META: Record<WaiverType, { label: string }> = {
  conditional_progress: { label: "Conditional Progress" },
  unconditional_progress: { label: "Unconditional Progress" },
  conditional_final: { label: "Conditional Final" },
  unconditional_final: { label: "Unconditional Final" },
};

export type WaiverRecord = {
  id: string;
  projectId: string;
  projectName: string;
  contractorId: string;
  contractorName: string;
  payAppNumber: number;
  waiverType: WaiverType;
  amount: number; // store as number; format in UI
  status: WaiverStatus;
  subStatus?: WaiverSubStatus;
  updatedAt: string; // ISO date string
};

export function getWaiverStatusLabel(status: WaiverStatus) {
  return waiverStatusMeta[status].label;
}

export function getWaiverStatusClass(status: WaiverStatus) {
  return waiverStatusMeta[status].className;
}

export function getWaiverRiskLevel(status: WaiverStatus) {
  return waiverStatusMeta[status].riskLevel;
}

export function getWaiverTypeLabel(type: WaiverType) {
  return WAIVER_TYPE_META[type].label;
}
