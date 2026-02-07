export type WaiverStatus = "missing" | "requested" | "uploaded" | "approved";

export type WaiverType =
  | "conditional_progress"
  | "unconditional_progress"
  | "conditional_final"
  | "unconditional_final";

export type Contractor = {
  id: string;
  projectId: string;
  name: string;
  hasFinalWaivers: boolean;
};

export type PayApp = {
  id: string;
  projectId: string;
  number: string;
  periodStart?: string;
  periodEnd?: string;
  totalAmount?: number;
  notes?: string;
  updatedAt: string;
};

export type WaiverRecord = {
  id: string;
  projectId: string;
  contractorId: string;
  payAppId: string;
  waiverType: WaiverType;
  status: WaiverStatus;
  amount?: number;
  updatedAt: string;
};

export type PayAppsData = {
  payApps: PayApp[];
  contractors: Contractor[];
  waiverRecords: WaiverRecord[];
};
