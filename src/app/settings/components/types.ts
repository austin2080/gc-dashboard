export type SettingsSectionId =
  | "general"
  | "company"
  | "team"
  | "roles"
  | "project-defaults"
  | "integrations"
  | "notifications"
  | "billing"
  | "security"
  | "audit-log";

export type SettingsNavItem = {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: string;
};

export type UserStatus = "Active" | "Invited" | "Deactivated";

export type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: UserStatus;
  lastActive: string;
};

export type RoleDefinition = {
  id: string;
  name: string;
  description: string;
};

export type PermissionModule = {
  id: string;
  label: string;
};
