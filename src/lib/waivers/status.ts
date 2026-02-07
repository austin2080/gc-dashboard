export const WAIVER_STATUS = {
  MISSING: "missing",
  REQUESTED: "requested",
  UPLOADED: "uploaded",
  APPROVED: "approved",
} as const;

export type WaiverStatus = (typeof WAIVER_STATUS)[keyof typeof WAIVER_STATUS];

type WaiverStatusMeta = {
  label: string;
  className: string;
};

const waiverStatusMeta: Record<WaiverStatus, WaiverStatusMeta> = {
  missing: {
    label: "Missing",
    className: "bg-rose-50 text-rose-700 border-rose-200",
  },
  requested: {
    label: "Requested",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  uploaded: {
    label: "Uploaded",
    className: "bg-sky-50 text-sky-700 border-sky-200",
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

export function getWaiverStatusLabel(status: WaiverStatus) {
  return waiverStatusMeta[status].label;
}

export function getWaiverStatusClass(status: WaiverStatus) {
  return waiverStatusMeta[status].className;
}

export const WAIVER_STATUS_VALUES = Object.values(WAIVER_STATUS) as WaiverStatus[];
