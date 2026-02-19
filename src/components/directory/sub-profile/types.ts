export type SubProfileCompany = {
  id: string;
  company_name: string;
  trade: string | null;
  status: "Active" | "Inactive";
  primary_contact: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_contacted: string | null;
};

export type SubAssignment = {
  project_id: string;
  project_name: string;
  city: string | null;
  status: string | null;
  last_activity: string | null;
  role_trade: string | null;
};

export type SubNote = {
  id: string;
  note: string;
  created_at: string | null;
};

export type NotesSource = "company_notes" | "companies";

export type AssignmentsSource = "directory_company_projects" | "company_projects" | "none";

export type SubProfilePayload = {
  company: SubProfileCompany;
  assignments: SubAssignment[];
  assignmentsSource: AssignmentsSource;
  notes: SubNote[];
  notesSource: NotesSource;
};
