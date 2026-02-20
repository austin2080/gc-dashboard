"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "./EmptyState";
import { SettingsCard } from "./SettingsCard";
import { SettingsLayout } from "./SettingsLayout";
import { SettingsSectionHeader } from "./SettingsSectionHeader";
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

const initialUsers: TeamUser[] = [
  {
    id: "1",
    name: "Sierra Johnson",
    email: "sierra@builderos.com",
    role: "Admin",
    status: "Active",
    lastActive: "2 minutes ago",
  },
  {
    id: "2",
    name: "Mateo Cooper",
    email: "mateo@builderos.com",
    role: "Estimator",
    status: "Invited",
    lastActive: "Never",
  },
  {
    id: "3",
    name: "Noah Bennett",
    email: "noah@builderos.com",
    role: "PM",
    status: "Active",
    lastActive: "3 hours ago",
  },
];

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

const defaultCompanyCostCodes: Array<{ code: string; description: string }> = [
  { code: "00", description: "Professional Services" },
  { code: "00-00-00-00", description: "Professional Services" },
  { code: "01", description: "General Conditions" },
  { code: "01-01-00-00", description: "General Conditions" },
  { code: "01-01-01-00", description: "General Labor" },
  { code: "01-01-02-00", description: "Project Manager / Project Executive" },
  { code: "01-01-03-00", description: "Superintendent / General Superintendent" },
  { code: "01-01-04-00", description: "Project Engineer" },
  { code: "01-01-05-00", description: "Project Coordinator" },
  { code: "01-01-06-00", description: "Safety" },
  { code: "01-01-07-00", description: "Pre-Construction" },
  { code: "01-01-08-00", description: "Cell Phone" },
  { code: "01-01-09-00", description: "Vehicle Allowance" },
  { code: "01-01-10-00", description: "Job Mobilization" },
  { code: "01-01-11-00", description: "Submittals" },
  { code: "01-01-12-00", description: "Special Procedures & Governmental Requirements" },
  { code: "01-01-13-00", description: "Safety Requirements" },
  { code: "01-01-14-00", description: "Security Procedures" },
  { code: "01-01-15-00", description: "Quality Requirements - Material Testing & Special Inspections" },
  { code: "01-01-16-00", description: "Temporary Facilities & Controls" },
  { code: "01-01-17-00", description: "Temporary Utilities" },
  { code: "01-01-18-00", description: "Temp Light, Power, Generator" },
  { code: "01-01-19-00", description: "Temporary Heating, Cooling, & Ventilating" },
  { code: "01-01-20-00", description: "Temporary Communications" },
  { code: "01-01-21-00", description: "Job Fuel" },
  { code: "01-01-22-00", description: "Trailer Setup & Removal" },
  { code: "01-01-23-00", description: "Construction Facilities - Field Offices & Sheds" },
  { code: "01-01-24-00", description: "Sanitary Facilities" },
  { code: "01-01-25-00", description: "Temporary Construction" },
  { code: "01-01-26-00", description: "Construction Equipment" },
  { code: "01-01-27-00", description: "Temporary Lifting & Hoisting Equipment" },
  { code: "01-01-28-00", description: "Scaffold & Temporary Platforms" },
  { code: "01-01-29-00", description: "Tools / Supplies / Protection Materials" },
  { code: "01-01-30-00", description: "Vehicle Access & Parking" },
  { code: "01-01-31-00", description: "Temporary Roads & Maintenance" },
  { code: "01-01-32-00", description: "Snow Removal" },
  { code: "01-01-33-00", description: "Traffic Control" },
  { code: "01-01-34-00", description: "Temporary Barriers & Enclosures" },
  { code: "01-01-35-00", description: "Temp Fencing" },
  { code: "01-01-36-00", description: "Fencing Privacy Mesh" },
  { code: "01-01-37-00", description: "Damage Fencing" },
  { code: "01-01-38-00", description: "Signs / Barricades" },
  { code: "01-01-39-00", description: "SWPPP - Storm Water Prevention Plan" },
  { code: "01-01-40-00", description: "Project Signage" },
  { code: "01-01-41-00", description: "Remote Construction Procedures" },
  { code: "01-01-42-00", description: "Construction Camp" },
  { code: "01-01-43-00", description: "Camp Maintenance" },
  { code: "01-01-44-00", description: "Travel Expense / Airfare" },
  { code: "01-01-45-00", description: "Subsistence & Per Diem" },
  { code: "01-01-46-00", description: "Product Requirements & Expediting" },
  { code: "01-01-47-00", description: "Freight" },
  { code: "01-01-48-00", description: "Air Freight" },
  { code: "01-01-49-00", description: "Product Handling Requirements, Load & Unload" },
  { code: "01-01-50-00", description: "Expeditor" },
  { code: "01-01-51-00", description: "Mobilization" },
  { code: "01-01-52-00", description: "Demobilization" },
  { code: "01-01-53-00", description: "Execution" },
  { code: "01-01-54-00", description: "Construction Cleaning - Temp Labor" },
  { code: "01-01-54-01", description: "Final Clean" },
  { code: "01-01-55-00", description: "Dumpster" },
  { code: "01-01-56-00", description: "Closeout Submittals" },
  { code: "01-01-57-00", description: "Plan Reprographics" },
  { code: "01-01-58-00", description: "Punchlist & Completion" },
  { code: "01-01-59-00", description: "As-Builts / O&M Data" },
  { code: "01-01-60-00", description: "Warranties" },
  { code: "01-01-61-00", description: "Sales" },
  { code: "01-01-62-00", description: "Performance Bonding Requirements" },
  { code: "01-01-63-00", description: "Commissioning" },
  { code: "01-01-64-00", description: "Project Management Software" },
  { code: "01-01-65-00", description: "Permits" },
  { code: "01-01-66-00", description: "Testing & Special Inspection Allowance" },
  { code: "01-01-67-00", description: "General Liability Insurance" },
  { code: "01-01-68-00", description: "Builders Risk Insurance" },
  { code: "01-01-69-00", description: "ICRA" },
  { code: "01-01-69-10", description: "ICRA - Negative Air Machines / Rental" },
  { code: "01-01-69-20", description: "ICRA - Filter Replacement" },
  { code: "01-01-70-00", description: "Site Watering for Dust Control" },
  { code: "01-01-71-00", description: "Contingency" },
  { code: "02", description: "Existing Conditions" },
  { code: "02-02-00-00", description: "Existing Conditions" },
  { code: "02-02-01-00", description: "Termite & Pest Control" },
  { code: "02-02-21-00", description: "Survey" },
  { code: "02-02-32-00", description: "Geo Technical Investigations" },
  { code: "02-02-41-00", description: "Demolition" },
  { code: "02-02-82-00", description: "Asbestos Remediation" },
  { code: "02-02-85-00", description: "Mold Remediation" },
  { code: "03", description: "Concrete" },
  { code: "03-03-00-00", description: "Concrete" },
  { code: "03-03-30-00", description: "Cast in Place Concrete" },
  { code: "03-03-40-00", description: "Precast Concrete" },
  { code: "03-03-47-00", description: "Site Cast Concrete" },
  { code: "04", description: "Masonry" },
  { code: "04-04-00-00", description: "Masonry" },
  { code: "04-04-40-00", description: "Stone" },
  { code: "05", description: "Metals" },
  { code: "05-05-00-00", description: "Metals" },
  { code: "05-05-10-00", description: "Structural Steel" },
  { code: "05-05-30-00", description: "Metal Decking" },
  { code: "05-05-50-00", description: "Metal Fabrication Misc Metals or Arch Metals" },
  { code: "06", description: "Wood & Plastics" },
  { code: "06-06-00-00", description: "Wood & Plastics" },
  { code: "06-06-10-00", description: "Rough Carpentry" },
  { code: "06-06-20-00", description: "Finish Carpentry" },
  { code: "06-06-22-00", description: "Millwork" },
  { code: "06-06-40-00", description: "Architectural Woodwork" },
  { code: "07", description: "Thermal & Moisture Protection" },
  { code: "07-07-00-00", description: "Moisture & Dampproofing" },
  { code: "07-07-10-00", description: "Dampproofing & Waterproofing" },
  { code: "07-07-11-00", description: "LATH/PLASTER/EIFS" },
  { code: "07-07-20-00", description: "Insulation" },
  { code: "07-07-24-00", description: "EIFS / Stucco" },
  { code: "07-07-50-00", description: "Roofing" },
  { code: "07-07-80-00", description: "Fire & Smoke Protection - Fireproofing" },
  { code: "07-07-90-00", description: "Joint Protection Caulking" },
  { code: "08", description: "Openings" },
  { code: "08-08-00-00", description: "Openings" },
  { code: "08-08-11-00", description: "Metal Doors & Frames" },
  { code: "08-08-30-00", description: "Specialty Doors & Frames" },
  { code: "08-08-70-00", description: "Hardware" },
  { code: "08-08-80-00", description: "Glass & Glazing" },
  { code: "08-08-90-00", description: "Louvers & Vents" },
  { code: "09", description: "Finishes" },
  { code: "09-09-00-00", description: "Finishes" },
  { code: "09-09-20-00", description: "Metal Studs & Drywall" },
  { code: "09-09-26-00", description: "Wood Siding" },
  { code: "09-09-30-00", description: "Tile" },
  { code: "09-09-50-00", description: "Ceilings" },
  { code: "09-09-60-00", description: "Flooring" },
  { code: "09-09-70-00", description: "Wall Finishes" },
  { code: "09-09-80-00", description: "Acoustics Treatment" },
  { code: "09-09-90-00", description: "Painting & Coating" },
  { code: "10", description: "Specialties" },
  { code: "10-10-00-00", description: "Specialties" },
  { code: "10-10-10-00", description: "Information Specialties" },
  { code: "10-10-14-00", description: "Signage" },
  { code: "10-10-21-00", description: "Compartments & Cubicles RR Accessories" },
  { code: "10-10-28-00", description: "Toilet Partitions & Accessories" },
  { code: "10-10-50-00", description: "Storage Specialties Lockers" },
  { code: "10-10-70-00", description: "Exterior Specialties" },
  { code: "11", description: "Equipment & Appliances" },
  { code: "11-11-00-00", description: "Equipment" },
  { code: "11-11-13-00", description: "Loading Dock Equipment" },
  { code: "11-11-14-00", description: "Food Service Equipment" },
  { code: "11-11-52-00", description: "Audio-Visual Equipment" },
  { code: "12", description: "Furnishings" },
  { code: "12-12-00-00", description: "Furnishings" },
  { code: "12-12-20-00", description: "Window Treatments" },
  { code: "12-12-50-00", description: "Furniture" },
  { code: "13", description: "Special Construction" },
  { code: "13-13-11-00", description: "Swimming Pools" },
  { code: "13-13-35-00", description: "Rammed Earth Construction" },
  { code: "14", description: "Conveying Systems" },
  { code: "14-14-00-00", description: "Conveying Systems" },
  { code: "14-14-20-00", description: "Elevators" },
  { code: "21", description: "Fire Suppression" },
  { code: "21-21-00-00", description: "Fire Suppression" },
  { code: "21-21-11-00", description: "Water Based Fire Suppression Systems Fire Sprinklers" },
  { code: "22", description: "Plumbing" },
  { code: "22-22-00-00", description: "Plumbing" },
  { code: "22-22-30-00", description: "Plumbing Piping & Fixtures" },
  { code: "22-22-60-00", description: "Gas & Vacuum Systems for Laboratory & Healthcare Facilities Med Gas" },
  { code: "23", description: "HVAC" },
  { code: "23-23-00-00", description: "HVAC" },
  { code: "25", description: "Integrated Automation" },
  { code: "25-25-00-00", description: "Building Integrated Automation" },
  { code: "25-25-50-00", description: "Integrated Automation Facility Controls EMS/BAS" },
  { code: "26", description: "Electrical" },
  { code: "26-26-00-00", description: "Electrical" },
  { code: "26-26-41-00", description: "Lighting Protection" },
  { code: "26-26-50-00", description: "Lighting" },
  { code: "27", description: "Communications" },
  { code: "27-27-00-00", description: "Communications" },
  { code: "27-27-10-00", description: "Structured Cabling" },
  { code: "28", description: "Electronic Safety & Security" },
  { code: "28-28-00-00", description: "Electronic Safety & Security" },
  { code: "28-28-10-00", description: "Access Control" },
  { code: "28-28-20-00", description: "Electronic Surveillance Security" },
  { code: "28-28-31-00", description: "Fire Detection & Alarm" },
  { code: "31", description: "Earthwork" },
  { code: "31-31-00-00", description: "Earthwork" },
  { code: "31-31-20-00", description: "Earth Moving & Paving" },
  { code: "31-31-25-00", description: "Erosion & Sedimentation Controls" },
  { code: "31-31-32-00", description: "Soil Stabilization" },
  { code: "31-31-37-00", description: "Riprap" },
  { code: "31-31-40-00", description: "Shoring & Underpinning" },
  { code: "31-31-66-00", description: "Special Foundations" },
  { code: "32", description: "Exterior Improvements" },
  { code: "32-32-00-00", description: "Exterior Improvements" },
  { code: "32-32-10-00", description: "Bases & Paving" },
  { code: "32-32-31-00", description: "Fences & Gates" },
  { code: "32-32-90-00", description: "Landscape & Irrigation" },
  { code: "33", description: "Utilities" },
  { code: "33-33-00-00", description: "Utilities" },
  { code: "33-33-10-00", description: "Site Utilities" },
  { code: "33-33-40-00", description: "Storm Drainage Utilities" },
  { code: "33-33-70-00", description: "Electrical Dry Utilities" },
  { code: "34", description: "Transportation" },
  { code: "34-34-00-00", description: "Transportation" },
  { code: "40", description: "Process Integration" },
  { code: "40-40-00-00", description: "Process Integration" },
  { code: "41", description: "Material Handling Equipment" },
  { code: "41-41-20-00", description: "Material Handling Equipment" },
  { code: "42", description: "Process Heating, Cooling & Drying" },
  { code: "42-42-00-00", description: "Process Heating, Cooling & Drying Equipment" },
  { code: "43", description: "Process Gas & Liquid Handling" },
  { code: "43-43-00-00", description: "Process Gas & Liquid Handling, Purification, & Storage Equipment" },
  { code: "44", description: "Pollution & Waste Control Equipment" },
  { code: "44-44-00-00", description: "Pollution & Waste Control Equipment" },
  { code: "45", description: "Industry Specific Manufacturing Equipment" },
  { code: "45-45-00-00", description: "Industry Specific Manufacturing Equipment" },
  { code: "46", description: "Water & Waste Water Equipment" },
  { code: "46-46-00-00", description: "Water & Waste Water Equipment" },
  { code: "48", description: "Electrical Power Generation Equipment" },
  { code: "48-48-10-00", description: "Electrical Power Generation Equipment" },
  { code: "50", description: "General Liability Insurance" },
  { code: "50-50-00-00", description: "Sales Tax" },
  { code: "51", description: "Builders Risk Insurance" },
  { code: "51-51-50-00", description: "Overhead" },
  { code: "52", description: "Overhead" },
  { code: "53", description: "Profit" },
  { code: "54", description: "Slush Fund" },
];

