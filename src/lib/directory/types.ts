export type CompanyStatus = "active" | "inactive";

export type WaiverSummary = {
  pending: number;
  requested: number;
  received: number;
  approved: number;
};

export type Company = {
  id: string;
  name: string;
  trade?: string;
  contactTitle?: string;
  primaryContact?: string;
  email?: string;
  phone?: string;
  officePhone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  website?: string;
  licenseNumber?: string;
  taxId?: string;
  vendorType?: string;
  procoreCompanyId?: string;
  notes?: string;
  isActive: boolean;
  lastUpdated: string;
  waiverSummary?: WaiverSummary;
};

export type ProjectDirectoryEntry = {
  id: string;
  name: string;
};

export type ProjectCompany = {
  id: string;
  projectId: string;
  companyId: string;
  assignedAt: string;
};

export type DirectoryData = {
  companies: Company[];
  projects: ProjectDirectoryEntry[];
  projectCompanies: ProjectCompany[];
};
