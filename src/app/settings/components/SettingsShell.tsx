"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmailSendingSection } from "./EmailSendingSection";
import { EmptyState } from "./EmptyState";
import { SettingsCard } from "./SettingsCard";
import { SettingsLayout } from "./SettingsLayout";
import { SettingsSectionHeader } from "./SettingsSectionHeader";
import {
  getWorkspaceTimezone,
  setWorkspaceTimezone,
  WORKSPACE_TIMEZONE_OPTIONS,
  type WorkspaceTimezone,
} from "@/lib/settings/preferences";
import {
  getWorkspaceTaxRates,
  setWorkspaceTaxRates,
  type WorkspaceTaxRate,
} from "@/lib/settings/tax-rates";
import {
  DEFAULT_WORKSPACE_COST_CODES,
  getWorkspaceCostCodes,
  setWorkspaceCostCodes,
} from "@/lib/settings/company-cost-codes";
import type {
  PermissionModule,
  RoleDefinition,
  SettingsNavItem,
  SettingsSectionId,
  TeamUser,
  UserStatus,
} from "./types";

const settingsNavItems: SettingsNavItem[] = [
  { id: "general", label: "General", description: "Profile preferences", icon: "⚙️" },
  { id: "company", label: "Company", description: "Company profile", icon: "🏢" },
  { id: "team", label: "Team & Users", description: "Members and invites", icon: "👥" },
  { id: "roles", label: "Roles & Permissions", description: "RBAC matrix", icon: "🛡️" },
  {
    id: "project-defaults",
    label: "Company Cost Codes",
    description: "Cost codes and bid settings",
    icon: "📐",
  },
  {
    id: "tax-rates",
    label: "Tax Rates",
    description: "City and jurisdiction rates",
    icon: "🏛️",
  },
  {
    id: "email-sending",
    label: "Email Sending",
    description: "Outlook and mailbox auth",
    icon: "✉️",
  },
  { id: "integrations", label: "Integrations", description: "Connected apps", icon: "🔌" },
  {
    id: "notifications",
    label: "Notifications",
    description: "Email & alerts",
    icon: "🔔",
  },
  { id: "billing", label: "Billing", description: "Plan and seats", icon: "💳" },
  { id: "security", label: "Security", description: "SSO and API keys", icon: "🔐" },
  { id: "audit-log", label: "Audit Log", description: "Access history", icon: "🧾" },
];

const initialUsers: TeamUser[] = [];

const roles: RoleDefinition[] = [
  { id: "admin", name: "Admin", description: "Full access across all modules" },
  { id: "pm", name: "PM", description: "Project management and execution" },
  { id: "estimator", name: "Estimator", description: "Bidding and budget planning" },
  { id: "ap", name: "AP", description: "Billing and pay apps" },
  { id: "viewer", name: "Viewer", description: "Read-only access" },
];

const modules: PermissionModule[] = [
  { id: "projects", label: "Projects" },
  { id: "bidding", label: "Bidding" },
  { id: "budget", label: "Budget" },
  { id: "change-orders", label: "Change Orders" },
  { id: "pay-apps", label: "Pay Apps" },
  { id: "lien-waivers", label: "Lien Waivers" },
  { id: "documents", label: "Documents" },
  { id: "directory", label: "Directory" },
];

const statusPillStyles: Record<UserStatus, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Invited: "bg-amber-100 text-amber-700",
  Deactivated: "bg-slate-200 text-slate-700",
};