function parseSection(value: string | null): SettingsSectionId {
  const fallback: SettingsSectionId = "general";
  if (!value) return fallback;
  const match = settingsNavItems.find((item) => item.id === value);
  return match?.id ?? fallback;
}

export function SettingsShell() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeSection = parseSection(searchParams.get("section"));

  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved">("saved");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState(roles[0].id);
  const [costCodeRows, setCostCodeRows] = useState(
    defaultCompanyCostCodes.map((item, index) => ({
      id: `cc-${index + 1}`,
      code: item.code,
      description: item.description,
    }))
  );

  const filteredUsers = useMemo(() => {
    return initialUsers.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, search, statusFilter]);

  const markUnsaved = () => setSaveStatus("unsaved");

  const onSectionChange = (section: SettingsSectionId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", section);
    router.replace(`${pathname}?${params.toString()}`);
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
            <select className="w-full rounded-lg border border-slate-300 p-2" defaultValue="pst" onChange={markUnsaved}>
              <option value="pst">Pacific (PST)</option>
              <option value="mst">Mountain (MST)</option>
              <option value="cst">Central (CST)</option>
              <option value="est">Eastern (EST)</option>
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
            onClick={() => setShowInviteModal(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Invite user
          </button>
        }
      />
      <SettingsCard>
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
                      <button type="button" className="mr-2 text-xs font-medium text-blue-600">
                        Edit
                      </button>
                      <button type="button" className="text-xs font-medium text-rose-600">
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
                <input className="w-full rounded-lg border border-slate-300 p-2" placeholder="name@company.com" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Role</span>
                <select className="w-full rounded-lg border border-slate-300 p-2">
                  {roles.map((role) => (
                    <option key={role.id}>{role.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
                onClick={() => setShowInviteModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
                onClick={() => {
                  // TODO: Supabase invite-user API call will be wired here.
                  setShowInviteModal(false);
                  setSaveStatus("unsaved");
                }}
              >
                Send invite
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
                defaultValue={row.code}
                className="rounded-lg border border-slate-300 p-2 text-sm"
                placeholder="Code"
                onChange={markUnsaved}
              />
              <input
                defaultValue={row.description}
                className="rounded-lg border border-slate-300 p-2 text-sm"
                placeholder="Description"
                onChange={markUnsaved}
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
        onCancel={() => setSaveStatus("saved")}
        onSave={() => setSaveStatus("saved")}
      >
        {content}
      </SettingsLayout>
    </>
  );
}
