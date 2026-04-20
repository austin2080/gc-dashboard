"use client";

export type WorkspaceCostCode = {
  id: string;
  code: string;
  description: string;
  usedIn: WorkspaceCostCodeUsage;
};

export type WorkspaceCostCodeUsage = {
  generalConditions: boolean;
  prelimEstimate: boolean;
  divisionTitle: boolean;
};

type WorkspaceCostCodeInput = {
  id?: string;
  code: string;
  description: string;
  usedIn?: Partial<WorkspaceCostCodeUsage>;
};

export const WORKSPACE_COST_CODES_STORAGE_KEY = "builderos.settings.company-cost-codes";

export const DEFAULT_WORKSPACE_COST_CODES: Array<{ code: string; description: string }> = [
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

function normalizeCostCodeKey(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function isDefaultDivisionTitle(code: string) {
  const normalized = normalizeCostCodeKey(code);
  if (/^\d{2}$/.test(normalized)) return true;
  return /^\d{8}$/.test(normalized) && normalized.slice(2, 4) === normalized.slice(0, 2) && normalized.slice(4) === "0000";
}

function getDefaultUsage(code: string): WorkspaceCostCodeUsage {
  const normalized = normalizeCostCodeKey(code);
  const divisionTitle = isDefaultDivisionTitle(code);

  return {
    generalConditions: normalized.startsWith("0101") && normalized !== "01010000",
    prelimEstimate: !divisionTitle,
    divisionTitle,
  };
}

function normalizeCostCodeUsage(
  value: Partial<WorkspaceCostCodeUsage> | undefined,
  code: string
): WorkspaceCostCodeUsage {
  const fallback = getDefaultUsage(code);

  if (!value || typeof value !== "object") return fallback;

  return {
    generalConditions:
      typeof value.generalConditions === "boolean"
        ? value.generalConditions
        : fallback.generalConditions,
    prelimEstimate:
      typeof value.prelimEstimate === "boolean" ? value.prelimEstimate : fallback.prelimEstimate,
    divisionTitle:
      typeof value.divisionTitle === "boolean" ? value.divisionTitle : fallback.divisionTitle,
  };
}

function normalizeCostCodeRow(value: unknown, index: number): WorkspaceCostCode | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<WorkspaceCostCode>;
  const code = typeof row.code === "string" ? row.code.trim() : "";
  const description = typeof row.description === "string" ? row.description.trim() : "";
  if (!code) return null;

  return {
    id: typeof row.id === "string" && row.id.trim() ? row.id : `cc-${index + 1}`,
    code,
    description,
    usedIn: normalizeCostCodeUsage(row.usedIn, code),
  };
}

export function getWorkspaceCostCodes(
  fallback: WorkspaceCostCodeInput[] = DEFAULT_WORKSPACE_COST_CODES
): WorkspaceCostCode[] {
  const normalizedFallback = fallback
    .map((row, index) => normalizeCostCodeRow(row, index))
    .filter((row): row is WorkspaceCostCode => Boolean(row));
  if (typeof window === "undefined") return normalizedFallback;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_COST_CODES_STORAGE_KEY);
    if (!raw) return normalizedFallback;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return normalizedFallback;
    const rows = parsed
      .map((row, index) => normalizeCostCodeRow(row, index))
      .filter((row): row is WorkspaceCostCode => Boolean(row));
    return rows.length ? rows : normalizedFallback;
  } catch {
    return normalizedFallback;
  }
}

export function setWorkspaceCostCodes(rows: WorkspaceCostCode[]) {
  if (typeof window === "undefined") return;
  const normalized = rows
    .map((row, index) => normalizeCostCodeRow(row, index))
    .filter((row): row is WorkspaceCostCode => Boolean(row));
  window.localStorage.setItem(WORKSPACE_COST_CODES_STORAGE_KEY, JSON.stringify(normalized));
}