function splitFullName(value: string): { firstName: string; lastName: string } {
  const trimmed = value.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

function formatActualTaxRate(rate: string, state: string): string {
  const numericRate = Number.parseFloat(rate);
  if (!Number.isFinite(numericRate)) return "-";
  const actualRate = state.trim().toUpperCase() === "AZ" ? numericRate * 0.65 : numericRate;
  return `${actualRate.toFixed(2)}%`;
}

type TaxRateSortKey = "city" | "state";
type SortDirection = "asc" | "desc";

function parseSection(value: string | null): SettingsSectionId {
  const fallback: SettingsSectionId = "general";
  if (!value) return fallback;
  const match = settingsNavItems.find((item) => item.id === value);
  return match?.id ?? fallback;
}

function getDefaultCostCodeRows() {
  return DEFAULT_WORKSPACE_COST_CODES.map((item, index) => ({
    id: `cc-${index + 1}`,
    code: item.code,
    description: item.description,
  }));
}

export function SettingsShell() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const bypassUnsavedGuardRef = useRef(false);

  const activeSection = parseSection(searchParams.get("section"));

  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved">("saved");
  const [pendingNavigation, setPendingNavigation] = useState<{
    section?: SettingsSectionId;
    href?: string;
  } | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>(initialUsers);
  const [loadingTeamUsers, setLoadingTeamUsers] = useState(false);
  const [teamUsersError, setTeamUsersError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);
  const [editCompanyDraft, setEditCompanyDraft] = useState("");
  const [editFirstNameDraft, setEditFirstNameDraft] = useState("");
  const [editLastNameDraft, setEditLastNameDraft] = useState("");
  const [editAddressDraft, setEditAddressDraft] = useState("");
  const [editCityStateZipDraft, setEditCityStateZipDraft] = useState("");
  const [editPhoneDraft, setEditPhoneDraft] = useState("");
  const [editEmailDraft, setEditEmailDraft] = useState("");
  const [editRoleDraft, setEditRoleDraft] = useState("");
  const [editStatusDraft, setEditStatusDraft] = useState<UserStatus>("Active");
  const [savingUserEdit, setSavingUserEdit] = useState(false);
  const [editUserError, setEditUserError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState(roles[0].id);
  const [inviteEmailDraft, setInviteEmailDraft] = useState("");
  const [inviteRoleDraft, setInviteRoleDraft] = useState(roles[0].name);
  const [invitingUser, setInvitingUser] = useState(false);
  const [inviteUserError, setInviteUserError] = useState<string | null>(null);
  const [workspaceTimezone, setWorkspaceTimezoneDraft] = useState<WorkspaceTimezone>("pst");
  const [taxRateRows, setTaxRateRows] = useState<WorkspaceTaxRate[]>([]);
  const [taxRateSort, setTaxRateSort] = useState<{
    key: TaxRateSortKey;
    direction: SortDirection;
  }>({
    key: "city",
    direction: "asc",
  });
  const [costCodeRows, setCostCodeRows] = useState(() => getWorkspaceCostCodes(getDefaultCostCodeRows()));

  useEffect(() => {
    setWorkspaceTimezoneDraft(getWorkspaceTimezone());
    setTaxRateRows(getWorkspaceTaxRates());
    setCostCodeRows(getWorkspaceCostCodes(getDefaultCostCodeRows()));
    setWorkspaceCostCodes(getWorkspaceCostCodes(getDefaultCostCodeRows()));
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (saveStatus !== "unsaved" || bypassUnsavedGuardRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveStatus]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (saveStatus !== "unsaved" || bypassUnsavedGuardRef.current) return;
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== "_self") return;

      const href = link.href;
      if (!href) return;

      const nextUrl = new URL(href);
      if (nextUrl.protocol !== "http:" && nextUrl.protocol !== "https:") return;
      const currentUrl = new URL(window.location.href);
      const sameDestination =
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search &&
        nextUrl.hash === currentUrl.hash;

      if (sameDestination) return;

      event.preventDefault();
      setPendingNavigation({ href });
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [saveStatus]);

  useEffect(() => {
    let active = true;
    async function loadTeamUsers() {
      setLoadingTeamUsers(true);
      setTeamUsersError(null);
      try {
        const response = await fetch("/api/settings/team-users", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | { users?: TeamUser[]; error?: string }
          | null;
        if (!active) return;
        if (!response.ok) {
          setTeamUsers([]);
          setTeamUsersError(payload?.error ?? "Unable to load team users.");
          return;
        }
        setTeamUsers(Array.isArray(payload?.users) ? payload.users : []);
      } catch {
        if (!active) return;
        setTeamUsers([]);
        setTeamUsersError("Unable to load team users.");
      } finally {
        if (active) setLoadingTeamUsers(false);
      }
    }
    void loadTeamUsers();
    return () => {
      active = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    return teamUsers.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, search, statusFilter, teamUsers]);

  const resetSettingsDrafts = () => {
    setWorkspaceTimezoneDraft(getWorkspaceTimezone());
    setTaxRateRows(getWorkspaceTaxRates());
    setCostCodeRows(getWorkspaceCostCodes(getDefaultCostCodeRows()));
    setSaveStatus("saved");
  };

  const markUnsaved = () => {
    bypassUnsavedGuardRef.current = false;
    setSaveStatus("unsaved");
  };

  const sortedTaxRateRows = useMemo(() => {
    const compareText = (left: string, right: string) =>
      left.trim().localeCompare(right.trim(), undefined, {
        numeric: true,
        sensitivity: "base",
      });

    return [...taxRateRows].sort((left, right) => {
      const primaryCompare = compareText(left[taxRateSort.key], right[taxRateSort.key]);
      const secondaryKey = taxRateSort.key === "city" ? "state" : "city";
      const secondaryCompare = compareText(left[secondaryKey], right[secondaryKey]);
      const result = primaryCompare || secondaryCompare;
      return taxRateSort.direction === "asc" ? result : result * -1;
    });
  }, [taxRateRows, taxRateSort]);

  const toggleTaxRateSort = (key: TaxRateSortKey) => {
    setTaxRateSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const renderTaxRateSortIcon = (key: TaxRateSortKey) => {
    const isActive = taxRateSort.key === key;

    return (
      <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
        <path
          d="M10 4 5.5 9h9L10 4z"
          fill={isActive && taxRateSort.direction === "asc" ? "#3B82F6" : "#CBD5E1"}
        />
        <path
          d="M10 16 14.5 11h-9L10 16z"
          fill={isActive && taxRateSort.direction === "desc" ? "#3B82F6" : "#CBD5E1"}
        />
      </svg>
    );
  };

  const handleTimezoneChange = (nextValue: WorkspaceTimezone) => {
    setWorkspaceTimezoneDraft(nextValue);
    markUnsaved();
  };

  const updateTaxRateRow = (rowId: string, patch: Partial<WorkspaceTaxRate>) => {
    setTaxRateRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row))
    );
    markUnsaved();
  };

  const addTaxRateRow = () => {
    setTaxRateRows((prev) => [
      ...prev,
      {
        id: `tax-custom-${Date.now()}`,
        city: "",
        state: "AZ",
        rate: "",
      },
    ]);
    markUnsaved();
  };

  const removeTaxRateRow = (rowId: string) => {
    setTaxRateRows((prev) => prev.filter((row) => row.id !== rowId));
    markUnsaved();
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setInviteEmailDraft("");
    setInviteRoleDraft(roles[0].name);
    setInvitingUser(false);
    setInviteUserError(null);
  };

  const submitInviteUser = async () => {
    const normalizedEmail = inviteEmailDraft.trim().toLowerCase();
    if (!normalizedEmail) {
      setInviteUserError("Enter an email address.");
      return;
    }

    setInvitingUser(true);
    setInviteUserError(null);
    try {
      const response = await fetch("/api/settings/team-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          role: inviteRoleDraft,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { user?: TeamUser; error?: string }
        | null;

      if (!response.ok || !payload?.user) {
        setInviteUserError(payload?.error ?? "Unable to invite user.");
        setInvitingUser(false);
        return;
      }

      setTeamUsers((prev) => {
        const withoutExisting = prev.filter((user) => user.id !== payload.user?.id);
        return [payload.user as TeamUser, ...withoutExisting];
      });
      setSaveStatus("unsaved");
      closeInviteModal();
    } catch {
      setInviteUserError("Unable to invite user.");
      setInvitingUser(false);
    }
  };

  const openEditUserModal = (user: TeamUser) => {
    const parsed = splitFullName(user.name ?? "");
    setEditingUser(user);
    setEditCompanyDraft(user.company ?? "");
    setEditFirstNameDraft(user.firstName ?? parsed.firstName);
    setEditLastNameDraft(user.lastName ?? parsed.lastName);
    setEditAddressDraft(user.address ?? "");
    setEditCityStateZipDraft(user.cityStateZip ?? "");
    setEditPhoneDraft(user.phone ?? "");
    setEditEmailDraft(user.email ?? "");
    setEditRoleDraft(user.role);
    setEditStatusDraft(user.status === "Deactivated" ? "Deactivated" : "Active");
    setEditUserError(null);
  };

  const closeEditUserModal = () => {
    setEditingUser(null);
    setEditCompanyDraft("");
    setEditFirstNameDraft("");
    setEditLastNameDraft("");
    setEditAddressDraft("");
    setEditCityStateZipDraft("");
    setEditPhoneDraft("");
    setEditEmailDraft("");
    setEditRoleDraft("");
    setEditStatusDraft("Active");
    setSavingUserEdit(false);
    setEditUserError(null);
  };

  const submitEditUser = async () => {
    if (!editingUser) return;
    setSavingUserEdit(true);
    setEditUserError(null);
    try {
      const response = await fetch(`/api/settings/team-users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: editRoleDraft,
          status: editStatusDraft,
          firstName: editFirstNameDraft,
          lastName: editLastNameDraft,
          company: editCompanyDraft,
          address: editAddressDraft,
          cityStateZip: editCityStateZipDraft,
          phone: editPhoneDraft,
          email: editEmailDraft,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setEditUserError(payload?.error ?? "Unable to update user.");
        setSavingUserEdit(false);
        return;
      }
      setTeamUsers((prev) =>
        prev.map((user) =>
          user.id === editingUser.id
            ? {
                ...user,
                company: editCompanyDraft.trim(),
                firstName: editFirstNameDraft.trim(),
                lastName: editLastNameDraft.trim(),
                name:
                  [editFirstNameDraft.trim(), editLastNameDraft.trim()].filter(Boolean).join(" ") ||
                  user.name,
                address: editAddressDraft.trim(),
                cityStateZip: editCityStateZipDraft.trim(),
                phone: editPhoneDraft.trim(),
                email: editEmailDraft.trim() || user.email,
                role: editRoleDraft.trim() || user.role,
                status: editStatusDraft,
              }
            : user
        )
      );
      setSaveStatus("saved");
      closeEditUserModal();
    } catch {
      setEditUserError("Unable to update user.");
      setSavingUserEdit(false);
    }
  };

  const onSectionChange = (section: SettingsSectionId) => {
    if (saveStatus === "unsaved" && section !== activeSection) {
      setPendingNavigation({ section });
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("section", section);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const confirmPendingNavigation = () => {
    if (!pendingNavigation) return;
    bypassUnsavedGuardRef.current = true;
    const nextNavigation = pendingNavigation;
    setPendingNavigation(null);
    resetSettingsDrafts();

    if (nextNavigation.section) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("section", nextNavigation.section);
      router.replace(`${pathname}?${params.toString()}`);
      return;
    }

    if (nextNavigation.href) {
      const nextUrl = new URL(nextNavigation.href);
      if (nextUrl.origin === window.location.origin) {
        router.push(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
        return;
      }

      window.location.href = nextNavigation.href;
    }
  };

  const renderGeneral = () => (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="General"
        description="Manage profile preferences and default workspace behaviors."
      />
      <SettingsCard title="Profile preferences" subtitle="Defaults for date, time, and currency formatting.">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Timezone</span>
            <select
              className="w-full rounded-lg border border-slate-300 p-2"
              value={workspaceTimezone}
              onChange={(event) => handleTimezoneChange(event.target.value as WorkspaceTimezone)}
            >
              {WORKSPACE_TIMEZONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Date format</span>
            <select className="w-full rounded-lg border border-slate-300 p-2" defaultValue="mdy" onChange={markUnsaved}>
              <option value="mdy">MM/DD/YYYY</option>
              <option value="dmy">DD/MM/YYYY</option>
              <option value="iso">YYYY-MM-DD</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Currency</span>
            <select className="w-full rounded-lg border border-slate-300 p-2" defaultValue="usd" onChange={markUnsaved}>
              <option value="usd">USD ($)</option>
              <option value="cad">CAD ($)</option>
            </select>
          </label>
        </div>
      </SettingsCard>
      <SettingsCard title="Display options">
        <div className="space-y-3">
          <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
            <span className="text-sm font-medium text-slate-700">Compact tables</span>
            <input type="checkbox" className="h-4 w-4" onChange={markUnsaved} />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
            <span className="text-sm font-medium text-slate-700">Show archived by default</span>
            <input type="checkbox" className="h-4 w-4" onChange={markUnsaved} />
          </label>
        </div>
      </SettingsCard>
    </div>
  );

  const renderCompany = () => (
    <div className="space-y-4">
      <SettingsSectionHeader title="Company" description="Company profile and financial defaults." />
      <SettingsCard title="Company profile">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            "Company name",
            "Address",
            "License #",
            "EIN",
            "Default markup %",
            "Default tax %",
            "Default overhead %",
          ].map((field) => (
            <label key={field} className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">{field}</span>
              <input
                className="w-full rounded-lg border border-slate-300 p-2"
                placeholder={`Enter ${field.toLowerCase()}`}
                onChange={markUnsaved}
              />
            </label>
          ))}
          <div className="md:col-span-2">
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-600">
              Logo upload placeholder (drag & drop coming soon)
            </div>
          </div>
        </div>
      </SettingsCard>
      <SettingsCard title="Danger zone" subtitle="This action cannot be undone.">
        <button
          type="button"
          disabled
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600 disabled:opacity-70"
        >
          Delete company
        </button>
      </SettingsCard>
    </div>
  );

  const renderTeam = () => (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Team & Users"
        description="Manage users, roles, and invitations across your company."
        action={
          <button
            type="button"
            onClick={() => {
              setInviteEmailDraft("");
              setInviteRoleDraft(roles[0].name);
              setInviteUserError(null);
              setShowInviteModal(true);
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Invite user
          </button>
        }
      />
      <SettingsCard>
        {loadingTeamUsers ? (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Loading users...
          </div>
        ) : null}
        {teamUsersError ? (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {teamUsersError}
          </div>
        ) : null}
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            className="min-w-52 flex-1 rounded-lg border border-slate-300 p-2 text-sm"
            placeholder="Search name or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="rounded-lg border border-slate-300 p-2 text-sm"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
          >
            <option value="all">All roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.name}>
                {role.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-300 p-2 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All status</option>
            <option value="Active">Active</option>
            <option value="Invited">Invited</option>
            <option value="Deactivated">Deactivated</option>
          </select>
        </div>

        {filteredUsers.length === 0 ? (
          <EmptyState
            title="No users found"
            description="Try adjusting your search or role/status filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  {[
                    "Name",
                    "Email",
                    "Role",
                    "Status",
                    "Last Active",
                    "Actions",
                  ].map((header) => (
                    <th key={header} className="px-2 py-2 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100">
                    <td className="px-2 py-3 font-medium text-slate-900">{user.name}</td>
                    <td className="px-2 py-3 text-slate-600">{user.email}</td>
                    <td className="px-2 py-3 text-slate-700">{user.role}</td>
                    <td className="px-2 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusPillStyles[user.status]}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-slate-600">{user.lastActive}</td>
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        className="mr-2 text-xs font-medium text-blue-600"
                        onClick={() => openEditUserModal(user)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs font-medium text-rose-600"
                        onClick={() =>
                          openEditUserModal({
                            ...user,
                            status: "Deactivated",
                          })
                        }
                      >
                        Deactivate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SettingsCard>

      {showInviteModal ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Invite user</h3>
            <p className="mt-1 text-sm text-slate-600">Send an invite with a pre-assigned role.</p>
            <div className="mt-4 space-y-3">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Email</span>
                <input
                  className="w-full rounded-lg border border-slate-300 p-2"
                  placeholder="name@company.com"
                  value={inviteEmailDraft}
                  onChange={(event) => setInviteEmailDraft(event.target.value)}
                  type="email"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Role</span>
                <select
                  className="w-full rounded-lg border border-slate-300 p-2"
                  value={inviteRoleDraft}
                  onChange={(event) => setInviteRoleDraft(event.target.value)}
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.name}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>
              {inviteUserError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {inviteUserError}
                </div>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
                onClick={closeInviteModal}
                disabled={invitingUser}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
                onClick={() => void submitInviteUser()}
                disabled={invitingUser}
              >
                {invitingUser ? "Sending..." : "Send invite"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingUser ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Edit user</h3>
            <p className="mt-1 text-sm text-slate-600">{editingUser.name} • {editingUser.email}</p>
            <div className="mt-4 space-y-3">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Company</span>
                <input
                  className="w-full rounded-lg border border-slate-300 p-2"
                  value={editCompanyDraft}
                  onChange={(event) => setEditCompanyDraft(event.target.value)}
                  placeholder="Company name"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">First Name</span>
                <input
                  className="w-full rounded-lg border border-slate-300 p-2"
                  value={editFirstNameDraft}
                  onChange={(event) => setEditFirstNameDraft(event.target.value)}
                  placeholder="First name"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Last Name</span>
                <input
                  className="w-full rounded-lg border border-slate-300 p-2"
                  value={editLastNameDraft}
                  onChange={(event) => setEditLastNameDraft(event.target.value)}
                  placeholder="Last name"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Address</span>
                <input
                  className="w-full rounded-lg border border-slate-300 p-2"
                  value={editAddressDraft}
                  onChange={(event) => setEditAddressDraft(event.target.value)}
                  placeholder="Street address"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">City, State ZIP</span>
                <input
                  className="w-full rounded-lg border border-slate-300 p-2"
                  value={editCityStateZipDraft}
                  onChange={(event) => setEditCityStateZipDraft(event.target.value)}
                  placeholder="City, ST ZIP"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Phone</span>
                <input
                  className="w-full rounded-lg border border-slate-300 p-2"
                  value={editPhoneDraft}
                  onChange={(event) => setEditPhoneDraft(event.target.value)}
                  placeholder="(555) 555-5555"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Email</span>
                <input
                  type="email"
                  className="w-full rounded-lg border border-slate-300 p-2"
                  value={editEmailDraft}
                  onChange={(event) => setEditEmailDraft(event.target.value)}
                  placeholder="user@company.com"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Role</span>
                <select
                  className="w-full rounded-lg border border-slate-300 p-2"
                  value={editRoleDraft}
                  onChange={(event) => setEditRoleDraft(event.target.value)}
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.name}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Status</span>
                <select
                  className="w-full rounded-lg border border-slate-300 p-2"
                  value={editStatusDraft}
                  onChange={(event) => setEditStatusDraft(event.target.value as UserStatus)}
                >
                  <option value="Active">Active</option>
                  <option value="Deactivated">Deactivated</option>
                </select>
              </label>
            </div>
            {editUserError ? (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {editUserError}
              </div>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
                onClick={closeEditUserModal}
                disabled={savingUserEdit}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
                onClick={submitEditUser}
                disabled={savingUserEdit}
              >
                {savingUserEdit ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  const renderRoles = () => (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Roles & Permissions"
        description="Configure role-based access controls across BuilderOS modules."
        action={
          <button
            type="button"
            disabled
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-500"
          >
            Create custom role
          </button>
        }
      />

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Permissions affect access across your company.
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <SettingsCard title="Roles">
          <ul className="space-y-1">
            {roles.map((role) => (
              <li key={role.id}>
                <button
                  type="button"
                  className={`w-full rounded-lg px-3 py-2 text-left ${
                    selectedRole === role.id ? "bg-slate-900 text-white" : "hover:bg-slate-100"
                  }`}
                  onClick={() => setSelectedRole(role.id)}
                >
                  <div className="text-sm font-medium">{role.name}</div>
                  <div className={`text-xs ${selectedRole === role.id ? "text-slate-300" : "text-slate-500"}`}>
                    {role.description}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </SettingsCard>

        <SettingsCard title="Permissions matrix">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-2 text-left font-medium">Module</th>
                  {[
                    "View",
                    "Create",
                    "Edit",
                    "Approve",
                    "Delete",
                  ].map((perm) => (
                    <th key={perm} className="px-3 py-2 text-center font-medium">
                      {perm}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((module) => (
                  <tr key={module.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-medium text-slate-700">{module.label}</td>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <td key={`${module.id}-${index}`} className="px-3 py-3 text-center">
                        <input type="checkbox" className="h-4 w-4" onChange={markUnsaved} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SettingsCard>
      </div>
    </div>
  );

  const renderProjectDefaults = () => (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Project Defaults"
        description="Set baseline templates for cost codes, bids, and waivers."
      />
      <SettingsCard
        title="Company Cost Codes"
        footer={
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
            onClick={() => {
              setCostCodeRows((prev) => [
                ...prev,
                { id: `cc-${prev.length + 1}`, code: "", description: "" },
              ]);
              markUnsaved();
            }}
          >
            Add row
          </button>
        }
      >
        <div className="space-y-2">
          {costCodeRows.map((row) => (
            <div key={row.id} className="grid gap-2 md:grid-cols-[160px_minmax(0,1fr)_90px]">
              <input
                value={row.code}
                className="rounded-lg border border-slate-300 p-2 text-sm"
                placeholder="Code"
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setCostCodeRows((prev) =>
                    prev.map((item) => (item.id === row.id ? { ...item, code: nextValue } : item))
                  );
                  markUnsaved();
                }}
              />
              <input
                value={row.description}
                className="rounded-lg border border-slate-300 p-2 text-sm"
                placeholder="Description"
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setCostCodeRows((prev) =>
                    prev.map((item) => (item.id === row.id ? { ...item, description: nextValue } : item))
                  );
                  markUnsaved();
                }}
              />
              <button
                type="button"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm text-rose-700"
                onClick={() => {
                  setCostCodeRows((prev) => prev.filter((item) => item.id !== row.id));
                  markUnsaved();
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </SettingsCard>
      <SettingsCard title="Bid settings">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Default invite template</span>
            <select className="w-full rounded-lg border border-slate-300 p-2" onChange={markUnsaved}>
              <option>Standard bid package</option>
              <option>Fast-track bid package</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Reminder cadence</span>
            <select className="w-full rounded-lg border border-slate-300 p-2" onChange={markUnsaved}>
              <option>3, 1 days before due date</option>
              <option>7, 3, 1 days before due date</option>
            </select>
          </label>
        </div>
      </SettingsCard>
      <SettingsCard title="Waiver settings">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Default waiver type</span>
            <select className="w-full rounded-lg border border-slate-300 p-2" onChange={markUnsaved}>
              <option>Conditional progress</option>
              <option>Unconditional final</option>
            </select>
          </label>
          <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700">
            Require notarization
            <input type="checkbox" className="h-4 w-4" onChange={markUnsaved} />
          </label>
        </div>
      </SettingsCard>
    </div>
  );

  const renderTaxRates = () => (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Tax Rates"
        description="Manage tax rates by city and jurisdiction. Applied automatically to bids based on project location."
      />
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm leading-6 text-blue-800">
        Tax rates are applied to bids when a project location matches a city or jurisdiction below.
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">Jurisdiction tax rates</h3>
          <button
            type="button"
            onClick={addTaxRateRow}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            + Add rate
          </button>
        </header>
        <div className="overflow-x-auto px-5 py-4">
          <table className="min-w-[760px] w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 text-left font-semibold">
                  <button
                    type="button"
                    onClick={() => toggleTaxRateSort("city")}
                    className="inline-flex items-center gap-4 rounded-md text-left font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-900"
                    aria-label={`Sort city or municipality ${
                      taxRateSort.key === "city" && taxRateSort.direction === "asc"
                        ? "descending"
                        : "ascending"
                    }`}
                  >
                    <span>City / Municipality</span>
                    {renderTaxRateSortIcon("city")}
                  </button>
                </th>
                <th className="w-48 px-3 py-3 text-left font-semibold">
                  <button
                    type="button"
                    onClick={() => toggleTaxRateSort("state")}
                    className="inline-flex items-center gap-4 rounded-md text-left font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-900"
                    aria-label={`Sort state ${
                      taxRateSort.key === "state" && taxRateSort.direction === "asc"
                        ? "descending"
                        : "ascending"
                    }`}
                  >
                    <span>State</span>
                    {renderTaxRateSortIcon("state")}
                  </button>
                </th>
                <th className="w-32 px-3 py-3 text-left font-semibold">Rate</th>
                <th className="w-32 px-3 py-3 text-left font-semibold">Actual Rate</th>
                <th className="w-24 px-3 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedTaxRateRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200">
                  <td className="px-3 py-3">
                    <input
                      value={row.city}
                      onChange={(event) => updateTaxRateRow(row.id, { city: event.target.value })}
                      className="w-full scroll-mb-40 rounded-lg border border-transparent bg-transparent px-2 py-2 font-semibold text-slate-900 outline-none focus:border-blue-300 focus:bg-white"
                      placeholder="City"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={row.state}
                      onChange={(event) =>
                        updateTaxRateRow(row.id, { state: event.target.value })
                      }
                      className="w-full scroll-mb-40 rounded-lg border border-transparent bg-transparent px-2 py-2 font-semibold text-slate-700 outline-none focus:border-blue-300 focus:bg-white"
                      aria-label={`State for ${row.city || "tax rate"}`}
                    >
                      {US_STATES.map((state) => (
                        <option key={state.code} value={state.code}>
                          {state.name} ({state.code})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center rounded-lg border border-transparent bg-transparent px-2 py-2 focus-within:border-blue-300 focus-within:bg-white">
                      <input
                        value={row.rate}
                        onChange={(event) =>
                          updateTaxRateRow(row.id, { rate: event.target.value.replace(/[^0-9.]/g, "") })
                        }
                        className="w-full scroll-mb-40 bg-transparent text-right font-semibold text-slate-900 outline-none"
                        placeholder="0.00"
                      />
                      <span className="ml-1 text-slate-500">%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 font-semibold text-slate-700">
                    {formatActualTaxRate(row.rate, row.state)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeTaxRateRow(row.id)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  const renderEmailSending = () => <EmailSendingSection />;

  const renderIntegrations = () => (
    <div className="space-y-4">
      <SettingsSectionHeader title="Integrations" description="Connect BuilderOS to your critical systems." />
      <div className="grid gap-4 md:grid-cols-3">
        {["Procore", "QuickBooks", "DocuSign"].map((tool) => (
          <SettingsCard key={tool} title={tool}>
            <p className="mb-3 text-sm text-slate-600">Sync data securely between platforms.</p>
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                Not connected
              </span>
              <button disabled className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-500">
                Connect
              </button>
            </div>
          </SettingsCard>
        ))}
      </div>
      <EmptyState
        title="Integrations are coming soon"
        description="We are finalizing secure OAuth workflows before enabling production connections."
      />
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-4">
      <SettingsSectionHeader title="Notifications" description="Configure alerts and delivery recipients." />
      <SettingsCard title="Email notifications">
        <div className="space-y-3">
          {[
            "Bid due reminders",
            "Waiver missing reminders",
            "Payment status changes",
          ].map((label) => (
            <label key={label} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <span className="text-sm font-medium text-slate-700">{label}</span>
              <input type="checkbox" className="h-4 w-4" onChange={markUnsaved} />
            </label>
          ))}
        </div>
      </SettingsCard>
      <SettingsCard title="Recipients">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Notification recipients</span>
          <select multiple className="h-28 w-full rounded-lg border border-slate-300 p-2" onChange={markUnsaved}>
            <option>Sierra Johnson</option>
            <option>Mateo Cooper</option>
            <option>Noah Bennett</option>
          </select>
          <span className="text-xs text-slate-500">Placeholder multi-select for future team lookup.</span>
        </label>
      </SettingsCard>
    </div>
  );

  const renderBilling = () => (
    <div className="space-y-4">
      <SettingsSectionHeader title="Billing" description="Manage your subscription and billing contacts." />
      <SettingsCard title="Current plan">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-xs uppercase text-slate-500">Plan</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">Pro (Placeholder)</div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-xs uppercase text-slate-500">Seats used</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">18 / 25</div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-xs uppercase text-slate-500">Next invoice</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">Mar 15, 2026</div>
          </div>
        </div>
        <button disabled className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-500">
          Manage billing
        </button>
      </SettingsCard>
    </div>
  );

  const renderSecurity = () => (
    <div className="space-y-4">
      <SettingsSectionHeader title="Security" description="Centralize identity and access controls." />
      <SettingsCard title="Authentication">
        <div className="space-y-3">
          <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
            <span className="text-sm font-medium text-slate-700">Enforce 2FA for all users</span>
            <input type="checkbox" className="h-4 w-4" onChange={markUnsaved} />
          </label>
          <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-600">SSO provider setup placeholder</div>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Session timeout</span>
            <select className="w-full rounded-lg border border-slate-300 p-2" onChange={markUnsaved}>
              <option>30 minutes</option>
              <option>1 hour</option>
              <option>8 hours</option>
            </select>
          </label>
        </div>
      </SettingsCard>
      <SettingsCard title="API keys">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-2 py-2 font-medium">Name</th>
              <th className="px-2 py-2 font-medium">Created</th>
              <th className="px-2 py-2 font-medium">Last used</th>
              <th className="px-2 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-2 py-3">Server-to-server key</td>
              <td className="px-2 py-3 text-slate-600">Jan 08, 2026</td>
              <td className="px-2 py-3 text-slate-600">Never</td>
              <td className="px-2 py-3 text-slate-600">Revoke</td>
            </tr>
          </tbody>
        </table>
      </SettingsCard>
    </div>
  );

  const renderAuditLog = () => (
    <div className="space-y-4">
      <SettingsSectionHeader title="Audit Log" description="Track user and system activity in your workspace." />
      <SettingsCard>
        <div className="mb-4 flex flex-wrap gap-2">
          <input className="min-w-52 flex-1 rounded-lg border border-slate-300 p-2 text-sm" placeholder="Search audit entries" />
          <select className="rounded-lg border border-slate-300 p-2 text-sm">
            <option>All users</option>
            <option>Sierra Johnson</option>
          </select>
          <select className="rounded-lg border border-slate-300 p-2 text-sm">
            <option>All actions</option>
            <option>Updated role</option>
            <option>Invited user</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                {[
                  "Timestamp",
                  "User",
                  "Action",
                  "Entity",
                  "Details",
                ].map((heading) => (
                  <th key={heading} className="px-2 py-2 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["2026-02-01 09:14", "Sierra Johnson", "Updated role", "Team User", "PM → Admin"],
                ["2026-02-01 08:02", "System", "Changed setting", "Security", "2FA enforced"],
              ].map((entry) => (
                <tr key={entry.join("-")} className="border-b border-slate-100">
                  {entry.map((cell) => (
                    <td key={cell} className="px-2 py-3 text-slate-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsCard>
    </div>
  );

  const content = {
    general: renderGeneral(),
    company: renderCompany(),
    team: renderTeam(),
    roles: renderRoles(),
    "project-defaults": renderProjectDefaults(),
    "tax-rates": renderTaxRates(),
    "email-sending": renderEmailSending(),
    integrations: renderIntegrations(),
    notifications: renderNotifications(),
    billing: renderBilling(),
    security: renderSecurity(),
    "audit-log": renderAuditLog(),
  }[activeSection];

  return (
    <>
      {/* TODO: Replace mock state with Supabase settings tables and RLS-aware mutations. */}
      <SettingsLayout
        items={settingsNavItems}
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        saveStatus={saveStatus}
        onCancel={() => {
          resetSettingsDrafts();
        }}
        onSave={() => {
          setWorkspaceTimezone(workspaceTimezone);
          setWorkspaceTaxRates(taxRateRows);
          setWorkspaceCostCodes(costCodeRows);
          bypassUnsavedGuardRef.current = false;
          setSaveStatus("saved");
        }}
      >
        {content}
      </SettingsLayout>
      {pendingNavigation ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Leave without saving?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              You have unsaved settings changes. If you leave now, those changes will be lost.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                onClick={() => setPendingNavigation(null)}
              >
                Stay
              </button>
              <button
                type="button"
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
                onClick={confirmPendingNavigation}
              >
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
