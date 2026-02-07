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

