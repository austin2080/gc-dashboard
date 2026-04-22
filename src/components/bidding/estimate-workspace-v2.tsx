"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent as ReactFormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import { getBidProjectDetail } from "@/lib/bidding/store";
import { getBidProjectIdForProject } from "@/lib/bidding/project-links";
import { getWorkspaceCostCodes } from "@/lib/settings/company-cost-codes";
import {
  PRELIM_COST_CODE_MAPPING_ITEMS,
  getWorkspacePrelimCostCodeMappings,
} from "@/lib/settings/prelim-cost-code-mappings";
import { getWorkspaceTaxRates } from "@/lib/settings/tax-rates";
import {
  ESTIMATE_EXPORT_REQUEST_EVENT,
  writeEstimateExportSnapshot,
  type EstimateExportSnapshot,
  type EstimateExportSnapshotDivision,
} from "@/lib/bidding/estimate-export";

const NAV_ITEMS = [
  "Data, Factors & Rates",
  "General Conditions",
  "Preliminary Estimate Worksheet",
  "Preliminary Estimate Cover Page",
] as const;

type FactorType = "Percent" | "Fixed";
type ProjectPlanningRow = {
  id: string;
  label: string;
  value: string;
};
type SalesTaxRow = {
  id: string;
  city: string;
  number: string;
  taxRate: string;
};
type ProjectDataValueType = "currency" | "percent" | "plain";
type ProjectDataRow = {
  id: string;
  label: string;
  value: string;
  valueType: ProjectDataValueType;
};
type CostSummaryRow = {
  id: string;
  label: string;
  amount: string;
};
type CoverPageField = {
  id: string;
  label: string;
  value: string;
};
type GeneralConditionsRow = {
  id: string;
  costCode: string;
  description: string;
  percentage: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  total: string;
  comments: string;
};
type DisplayedGeneralConditionsRow = GeneralConditionsRow & {
  computedTotal: number | null;
  computedTotalDisplay: string;
  autoCalculated: boolean;
  autoCalculatedComment: string;
};
type RowVisibilityFilter = "all" | "with-values" | "without-values";
type WorksheetCostCode = {
  id: string;
  code: string;
  description: string;
  division: string;
};
type WorksheetLineItem = {
  id: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  gcMarkup: string;
  comments: string;
};
type WorksheetCostCodeGroup = {
  id: string;
  code: string;
  title: string;
  division: string;
  lineItems: WorksheetLineItem[];
};
type ImportedEstimateUnitPrice = {
  costCodeCode: string;
  unitPrice: string;
  subcontractorName: string;
};
type WorksheetLineItemPendingDelete = {
  costCodeId: string;
  lineItemId: string;
  label: string;
};
type WorksheetRenderedCostCodeGroup = WorksheetCostCodeGroup & {
  total: number;
  readOnlyRollup?: boolean;
};
type FilteredWorksheetRenderedCostCodeGroup = WorksheetRenderedCostCodeGroup & {
  filteredLineItems?: WorksheetLineItem[];
  hasVisibleLines?: boolean;
};
type FilteredWorksheetDivisionGroup = {
  division: string;
  divisionCode: string;
  divisionTitle: string;
  sortCode?: string;
  costCodeGroups: FilteredWorksheetRenderedCostCodeGroup[];
  subtotal: number;
};
type SectionKey =
  | "projectInfo"
  | "fees"
  | "projectData"
  | "projectPlanning"
  | "salesTax"
  | "costSummary";

type FactorRow = {
  id: string;
  category: "Insurance" | "Fees" | "Markups" | "Optional Costs";
  factorName: string;
  type: FactorType;
  value: string;
  appliesTo: string;
  notes: string;
};

const INITIAL_ROWS: FactorRow[] = [
  {
    id: "insurance-builder-risk",
    category: "Insurance",
    factorName: "Builder's Risk",
    type: "Percent",
    value: "1.25",
    appliesTo: "Hard Costs",
    notes: "Annualized policy",
  },
  {
    id: "insurance-gl",
    category: "Insurance",
    factorName: "General Liability",
    type: "Percent",
    value: "0.95",
    appliesTo: "Hard Costs",
    notes: "",
  },
  {
    id: "fees-general-liability",
    category: "Fees",
    factorName: "General Liability Insurance",
    type: "Percent",
    value: "9.55",
    appliesTo: "Hard Costs",
    notes: "",
  },
  {
    id: "fees-builders-risk",
    category: "Fees",
    factorName: "Builder's Risk Insurance",
    type: "Percent",
    value: "-",
    appliesTo: "Hard Costs",
    notes: "",
  },
  {
    id: "fees-project-management",
    category: "Fees",
    factorName: "Project Management Software",
    type: "Percent",
    value: "0.211",
    appliesTo: "Hard Costs",
    notes: "",
  },
  {
    id: "fees-sales-commission",
    category: "Fees",
    factorName: "Sales Commission",
    type: "Percent",
    value: "0.000",
    appliesTo: "Hard Costs",
    notes: "",
  },
  {
    id: "fees-warranty",
    category: "Fees",
    factorName: "Warranty Provision",
    type: "Percent",
    value: "0.550",
    appliesTo: "Hard Costs",
    notes: "",
  },
  {
    id: "fees-performance-bond",
    category: "Fees",
    factorName: "Performance Bond",
    type: "Percent",
    value: "0.000",
    appliesTo: "Hard Costs",
    notes: "",
  },
  {
    id: "fees-expeditor",
    category: "Fees",
    factorName: "Expeditor (Nights & Weekends)",
    type: "Percent",
    value: "0.000",
    appliesTo: "Hard Costs",
    notes: "",
  },
  {
    id: "fees-contingency",
    category: "Fees",
    factorName: "Contingency",
    type: "Percent",
    value: "0.000",
    appliesTo: "Hard Costs",
    notes: "",
  },
  {
    id: "fees-overhead",
    category: "Fees",
    factorName: "Overhead",
    type: "Percent",
    value: "4.000",
    appliesTo: "Hard Costs",
    notes: "",
  },
  {
    id: "fees-profit",
    category: "Fees",
    factorName: "Profit",
    type: "Percent",
    value: "3.000",
    appliesTo: "Hard Costs",
    notes: "",
  },
  {
    id: "markups-ohp",
    category: "Markups",
    factorName: "Overhead",
    type: "Percent",
    value: "6.0",
    appliesTo: "Subcontract + Self Perform",
    notes: "",
  },
  {
    id: "markups-profit",
    category: "Markups",
    factorName: "Profit",
    type: "Percent",
    value: "4.5",
    appliesTo: "Subtotal",
    notes: "",
  },
  {
    id: "optional-contingency",
    category: "Optional Costs",
    factorName: "Design Contingency",
    type: "Percent",
    value: "3.0",
    appliesTo: "Hard Costs",
    notes: "Adjust per DD progress",
  },
  {
    id: "optional-escalation",
    category: "Optional Costs",
    factorName: "Material Escalation",
    type: "Percent",
    value: "2.0",
    appliesTo: "Concrete + Steel",
    notes: "",
  },
];

const INITIAL_PROJECT_PLANNING_ROWS: ProjectPlanningRow[] = [
  { id: "pp-project-size", label: "Project Size (SQ FT)", value: "3249" },
  { id: "pp-site-size", label: "Project Site Size (SQ FT)", value: "3249" },
  { id: "pp-start-date", label: "Construction Start Date", value: "2026-03-09" },
  { id: "pp-completion-date", label: "Construction Completion Date", value: "2026-06-05" },
  {
    id: "pp-closeout-date",
    label: "Closeout Completion Date (Plan 1 wks)",
    value: "2026-06-12",
  },
  { id: "pp-construction-duration", label: "Construction Duration (Weeks)", value: "13" },
  {
    id: "pp-project-duration",
    label: "Project Duration (Weeks/Includes Close-out)",
    value: "14",
  },
];

const INITIAL_SALES_TAX_ROWS: SalesTaxRow[] = [
  { id: "tax-avondale", city: "Avondale", number: "14", taxRate: "8.8000" },
  { id: "tax-buckeye", city: "Buckeye", number: "12", taxRate: "9.3000" },
  { id: "tax-cave-creek", city: "Cave Creek", number: "6", taxRate: "9.3000" },
  { id: "tax-chandler", city: "Chandler", number: "11", taxRate: "7.8000" },
  { id: "tax-flagstaff", city: "Flagstaff", number: "4", taxRate: "9.1800" },
  { id: "tax-gilbert", city: "Gilbert", number: "7", taxRate: "8.3000" },
  { id: "tax-glendale", city: "Glendale", number: "8", taxRate: "9.2000" },
  { id: "tax-mesa", city: "Mesa", number: "3", taxRate: "8.3000" },
  { id: "tax-paradise-valley", city: "Paradise Valley", number: "5", taxRate: "8.8000" },
  { id: "tax-peoria", city: "Peoria", number: "10", taxRate: "8.1000" },
  { id: "tax-phoenix", city: "Phoenix", number: "2", taxRate: "8.6000" },
  { id: "tax-scottsdale", city: "Scottsdale", number: "1", taxRate: "8.0500" },
  { id: "tax-surprise", city: "Surprise", number: "13", taxRate: "10.0000" },
  { id: "tax-tempe", city: "Tempe", number: "9", taxRate: "8.1000" },
];

const UNKNOWN_SALES_TAX: SalesTaxRow = {
  id: "tax-unknown",
  city: "Unknown",
  number: "15",
  taxRate: "7.9500",
};

const TI_TAX_ROW: SalesTaxRow = {
  id: "tax-ti",
  city: "TI TAX - Carrying Tax for Trade Materials Only",
  number: "16",
  taxRate: "4.5000",
};

const NOT_TAXABLE_ROW: SalesTaxRow = {
  id: "tax-none",
  city: "Not Taxable",
  number: "17",
  taxRate: "0.0000",
};

const INITIAL_PROJECT_DATA_ROWS: ProjectDataRow[] = [
  {
    id: "project-revenue",
    label: "Project Revenue (Less Tax)",
    value: "570,212.28",
    valueType: "currency",
  },
  {
    id: "raw-construction-costs",
    label: "Raw Construction Costs",
    value: "422,927.60",
    valueType: "currency",
  },
  {
    id: "gross-margin-inc-labor",
    label: "Gross Margin % (Inc Labor)",
    value: "17",
    valueType: "percent",
  },
  {
    id: "gross-profit-inc-labor",
    label: "Gross Profit Calculation Inc Labor",
    value: "95,864.65",
    valueType: "currency",
  },
  {
    id: "net-profit-excl-act",
    label: "Net Profit Calculation Excl Act",
    value: "",
    valueType: "plain",
  },
  {
    id: "labor-bonuses",
    label: "Labor & Bonuses",
    value: "40,085.02",
    valueType: "currency",
  },
  {
    id: "net-profit-percent-excl-act-labor",
    label: "Net Profit % (Excl Act Labor)",
    value: "7",
    valueType: "percent",
  },
  {
    id: "price-per-sqft-less-tax",
    label: "Price per Sq. ft. (Less Tax)",
    value: "175.50",
    valueType: "currency",
  },
  {
    id: "projected-team-bonus-total",
    label: "Projected Team Project Bonus Total",
    value: "",
    valueType: "plain",
  },
  {
    id: "allowance",
    label: "Allowance",
    value: "2,851.06",
    valueType: "currency",
  },
];

const INITIAL_COST_SUMMARY_ROWS: CostSummaryRow[] = [
  { id: "summary-general-conditions", label: "General Conditions", amount: "49,633.08" },
  { id: "summary-supervision", label: "Supervision", amount: "52,928.57" },
  { id: "summary-insurance", label: "Insurance", amount: "5,035.49" },
  { id: "summary-ohp", label: "Overhead & Profit", amount: "37,900.59" },
];

const INITIAL_COVER_PAGE_FIELDS: CoverPageField[] = [
  { id: "cover-attn-name", label: "Attn Name", value: "" },
  { id: "cover-attn-address", label: "Attn Address", value: "" },
  { id: "cover-attn-phone", label: "Attn Phone", value: "" },
  { id: "cover-attn-email", label: "Attn Email", value: "" },
  { id: "cover-project-name", label: "Project Name", value: "" },
  { id: "cover-architect", label: "Architect", value: "" },
  { id: "cover-contractor-company", label: "Contractor Company", value: "" },
  { id: "cover-contractor-name", label: "Contractor Name", value: "" },
  { id: "cover-contractor-address", label: "Contractor Address", value: "" },
  { id: "cover-contractor-city-state-zip", label: "Contractor City State Zip", value: "" },
  { id: "cover-contractor-phone", label: "Contractor Phone", value: "" },
  { id: "cover-contractor-email", label: "Contractor Email", value: "" },
  { id: "cover-bid-set-date", label: "Bid Set Date", value: new Date().toLocaleDateString() },
];

const PROJECT_INFO_GRID_ROWS: Array<{
  leftLabel: string;
  leftFieldId: string;
  rightLabel: string;
  rightFieldId: string;
}> = [
  {
    leftLabel: "Name",
    leftFieldId: "cover-attn-name",
    rightLabel: "Company",
    rightFieldId: "cover-contractor-company",
  },
  {
    leftLabel: "Address",
    leftFieldId: "cover-attn-address",
    rightLabel: "Name",
    rightFieldId: "cover-contractor-name",
  },
  {
    leftLabel: "Phone",
    leftFieldId: "cover-attn-phone",
    rightLabel: "Address",
    rightFieldId: "cover-contractor-address",
  },
  {
    leftLabel: "Email",
    leftFieldId: "cover-attn-email",
    rightLabel: "City, State ZIP",
    rightFieldId: "cover-contractor-city-state-zip",
  },
  {
    leftLabel: "Project Name",
    leftFieldId: "cover-project-name",
    rightLabel: "Phone",
    rightFieldId: "cover-contractor-phone",
  },
  {
    leftLabel: "Architect",
    leftFieldId: "cover-architect",
    rightLabel: "Email",
    rightFieldId: "cover-contractor-email",
  },
  {
    leftLabel: "",
    leftFieldId: "",
    rightLabel: "Bid Set Date",
    rightFieldId: "cover-bid-set-date",
  },
];

const INITIAL_GENERAL_CONDITIONS_ROWS: GeneralConditionsRow[] = [
  {
    id: "gc-010100",
    costCode: "01 01 00",
    description: "General Labor",
    percentage: "15%",
    unit: "wks",
    quantity: "14",
    unitPrice: "1,200.00",
    total: "2,442.86",
    comments: "",
  },
  {
    id: "gc-010200-a",
    costCode: "01 02 00",
    description: "Sr. Project Manager / Project Executive",
    percentage: "0%",
    unit: "wks",
    quantity: "14",
    unitPrice: "4,480.00",
    total: "-",
    comments: "",
  },
  {
    id: "gc-010200-b",
    costCode: "01 02 00",
    description: "Project Manager",
    percentage: "20%",
    unit: "wks",
    quantity: "14",
    unitPrice: "3,000.00",
    total: "8,142.86",
    comments: "",
  },
  {
    id: "gc-010200-c",
    costCode: "",
    description: "Sr. Superintendent / General Superintendent",
    percentage: "0%",
    unit: "wks",
    quantity: "14",
    unitPrice: "3,795.00",
    total: "-",
    comments: "",
  },
  {
    id: "gc-010300-a",
    costCode: "01 03 00",
    description: "Project Superintendent",
    percentage: "100%",
    unit: "wks",
    quantity: "14",
    unitPrice: "3,000.00",
    total: "40,714.29",
    comments: "",
  },
  {
    id: "gc-010300-b",
    costCode: "",
    description: "Assistant Superintendent / Jr Superintendent",
    percentage: "0%",
    unit: "wks",
    quantity: "14",
    unitPrice: "2,600.00",
    total: "-",
    comments: "",
  },
  {
    id: "gc-010400",
    costCode: "01 04 00",
    description: "Project Engineer",
    percentage: "0%",
    unit: "wks",
    quantity: "14",
    unitPrice: "2,400.00",
    total: "-",
    comments: "",
  },
  {
    id: "gc-010500",
    costCode: "01 05 00",
    description: "Project Coordinator",
    percentage: "15%",
    unit: "wks",
    quantity: "14",
    unitPrice: "2,000.00",
    total: "4,071.43",
    comments: "",
  },
  {
    id: "gc-010600",
    costCode: "01 06 00",
    description: "Safety",
    percentage: "0%",
    unit: "wks",
    quantity: "14",
    unitPrice: "4,400.00",
    total: "-",
    comments: "",
  },
  {
    id: "gc-010700",
    costCode: "01 07 00",
    description: "Pre-Construction",
    percentage: "0%",
    unit: "wks",
    quantity: "14",
    unitPrice: "3,680.00",
    total: "-",
    comments: "",
  },
  {
    id: "gc-010800",
    costCode: "01 08 00",
    description: "Cell Phone",
    percentage: "",
    unit: "mon",
    quantity: "0",
    unitPrice: "75.00",
    total: "-",
    comments: "",
  },
  {
    id: "gc-010900",
    costCode: "01 09 00",
    description: "Vehicle Allowance",
    percentage: "",
    unit: "mon",
    quantity: "0",
    unitPrice: "750.00",
    total: "-",
    comments: "",
  },
  {
    id: "gc-011000",
    costCode: "01 10 00",
    description: "Job Photos",
    percentage: "",
    unit: "mon",
    quantity: "0",
    unitPrice: "100.00",
    total: "-",
    comments: "",
  },
  {
    id: "gc-011100",
    costCode: "01 11 00",
    description: "Submittal/s",
    percentage: "",
    unit: "l/s",
    quantity: "1",
    unitPrice: "500.00",
    total: "500.00",
    comments: "",
  },
  {
    id: "gc-011200",
    costCode: "01 12 00",
    description: "Special Procedures & Governmental Requirements",
    percentage: "",
    unit: "l/s",
    quantity: "0",
    unitPrice: "-",
    total: "-",
    comments: "",
  },
  {
    id: "gc-011300",
    costCode: "01 13 00",
    description: "Safety Requirements",
    percentage: "",
    unit: "l/s",
    quantity: "0",
    unitPrice: "-",
    total: "-",
    comments: "",
  },
  {
    id: "gc-011400",
    costCode: "01 14 00",
    description: "Security Procedures",
    percentage: "",
    unit: "l/s",
    quantity: "0",
    unitPrice: "-",
    total: "-",
    comments: "",
  },
  {
    id: "gc-011500",
    costCode: "01 15 00",
    description: "Quality Requirements - Material Testing & Special Inspections",
    percentage: "",
    unit: "l/s",
    quantity: "0",
    unitPrice: "4,000.00",
    total: "-",
    comments: "",
  },
  {
    id: "gc-011600",
    costCode: "01 16 00",
    description: "Temp Facilities & Control(s)",
    percentage: "",
    unit: "mon",
    quantity: "0",
    unitPrice: "-",
    total: "-",
    comments: "",
  },
  {
    id: "gc-011700",
    costCode: "01 17 00",
    description: "Temporary Utilities",
    percentage: "",
    unit: "mon",
    quantity: "0",
    unitPrice: "-",
    total: "-",
    comments: "",
  },
  {
    id: "gc-011800",
    costCode: "01 18 00",
    description: "Temp Light, Power, Generator",
    percentage: "",
    unit: "mon",
    quantity: "1",
    unitPrice: "650.00",
    total: "650.00",
    comments: "",
  },
  {
    id: "gc-011900",
    costCode: "01 19 00",
    description: "Temporary Heating, Cooling, and Ventilating",
    percentage: "",
    unit: "ea",
    quantity: "0",
    unitPrice: "1,497.00",
    total: "-",
    comments: "",
  },
  {
    id: "gc-012000",
    costCode: "01 20 00",
    description: "Temporary Communications",
    percentage: "",
    unit: "mon",
    quantity: "0",
    unitPrice: "-",
    total: "-",
    comments: "",
  },
  {
    id: "gc-012100",
    costCode: "01 21 00",
    description: "Job Fuel",
    percentage: "",
    unit: "mon",
    quantity: "0",
    unitPrice: "-",
    total: "-",
    comments: "",
  },
  {
    id: "gc-012200",
    costCode: "01 2200",
    description: "Trailer Setup and Removal",
    percentage: "",
    unit: "l/s",
    quantity: "0",
    unitPrice: "4,200.00",
    total: "-",
    comments: "",
  },
  {
    id: "gc-012300",
    costCode: "01 23 00",
    description: "Construction Facilities - Field Offices & Sheds",
    percentage: "",
    unit: "mon",
    quantity: "0",
    unitPrice: "2,000.00",
    total: "-",
    comments: "",
  },
  {
    id: "gc-012400",
    costCode: "01 24 00",
    description: "Sanitary Facilities",
    percentage: "",
    unit: "mon",
    quantity: "3",
    unitPrice: "475.00",
    total: "1,425.00",
    comments: "",
  },
  {
    id: "gc-012500",
    costCode: "01 25 00",
    description: "Temporary Construction",
    percentage: "",
    unit: "mon",
    quantity: "0",
    unitPrice: "-",
    total: "-",
    comments: "",
  },
  {
    id: "gc-012600",
    costCode: "01 26 00",
    description: "Construction Equipment",
    percentage: "",
    unit: "mon",
    quantity: "0",
    unitPrice: "1,000.00",
    total: "-",
    comments: "",
  },
  {
    id: "gc-012700",
    costCode: "01 27 00",
    description: "Temporary Lifting & Hoisting Equipment",
    percentage: "",
    unit: "mon",
    quantity: "0",
    unitPrice: "1,492.00",
    total: "-",
    comments: "",
  },
  {
    id: "gc-012800",
    costCode: "01 28 00",
    description: "Scaffold & Temporary Platforms",
    percentage: "",
    unit: "mon",
    quantity: "0",
    unitPrice: "1,500.00",
    total: "-",
    comments: "",
  },
];

const normalizeCostCodeKey = (value: string) => value.replace(/[^0-9]/g, "");

function matchesRowVisibilityFilter(hasValue: boolean, filter: RowVisibilityFilter) {
  if (filter === "with-values") return hasValue;
  if (filter === "without-values") return !hasValue;
  return true;
}

function isStandardDivisionNumber(normalizedCode: string) {
  if (!/^\d{2}$/.test(normalizedCode)) return false;
  const divisionNumber = Number.parseInt(normalizedCode, 10);
  return divisionNumber >= 0 && divisionNumber <= 49;
}

function isDivisionTitleCostCode(code: string) {
  const normalized = normalizeCostCodeKey(code);
  if (isStandardDivisionNumber(normalized)) return true;
  return (
    /^\d{8}$/.test(normalized) &&
    isStandardDivisionNumber(normalized.slice(0, 2)) &&
    normalized.slice(2, 4) === normalized.slice(0, 2) &&
    normalized.slice(4) === "0000"
  );
}

function getDivisionCodeFromCostCode(code: string) {
  return normalizeCostCodeKey(code).slice(0, 2);
}

function buildWorksheetDivisionLabel(divisionCode: string, title: string) {
  const trimmedTitle = title.trim();
  if (!divisionCode) return trimmedTitle || "Other";
  if (!trimmedTitle) return divisionCode;
  return `${divisionCode} ${trimmedTitle}`.trim();
}

function getWorksheetDivisionLabelForCostCode(row: {
  code: string;
  description: string;
  usedIn: { divisionTitle: boolean };
}, divisionTitleByCode: Map<string, string>) {
  const divisionCode = getDivisionCodeFromCostCode(row.code);
  const divisionTitle = row.usedIn.divisionTitle
    ? row.description.trim()
    : divisionTitleByCode.get(divisionCode) ?? row.description.trim();
  return buildWorksheetDivisionLabel(divisionCode, divisionTitle);
}

function mapWorkspaceCostCodesToWorksheetCostCodes(): WorksheetCostCode[] {
  const settingsRows = getWorkspaceCostCodes();
  const divisionTitleByCode = new Map<string, string>();

  for (const row of settingsRows) {
    if (!row.usedIn.divisionTitle && !isDivisionTitleCostCode(row.code)) continue;
    const divisionCode = getDivisionCodeFromCostCode(row.code);
    if (!divisionCode || divisionTitleByCode.has(divisionCode)) continue;
    divisionTitleByCode.set(divisionCode, row.description.trim());
  }

  return settingsRows
    .filter((row) => row.usedIn.prelimEstimate)
    .map((row) => {
      return {
        id: normalizeCostCodeKey(row.code) || row.id,
        code: row.code,
        description: row.description,
        division: getWorksheetDivisionLabelForCostCode(row, divisionTitleByCode),
      } satisfies WorksheetCostCode;
    })
    .sort((left, right) =>
      left.code.localeCompare(right.code, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
}

function getPrelimMarkupFeeRowConfig() {
  const workspaceCostCodes = getWorkspaceCostCodes();
  const mappings = getWorkspacePrelimCostCodeMappings(workspaceCostCodes);
  const costCodeById = new Map(workspaceCostCodes.map((costCode) => [costCode.id, costCode]));
  const mappingByRowId = new Map(mappings.map((mapping) => [mapping.rowId, mapping.costCodeRowId]));

  return PRELIM_COST_CODE_MAPPING_ITEMS.map((item) => {
    const mappedCostCode = costCodeById.get(mappingByRowId.get(item.rowId) ?? "");
    return {
      rowId: item.rowId,
      costCode: mappedCostCode?.code ?? "",
      label: item.label.toUpperCase(),
    };
  });
}

const normalizeCostCodeDescription = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const legacyGeneralConditionsRowsByCode = new Map(
  INITIAL_GENERAL_CONDITIONS_ROWS.filter((row) => row.costCode.trim()).map((row) => [
    normalizeCostCodeKey(row.costCode),
    row,
  ])
);

const legacyGeneralConditionsRowsByDescription = new Map(
  INITIAL_GENERAL_CONDITIONS_ROWS.map((row) => [
    normalizeCostCodeDescription(row.description),
    row,
  ])
);

function createGeneralConditionsRowsFromCostCodes(): GeneralConditionsRow[] {
  return getWorkspaceCostCodes()
    .filter(
      (costCode) => costCode.usedIn.generalConditions && !costCode.usedIn.prelimEstimate
    )
    .map((costCode) => {
      const normalized = normalizeCostCodeKey(costCode.code);
      const sequence = normalized.slice(4);
      const legacyRow =
        legacyGeneralConditionsRowsByDescription.get(normalizeCostCodeDescription(costCode.description)) ??
        legacyGeneralConditionsRowsByCode.get(normalized) ??
        legacyGeneralConditionsRowsByCode.get(`01${sequence.slice(0, 2)}00`) ??
        null;
      return {
        id: `gc-${normalized}`,
        costCode: costCode.code,
        description: costCode.description,
        percentage: legacyRow?.percentage ?? "",
        unit: legacyRow?.unit ?? "l/s",
        quantity:
          legacyRow?.quantity ??
          (isGeneralConditionsFeeTotalRow({
            id: `gc-${normalized}`,
            costCode: costCode.code,
            description: costCode.description,
            percentage: "",
            unit: "l/s",
            quantity: "0",
            unitPrice: "-",
            total: "-",
            comments: "",
          })
            ? "1"
            : "0"),
        unitPrice: legacyRow?.unitPrice ?? "-",
        total: "-",
        comments: legacyRow?.comments ?? "",
      };
    });
}

const formatCurrency = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const parseNumericInput = (value: string) => {
  const parsed = Number.parseFloat(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDerivedNumericInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-") return null;
  const formulaResult = evaluateUnitPriceFormula(trimmed);
  if (formulaResult !== null) return formulaResult;
  const parsed = Number.parseFloat(trimmed.replace(/[$,% ,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const formatToTwoDecimals = (value: string) => {
  const parsed = Number.parseFloat(value.replace(/[$,]/g, "").trim());
  if (!Number.isFinite(parsed)) return "";
  return parsed.toFixed(2);
};

const formatCurrencyDisplayString = (value: string) => {
  const parsed = Number.parseFloat(value.replace(/[$,]/g, "").trim());
  if (!Number.isFinite(parsed)) return "";
  return parsed.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatCurrencyInputWhileTyping = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const negative = trimmed.startsWith("-");
  const sanitized = trimmed.replace(/[$,\s-]/g, "");
  if (!sanitized) return negative ? "-" : "";

  const [rawIntegerPart, rawDecimalPart] = sanitized.split(".");
  const integerDigits = rawIntegerPart.replace(/\D/g, "");
  const decimalDigits = (rawDecimalPart ?? "").replace(/\D/g, "");
  const integerValue = integerDigits || "0";
  const formattedInteger = Number.parseInt(integerValue, 10).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });

  const prefix = negative ? "-" : "";
  if (sanitized.endsWith(".") && rawDecimalPart === "") {
    return `${prefix}${formattedInteger}.`;
  }
  if (rawDecimalPart !== undefined) {
    return `${prefix}${formattedInteger}.${decimalDigits.slice(0, 2)}`;
  }
  return `${prefix}${formattedInteger}`;
};

const evaluateUnitPriceFormula = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("=")) return null;
  const expression = trimmed.slice(1).replace(/,/g, "");
  if (!/^[0-9+\-*/().\s]+$/.test(expression)) return null;
  try {
    const result = Function(`"use strict"; return (${expression});`)();
    return typeof result === "number" && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
};

const normalizeUnitPriceInput = (value: string) => {
  const formulaResult = evaluateUnitPriceFormula(value);
  if (formulaResult !== null) {
    return {
      normalizedValue: formulaResult.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      formula: value.trim(),
    };
  }
  return {
    normalizedValue: formatCurrencyDisplayString(value),
    formula: null,
  };
};

const WORKSHEET_UNIT_OPTIONS = [
  "",
  "excluded",
  "allow",
  "ls",
  "ea",
  "sf",
  "lf",
  "cy",
  "sy",
  "ton",
  "hr",
  "day",
  "wk",
  "mo",
] as const;

const PRELIM_COLUMN_MIN_WIDTHS = [72, 220, 96, 64, 72, 90, 90, 120] as const;
const PRELIM_DEFAULT_COLUMN_WIDTHS = [92, 520, 104, 78, 84, 118, 104, 150] as const;
const BID_PACKAGE_AUTOSAVE_STORAGE_KEY = "bidding-all-new-package-autosave-v1";
const BID_PROJECT_GENERAL_INFO_STORAGE_KEY = "bidding-project-general-info-v1";
const ESTIMATE_FACTOR_ROWS_STORAGE_KEY = "estimateFactorRowsByProject";
const ESTIMATE_GENERAL_CONDITIONS_STORAGE_KEY = "estimateGeneralConditionsRowsByProject";
const ESTIMATE_GENERAL_CONDITIONS_QUANTITY_OVERRIDES_STORAGE_KEY =
  "estimateGeneralConditionsQuantityOverridesByProject";

type BidProjectGeneralInfoCacheRow = {
  projectName: string;
  projectNumber: string;
  clientName: string;
  projectAddress: string;
  projectCity: string;
  projectState: string;
  projectZip: string;
  architect: string;
  bidSetDate: string;
  clientPhone: string;
  clientEmail: string;
  primaryBiddingContact: string;
  projectSizeSqft: string;
  projectSiteSizeSqft: string;
  constructionStartDate: string;
  constructionCompletionDate: string;
  constructionDurationWeeks: string;
  projectDurationWeeks: string;
  taxCityNumber: string;
  taxCityName: string;
  taxRate: string;
};

type ProjectPlanningScheduleSyncSource = "dates" | "construction-duration" | "project-duration";

type CompanyUserOption = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "Active" | "Invited" | "Deactivated";
  company?: string;
  address?: string;
  cityStateZip?: string;
  phone?: string;
};

const createWorksheetLineItem = (seed: string): WorksheetLineItem => ({
  id: `${seed}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString(36)}`,
  description: "",
  unit: "ls",
  quantity: "",
  unitPrice: "",
  gcMarkup: "",
  comments: "",
});

const parsePercentValue = (value: string) => {
  const parsed = Number.parseFloat(value.replace("%", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const calculateGeneralConditionsRowTotal = (row: GeneralConditionsRow) => {
  const quantity = parseDerivedNumericInput(row.quantity);
  const unitPrice = parseDerivedNumericInput(row.unitPrice);
  if (quantity === null || unitPrice === null || quantity <= 0 || unitPrice <= 0) return null;
  const parsedPercent = row.percentage.trim() ? parsePercentValue(row.percentage) : null;
  if (parsedPercent !== null && parsedPercent <= 0) return null;
  const multiplier = parsedPercent === null ? 1 : parsedPercent / 100;
  const total = quantity * unitPrice * multiplier;
  return Number.isFinite(total) && total > 0 ? total : null;
};

const isProjectPlanningCalendarRow = (rowId: string) =>
  rowId === "pp-start-date" || rowId === "pp-completion-date" || rowId === "pp-closeout-date";

const addDaysToIsoDate = (isoDate: string, days: number) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [year, month, day] = isoDate.split("-").map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return null;
  const nextDate = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(nextDate.getTime())) return null;
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  const nextYear = nextDate.getUTCFullYear();
  const nextMonth = String(nextDate.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(nextDate.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
};

const normalizeContactName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");
const ESTIMATE_UNIT_PRICE_IMPORTS_STORAGE_KEY = "estimateUnitPriceImportsByProject";
const ESTIMATE_WORKSHEET_COST_CODE_GROUPS_STORAGE_KEY =
  "estimateWorksheetCostCodeGroupsByProject";

function normalizeCostCodeCode(value: string) {
  return value.replace(/\D/g, "");
}

function readEstimateUnitPriceImportsMap(): Record<string, ImportedEstimateUnitPrice[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ESTIMATE_UNIT_PRICE_IMPORTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const next: Record<string, ImportedEstimateUnitPrice[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue;
      next[key] = value.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Partial<ImportedEstimateUnitPrice>;
        if (
          typeof row.costCodeCode !== "string" ||
          typeof row.unitPrice !== "string" ||
          typeof row.subcontractorName !== "string"
        ) {
          return [];
        }
        return [
          {
            costCodeCode: row.costCodeCode,
            unitPrice: row.unitPrice,
            subcontractorName: row.subcontractorName,
          },
        ];
      });
    }
    return next;
  } catch {
    return {};
  }
}

function isWorksheetLineItem(value: unknown): value is WorksheetLineItem {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<WorksheetLineItem>;
  return (
    typeof row.id === "string" &&
    typeof row.description === "string" &&
    typeof row.unit === "string" &&
    typeof row.quantity === "string" &&
    typeof row.unitPrice === "string" &&
    typeof row.gcMarkup === "string" &&
    typeof row.comments === "string"
  );
}

function isWorksheetCostCodeGroup(value: unknown): value is WorksheetCostCodeGroup {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<WorksheetCostCodeGroup>;
  return (
    typeof row.id === "string" &&
    typeof row.code === "string" &&
    typeof row.title === "string" &&
    typeof row.division === "string" &&
    Array.isArray(row.lineItems) &&
    row.lineItems.every((lineItem) => isWorksheetLineItem(lineItem))
  );
}

function readEstimateWorksheetCostCodeGroupsMap(): Record<string, WorksheetCostCodeGroup[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ESTIMATE_WORKSHEET_COST_CODE_GROUPS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const next: Record<string, WorksheetCostCodeGroup[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue;
      next[key] = value.filter((item): item is WorksheetCostCodeGroup =>
        isWorksheetCostCodeGroup(item)
      );
    }
    return next;
  } catch {
    return {};
  }
}

function isFactorRow(value: unknown): value is FactorRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<FactorRow>;
  return (
    typeof row.id === "string" &&
    (row.category === "Insurance" ||
      row.category === "Fees" ||
      row.category === "Markups" ||
      row.category === "Optional Costs") &&
    (row.type === "Percent" || row.type === "Fixed") &&
    typeof row.factorName === "string" &&
    typeof row.value === "string" &&
    typeof row.appliesTo === "string" &&
    typeof row.notes === "string"
  );
}

function readEstimateFactorRowsMap(): Record<string, FactorRow[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ESTIMATE_FACTOR_ROWS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const next: Record<string, FactorRow[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue;
      next[key] = value.filter(isFactorRow);
    }
    return next;
  } catch {
    return {};
  }
}

function writeEstimateFactorRows(projectIds: string[], rows: FactorRow[]) {
  if (typeof window === "undefined" || projectIds.length === 0) return;
  const current = readEstimateFactorRowsMap();
  for (const projectId of projectIds) {
    current[projectId] = rows;
  }
  localStorage.setItem(ESTIMATE_FACTOR_ROWS_STORAGE_KEY, JSON.stringify(current));
}

function mergeFactorRows(baseRows: FactorRow[], savedRows: FactorRow[]) {
  const savedById = new Map(savedRows.map((row) => [row.id, row]));
  return baseRows.map((baseRow) => {
    const savedRow = savedById.get(baseRow.id);
    return savedRow ? { ...baseRow, ...savedRow, id: baseRow.id } : baseRow;
  });
}

function writeEstimateWorksheetCostCodeGroups(
  projectIds: string[],
  groups: WorksheetCostCodeGroup[]
) {
  if (typeof window === "undefined" || projectIds.length === 0) return;
  const current = readEstimateWorksheetCostCodeGroupsMap();
  projectIds.forEach((projectId) => {
    const existingGroups = current[projectId] ?? [];
    const nextByCode = new Map(
      existingGroups.map((group) => [normalizeCostCodeKey(group.code), group])
    );

    for (const group of groups) {
      nextByCode.set(normalizeCostCodeKey(group.code), group);
    }

    current[projectId] = Array.from(nextByCode.values());
  });
  localStorage.setItem(
    ESTIMATE_WORKSHEET_COST_CODE_GROUPS_STORAGE_KEY,
    JSON.stringify(current)
  );
}

function mergeWorksheetCostCodeGroups(
  baseGroups: WorksheetCostCodeGroup[],
  savedGroups: WorksheetCostCodeGroup[]
) {
  const savedById = new Map(savedGroups.map((group) => [group.id, group]));
  const savedByCode = new Map(
    savedGroups.map((group) => [normalizeCostCodeKey(group.code), group])
  );
  return baseGroups.map((group) => {
    const saved =
      savedByCode.get(normalizeCostCodeKey(group.code)) ?? savedById.get(group.id);
    if (!saved) return group;
    return {
      ...group,
      title: saved.title || group.title,
      lineItems: saved.lineItems.length > 0 ? saved.lineItems : group.lineItems,
    };
  });
}

function readBidProjectGeneralInfoMap(): Record<string, BidProjectGeneralInfoCacheRow> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(BID_PROJECT_GENERAL_INFO_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const next: Record<string, BidProjectGeneralInfoCacheRow> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const row = value as Partial<BidProjectGeneralInfoCacheRow>;
      next[key] = {
        projectName: typeof row.projectName === "string" ? row.projectName : "",
        projectNumber: typeof row.projectNumber === "string" ? row.projectNumber : "",
        clientName: typeof row.clientName === "string" ? row.clientName : "",
        projectAddress: typeof row.projectAddress === "string" ? row.projectAddress : "",
        projectCity: typeof row.projectCity === "string" ? row.projectCity : "",
        projectState: typeof row.projectState === "string" ? row.projectState : "",
        projectZip: typeof row.projectZip === "string" ? row.projectZip : "",
        architect: typeof row.architect === "string" ? row.architect : "",
        bidSetDate: typeof row.bidSetDate === "string" ? row.bidSetDate : "",
        clientPhone: typeof row.clientPhone === "string" ? row.clientPhone : "",
        clientEmail: typeof row.clientEmail === "string" ? row.clientEmail : "",
        primaryBiddingContact:
          typeof row.primaryBiddingContact === "string" ? row.primaryBiddingContact : "",
        projectSizeSqft: typeof row.projectSizeSqft === "string" ? row.projectSizeSqft : "",
        projectSiteSizeSqft:
          typeof row.projectSiteSizeSqft === "string" ? row.projectSiteSizeSqft : "",
        constructionStartDate:
          typeof row.constructionStartDate === "string" ? row.constructionStartDate : "",
        constructionCompletionDate:
          typeof row.constructionCompletionDate === "string" ? row.constructionCompletionDate : "",
        constructionDurationWeeks:
          typeof row.constructionDurationWeeks === "string" ? row.constructionDurationWeeks : "",
        projectDurationWeeks:
          typeof row.projectDurationWeeks === "string" ? row.projectDurationWeeks : "",
        taxCityNumber: typeof row.taxCityNumber === "string" ? row.taxCityNumber : "",
        taxCityName: typeof row.taxCityName === "string" ? row.taxCityName : "",
        taxRate: typeof row.taxRate === "string" ? row.taxRate : "",
      };
    }
    return next;
  } catch {
    return {};
  }
}

function writeBidProjectGeneralInfoMap(map: Record<string, BidProjectGeneralInfoCacheRow>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BID_PROJECT_GENERAL_INFO_STORAGE_KEY, JSON.stringify(map));
}

function getBidPackageAutosaveStorageKey(projectId?: string | null): string {
  return projectId
    ? `${BID_PACKAGE_AUTOSAVE_STORAGE_KEY}:${projectId}`
    : BID_PACKAGE_AUTOSAVE_STORAGE_KEY;
}

function updateBidPackageAutosaveSchedule(
  projectId: string,
  schedule: {
    constructionStartDate: string;
    constructionCompletionDate: string;
    closeoutCompletionDate: string;
    constructionDurationWeeks: string;
    projectDurationWeeks: string;
  }
) {
  if (typeof window === "undefined") return;
  try {
    const storageKey = getBidPackageAutosaveStorageKey(projectId);
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return;
    const payload = parsed as { draft?: unknown };
    if (!payload.draft || typeof payload.draft !== "object") return;
    payload.draft = {
      ...payload.draft,
      construction_start_date: schedule.constructionStartDate,
      construction_completion_date: schedule.constructionCompletionDate,
      closeout_completion_date: schedule.closeoutCompletionDate,
      construction_duration_weeks: schedule.constructionDurationWeeks,
      project_duration_weeks: schedule.projectDurationWeeks,
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // Ignore malformed autosave payloads.
  }
}

function isGeneralConditionsRow(value: unknown): value is GeneralConditionsRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<GeneralConditionsRow>;
  return (
    typeof row.id === "string" &&
    typeof row.costCode === "string" &&
    typeof row.description === "string" &&
    typeof row.percentage === "string" &&
    typeof row.unit === "string" &&
    typeof row.quantity === "string" &&
    typeof row.unitPrice === "string" &&
    typeof row.total === "string" &&
    typeof row.comments === "string"
  );
}

function readEstimateGeneralConditionsRowsMap(): Record<string, GeneralConditionsRow[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ESTIMATE_GENERAL_CONDITIONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const next: Record<string, GeneralConditionsRow[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue;
      next[key] = value.filter(isGeneralConditionsRow);
    }
    return next;
  } catch {
    return {};
  }
}

function writeEstimateGeneralConditionsRows(
  projectIds: string[],
  rows: GeneralConditionsRow[]
) {
  if (typeof window === "undefined" || projectIds.length === 0) return;
  const current = readEstimateGeneralConditionsRowsMap();
  for (const projectId of projectIds) {
    current[projectId] = rows;
  }
  localStorage.setItem(ESTIMATE_GENERAL_CONDITIONS_STORAGE_KEY, JSON.stringify(current));
}

function readEstimateGeneralConditionsQuantityOverridesMap(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ESTIMATE_GENERAL_CONDITIONS_QUANTITY_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const next: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue;
      next[key] = value.filter((rowId): rowId is string => typeof rowId === "string");
    }
    return next;
  } catch {
    return {};
  }
}

function writeEstimateGeneralConditionsQuantityOverrides(
  projectIds: string[],
  rowIds: Set<string>
) {
  if (typeof window === "undefined" || projectIds.length === 0) return;
  const current = readEstimateGeneralConditionsQuantityOverridesMap();
  const rowIdList = Array.from(rowIds);
  for (const projectId of projectIds) {
    current[projectId] = rowIdList;
  }
  localStorage.setItem(
    ESTIMATE_GENERAL_CONDITIONS_QUANTITY_OVERRIDES_STORAGE_KEY,
    JSON.stringify(current)
  );
}

function mergeGeneralConditionsRows(
  baseRows: GeneralConditionsRow[],
  savedRows: GeneralConditionsRow[]
) {
  const savedById = new Map(savedRows.map((row) => [row.id, row]));
  const savedByCodeAndDescription = new Map(
    savedRows.map((row) => [
      `${normalizeCostCodeKey(row.costCode)}:${normalizeCostCodeDescription(row.description)}`,
      row,
    ])
  );
  const savedByDescription = new Map(
    savedRows.map((row) => [normalizeCostCodeDescription(row.description), row])
  );

  return baseRows.map((baseRow) => {
    const savedRow =
      savedById.get(baseRow.id) ??
      savedByCodeAndDescription.get(
        `${normalizeCostCodeKey(baseRow.costCode)}:${normalizeCostCodeDescription(baseRow.description)}`
      ) ??
      savedByDescription.get(normalizeCostCodeDescription(baseRow.description)) ??
      null;
    return savedRow ? { ...baseRow, ...savedRow, id: baseRow.id } : baseRow;
  });
}

const GC_WEEKS_SYNC_ROW_IDS = new Set([
  "gc-010100",
  "gc-010200-a",
  "gc-010200-b",
  "gc-010200-c",
  "gc-010300-a",
  "gc-010300-b",
  "gc-010400",
  "gc-010500",
  "gc-010600",
  "gc-010700",
]);

const isWeeksUnit = (unit: string) => {
  const normalized = unit.trim().toLowerCase();
  return normalized === "wks" || normalized === "wk" || normalized === "weeks" || normalized === "week";
};

const isExcludedWorksheetUnit = (unit: string) => unit.trim().toLowerCase() === "excluded";

const shouldSyncGeneralConditionsWeeks = (row: GeneralConditionsRow) =>
  isWeeksUnit(row.unit) || GC_WEEKS_SYNC_ROW_IDS.has(row.id);

const getGeneralConditionsFeeRowId = (row: GeneralConditionsRow) => {
  const normalizedDescription = normalizeCostCodeDescription(row.description);
  if (normalizedDescription === "warranties" || normalizedDescription === "warrantyprovision") {
    return "fees-warranty";
  }
  if (normalizedDescription === "projectmanagementsoftware") {
    return "fees-project-management";
  }
  return null;
};

const isGeneralConditionsFeeTotalRow = (row: GeneralConditionsRow) =>
  getGeneralConditionsFeeRowId(row) !== null;

const calculateDurationWeeks = (startIsoDate: string, endIsoDate: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startIsoDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endIsoDate)) {
    return null;
  }
  const [startYear, startMonth, startDay] = startIsoDate
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  const [endYear, endMonth, endDay] = endIsoDate
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) return null;
  const startDate = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));
  const diffMs = endDate.getTime() - startDate.getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return null;
  const days = diffMs / (1000 * 60 * 60 * 24);
  return Math.ceil(days / 7);
};

const sanitizeWholeNumberInput = (value: string) => value.replace(/\D/g, "");

const resolveSelectedSalesTaxRow = (
  cityNumber: string,
  salesTaxRows: SalesTaxRow[],
  unknownSalesTax: SalesTaxRow,
  tiTax: SalesTaxRow,
  notTaxable: SalesTaxRow
) => {
  const normalizedCityNumber = cityNumber.trim();
  if (!normalizedCityNumber) return null;
  if (normalizedCityNumber === unknownSalesTax.number) return unknownSalesTax;
  if (normalizedCityNumber === tiTax.number) return tiTax;
  if (normalizedCityNumber === notTaxable.number) return notTaxable;
  return salesTaxRows.find((row) => row.number === normalizedCityNumber) ?? null;
};

export default function EstimateWorkspaceV2() {
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("project");
  const [selectedItem, setSelectedItem] = useState<string>(NAV_ITEMS[0]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [rows, setRows] = useState<FactorRow[]>(INITIAL_ROWS);
  const [projectPlanningRows, setProjectPlanningRows] = useState<ProjectPlanningRow[]>(
    INITIAL_PROJECT_PLANNING_ROWS
  );
  const [salesTaxRows, setSalesTaxRows] = useState<SalesTaxRow[]>(INITIAL_SALES_TAX_ROWS);
  const [unknownSalesTax, setUnknownSalesTax] = useState<SalesTaxRow>(UNKNOWN_SALES_TAX);
  const [tiTax, setTiTax] = useState<SalesTaxRow>(TI_TAX_ROW);
  const [notTaxable] = useState<SalesTaxRow>(NOT_TAXABLE_ROW);
  const [selectedCityNumber, setSelectedCityNumber] = useState<string>("17");
  const [projectDataRows, setProjectDataRows] = useState<ProjectDataRow[]>(
    INITIAL_PROJECT_DATA_ROWS
  );
  const [costSummaryRows, setCostSummaryRows] = useState<CostSummaryRow[]>(
    INITIAL_COST_SUMMARY_ROWS
  );
  const [coverPageFields, setCoverPageFields] = useState<CoverPageField[]>(
    INITIAL_COVER_PAGE_FIELDS
  );
  const [costSummaryPercent, setCostSummaryPercent] = useState<string>("28");
  const [generalConditionsRows, setGeneralConditionsRows] = useState<GeneralConditionsRow[]>(
    () => createGeneralConditionsRowsFromCostCodes()
  );
  const [worksheetCostCodeGroups, setWorksheetCostCodeGroups] = useState<WorksheetCostCodeGroup[]>(
    []
  );
  const [worksheetUnitPriceFormulas, setWorksheetUnitPriceFormulas] = useState<
    Record<string, string>
  >({});
  const [activeWorksheetUnitPriceCell, setActiveWorksheetUnitPriceCell] = useState<string | null>(
    null
  );
  const worksheetHydratedRef = useRef(false);
  const generalConditionsHydratedRef = useRef(false);
  const generalConditionsQuantityOverrideIdsRef = useRef<Set<string>>(new Set());
  const skipNextGeneralConditionsSaveRef = useRef(false);
  const [prelimColumnWidths, setPrelimColumnWidths] = useState<number[]>([
    ...PRELIM_DEFAULT_COLUMN_WIDTHS,
  ]);
  const [expandedWorksheetDivisionKeys, setExpandedWorksheetDivisionKeys] = useState<
    Record<string, boolean>
  >({});
  const [expandedWorksheetCostCodeIds, setExpandedWorksheetCostCodeIds] = useState<
    Record<string, boolean>
  >({});
  const [worksheetLoading, setWorksheetLoading] = useState<boolean>(false);
  const [worksheetError, setWorksheetError] = useState<string | null>(null);
  const [worksheetGcMarkupMessage, setWorksheetGcMarkupMessage] = useState<string | null>(null);
  const [worksheetLineItemPendingDelete, setWorksheetLineItemPendingDelete] =
    useState<WorksheetLineItemPendingDelete | null>(null);
  const [generalConditionsRowVisibilityFilter, setGeneralConditionsRowVisibilityFilter] =
    useState<RowVisibilityFilter>("all");
  const [prelimWorksheetRowVisibilityFilter, setPrelimWorksheetRowVisibilityFilter] =
    useState<RowVisibilityFilter>("all");
  const [coverRowVisibilityFilter, setCoverRowVisibilityFilter] =
    useState<RowVisibilityFilter>("all");
  const prelimResizeRef = useRef<{
    columnIndex: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    projectInfo: true,
    fees: true,
    projectData: true,
    projectPlanning: true,
    salesTax: true,
    costSummary: true,
  });
  const projectPlanningScheduleSyncSourceRef =
    useRef<ProjectPlanningScheduleSyncSource | null>(null);
  const feeRows = useMemo(() => rows.filter((row) => row.category === "Fees"), [rows]);
  const startDateValue =
    projectPlanningRows.find((row) => row.id === "pp-start-date")?.value ?? "";
  const completionDateValue =
    projectPlanningRows.find((row) => row.id === "pp-completion-date")?.value ?? "";
  const closeoutDateValue =
    projectPlanningRows.find((row) => row.id === "pp-closeout-date")?.value ?? "";
  const constructionDurationWeeksValue =
    projectPlanningRows.find((row) => row.id === "pp-construction-duration")?.value ?? "";
  const projectDurationWeeksValue =
    projectPlanningRows.find((row) => row.id === "pp-project-duration")?.value ?? "";
  const estimateProjectStorageIds = useMemo(() => {
    const mappedBidProjectId = getBidProjectIdForProject(queryProjectId ?? "");
    return [mappedBidProjectId, queryProjectId].filter(
      (id, index, list): id is string => Boolean(id) && list.indexOf(id) === index
    );
  }, [queryProjectId]);
  const prelimMarkupFeeRowConfig = useMemo(() => getPrelimMarkupFeeRowConfig(), []);

  useEffect(() => {
    const workspaceTaxRates = getWorkspaceTaxRates();
    if (!workspaceTaxRates.length) return;

    setSalesTaxRows((prev) => {
      let changed = false;
      const nextRows = prev.map((row) => {
        const workspaceMatch = workspaceTaxRates.find((rate) => rate.id === row.id);
        if (!workspaceMatch || workspaceMatch.rate === row.taxRate) return row;
        changed = true;
        return { ...row, taxRate: workspaceMatch.rate };
      });
      return changed ? nextRows : prev;
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadWorksheetCostCodes = async () => {
      setWorksheetLoading(true);
      setWorksheetError(null);
      try {
        const settingsCostCodes = mapWorkspaceCostCodesToWorksheetCostCodes();
        const worksheetCostCodes =
          settingsCostCodes.length > 0
            ? settingsCostCodes
            : await (async () => {
                const response = await fetch("/api/cost-codes", { cache: "no-store" });
                const payload = (await response.json()) as {
                  costCodes?: WorksheetCostCode[];
                  error?: string;
                };

                if (!response.ok) {
                  throw new Error(payload.error ?? "Unable to load cost codes.");
                }

                return payload.costCodes ?? [];
              })();

        const groupsFromCodes = worksheetCostCodes.map((costCode) => ({
          id: costCode.id,
          code: costCode.code ?? "",
          title: costCode.description ?? "",
          division: costCode.division ?? "Other",
          lineItems: [
            {
              id: `${costCode.id}-line-1`,
              description: costCode.description ?? "",
              unit: "ls",
              quantity: "",
              unitPrice: "",
              gcMarkup: "",
              comments: "",
            },
          ],
        }));
        const importProjectKey = getBidProjectIdForProject(queryProjectId ?? "") ?? queryProjectId ?? "";
        const importsByProject = readEstimateUnitPriceImportsMap();
        const importedRows = importProjectKey ? importsByProject[importProjectKey] ?? [] : [];
        const importedByCode = new Map(
          importedRows.map((row) => [normalizeCostCodeCode(row.costCodeCode), row])
        );
        const hydratedGroups = groupsFromCodes.map((group) => {
          const imported = importedByCode.get(normalizeCostCodeCode(group.code));
          if (!imported) return group;
          return {
            ...group,
            lineItems: group.lineItems.map((line, index) =>
              index === 0
                ? {
                    ...line,
                    unitPrice: imported.unitPrice,
                  }
                : line
            ),
          };
        });
        const savedWorksheetGroupsMap = readEstimateWorksheetCostCodeGroupsMap();
        const savedWorksheetGroups =
          estimateProjectStorageIds
            .map((projectId) => savedWorksheetGroupsMap[projectId] ?? [])
            .find((groups) => groups.length > 0) ?? [];
        const mergedGroups = mergeWorksheetCostCodeGroups(
          hydratedGroups,
          savedWorksheetGroups
        );

        if (isMounted) {
          setWorksheetCostCodeGroups(mergedGroups);
          setExpandedWorksheetDivisionKeys(
            mergedGroups.reduce<Record<string, boolean>>((acc, group) => {
              const divisionKey = group.division?.trim() || "Other";
              if (acc[divisionKey] === undefined) {
                acc[divisionKey] = true;
              }
              return acc;
            }, {})
          );
          setExpandedWorksheetCostCodeIds(
            mergedGroups.reduce<Record<string, boolean>>((acc, group) => {
              acc[group.id] = true;
              return acc;
            }, {})
          );
          worksheetHydratedRef.current = true;
        }
      } catch (error) {
        if (isMounted) {
          setWorksheetError(
            error instanceof Error ? error.message : "Unable to load cost codes."
          );
        }
      } finally {
        if (isMounted) {
          setWorksheetLoading(false);
        }
      }
    };

    loadWorksheetCostCodes();
    return () => {
      isMounted = false;
    };
  }, []);
  useEffect(() => {
    if (!worksheetHydratedRef.current || estimateProjectStorageIds.length === 0) return;
    writeEstimateWorksheetCostCodeGroups(
      estimateProjectStorageIds,
      worksheetCostCodeGroups
    );
  }, [estimateProjectStorageIds, worksheetCostCodeGroups]);
  useEffect(() => {
    const savedRowsMap = readEstimateFactorRowsMap();
    const savedRows =
      estimateProjectStorageIds
        .map((projectId) => savedRowsMap[projectId])
        .find((rowsForProject) => rowsForProject && rowsForProject.length > 0) ?? [];
    if (savedRows.length === 0) {
      setRows(INITIAL_ROWS);
      return;
    }
    setRows(mergeFactorRows(INITIAL_ROWS, savedRows));
  }, [estimateProjectStorageIds]);
  useEffect(() => {
    if (estimateProjectStorageIds.length === 0) return;
    writeEstimateFactorRows(estimateProjectStorageIds, rows);
  }, [estimateProjectStorageIds, rows]);
  useEffect(() => {
    if (!queryProjectId) return;
    const queryProjectIdValue: string = queryProjectId;
    let active = true;
    async function hydrateCoverPageFromBidProject() {
      const mappedBidProjectId = getBidProjectIdForProject(queryProjectIdValue);
      const candidates = [mappedBidProjectId, queryProjectIdValue].filter(
        (id, index, list): id is string => Boolean(id) && list.indexOf(id) === index
      );
      let detail: Awaited<ReturnType<typeof getBidProjectDetail>> = null;
      let resolvedProjectId: string = queryProjectIdValue;
      for (const candidate of candidates) {
        detail = await getBidProjectDetail(candidate);
        if (detail) {
          resolvedProjectId = candidate;
          break;
        }
      }
      if (!active) return;
      const generalInfoMap = readBidProjectGeneralInfoMap();
      const cachedInfo =
        generalInfoMap[resolvedProjectId] ?? generalInfoMap[queryProjectIdValue];
      if (cachedInfo?.taxCityNumber) {
        const cachedTaxCityNumber = cachedInfo.taxCityNumber.trim();
        const matchingTaxRow = salesTaxRows.find((row) => row.id === cachedTaxCityNumber);

        if (matchingTaxRow) {
          setSelectedCityNumber(matchingTaxRow.number);
          if (cachedInfo.taxRate.trim()) {
            setSalesTaxRows((prev) =>
              prev.map((row) =>
                row.id === matchingTaxRow.id
                  ? { ...row, taxRate: cachedInfo.taxRate.trim() }
                  : row
              )
            );
          }
        } else {
          setSelectedCityNumber(UNKNOWN_SALES_TAX.number);
          setUnknownSalesTax((prev) => ({
            ...prev,
            city: cachedInfo.taxCityName.trim() || prev.city,
            taxRate: cachedInfo.taxRate.trim() || prev.taxRate,
          }));
        }
      }
      let selectedPrimaryUser: CompanyUserOption | null = null;
      if (cachedInfo?.primaryBiddingContact) {
        try {
          const usersResponse = await fetch("/api/settings/team-users", { cache: "no-store" });
          const usersPayload = (await usersResponse.json().catch(() => null)) as
            | { users?: CompanyUserOption[] }
            | null;
          const activeUsers = Array.isArray(usersPayload?.users)
            ? usersPayload.users.filter((user) => user.status === "Active")
            : [];
          const normalizedCached = normalizeContactName(cachedInfo.primaryBiddingContact);
          selectedPrimaryUser =
            activeUsers.find(
              (user) => normalizeContactName(user.name) === normalizedCached
            ) ?? null;
        } catch {
          selectedPrimaryUser = null;
        }
      }
      setCoverPageFields((prev) =>
        prev.map((field) => {
          if (field.id === "cover-project-name") {
            return {
              ...field,
              value:
                detail?.project.project_name ??
                cachedInfo?.projectName ??
                field.value,
            };
          }
          if (field.id === "cover-attn-name") {
            return {
              ...field,
              value: detail?.project.owner ?? cachedInfo?.clientName ?? field.value,
            };
          }
          if (field.id === "cover-attn-address") {
            return {
              ...field,
              value:
                detail?.project.location ??
                cachedInfo?.projectAddress ??
                field.value,
            };
          }
          if (field.id === "cover-attn-phone") {
            return { ...field, value: cachedInfo?.clientPhone ?? field.value };
          }
          if (field.id === "cover-attn-email") {
            return { ...field, value: cachedInfo?.clientEmail ?? field.value };
          }
          if (field.id === "cover-architect") {
            return { ...field, value: cachedInfo?.architect ?? field.value };
          }
          if (field.id === "cover-bid-set-date") {
            return { ...field, value: cachedInfo?.bidSetDate ?? field.value };
          }
          if (field.id === "cover-contractor-company") {
            return {
              ...field,
              value: selectedPrimaryUser?.company || field.value,
            };
          }
          if (field.id === "cover-contractor-name") {
            return {
              ...field,
              value: selectedPrimaryUser?.name || field.value,
            };
          }
          if (field.id === "cover-contractor-address") {
            return {
              ...field,
              value: selectedPrimaryUser?.address || field.value,
            };
          }
          if (field.id === "cover-contractor-city-state-zip") {
            return {
              ...field,
              value: selectedPrimaryUser?.cityStateZip || field.value,
            };
          }
          if (field.id === "cover-contractor-phone") {
            return {
              ...field,
              value: selectedPrimaryUser?.phone || field.value,
            };
          }
          if (field.id === "cover-contractor-email") {
            return {
              ...field,
              value: selectedPrimaryUser?.email || field.value,
            };
          }
          return field;
        })
      );
      setProjectPlanningRows((prev) =>
        prev.map((row) => {
          if (row.id === "pp-project-size") {
            return { ...row, value: cachedInfo?.projectSizeSqft ?? row.value };
          }
          if (row.id === "pp-site-size") {
            return { ...row, value: cachedInfo?.projectSiteSizeSqft ?? row.value };
          }
          if (row.id === "pp-start-date") {
            return { ...row, value: cachedInfo?.constructionStartDate ?? row.value };
          }
          if (row.id === "pp-completion-date") {
            return { ...row, value: cachedInfo?.constructionCompletionDate ?? row.value };
          }
          if (row.id === "pp-construction-duration") {
            return { ...row, value: cachedInfo?.constructionDurationWeeks ?? row.value };
          }
          if (row.id === "pp-project-duration") {
            return { ...row, value: cachedInfo?.projectDurationWeeks ?? row.value };
          }
          return row;
        })
      );
    }
    void hydrateCoverPageFromBidProject();
    return () => {
      active = false;
    };
  }, [queryProjectId, salesTaxRows]);
  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const active = prelimResizeRef.current;
      if (!active) return;
      const delta = event.clientX - active.startX;
      const nextWidth = Math.max(
        PRELIM_COLUMN_MIN_WIDTHS[active.columnIndex] ?? 64,
        active.startWidth + delta
      );
      setPrelimColumnWidths((prev) =>
        prev.map((width, idx) => (idx === active.columnIndex ? nextWidth : width))
      );
    };
    const onMouseUp = () => {
      prelimResizeRef.current = null;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);
  useEffect(() => {
    if (projectPlanningScheduleSyncSourceRef.current === "construction-duration") {
      const nextConstructionDuration = sanitizeWholeNumberInput(
        constructionDurationWeeksValue
      ).trim();
      const durationWeeks = Number.parseInt(nextConstructionDuration, 10);
      const nextCompletionDate =
        startDateValue && Number.isFinite(durationWeeks) && durationWeeks >= 0
          ? addDaysToIsoDate(startDateValue, durationWeeks * 7) ?? ""
          : "";
      const nextCloseoutDate = addDaysToIsoDate(nextCompletionDate, 7) ?? "";
      const nextProjectDuration = nextCloseoutDate
        ? calculateDurationWeeks(startDateValue, nextCloseoutDate)
        : null;
      const nextProjectDurationValue =
        nextProjectDuration === null ? "" : String(nextProjectDuration);

      setProjectPlanningRows((prev) => {
        let changed = false;
        const nextRows = prev.map((row) => {
          let nextValue = row.value;
          if (row.id === "pp-construction-duration") nextValue = nextConstructionDuration;
          if (row.id === "pp-completion-date") nextValue = nextCompletionDate;
          if (row.id === "pp-closeout-date") nextValue = nextCloseoutDate;
          if (row.id === "pp-project-duration") nextValue = nextProjectDurationValue;
          if (nextValue === row.value) return row;
          changed = true;
          return { ...row, value: nextValue };
        });
        return changed ? nextRows : prev;
      });
      return;
    }

    if (projectPlanningScheduleSyncSourceRef.current === "project-duration") {
      const nextProjectDuration = sanitizeWholeNumberInput(projectDurationWeeksValue).trim();
      const projectDurationWeeks = Number.parseInt(nextProjectDuration, 10);
      const nextCloseoutDate =
        startDateValue && Number.isFinite(projectDurationWeeks) && projectDurationWeeks >= 0
          ? addDaysToIsoDate(startDateValue, projectDurationWeeks * 7) ?? ""
          : "";
      const nextCompletionDate = addDaysToIsoDate(nextCloseoutDate, -7) ?? "";
      const nextConstructionDuration = calculateDurationWeeks(startDateValue, nextCompletionDate);
      const nextConstructionDurationValue =
        nextConstructionDuration === null ? "" : String(nextConstructionDuration);

      setProjectPlanningRows((prev) => {
        let changed = false;
        const nextRows = prev.map((row) => {
          let nextValue = row.value;
          if (row.id === "pp-project-duration") nextValue = nextProjectDuration;
          if (row.id === "pp-completion-date") nextValue = nextCompletionDate;
          if (row.id === "pp-closeout-date") nextValue = nextCloseoutDate;
          if (row.id === "pp-construction-duration") nextValue = nextConstructionDurationValue;
          if (nextValue === row.value) return row;
          changed = true;
          return { ...row, value: nextValue };
        });
        return changed ? nextRows : prev;
      });
      return;
    }

    const nextCloseoutDate = addDaysToIsoDate(completionDateValue, 7) ?? "";
    const constructionWeeks = calculateDurationWeeks(startDateValue, completionDateValue);
    const projectWeeks = nextCloseoutDate
      ? calculateDurationWeeks(startDateValue, nextCloseoutDate)
      : null;
    const nextConstructionDuration = constructionWeeks === null ? "" : String(constructionWeeks);
    const nextProjectDuration = projectWeeks === null ? "" : String(projectWeeks);

    setProjectPlanningRows((prev) => {
      let changed = false;
      const nextRows = prev.map((row) => {
        let nextValue = row.value;
        if (row.id === "pp-closeout-date") nextValue = nextCloseoutDate;
        if (row.id === "pp-construction-duration") nextValue = nextConstructionDuration;
        if (row.id === "pp-project-duration") nextValue = nextProjectDuration;
        if (nextValue === row.value) return row;
        changed = true;
        return { ...row, value: nextValue };
      });
      return changed ? nextRows : prev;
    });
  }, [
    startDateValue,
    completionDateValue,
    constructionDurationWeeksValue,
    projectDurationWeeksValue,
  ]);
  useEffect(() => {
    if (!queryProjectId || projectPlanningScheduleSyncSourceRef.current === null) return;

    const timeoutId = window.setTimeout(() => {
      const mappedBidProjectId = getBidProjectIdForProject(queryProjectId);
      const projectIds = [mappedBidProjectId, queryProjectId].filter(
        (id, index, list): id is string => Boolean(id) && list.indexOf(id) === index
      );
      if (projectIds.length === 0) return;

      const current = readBidProjectGeneralInfoMap();
      for (const projectId of projectIds) {
        const previous = current[projectId];
        current[projectId] = {
          projectName: previous?.projectName ?? "",
          projectNumber: previous?.projectNumber ?? "",
          clientName: previous?.clientName ?? "",
          projectAddress: previous?.projectAddress ?? "",
          projectCity: previous?.projectCity ?? "",
          projectState: previous?.projectState ?? "",
          projectZip: previous?.projectZip ?? "",
          architect: previous?.architect ?? "",
          bidSetDate: previous?.bidSetDate ?? "",
          clientPhone: previous?.clientPhone ?? "",
          clientEmail: previous?.clientEmail ?? "",
          primaryBiddingContact: previous?.primaryBiddingContact ?? "",
          projectSizeSqft: previous?.projectSizeSqft ?? "",
          projectSiteSizeSqft: previous?.projectSiteSizeSqft ?? "",
          constructionStartDate: startDateValue.trim(),
          constructionCompletionDate: completionDateValue.trim(),
          constructionDurationWeeks: constructionDurationWeeksValue.trim(),
          projectDurationWeeks: projectDurationWeeksValue.trim(),
          taxCityNumber: previous?.taxCityNumber ?? "",
          taxCityName: previous?.taxCityName ?? "",
          taxRate: previous?.taxRate ?? "",
        };
        updateBidPackageAutosaveSchedule(projectId, {
          constructionStartDate: startDateValue.trim(),
          constructionCompletionDate: completionDateValue.trim(),
          closeoutCompletionDate: closeoutDateValue.trim(),
          constructionDurationWeeks: constructionDurationWeeksValue.trim(),
          projectDurationWeeks: projectDurationWeeksValue.trim(),
        });
      }
      writeBidProjectGeneralInfoMap(current);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [
    closeoutDateValue,
    completionDateValue,
    constructionDurationWeeksValue,
    projectDurationWeeksValue,
    queryProjectId,
    startDateValue,
  ]);
  useEffect(() => {
    generalConditionsHydratedRef.current = false;
    skipNextGeneralConditionsSaveRef.current = true;
    const baseRows = createGeneralConditionsRowsFromCostCodes();
    const savedRowsMap = readEstimateGeneralConditionsRowsMap();
    const savedOverrideRowsMap = readEstimateGeneralConditionsQuantityOverridesMap();
    const savedRows =
      estimateProjectStorageIds
        .map((projectId) => savedRowsMap[projectId])
        .find((rowsForProject) => rowsForProject && rowsForProject.length > 0) ?? [];
    const savedOverrideRows =
      estimateProjectStorageIds
        .map((projectId) => savedOverrideRowsMap[projectId])
        .find((rowIds) => rowIds && rowIds.length > 0) ?? [];
    let nextRows =
      savedRows.length > 0 ? mergeGeneralConditionsRows(baseRows, savedRows) : baseRows;
    const baseQuantityById = new Map(baseRows.map((row) => [row.id, row.quantity.trim()]));
    const nextOverrideIds = new Set(savedOverrideRows);
    const weeksValue = projectDurationWeeksValue.trim();
    if (savedOverrideRows.length === 0 && savedRows.length > 0) {
      for (const row of nextRows) {
        if (!shouldSyncGeneralConditionsWeeks(row)) continue;
        const quantity = row.quantity.trim();
        if (!quantity) continue;
        if (quantity !== baseQuantityById.get(row.id) && quantity !== weeksValue) {
          nextOverrideIds.add(row.id);
        }
      }
    }
    nextRows = nextRows.map((row) => {
      if (!isGeneralConditionsFeeTotalRow(row)) return row;
      if (nextOverrideIds.has(row.id)) return row;
      return row.quantity.trim() === "1" ? row : { ...row, quantity: "1" };
    });
    generalConditionsQuantityOverrideIdsRef.current = nextOverrideIds;

    setGeneralConditionsRows(nextRows);
    generalConditionsHydratedRef.current = true;
  }, [estimateProjectStorageIds]);

  useEffect(() => {
    const weeksValue = projectDurationWeeksValue.trim();
    if (!weeksValue) return;
    setGeneralConditionsRows((prev) =>
      prev.map((row) => {
        if (!shouldSyncGeneralConditionsWeeks(row)) return row;
        if (generalConditionsQuantityOverrideIdsRef.current.has(row.id)) return row;
        return row.quantity === weeksValue ? row : { ...row, quantity: weeksValue };
      })
    );
  }, [projectDurationWeeksValue]);
  useEffect(() => {
    if (!generalConditionsHydratedRef.current || estimateProjectStorageIds.length === 0) return;
    if (skipNextGeneralConditionsSaveRef.current) {
      skipNextGeneralConditionsSaveRef.current = false;
      return;
    }
    writeEstimateGeneralConditionsRows(estimateProjectStorageIds, generalConditionsRows);
    writeEstimateGeneralConditionsQuantityOverrides(
      estimateProjectStorageIds,
      generalConditionsQuantityOverrideIdsRef.current
    );
  }, [estimateProjectStorageIds, generalConditionsRows]);

  const updateCell = (rowId: string, key: keyof FactorRow, value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        if (key === "type") {
          return { ...row, type: (value === "Fixed" ? "Fixed" : "Percent") as FactorType };
        }
        return { ...row, [key]: value };
      })
    );
  };
  const beginPrelimColumnResize = (
    columnIndex: number,
    event: ReactMouseEvent<HTMLSpanElement>
  ) => {
    prelimResizeRef.current = {
      columnIndex,
      startX: event.clientX,
      startWidth: prelimColumnWidths[columnIndex] ?? PRELIM_DEFAULT_COLUMN_WIDTHS[columnIndex],
    };
  };
  const autoResizeWorksheetTextarea = (event: ReactFormEvent<HTMLTextAreaElement>) => {
    const element = event.currentTarget;
    element.style.height = "0px";
    element.style.height = `${Math.max(32, element.scrollHeight)}px`;
  };
  const toggleWorksheetCostCodeExpanded = (costCodeId: string) => {
    setExpandedWorksheetCostCodeIds((prev) => ({ ...prev, [costCodeId]: !prev[costCodeId] }));
  };
  const toggleWorksheetDivisionExpanded = (divisionKey: string) => {
    setExpandedWorksheetDivisionKeys((prev) => ({
      ...prev,
      [divisionKey]: !(prev[divisionKey] ?? true),
    }));
  };
  const updateWorksheetCostCodeTitle = (costCodeId: string, value: string) => {
    setWorksheetCostCodeGroups((prev) =>
      prev.map((group) => (group.id === costCodeId ? { ...group, title: value } : group))
    );
  };
  const addWorksheetLineItem = (costCodeId: string) => {
    setWorksheetCostCodeGroups((prev) =>
      prev.map((group) => {
        if (group.id !== costCodeId) return group;
        return {
          ...group,
          lineItems: [...group.lineItems, createWorksheetLineItem(costCodeId)],
        };
      })
    );
    setExpandedWorksheetCostCodeIds((prev) => ({ ...prev, [costCodeId]: true }));
  };
  const updateWorksheetLineItemCell = (
    costCodeId: string,
    lineItemId: string,
    key: keyof WorksheetLineItem,
    value: string
  ) => {
    setWorksheetCostCodeGroups((prev) =>
      prev.map((group) => {
        if (group.id !== costCodeId) return group;
        return {
          ...group,
          lineItems: group.lineItems.map((line) =>
            line.id === lineItemId ? { ...line, [key]: value } : line
          ),
        };
      })
    );
  };
  const removeWorksheetLineItem = (costCodeId: string, lineItemId: string) => {
    setWorksheetCostCodeGroups((prev) =>
      prev.map((group) => {
        if (group.id !== costCodeId) return group;
        return {
          ...group,
          lineItems: group.lineItems.filter((line) => line.id !== lineItemId),
        };
      })
    );
    const cellKey = worksheetUnitPriceCellKey(costCodeId, lineItemId);
    setWorksheetUnitPriceFormulas((prev) => {
      const next = { ...prev };
      delete next[cellKey];
      return next;
    });
    setActiveWorksheetUnitPriceCell((prev) => (prev === cellKey ? null : prev));
  };
  const worksheetUnitPriceCellKey = (costCodeId: string, lineItemId: string) =>
    `${costCodeId}:${lineItemId}`;
  const stepWorksheetLineItemQuantity = (
    costCodeId: string,
    lineItemId: string,
    delta: number
  ) => {
    setWorksheetCostCodeGroups((prev) =>
      prev.map((group) => {
        if (group.id !== costCodeId) return group;
        return {
          ...group,
          lineItems: group.lineItems.map((line) => {
            if (line.id !== lineItemId) return line;
            const current = parseNumericInput(line.quantity);
            const next = Math.max(0, current + delta);
            return { ...line, quantity: String(next) };
          }),
        };
      })
    );
  };

  const worksheetView = selectedItem === "Data, Factors & Rates";
  const generalConditionsView = selectedItem === "General Conditions";
  const coverPageView = selectedItem === "Preliminary Estimate Cover Page";
  const preliminaryWorksheetView = selectedItem === "Preliminary Estimate Worksheet";
  const updateProjectPlanningValue = (rowId: string, value: string) => {
    if (rowId === "pp-start-date") {
      const hasProjectDurationValue =
        sanitizeWholeNumberInput(projectDurationWeeksValue).trim().length > 0;
      const hasConstructionDurationValue =
        sanitizeWholeNumberInput(constructionDurationWeeksValue).trim().length > 0;
      projectPlanningScheduleSyncSourceRef.current =
        projectPlanningScheduleSyncSourceRef.current === "project-duration" ||
        (!completionDateValue && hasProjectDurationValue)
          ? "project-duration"
          : projectPlanningScheduleSyncSourceRef.current === "construction-duration" ||
              (!completionDateValue && hasConstructionDurationValue)
            ? "construction-duration"
            : "dates";
    } else if (rowId === "pp-completion-date") {
      projectPlanningScheduleSyncSourceRef.current = "dates";
    } else if (rowId === "pp-construction-duration") {
      projectPlanningScheduleSyncSourceRef.current = "construction-duration";
      value = sanitizeWholeNumberInput(value);
    } else if (rowId === "pp-project-duration") {
      projectPlanningScheduleSyncSourceRef.current = "project-duration";
      value = sanitizeWholeNumberInput(value);
    }
    setProjectPlanningRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, value } : row))
    );
  };
  const updateSalesTaxRate = (rowId: string, taxRate: string) => {
    setSalesTaxRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, taxRate } : row))
    );
  };
  const toActualTaxRate = (taxRate: string) => {
    const numericRate = Number.parseFloat(taxRate);
    if (Number.isNaN(numericRate)) return "-";
    return `${(numericRate * 0.65).toFixed(6)}%`;
  };
  const updateProjectDataValue = (rowId: string, value: string) => {
    setProjectDataRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, value } : row))
    );
  };
  const updateCostSummaryAmount = (rowId: string, amount: string) => {
    setCostSummaryRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, amount } : row))
    );
  };
  const updateCoverPageField = (fieldId: string, value: string) => {
    setCoverPageFields((prev) =>
      prev.map((field) => (field.id === fieldId ? { ...field, value } : field))
    );
  };
  const showWorksheetGcMarkupMessage = () => {
    setWorksheetGcMarkupMessage(
      "Enter a $/Unit amount for this line item before applying GC markup."
    );
  };
  const updateGeneralConditionsCell = (
    rowId: string,
    key: keyof GeneralConditionsRow,
    value: string
  ) => {
    if (key === "quantity") {
      const nextOverrideIds = new Set(generalConditionsQuantityOverrideIdsRef.current);
      if (value.trim() === projectDurationWeeksValue.trim()) {
        nextOverrideIds.delete(rowId);
      } else {
        nextOverrideIds.add(rowId);
      }
      generalConditionsQuantityOverrideIdsRef.current = nextOverrideIds;
      writeEstimateGeneralConditionsQuantityOverrides(
        estimateProjectStorageIds,
        generalConditionsQuantityOverrideIdsRef.current
      );
    }
    setGeneralConditionsRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [key]: value } : row))
    );
  };
  const focusGeneralConditionsCell = (rowIndex: number, columnIndex: number) => {
    const cell = document.querySelector<HTMLInputElement>(
      `[data-gc-row="${rowIndex}"][data-gc-col="${columnIndex}"]`
    );
    if (!cell) return false;
    cell.focus();
    const cursorPosition = cell.value.length;
    cell.setSelectionRange(cursorPosition, cursorPosition);
    return true;
  };
  const focusNearestGeneralConditionsCell = (rowIndex: number, columnIndex: number) => {
    if (focusGeneralConditionsCell(rowIndex, columnIndex)) return true;
    for (let offset = 1; offset <= 6; offset += 1) {
      if (focusGeneralConditionsCell(rowIndex, columnIndex + offset)) return true;
      if (focusGeneralConditionsCell(rowIndex, columnIndex - offset)) return true;
    }
    return false;
  };
  const moveGeneralConditionsFocus = (
    rowIndex: number,
    columnIndex: number,
    direction: "left" | "right" | "up" | "down"
  ) => {
    if (direction === "left" || direction === "right") {
      const step = direction === "right" ? 1 : -1;
      for (let nextColumn = columnIndex + step; nextColumn >= 0 && nextColumn <= 6; nextColumn += step) {
        if (focusGeneralConditionsCell(rowIndex, nextColumn)) return;
      }
      return;
    }

    const step = direction === "down" ? 1 : -1;
    for (
      let nextRow = rowIndex + step;
      nextRow >= 0 && nextRow < computedGeneralConditionsRows.length;
      nextRow += step
    ) {
      if (focusNearestGeneralConditionsCell(nextRow, columnIndex)) return;
    }
  };
  const handleGeneralConditionsCellKeyDown =
    (rowIndex: number, columnIndex: number) =>
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      const keyToDirection: Record<string, "left" | "right" | "up" | "down" | undefined> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
        Enter: event.shiftKey ? "up" : "down",
      };
      const direction = keyToDirection[event.key];
      if (!direction) return;
      event.preventDefault();
      moveGeneralConditionsFocus(rowIndex, columnIndex, direction);
    };
  const toggleSection = (section: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };
  const summaryTotal = useMemo(() => {
    const total = costSummaryRows.reduce((sum, row) => {
      const numericAmount = Number.parseFloat(row.amount.replace(/,/g, ""));
      return sum + (Number.isNaN(numericAmount) ? 0 : numericAmount);
    }, 0);
    return total.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [costSummaryRows]);
  const computedGeneralConditionsRows = useMemo(() => {
    return generalConditionsRows.map((row) => {
      const computedTotal = calculateGeneralConditionsRowTotal(row);
      return {
        ...row,
        computedTotal,
        computedTotalDisplay: computedTotal === null ? "-" : formatCurrency(computedTotal),
      };
    });
  }, [generalConditionsRows]);
  const generalConditionsTotal = useMemo(
    () =>
      computedGeneralConditionsRows.reduce(
        (sum, row) => sum + (row.computedTotal !== null ? row.computedTotal : 0),
        0
      ),
    [computedGeneralConditionsRows]
  );
  const projectDurationWeeks = useMemo(() => {
    const rawValue =
      projectPlanningRows.find((row) => row.id === "pp-project-duration")?.value ?? "";
    const parsed = parseDerivedNumericInput(rawValue);
    return parsed !== null && parsed > 0 ? parsed : null;
  }, [projectPlanningRows]);
  const generalConditionsWeekly =
    projectDurationWeeks && projectDurationWeeks > 0
      ? generalConditionsTotal / projectDurationWeeks
      : 0;
  const generalConditionsMonthly = generalConditionsWeekly * 4;
  const worksheetDivisionGroups = useMemo(() => {
    const grouped = worksheetCostCodeGroups.reduce<Record<string, WorksheetCostCodeGroup[]>>(
      (acc, group) => {
        const key = group.division?.trim() || "Other";
        if (!acc[key]) acc[key] = [];
        acc[key].push(group);
        return acc;
      },
      {}
    );

    return Object.entries(grouped)
      .map(([division, costCodeGroups]) => {
        const sortedGroups = [...costCodeGroups].sort((a, b) =>
          a.code.localeCompare(b.code, undefined, { numeric: true })
        );
        const firstCostCode = sortedGroups[0]?.code ?? "";
        const codeMatch = firstCostCode.match(/^(\d{2})/) ?? division.match(/^(\d{2})/);
        const divisionCode = codeMatch?.[1] ?? "";
        const trimmedDivision = division.trim();
        const divisionTitle =
          divisionCode && trimmedDivision.startsWith(divisionCode)
            ? trimmedDivision.slice(divisionCode.length).trim() || trimmedDivision
            : trimmedDivision;
        const groupsWithTotals: WorksheetRenderedCostCodeGroup[] = sortedGroups.map((group) => {
          const total = group.lineItems.reduce((sum, line) => {
            if (isExcludedWorksheetUnit(line.unit)) return sum;
            const quantity = parseNumericInput(line.quantity);
            const unitPrice = parseNumericInput(line.unitPrice);
            const gcMarkup = parseNumericInput(line.gcMarkup);
            return sum + quantity * unitPrice + gcMarkup;
          }, 0);
          return { ...group, total };
        });
        const renderedCostCodeGroups =
          divisionCode === "01" && normalizeCostCodeDescription(divisionTitle) === "generalconditions"
            ? [
                {
                  id: "__division-01-rollup__",
                  code: "01",
                  title: "General Conditions",
                  division,
                  lineItems: [],
                  total: generalConditionsTotal,
                  readOnlyRollup: true,
                } satisfies WorksheetRenderedCostCodeGroup,
              ]
            : groupsWithTotals;
        const subtotal =
          divisionCode === "01" && normalizeCostCodeDescription(divisionTitle) === "generalconditions"
            ? generalConditionsTotal
            : renderedCostCodeGroups.reduce((sum, group) => sum + group.total, 0);
        return {
          division,
          divisionCode,
          divisionTitle,
          sortCode: firstCostCode,
          costCodeGroups: renderedCostCodeGroups,
          subtotal,
        };
      })
      .sort((a, b) => {
        const aRank = a.divisionCode ? Number.parseInt(a.divisionCode, 10) : Number.MAX_SAFE_INTEGER;
        const bRank = b.divisionCode ? Number.parseInt(b.divisionCode, 10) : Number.MAX_SAFE_INTEGER;
        if (aRank !== bRank) return aRank - bRank;
        const sortByCode = (a.sortCode || "").localeCompare(b.sortCode || "", undefined, {
          numeric: true,
          sensitivity: "base",
        });
        if (sortByCode !== 0) return sortByCode;
        return a.divisionTitle.localeCompare(b.divisionTitle, undefined, { numeric: true });
      });
  }, [worksheetCostCodeGroups, generalConditionsTotal]);
  const preliminarySubtotal = useMemo(
    () => worksheetDivisionGroups.reduce((sum, group) => sum + group.subtotal, 0),
    [worksheetDivisionGroups]
  );
  const preliminaryGcMarkupTotal = useMemo(
    () =>
      worksheetCostCodeGroups.reduce(
        (sum, group) =>
          sum +
          group.lineItems.reduce(
            (lineSum, lineItem) => lineSum + parseNumericInput(lineItem.gcMarkup),
            0
          ),
        0
      ),
    [worksheetCostCodeGroups]
  );
  const preliminaryMarkupCalculations = useMemo(() => {
    const feeValueById = feeRows.reduce<Record<string, string>>((acc, row) => {
      acc[row.id] = row.value;
      return acc;
    }, {});
    const getNumericValue = (rowId: string) => {
      const raw = feeValueById[rowId];
      if (!raw) return null;
      return parsePercentValue(raw);
    };
    const liabilityRate = getNumericValue("fees-general-liability");
    const buildersRiskRate = getNumericValue("fees-builders-risk");
    const projectManagementRate = getNumericValue("fees-project-management");
    const warrantyRate = getNumericValue("fees-warranty");
    const overheadRate = getNumericValue("fees-overhead");
    const profitRate = getNumericValue("fees-profit");
    const performanceBondRate = getNumericValue("fees-performance-bond");
    const contingencyRate = getNumericValue("fees-contingency");

    const liabilityInsurance =
      liabilityRate !== null && liabilityRate > 0
        ? (preliminarySubtotal / 1000) * liabilityRate
        : null;
    const buildersRiskBase = preliminarySubtotal + (liabilityInsurance ?? 0);
    const buildersRisk =
      buildersRiskRate !== null && buildersRiskRate > 0
        ? (buildersRiskBase / 100) * buildersRiskRate
        : null;
    const overheadBase = preliminarySubtotal + (liabilityInsurance ?? 0) + (buildersRisk ?? 0);
    const overhead =
      overheadRate !== null && overheadRate > 0 ? (overheadBase * overheadRate) / 100 : null;
    const profitBase = overheadBase + (overhead ?? 0);
    const profit =
      profitRate !== null && profitRate > 0 ? (profitBase * profitRate) / 100 : null;
    const performanceBond =
      performanceBondRate !== null && performanceBondRate > 0
        ? (preliminarySubtotal * performanceBondRate) / 100
        : null;
    const contingency =
      contingencyRate !== null && contingencyRate > 0
        ? (preliminarySubtotal * contingencyRate) / 100
        : null;
    const projectAdminFeeBase =
      preliminarySubtotal +
      (liabilityInsurance ?? 0) +
      (buildersRisk ?? 0) +
      (overhead ?? 0) +
      (profit ?? 0) +
      (performanceBond ?? 0) +
      (contingency ?? 0);
    const projectManagementSoftware =
      projectManagementRate !== null && projectManagementRate > 0
        ? (projectAdminFeeBase * projectManagementRate) / 100
        : null;
    const warrantyProvision =
      warrantyRate !== null && warrantyRate > 0
        ? (projectAdminFeeBase * warrantyRate) / 100
        : null;

    const selectedSalesTaxRow = resolveSelectedSalesTaxRow(
      selectedCityNumber,
      salesTaxRows,
      unknownSalesTax,
      tiTax,
      notTaxable
    );
    const selectedSalesTaxRate = parsePercentValue(selectedSalesTaxRow?.taxRate ?? "");
    const selectedSalesTaxActualRate =
      selectedSalesTaxRate !== null && selectedSalesTaxRate > 0
        ? selectedSalesTaxRate * 0.65
        : null;
    const taxBase =
      preliminarySubtotal +
      (liabilityInsurance ?? 0) +
      (buildersRisk ?? 0) +
      (projectManagementSoftware ?? 0) +
      (warrantyProvision ?? 0) +
      (overhead ?? 0) +
      (profit ?? 0) +
      (performanceBond ?? 0) +
      (contingency ?? 0);
    const tax =
      selectedSalesTaxActualRate !== null && taxBase > 0
        ? (taxBase * selectedSalesTaxActualRate) / 100
        : null;

    const amountByRowId: Record<string, number | null> = {
      "fees-general-liability":
        liabilityInsurance !== null && Number.isFinite(liabilityInsurance) && liabilityInsurance > 0
          ? liabilityInsurance
          : null,
      "fees-builders-risk":
        buildersRisk !== null && Number.isFinite(buildersRisk) && buildersRisk > 0
          ? buildersRisk
          : null,
      "fees-project-management":
        projectManagementSoftware !== null &&
        Number.isFinite(projectManagementSoftware) &&
        projectManagementSoftware > 0
          ? projectManagementSoftware
          : null,
      "fees-warranty":
        warrantyProvision !== null && Number.isFinite(warrantyProvision) && warrantyProvision > 0
          ? warrantyProvision
          : null,
      "fees-overhead":
        overhead !== null && Number.isFinite(overhead) && overhead > 0 ? overhead : null,
      "fees-profit": profit !== null && Number.isFinite(profit) && profit > 0 ? profit : null,
      "fees-performance-bond":
        performanceBond !== null && Number.isFinite(performanceBond) && performanceBond > 0
          ? performanceBond
          : null,
      "fees-contingency":
        contingency !== null && Number.isFinite(contingency) && contingency > 0 ? contingency : null,
      __tax__: tax !== null && Number.isFinite(tax) && tax > 0 ? tax : null,
    };

    return amountByRowId;
  }, [
    feeRows,
    notTaxable,
    prelimMarkupFeeRowConfig,
    preliminarySubtotal,
    salesTaxRows,
    selectedCityNumber,
    tiTax,
    unknownSalesTax,
  ]);
  const preliminaryMarkupRows = useMemo(
    () =>
      prelimMarkupFeeRowConfig.map((config) => ({
        costCode: config.costCode,
        label: config.label,
        amount: preliminaryMarkupCalculations[config.rowId] ?? null,
      })),
    [preliminaryMarkupCalculations, prelimMarkupFeeRowConfig]
  );
  const preliminaryMarkupAmountByRowId = useMemo(() => {
    return preliminaryMarkupCalculations;
  }, [preliminaryMarkupCalculations]);
  const displayedGeneralConditionsRows = useMemo<DisplayedGeneralConditionsRow[]>(
    () =>
      computedGeneralConditionsRows.map((row) => {
        const feeRowId = getGeneralConditionsFeeRowId(row);
        if (!feeRowId) {
          return {
            ...row,
            autoCalculated: false,
            autoCalculatedComment: "",
          };
        }
        const feeAmount = preliminaryMarkupAmountByRowId[feeRowId] ?? null;
        const autoCalculatedUnitPrice =
          feeAmount !== null && Number.isFinite(feeAmount) && feeAmount > 0
            ? formatCurrency(feeAmount)
            : "-";
        return {
          ...row,
          unitPrice: autoCalculatedUnitPrice,
          computedTotal: feeAmount,
          computedTotalDisplay:
            feeAmount !== null && Number.isFinite(feeAmount) && feeAmount > 0
              ? formatCurrency(feeAmount)
              : "-",
          autoCalculated: true,
          autoCalculatedComment: "Auto Calculated",
        };
      }),
    [computedGeneralConditionsRows, preliminaryMarkupAmountByRowId]
  );
  const filteredGeneralConditionsRows = useMemo(
    () =>
      displayedGeneralConditionsRows.filter((row) => {
        const hasValue = row.computedTotal !== null && row.computedTotal > 0;
        return matchesRowVisibilityFilter(hasValue, generalConditionsRowVisibilityFilter);
      }),
    [displayedGeneralConditionsRows, generalConditionsRowVisibilityFilter]
  );
  const displayedGeneralConditionsTotal = useMemo(
    () =>
      displayedGeneralConditionsRows.reduce(
        (sum, row) => sum + (row.computedTotal !== null ? row.computedTotal : 0),
        0
      ),
    [displayedGeneralConditionsRows]
  );
  const displayedGeneralConditionsWeekly =
    projectDurationWeeks && projectDurationWeeks > 0
      ? displayedGeneralConditionsTotal / projectDurationWeeks
      : 0;
  const displayedGeneralConditionsMonthly = displayedGeneralConditionsWeekly * 4;
  const filteredWorksheetDivisionGroups = useMemo<FilteredWorksheetDivisionGroup[]>(() => {
    return worksheetDivisionGroups.reduce<FilteredWorksheetDivisionGroup[]>((acc, group) => {
        const filteredCostCodeGroups: FilteredWorksheetRenderedCostCodeGroup[] = group.costCodeGroups
          .map((costCodeGroup) => {
            if (costCodeGroup.readOnlyRollup) {
              const hasValue = costCodeGroup.total > 0;
              if (!matchesRowVisibilityFilter(hasValue, prelimWorksheetRowVisibilityFilter)) return null;
              return costCodeGroup;
            }

            const filteredLineItems = costCodeGroup.lineItems.filter((lineItem) => {
              if (isExcludedWorksheetUnit(lineItem.unit)) {
                return true;
              }
              const quantity = parseNumericInput(lineItem.quantity);
              const unitPrice = parseNumericInput(lineItem.unitPrice);
              const gcMarkup = parseNumericInput(lineItem.gcMarkup);
              const lineTotal = quantity * unitPrice + gcMarkup;
              const hasValue = lineTotal > 0;
              return matchesRowVisibilityFilter(hasValue, prelimWorksheetRowVisibilityFilter);
            });

            if (filteredLineItems.length === 0) return null;

            return {
              ...costCodeGroup,
              filteredLineItems,
              hasVisibleLines: true,
            };
          })
          .filter((group): group is FilteredWorksheetRenderedCostCodeGroup => Boolean(group));

        if (filteredCostCodeGroups.length === 0) return acc;

        acc.push({
          ...group,
          costCodeGroups: filteredCostCodeGroups,
        } satisfies FilteredWorksheetDivisionGroup);
        return acc;
      }, []);
  }, [prelimWorksheetRowVisibilityFilter, worksheetDivisionGroups]);
  const preliminaryMarkupTotal = useMemo(
    () =>
      preliminaryMarkupRows.reduce(
        (sum, row) => sum + (row.amount !== null && Number.isFinite(row.amount) ? row.amount : 0),
        0
      ),
    [preliminaryMarkupRows]
  );
  const preliminaryGrandTotal = preliminarySubtotal + preliminaryMarkupTotal;
  const allowanceTotal = useMemo(
    () =>
      worksheetCostCodeGroups.reduce(
        (sum, group) =>
          sum +
          group.lineItems.reduce((lineSum, lineItem) => {
            if (isExcludedWorksheetUnit(lineItem.unit)) return lineSum;
            if (lineItem.unit.trim().toLowerCase() !== "allow") return lineSum;
            const quantity = parseNumericInput(lineItem.quantity);
            const unitPrice = parseNumericInput(lineItem.unitPrice);
            const gcMarkup = parseNumericInput(lineItem.gcMarkup);
            return lineSum + quantity * unitPrice + gcMarkup;
          }, 0),
        0
      ),
    [worksheetCostCodeGroups]
  );
  const getCoverPageFieldValue = (fieldId: string) =>
    coverPageFields.find((field) => field.id === fieldId)?.value ?? "";
  const coverProjectSquareFeet = useMemo(() => {
    const projectSizeRaw =
      projectPlanningRows.find((row) => row.id === "pp-project-size")?.value ?? "";
    const parsed = Number.parseFloat(projectSizeRaw.replace(/,/g, ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [projectPlanningRows]);
  const derivedProjectDataValueById = useMemo(() => {
    const revenue = preliminaryGrandTotal;
    const rawConstructionCosts = preliminarySubtotal;
    const grossProfit = revenue - rawConstructionCosts;
    const grossMarginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : null;
    const laborBonuses = 0;
    const netProfitExcludingActLabor = grossProfit - laborBonuses;
    const netProfitPercentExcludingActLabor =
      revenue > 0 ? (netProfitExcludingActLabor / revenue) * 100 : null;
    const pricePerSqftLessTax =
      coverProjectSquareFeet && coverProjectSquareFeet > 0 ? revenue / coverProjectSquareFeet : null;

    return {
      "project-revenue": revenue > 0 ? formatCurrency(revenue) : "",
      "raw-construction-costs": rawConstructionCosts > 0 ? formatCurrency(rawConstructionCosts) : "",
      "gross-margin-inc-labor":
        grossMarginPercent !== null && Number.isFinite(grossMarginPercent)
          ? grossMarginPercent.toFixed(2)
          : "",
      "gross-profit-inc-labor": grossProfit > 0 ? formatCurrency(grossProfit) : "",
      "labor-bonuses": formatCurrency(laborBonuses),
      "net-profit-excl-act":
        Number.isFinite(netProfitExcludingActLabor) ? formatCurrency(netProfitExcludingActLabor) : "",
      "net-profit-percent-excl-act-labor":
        netProfitPercentExcludingActLabor !== null &&
        Number.isFinite(netProfitPercentExcludingActLabor)
          ? netProfitPercentExcludingActLabor.toFixed(2)
          : "",
      allowance: formatCurrency(allowanceTotal),
      "price-per-sqft-less-tax":
        pricePerSqftLessTax !== null && Number.isFinite(pricePerSqftLessTax)
          ? formatCurrency(pricePerSqftLessTax)
          : "",
    } satisfies Partial<Record<ProjectDataRow["id"], string>>;
  }, [allowanceTotal, coverProjectSquareFeet, preliminaryGrandTotal, preliminarySubtotal, projectDataRows]);
  const resolvedProjectDataRows = useMemo(
    () =>
      projectDataRows.map((row) => {
        const derivedValue = derivedProjectDataValueById[row.id as keyof typeof derivedProjectDataValueById];
        if (typeof derivedValue !== "string") return { ...row, readOnly: false };
        return { ...row, value: derivedValue, readOnly: true };
      }),
    [derivedProjectDataValueById, projectDataRows]
  );
  const coverDivisionRows = useMemo(() => {
    return worksheetDivisionGroups
      .map((group) => {
      const summaryDescription = group.costCodeGroups
        .flatMap((costCodeGroup) => costCodeGroup.lineItems.map((line) => line.description.trim()))
        .filter((line) => line.length > 0)
        .slice(0, 2)
        .join(", ");
      const dollarsPerSf =
        coverProjectSquareFeet && coverProjectSquareFeet > 0
          ? group.subtotal / coverProjectSquareFeet
          : null;
      const scopePercent =
        preliminarySubtotal > 0 ? (group.subtotal / preliminarySubtotal) * 100 : null;
      return {
        divisionLabel: group.divisionCode ? `DIVISION ${group.divisionCode}` : group.division,
        item: group.divisionTitle.toUpperCase(),
        subtotal: group.subtotal,
        dollarsPerSf,
        scopePercent,
        summaryDescription,
      };
      })
      .filter((row) => matchesRowVisibilityFilter(row.subtotal > 0, coverRowVisibilityFilter));
  }, [worksheetDivisionGroups, coverProjectSquareFeet, preliminarySubtotal, coverRowVisibilityFilter]);
  const exportProjectId = useMemo(
    () => getBidProjectIdForProject(queryProjectId ?? "") ?? queryProjectId ?? "",
    [queryProjectId]
  );
  const estimateExportSnapshot = useMemo<EstimateExportSnapshot | null>(() => {
    if (!exportProjectId) return null;
    const divisions: EstimateExportSnapshotDivision[] = worksheetDivisionGroups.map((group) => ({
      divisionCode: group.divisionCode,
      divisionTitle: group.divisionTitle,
      subtotal: formatCurrency(group.subtotal),
      lineItems: group.costCodeGroups.flatMap((costCodeGroup) => {
        if (costCodeGroup.readOnlyRollup) {
          return [
            {
              costCode: costCodeGroup.code,
              description: costCodeGroup.title,
              unit: "",
              quantity: "",
              unitPrice: "",
              gcMarkup: "",
              total: formatCurrency(costCodeGroup.total),
            },
          ];
        }
        return costCodeGroup.lineItems.map((lineItem) => {
          const isExcluded = isExcludedWorksheetUnit(lineItem.unit);
          const quantity = parseNumericInput(lineItem.quantity);
          const unitPrice = parseNumericInput(lineItem.unitPrice);
          const gcMarkup = parseNumericInput(lineItem.gcMarkup);
          const total = isExcluded ? 0 : quantity * unitPrice + gcMarkup;
          return {
            costCode: costCodeGroup.code,
            description: lineItem.description || costCodeGroup.title,
            unit: lineItem.unit || "",
            quantity: lineItem.quantity || "",
            unitPrice: lineItem.unitPrice || "",
            gcMarkup: lineItem.gcMarkup || "",
            total: total > 0 ? formatCurrency(total) : "-",
          };
        });
      }),
    }));

    return {
      projectId: exportProjectId,
      projectName: getCoverPageFieldValue("cover-project-name") || "Untitled Project",
      generatedAt: new Date().toISOString(),
      coverFields: coverPageFields.reduce<Record<string, string>>((acc, field) => {
        acc[field.id] = field.value ?? "";
        return acc;
      }, {}),
      projectPlanning: projectPlanningRows.reduce<Record<string, string>>((acc, row) => {
        acc[row.id] = row.value ?? "";
        return acc;
      }, {}),
      divisions,
      markupRows: preliminaryMarkupRows
        .filter((row) => row.amount !== null && Number.isFinite(row.amount))
        .map((row) => ({
          label: row.label,
          amount: formatCurrency(row.amount ?? 0),
        })),
      subtotal: formatCurrency(preliminarySubtotal),
      markupTotal: formatCurrency(preliminaryMarkupTotal),
      grandTotal: formatCurrency(preliminaryGrandTotal),
    };
  }, [
    coverPageFields,
    exportProjectId,
    preliminaryGrandTotal,
    preliminaryMarkupRows,
    preliminaryMarkupTotal,
    preliminarySubtotal,
    projectPlanningRows,
    worksheetDivisionGroups,
  ]);
  const renderRowVisibilityFilterControl = (
    filterId: string,
    value: RowVisibilityFilter,
    onChange: (value: RowVisibilityFilter) => void
  ) => (
    <div className="mb-3 flex items-center justify-end gap-2">
      <label
        htmlFor={filterId}
        className="text-sm font-medium text-slate-600"
      >
        View / Hide
      </label>
      <select
        id={filterId}
        value={value}
        onChange={(event) => onChange(event.target.value as RowVisibilityFilter)}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
      >
        <option value="all">All rows</option>
        <option value="with-values">Rows with values</option>
        <option value="without-values">Rows without values</option>
      </select>
    </div>
  );

  useEffect(() => {
    const handleExportRequest = () => {
      if (!estimateExportSnapshot) return;
      writeEstimateExportSnapshot(estimateExportSnapshot);
    };
    window.addEventListener(ESTIMATE_EXPORT_REQUEST_EVENT, handleExportRequest);
    return () => {
      window.removeEventListener(ESTIMATE_EXPORT_REQUEST_EVENT, handleExportRequest);
    };
  }, [estimateExportSnapshot]);

  useEffect(() => {
    if (!worksheetGcMarkupMessage) return;
    const timer = window.setTimeout(() => setWorksheetGcMarkupMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [worksheetGcMarkupMessage]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div
        className={`relative grid min-h-[720px] transition-[grid-template-columns] duration-300 ${
          isSidebarCollapsed
            ? "grid-cols-[0px_minmax(0,1fr)]"
            : "grid-cols-[240px_minmax(0,1fr)]"
        }`}
      >
        <button
          type="button"
          onClick={() => setIsSidebarCollapsed((prev) => !prev)}
          className={`absolute top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition-all ${
            isSidebarCollapsed ? "left-2" : "left-[224px]"
          }`}
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className={`h-4 w-4 transition-transform ${
              isSidebarCollapsed ? "rotate-180" : "rotate-0"
            }`}
          >
            <path d="M12.5 4.5L7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>

        <aside
          className={`overflow-hidden border-r border-slate-200 bg-slate-50 transition-opacity duration-200 ${
            isSidebarCollapsed ? "opacity-0" : "opacity-100"
          }`}
        >
          <nav className="space-y-1 p-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSelectedItem(item)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                  selectedItem === item
                    ? "border-l-4 border-blue-600 bg-white font-semibold text-blue-700"
                    : "text-slate-700 hover:bg-white"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <div className="overflow-hidden bg-slate-50">
          <div className="border-b border-slate-200 bg-white px-4 py-3">
            <h2 className="text-2xl font-semibold text-slate-900">{selectedItem}</h2>
          </div>

          {worksheetView ? (
            <div className="p-3">
              <div className="space-y-3">
                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => toggleSection("projectInfo")}
                    className="flex w-full items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-800"
                  >
                    <span className="flex items-center gap-2">
                      <svg
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                        className={`h-4 w-4 transition-transform ${
                          openSections.projectInfo ? "rotate-180" : "rotate-0"
                        }`}
                      >
                        <path d="M5 7l5 6 5-6H5z" fill="currentColor" />
                      </svg>
                      <span>Project Information</span>
                    </span>
                    <span className="text-xs text-slate-500">
                      {openSections.projectInfo ? "Hide" : "Show"}
                    </span>
                  </button>
                  {openSections.projectInfo ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
                        <thead className="bg-slate-100/80 text-slate-700">
                          <tr>
                            <th className="w-[20%] border-b border-r border-slate-200 px-3 py-2 text-left font-semibold">
                              ATTN
                            </th>
                            <th className="w-[30%] border-b border-r border-slate-200 px-3 py-2 text-left font-semibold">
                              Details
                            </th>
                            <th className="w-[20%] border-b border-r border-slate-200 px-3 py-2 text-left font-semibold">
                              Contractor Information
                            </th>
                            <th className="w-[30%] border-b border-slate-200 px-3 py-2 text-left font-semibold">
                              Details
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {PROJECT_INFO_GRID_ROWS.map((row, index) => (
                            <tr key={`${row.leftFieldId}-${row.rightFieldId}-${index}`} className="odd:bg-white even:bg-slate-50/30">
                              <td className="border-b border-r border-slate-200 px-3 py-2 text-slate-700">
                                {row.leftLabel}
                              </td>
                              <td className="border-b border-r border-slate-200 p-0">
                                {row.leftFieldId ? (
                                  <input
                                    value={getCoverPageFieldValue(row.leftFieldId)}
                                    onChange={(event) =>
                                      updateCoverPageField(row.leftFieldId, event.target.value)
                                    }
                                    className="h-10 w-full border-0 bg-transparent px-3 text-base text-slate-900 focus:bg-white focus:outline-none"
                                  />
                                ) : (
                                  <div className="h-10"></div>
                                )}
                              </td>
                              <td className="border-b border-r border-slate-200 px-3 py-2 text-slate-700">
                                {row.rightLabel}
                              </td>
                              <td className="border-b border-slate-200 p-0">
                                {row.rightFieldId ? (
                                  <input
                                    value={getCoverPageFieldValue(row.rightFieldId)}
                                    onChange={(event) =>
                                      updateCoverPageField(row.rightFieldId, event.target.value)
                                    }
                                    className="h-10 w-full border-0 bg-transparent px-3 text-base text-slate-900 focus:bg-white focus:outline-none"
                                  />
                                ) : (
                                  <div className="h-10"></div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </section>

                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => toggleSection("projectPlanning")}
                    className="flex w-full items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-800"
                  >
                    <span className="flex items-center gap-2">
                      <svg
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                        className={`h-4 w-4 transition-transform ${
                          openSections.projectPlanning ? "rotate-180" : "rotate-0"
                        }`}
                      >
                        <path d="M5 7l5 6 5-6H5z" fill="currentColor" />
                      </svg>
                      <span>Project Planning</span>
                    </span>
                    <span className="text-xs text-slate-500">
                      {openSections.projectPlanning ? "Hide" : "Show"}
                    </span>
                  </button>
                  {openSections.projectPlanning ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
                    <thead className="bg-slate-100/80 text-slate-700">
                      <tr>
                        <th className="w-[50%] border-b border-r border-slate-200 px-3 py-2 text-left font-semibold">
                          PROJECT PLANNING
                        </th>
                        <th className="w-[16%] border-b border-r border-slate-200 px-3 py-2 text-left font-semibold">
                          Value
                        </th>
                        <th className="w-[34%] border-b border-slate-200 px-3 py-2 text-left font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectPlanningRows.map((row) => (
                        <tr key={row.id} className="odd:bg-white even:bg-slate-50/30">
                          <td className="border-b border-r border-slate-200 p-0">
                            <div className="min-h-11 px-3 py-2 text-base text-slate-900">{row.label}</div>
                          </td>
                          <td className="border-b border-r border-slate-200 p-0">
                            {isProjectPlanningCalendarRow(row.id) ? (
                              <input
                                type="date"
                                value={row.value}
                                onChange={(event) =>
                                  updateProjectPlanningValue(row.id, event.target.value)
                                }
                                readOnly={row.id === "pp-closeout-date"}
                                className="h-11 w-full border-0 bg-transparent px-3 text-right text-base text-slate-900 focus:bg-white focus:outline-none"
                              />
                            ) : (
                              <input
                                value={row.value}
                                onChange={(event) =>
                                  updateProjectPlanningValue(row.id, event.target.value)
                                }
                                className="h-11 w-full border-0 bg-transparent px-3 text-right text-base text-slate-900 focus:bg-white focus:outline-none"
                              />
                            )}
                          </td>
                          <td className="border-b border-slate-200 px-3 py-2"></td>
                        </tr>
                      ))}
                    </tbody>
                      </table>
                    </div>
                  ) : null}
                </section>

                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => toggleSection("fees")}
                    className="flex w-full items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-800"
                  >
                    <span className="flex items-center gap-2">
                      <svg
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                        className={`h-4 w-4 transition-transform ${
                          openSections.fees ? "rotate-180" : "rotate-0"
                        }`}
                      >
                        <path d="M5 7l5 6 5-6H5z" fill="currentColor" />
                      </svg>
                      <span>Fees</span>
                    </span>
                    <span className="text-xs text-slate-500">{openSections.fees ? "Hide" : "Show"}</span>
                  </button>
                  {openSections.fees ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
                    <thead className="bg-slate-100/80 text-slate-700">
                      <tr>
                        <th className="w-[50%] border-b border-r border-slate-200 px-3 py-2 text-left font-semibold">
                          FEES % (Less Tax)
                        </th>
                        <th className="w-[16%] border-b border-r border-slate-200 px-3 py-2 text-left font-semibold">
                          Value
                        </th>
                        <th className="w-[34%] border-b border-slate-200 px-3 py-2 text-left font-semibold">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeRows.map((row) => (
                        <tr key={row.id} className="odd:bg-white even:bg-slate-50/30">
                          <td className="border-b border-r border-slate-200 p-0">
                            <input
                              value={row.factorName}
                              onChange={(event) => updateCell(row.id, "factorName", event.target.value)}
                              className="h-11 w-full border-0 bg-transparent px-3 text-base text-slate-900 focus:bg-white focus:outline-none"
                            />
                          </td>
                          <td className="border-b border-r border-slate-200 p-0">
                            <div className="flex h-11 items-center gap-2 px-3">
                              <input
                                value={row.value}
                                onChange={(event) => updateCell(row.id, "value", event.target.value)}
                                className="h-full w-full border-0 bg-transparent text-right text-base text-slate-900 focus:bg-white focus:outline-none"
                              />
                              <span className="text-sm text-slate-500">%</span>
                            </div>
                          </td>
                          <td className="border-b border-slate-200 px-3 py-2 text-right text-base text-slate-500">
                            {preliminaryMarkupAmountByRowId[row.id] !== undefined
                              ? preliminaryMarkupAmountByRowId[row.id] === null
                                ? "-"
                                : `$${formatCurrency(preliminaryMarkupAmountByRowId[row.id] ?? 0)}`
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                      </table>
                    </div>
                  ) : null}
                </section>

                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => toggleSection("projectData")}
                    className="flex w-full items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-800"
                  >
                    <span className="flex items-center gap-2">
                      <svg
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                        className={`h-4 w-4 transition-transform ${
                          openSections.projectData ? "rotate-180" : "rotate-0"
                        }`}
                      >
                        <path d="M5 7l5 6 5-6H5z" fill="currentColor" />
                      </svg>
                      <span>Project Data</span>
                    </span>
                    <span className="text-xs text-slate-500">
                      {openSections.projectData ? "Hide" : "Show"}
                    </span>
                  </button>
                  {openSections.projectData ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
                    <thead className="bg-slate-100/80 text-slate-700">
                      <tr>
                        <th className="w-[50%] border-b border-r border-slate-200 px-3 py-2 text-left font-semibold">
                          PROJECT DATA
                        </th>
                        <th className="w-[16%] border-b border-r border-slate-200 px-3 py-2 text-left font-semibold">
                          Value
                        </th>
                        <th className="w-[34%] border-b border-slate-200 px-3 py-2 text-left font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {resolvedProjectDataRows.map((row) => (
                        <tr key={row.id} className="odd:bg-white even:bg-slate-50/30">
                          <td className="border-b border-r border-slate-200 p-0">
                            <div className="min-h-11 px-3 py-2 text-base text-slate-900">{row.label}</div>
                          </td>
                          <td className="border-b border-r border-slate-200 p-0">
                            <div className="flex h-11 items-center justify-end gap-1 px-3">
                              {row.valueType === "currency" ? (
                                <span className="text-slate-700">$</span>
                              ) : null}
                              <input
                                value={row.value}
                                onChange={(event) =>
                                  updateProjectDataValue(row.id, event.target.value)
                                }
                                readOnly={row.readOnly}
                                className={`h-full w-full border-0 bg-transparent text-right text-base text-slate-900 focus:outline-none ${
                                  row.readOnly ? "cursor-default" : "focus:bg-white"
                                }`}
                              />
                              {row.valueType === "percent" ? (
                                <span className="text-slate-700">%</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="border-b border-slate-200 px-3 py-2"></td>
                        </tr>
                      ))}
                    </tbody>
                      </table>
                    </div>
                  ) : null}
                </section>

                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => toggleSection("salesTax")}
                    className="flex w-full items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-800"
                  >
                    <span className="flex items-center gap-2">
                      <svg
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                        className={`h-4 w-4 transition-transform ${
                          openSections.salesTax ? "rotate-180" : "rotate-0"
                        }`}
                      >
                        <path d="M5 7l5 6 5-6H5z" fill="currentColor" />
                      </svg>
                      <span>Sales Tax</span>
                    </span>
                    <span className="text-xs text-slate-500">
                      {openSections.salesTax ? "Hide" : "Show"}
                    </span>
                  </button>
                  {openSections.salesTax ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
                    <thead className="bg-[#e8792e] text-white">
                      <tr>
                        <th className="w-[50%] border-b border-r border-[#c96420] px-3 py-2 text-left font-semibold">
                          SALES TAX
                        </th>
                        <th className="w-[16%] border-b border-r border-[#c96420] px-3 py-2 text-right font-semibold">
                          Number
                        </th>
                        <th className="w-[16%] border-b border-r border-[#c96420] px-3 py-2 text-right font-semibold">
                          Tax Rates
                        </th>
                        <th className="w-[18%] border-b border-[#c96420] px-3 py-2 text-right font-semibold">
                          Actual
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-slate-200/70">
                        <td className="border-b border-r border-slate-300 px-3 py-2 font-semibold text-slate-900">
                          Arizona
                        </td>
                        <td className="border-b border-r border-slate-300 px-3 py-2"></td>
                        <td className="border-b border-r border-slate-300 px-3 py-2"></td>
                        <td className="border-b border-slate-300 px-3 py-2"></td>
                      </tr>
                      {salesTaxRows.map((row) => (
                        <tr key={row.id} className="odd:bg-white even:bg-slate-50/30">
                          <td className="border-b border-r border-slate-200 px-3 py-2 text-slate-900">
                            {row.city}
                          </td>
                          <td className="border-b border-r border-slate-200 px-3 py-2 text-right text-slate-900">
                            {row.number}
                          </td>
                          <td className="border-b border-r border-slate-200 p-0">
                            <div className="flex h-11 items-center justify-end gap-1 px-3">
                              <input
                                value={row.taxRate}
                                onChange={(event) => updateSalesTaxRate(row.id, event.target.value)}
                                className="h-full w-full border-0 bg-transparent text-right text-base text-slate-900 focus:bg-white focus:outline-none"
                              />
                              <span className="text-slate-500">%</span>
                            </div>
                          </td>
                          <td className="border-b border-slate-200 px-3 py-2 text-right text-red-600">
                            {toActualTaxRate(row.taxRate)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-200/70">
                        <td className="border-b border-r border-slate-300 px-3 py-2 font-semibold text-slate-900">
                          Unknown
                        </td>
                        <td className="border-b border-r border-slate-300 px-3 py-2"></td>
                        <td className="border-b border-r border-slate-300 px-3 py-2"></td>
                        <td className="border-b border-slate-300 px-3 py-2"></td>
                      </tr>
                      <tr className="bg-white">
                        <td className="border-b border-r border-slate-200 px-3 py-2 text-slate-900">
                          Look Up: www.salestaxhandbook.com/arizona/rates/
                        </td>
                        <td className="border-b border-r border-slate-200 px-3 py-2 text-right text-slate-900">
                          {unknownSalesTax.number}
                        </td>
                        <td className="border-b border-r border-slate-200 p-0">
                          <div className="flex h-11 items-center justify-end gap-1 px-3">
                            <input
                              value={unknownSalesTax.taxRate}
                              onChange={(event) =>
                                setUnknownSalesTax((prev) => ({ ...prev, taxRate: event.target.value }))
                              }
                              className="h-full w-full border-0 bg-transparent text-right text-base text-slate-900 focus:bg-white focus:outline-none"
                            />
                            <span className="text-slate-500">%</span>
                          </div>
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 text-right text-red-600">
                          {toActualTaxRate(unknownSalesTax.taxRate)}
                        </td>
                      </tr>
                      <tr className="bg-slate-200/70">
                        <td className="border-b border-r border-slate-300 px-3 py-2 font-semibold text-slate-900">
                          {tiTax.city}
                        </td>
                        <td className="border-b border-r border-slate-300 px-3 py-2 text-right text-slate-900">
                          {tiTax.number}
                        </td>
                        <td className="border-b border-r border-slate-300 p-0">
                          <div className="flex h-11 items-center justify-end gap-1 px-3">
                            <input
                              value={tiTax.taxRate}
                              onChange={(event) =>
                                setTiTax((prev) => ({ ...prev, taxRate: event.target.value }))
                              }
                              className="h-full w-full border-0 bg-transparent text-right text-base text-slate-900 focus:bg-white focus:outline-none"
                            />
                            <span className="text-slate-700">%</span>
                          </div>
                        </td>
                        <td className="border-b border-slate-300 px-3 py-2 text-right text-red-600">
                          {toActualTaxRate(tiTax.taxRate)}
                        </td>
                      </tr>
                      <tr className="bg-slate-300/80 font-semibold">
                        <td className="border-b border-r border-slate-400 px-3 py-2 text-slate-900">
                          {notTaxable.city}
                        </td>
                        <td className="border-b border-r border-slate-400 px-3 py-2 text-right text-slate-900">
                          {notTaxable.number}
                        </td>
                        <td className="border-b border-r border-slate-400 px-3 py-2 text-right text-slate-900">
                          {notTaxable.taxRate}%
                        </td>
                        <td className="border-b border-slate-400 px-3 py-2 text-right text-red-600">
                          {toActualTaxRate(notTaxable.taxRate)}
                        </td>
                      </tr>
                      <tr className="bg-[#efdfd4]">
                        <td className="border-b border-r border-slate-300 px-3 py-2 text-right font-semibold text-slate-900">
                          Enter City Number
                        </td>
                        <td className="border-b border-r border-slate-300 p-0">
                          <input
                            value={selectedCityNumber}
                            onChange={(event) => setSelectedCityNumber(event.target.value)}
                            className="h-11 w-full border-0 bg-transparent px-3 text-right text-base font-semibold text-slate-900 focus:bg-white focus:outline-none"
                          />
                        </td>
                        <td className="border-b border-r border-slate-300 px-3 py-2"></td>
                        <td className="border-b border-slate-300 px-3 py-2"></td>
                      </tr>
                    </tbody>
                      </table>
                    </div>
                  ) : null}
                </section>

                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => toggleSection("costSummary")}
                    className="flex w-full items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-800"
                  >
                    <span className="flex items-center gap-2">
                      <svg
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                        className={`h-4 w-4 transition-transform ${
                          openSections.costSummary ? "rotate-180" : "rotate-0"
                        }`}
                      >
                        <path d="M5 7l5 6 5-6H5z" fill="currentColor" />
                      </svg>
                      <span>Cost Summary</span>
                    </span>
                    <span className="text-xs text-slate-500">
                      {openSections.costSummary ? "Hide" : "Show"}
                    </span>
                  </button>
                  {openSections.costSummary ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
                    <thead className="bg-slate-100/80 text-slate-700">
                      <tr>
                        <th className="w-[50%] border-b border-r border-slate-200 px-3 py-2 text-left font-semibold">
                          COST SUMMARY
                        </th>
                        <th className="w-[16%] border-b border-r border-slate-200 px-3 py-2 text-left font-semibold">
                          Value
                        </th>
                        <th className="w-[34%] border-b border-slate-200 px-3 py-2 text-left font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {costSummaryRows.map((row) => (
                        <tr key={row.id} className="odd:bg-white even:bg-slate-50/30">
                          <td className="border-b border-r border-slate-200 p-0">
                            <div className="min-h-11 px-3 py-2 text-base text-slate-900">{row.label}</div>
                          </td>
                          <td className="border-b border-r border-slate-200 p-0">
                            <div className="flex h-11 items-center justify-end gap-1 px-3">
                              <span className="text-slate-700">$</span>
                              <input
                                value={row.amount}
                                onChange={(event) =>
                                  updateCostSummaryAmount(row.id, event.target.value)
                                }
                                className="h-full w-full border-0 bg-transparent text-right text-base text-slate-900 focus:bg-white focus:outline-none"
                              />
                            </div>
                          </td>
                          <td className="border-b border-slate-200 px-3 py-2"></td>
                        </tr>
                      ))}
                      <tr className="bg-white">
                        <td className="border-b border-r border-t-2 border-slate-900 px-3 py-2 text-right text-base font-bold text-slate-900">
                          TOTAL
                        </td>
                        <td className="border-b border-r border-t-2 border-slate-900 px-3 py-2 text-right text-xl font-bold text-slate-900">
                          ${summaryTotal}
                        </td>
                        <td className="border-b border-t-2 border-slate-900 px-3 py-2"></td>
                      </tr>
                      <tr className="bg-white">
                        <td className="border-b border-r border-slate-200 px-3 py-2 text-right text-base font-bold text-slate-900">
                          %
                        </td>
                        <td className="border-b border-r border-slate-200 p-0">
                          <div className="flex h-11 items-center justify-end gap-1 px-3">
                            <input
                              value={costSummaryPercent}
                              onChange={(event) => setCostSummaryPercent(event.target.value)}
                              className="h-full w-full border-0 bg-transparent text-right text-xl font-bold text-slate-900 focus:bg-white focus:outline-none"
                            />
                            <span className="text-base font-bold text-slate-900">%</span>
                          </div>
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2"></td>
                      </tr>
                    </tbody>
                      </table>
                    </div>
                  ) : null}
                </section>
              </div>
            </div>
          ) : generalConditionsView ? (
            <div className="p-3">
              {renderRowVisibilityFilterControl(
                "general-conditions-row-visibility-filter",
                generalConditionsRowVisibilityFilter,
                setGeneralConditionsRowVisibilityFilter
              )}
              <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
                <table className="w-full min-w-[1200px] border-separate border-spacing-0 text-sm text-slate-800">
                  <colgroup>
                    <col className="w-[10%]" />
                    <col className="w-[39%]" />
                    <col className="w-[7%]" />
                    <col className="w-[8%]" />
                    <col className="w-[8%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[8%]" />
                  </colgroup>
                  <tbody>
                    <tr className="bg-slate-100 text-slate-800">
                      <td className="border-b border-r border-slate-400 px-2 py-2 font-semibold">Cost Code</td>
                      <td className="border-b border-r border-slate-400 px-2 py-2 font-semibold">Description</td>
                      <td className="border-b border-r border-slate-400 px-2 py-2 font-semibold text-center"></td>
                      <td className="border-b border-r border-slate-400 px-2 py-2 font-semibold text-center">Unit</td>
                      <td className="border-b border-r border-slate-400 px-2 py-2 font-semibold text-center">Quan</td>
                      <td className="border-b border-r border-slate-400 px-2 py-2 font-semibold text-center">$/Unit</td>
                      <td className="border-b border-r border-slate-400 px-2 py-2 font-semibold text-center">Total</td>
                      <td className="border-b border-slate-400 px-2 py-2 font-semibold text-center">Comments</td>
                    </tr>
                    {filteredGeneralConditionsRows.map((row, rowIndex) => (
                      <tr
                        key={row.id}
                        className={row.autoCalculated ? "bg-orange-50" : "bg-white"}
                      >
                        <td className="border-b border-r border-slate-300 p-0">
                          <input
                            data-gc-row={rowIndex}
                            data-gc-col={0}
                            value={row.costCode}
                            onChange={(event) =>
                              updateGeneralConditionsCell(row.id, "costCode", event.target.value)
                            }
                            onKeyDown={handleGeneralConditionsCellKeyDown(rowIndex, 0)}
                            className="h-8 w-full border-0 bg-transparent px-2 text-xs text-slate-600 focus:bg-white focus:outline-none"
                          />
                        </td>
                        <td
                          colSpan={row.percentage ? 1 : 2}
                          className="border-b border-r border-slate-300 p-0"
                        >
                          <input
                            data-gc-row={rowIndex}
                            data-gc-col={1}
                            value={row.description}
                            onChange={(event) =>
                              updateGeneralConditionsCell(row.id, "description", event.target.value)
                            }
                            onKeyDown={handleGeneralConditionsCellKeyDown(rowIndex, 1)}
                            className="h-8 w-full border-0 bg-transparent px-2 text-sm font-semibold text-slate-700 focus:bg-white focus:outline-none"
                          />
                        </td>
                        {row.percentage ? (
                          <td className="border-b border-r border-slate-300 bg-[#efdfd4] p-0">
                            <input
                              data-gc-row={rowIndex}
                              data-gc-col={2}
                              value={row.percentage}
                              onChange={(event) =>
                                updateGeneralConditionsCell(row.id, "percentage", event.target.value)
                              }
                              onKeyDown={handleGeneralConditionsCellKeyDown(rowIndex, 2)}
                              className="h-8 w-full border-0 bg-transparent px-2 text-right text-base font-semibold text-slate-700 focus:bg-[#f6e7dd] focus:outline-none"
                            />
                          </td>
                        ) : null}
                        <td className="border-b border-r border-slate-300 p-0">
                          <input
                            data-gc-row={rowIndex}
                            data-gc-col={3}
                            value={row.unit}
                            onChange={(event) =>
                              updateGeneralConditionsCell(row.id, "unit", event.target.value)
                            }
                            onKeyDown={handleGeneralConditionsCellKeyDown(rowIndex, 3)}
                            className="h-8 w-full border-0 bg-transparent px-2 text-center text-sm text-slate-700 focus:bg-white focus:outline-none"
                          />
                        </td>
                        <td className="border-b border-r border-slate-300 p-0">
                          <input
                            data-gc-row={rowIndex}
                            data-gc-col={4}
                            value={row.quantity === "0" ? "" : row.quantity}
                            onChange={(event) =>
                              updateGeneralConditionsCell(row.id, "quantity", event.target.value)
                            }
                            onKeyDown={handleGeneralConditionsCellKeyDown(rowIndex, 4)}
                            placeholder="0"
                            className={`h-8 w-full border-0 bg-transparent px-2 text-center text-sm font-semibold focus:bg-white focus:outline-none ${
                              row.quantity !== "0" && row.quantity !== "" ? "text-orange-600" : "text-slate-700"
                            }`}
                          />
                        </td>
                        <td className="border-b border-r border-slate-300 p-0">
                          <div className="flex h-8 items-center gap-2 px-2 text-sm">
                            <span className="text-slate-700">$</span>
                            <input
                              data-gc-row={rowIndex}
                              data-gc-col={5}
                              value={row.unitPrice === "-" ? "" : row.unitPrice}
                              onChange={(event) =>
                                updateGeneralConditionsCell(row.id, "unitPrice", event.target.value)
                              }
                              readOnly={Boolean(row.autoCalculated)}
                              onFocus={() => {
                                if (row.autoCalculated) return;
                                if (row.unitPrice === "-") {
                                  updateGeneralConditionsCell(row.id, "unitPrice", "");
                                }
                              }}
                              onBlur={(event) => {
                                if (row.autoCalculated) return;
                                updateGeneralConditionsCell(
                                  row.id,
                                  "unitPrice",
                                  formatToTwoDecimals(event.target.value)
                                );
                              }}
                              onKeyDown={handleGeneralConditionsCellKeyDown(rowIndex, 5)}
                              placeholder="-"
                              className={`h-full w-full border-0 bg-transparent text-right text-sm text-slate-700 focus:outline-none ${
                                row.autoCalculated ? "font-semibold text-orange-700" : "focus:bg-white"
                              }`}
                            />
                          </div>
                        </td>
                        <td className="border-b border-r border-slate-300 p-0">
                          {row.computedTotal === null ? (
                            <div className="flex h-8 items-center justify-center px-2 text-sm text-slate-700">
                              -
                            </div>
                          ) : (
                            <div className="flex h-8 items-center gap-2 px-2 text-sm">
                              <span className="text-slate-700">$</span>
                              <div className="w-full text-right text-sm text-slate-700">
                                {row.computedTotalDisplay}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="border-b border-slate-300 p-0">
                          <input
                            data-gc-row={rowIndex}
                            data-gc-col={6}
                            value={row.autoCalculated ? row.autoCalculatedComment : row.comments}
                            onChange={(event) =>
                              updateGeneralConditionsCell(row.id, "comments", event.target.value)
                            }
                            readOnly={Boolean(row.autoCalculated)}
                            onKeyDown={handleGeneralConditionsCellKeyDown(rowIndex, 6)}
                            className={`h-8 w-full border-0 bg-transparent px-2 text-sm text-slate-700 focus:outline-none ${
                              row.autoCalculated ? "font-semibold text-orange-700" : "focus:bg-white"
                            }`}
                          />
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#e8792e]">
                      <td colSpan={6} className="border-b border-[#c96420] px-4 py-2"></td>
                      <td className="border-b border-r border-[#c96420] px-4 py-2 text-right text-2xl font-semibold text-white">
                        ${displayedGeneralConditionsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="border-b border-[#c96420] px-2 py-2"></td>
                    </tr>
                    <tr className="bg-slate-200">
                      <td colSpan={5} className="border-b border-slate-300 px-2 py-2"></td>
                      <td className="border-b border-r border-slate-300 px-4 py-2 text-right align-top">
                        <div className="space-y-1 text-2xl font-semibold leading-tight text-slate-900">
                          <div>Wkly</div>
                          <div>Monthly</div>
                        </div>
                      </td>
                      <td className="border-b border-r border-slate-300 px-4 py-2 text-right align-top">
                        <div className="space-y-1 text-2xl leading-tight text-slate-900">
                          <div>
                            <span className="mr-3">$</span>
                            <span>{displayedGeneralConditionsWeekly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div>
                            <span className="mr-3">$</span>
                            <span>{displayedGeneralConditionsMonthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-slate-300 px-2 py-2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : coverPageView ? (
            <div className="p-3">
              {renderRowVisibilityFilterControl(
                "cover-row-visibility-filter",
                coverRowVisibilityFilter,
                setCoverRowVisibilityFilter
              )}
              <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
                <table className="w-full border-separate border-spacing-0 text-sm text-slate-900">
                  <colgroup>
                    <col className="w-[16%]" />
                    <col className="w-[34%]" />
                    <col className="w-[16%]" />
                    <col className="w-[34%]" />
                  </colgroup>
                  <tbody>
                    <tr className="bg-white">
                      <td colSpan={4} className="border-b border-slate-300 px-3 py-2 text-center text-2xl font-black tracking-wide">
                        PRELIMINARY ESTIMATE
                      </td>
                    </tr>
                    <tr className="bg-white">
                      <td colSpan={2} className="border-b border-r border-slate-300 px-3 py-2 text-base font-bold">
                        ATTN:
                      </td>
                      <td className="border-b border-r border-slate-300 px-3 py-2 text-base font-bold">
                        Contractor Information
                      </td>
                      <td className="border-b border-slate-300"></td>
                    </tr>
                    <tr className="bg-white">
                      <td className="border-b border-r border-slate-300 px-3 py-1 text-sm italic">Name</td>
                      <td className="border-b border-r border-slate-300 p-0">
                        <input
                          value={getCoverPageFieldValue("cover-attn-name")}
                          onChange={(event) =>
                            updateCoverPageField("cover-attn-name", event.target.value)
                          }
                          className="h-9 w-full border-0 bg-transparent px-3 text-sm focus:bg-white focus:outline-none"
                        />
                      </td>
                      <td className="border-b border-r border-slate-300 px-3 py-1 text-sm italic">Company</td>
                      <td className="border-b border-slate-300 p-0">
                        <input
                          value={getCoverPageFieldValue("cover-contractor-company")}
                          onChange={(event) =>
                            updateCoverPageField("cover-contractor-company", event.target.value)
                          }
                          className="h-9 w-full border-0 bg-transparent px-3 text-sm focus:bg-white focus:outline-none"
                        />
                      </td>
                    </tr>
                    <tr className="bg-white">
                      <td className="border-b border-r border-slate-300 px-3 py-1 text-sm italic">Address</td>
                      <td className="border-b border-r border-slate-300 p-0">
                        <input
                          value={getCoverPageFieldValue("cover-attn-address")}
                          onChange={(event) =>
                            updateCoverPageField("cover-attn-address", event.target.value)
                          }
                          className="h-9 w-full border-0 bg-transparent px-3 text-sm focus:bg-white focus:outline-none"
                        />
                      </td>
                      <td className="border-b border-r border-slate-300 px-3 py-1 text-sm italic">Name</td>
                      <td className="border-b border-slate-300 p-0">
                        <input
                          value={getCoverPageFieldValue("cover-contractor-name")}
                          onChange={(event) =>
                            updateCoverPageField("cover-contractor-name", event.target.value)
                          }
                          className="h-9 w-full border-0 bg-transparent px-3 text-sm focus:bg-white focus:outline-none"
                        />
                      </td>
                    </tr>
                    <tr className="bg-white">
                      <td className="border-b border-r border-slate-300 px-3 py-1 text-sm italic">Phone</td>
                      <td className="border-b border-r border-slate-300 p-0">
                        <input
                          value={getCoverPageFieldValue("cover-attn-phone")}
                          onChange={(event) =>
                            updateCoverPageField("cover-attn-phone", event.target.value)
                          }
                          className="h-9 w-full border-0 bg-transparent px-3 text-sm focus:bg-white focus:outline-none"
                        />
                      </td>
                      <td className="border-b border-r border-slate-300 px-3 py-1 text-sm italic">Address</td>
                      <td className="border-b border-slate-300 p-0">
                        <input
                          value={getCoverPageFieldValue("cover-contractor-address")}
                          onChange={(event) =>
                            updateCoverPageField("cover-contractor-address", event.target.value)
                          }
                          className="h-9 w-full border-0 bg-transparent px-3 text-sm focus:bg-white focus:outline-none"
                        />
                      </td>
                    </tr>
                    <tr className="bg-white">
                      <td className="border-b border-r border-slate-300 px-3 py-1 text-sm italic">Email</td>
                      <td className="border-b border-r border-slate-300 p-0">
                        <input
                          value={getCoverPageFieldValue("cover-attn-email")}
                          onChange={(event) =>
                            updateCoverPageField("cover-attn-email", event.target.value)
                          }
                          className="h-9 w-full border-0 bg-transparent px-3 text-sm focus:bg-white focus:outline-none"
                        />
                      </td>
                      <td className="border-b border-r border-slate-300 px-3 py-1 text-sm italic">City, State ZIP</td>
                      <td className="border-b border-slate-300 p-0">
                        <input
                          value={getCoverPageFieldValue("cover-contractor-city-state-zip")}
                          onChange={(event) =>
                            updateCoverPageField(
                              "cover-contractor-city-state-zip",
                              event.target.value
                            )
                          }
                          className="h-9 w-full border-0 bg-transparent px-3 text-sm focus:bg-white focus:outline-none"
                        />
                      </td>
                    </tr>
                    <tr className="bg-white">
                      <td className="border-b border-r border-slate-300 px-3 py-1 text-base font-bold">Project Name</td>
                      <td className="border-b border-r border-slate-300 p-0">
                        <input
                          value={getCoverPageFieldValue("cover-project-name")}
                          onChange={(event) =>
                            updateCoverPageField("cover-project-name", event.target.value)
                          }
                          className="h-9 w-full border-0 bg-transparent px-3 text-sm focus:bg-white focus:outline-none"
                        />
                      </td>
                      <td className="border-b border-r border-slate-300 px-3 py-1 text-sm italic">Phone</td>
                      <td className="border-b border-slate-300 p-0">
                        <input
                          value={getCoverPageFieldValue("cover-contractor-phone")}
                          onChange={(event) =>
                            updateCoverPageField("cover-contractor-phone", event.target.value)
                          }
                          className="h-9 w-full border-0 bg-transparent px-3 text-sm focus:bg-white focus:outline-none"
                        />
                      </td>
                    </tr>
                    <tr className="bg-white">
                      <td className="border-b border-r border-slate-300 px-3 py-1 text-base font-bold">Architect</td>
                      <td className="border-b border-r border-slate-300 p-0">
                        <input
                          value={getCoverPageFieldValue("cover-architect")}
                          onChange={(event) =>
                            updateCoverPageField("cover-architect", event.target.value)
                          }
                          className="h-9 w-full border-0 bg-transparent px-3 text-sm focus:bg-white focus:outline-none"
                        />
                      </td>
                      <td className="border-b border-r border-slate-300 px-3 py-1 text-sm italic">Email</td>
                      <td className="border-b border-slate-300 p-0">
                        <input
                          value={getCoverPageFieldValue("cover-contractor-email")}
                          onChange={(event) =>
                            updateCoverPageField("cover-contractor-email", event.target.value)
                          }
                          className="h-9 w-full border-0 bg-transparent px-3 text-sm focus:bg-white focus:outline-none"
                        />
                      </td>
                    </tr>
                    <tr className="bg-white">
                      <td className="border-b border-r border-slate-300 px-3 py-1"></td>
                      <td className="border-b border-r border-slate-300"></td>
                      <td className="border-b border-r border-slate-300 px-3 py-1 text-base font-bold">Bid Set Date</td>
                      <td className="border-b border-slate-300 p-0">
                        <input
                          value={getCoverPageFieldValue("cover-bid-set-date")}
                          onChange={(event) =>
                            updateCoverPageField("cover-bid-set-date", event.target.value)
                          }
                          className="h-9 w-full border-0 bg-transparent px-3 text-sm italic focus:bg-white focus:outline-none"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-3 overflow-x-auto rounded-lg border border-[#c96420] bg-[#d9d9d9]">
                <table className="w-full border-separate border-spacing-0 text-slate-900">
                  <colgroup>
                    <col className="w-[10%]" />
                    <col className="w-[48%]" />
                    <col className="w-[17%]" />
                    <col className="w-[12%]" />
                    <col className="w-[13%]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-[#e8792e] text-white">
                      <th className="px-2 py-2 text-left text-sm font-semibold">DIVISION</th>
                      <th className="px-2 py-2 text-left text-sm font-semibold">ITEM</th>
                      <th className="px-2 py-2 text-center text-sm font-semibold">TOTAL</th>
                      <th className="px-2 py-2 text-center text-sm font-semibold">$/SF</th>
                      <th className="px-2 py-2 text-center text-sm font-semibold">% of Scope</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverDivisionRows.map((row) => (
                      <Fragment key={`cover-division-${row.divisionLabel}-${row.item}`}>
                        <tr className="bg-[#d9d9d9]">
                          <td className="border-b border-t-2 border-slate-500 px-2 py-2 text-sm">
                            {row.divisionLabel}
                          </td>
                          <td className="border-b border-t-2 border-slate-500 bg-white px-2 py-2 text-base font-semibold">
                            {row.item}
                          </td>
                          <td className="border-b border-t-2 border-slate-500 bg-white px-2 py-2 text-center text-base font-semibold">
                            ${formatCurrency(row.subtotal)}
                          </td>
                          <td className="border-b border-t-2 border-slate-500 bg-white px-2 py-2 text-center text-base italic text-slate-600">
                            {row.dollarsPerSf === null ? "-" : row.dollarsPerSf.toFixed(2)}
                          </td>
                          <td className="border-b border-t-2 border-slate-500 bg-white px-2 py-2 text-center text-base italic text-slate-600">
                            {row.scopePercent === null ? "0%" : `${Math.round(row.scopePercent)}%`}
                          </td>
                        </tr>
                        {row.summaryDescription ? (
                          <tr className="bg-[#c8c8c8]">
                            <td className="border-b border-slate-500 px-2 py-1"></td>
                            <td className="border-b border-slate-500 px-2 py-1 text-sm italic">
                              {row.summaryDescription}
                            </td>
                            <td className="border-b border-slate-500"></td>
                            <td className="border-b border-slate-500"></td>
                            <td className="border-b border-slate-500"></td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                    <tr className="bg-[#e8792e] text-white">
                      <td colSpan={2} className="border-t border-[#c96420] px-2 py-2 text-right text-sm font-semibold">
                        SUBTOTAL
                      </td>
                      <td className="border-t border-[#c96420] px-2 py-2 text-center text-sm font-semibold">
                        ${formatCurrency(preliminarySubtotal)}
                      </td>
                      <td className="border-t border-[#c96420]"></td>
                      <td className="border-t border-[#c96420]"></td>
                    </tr>
                    <tr className="bg-[#c8c8c8]">
                      <td colSpan={5} className="h-4 border-b border-slate-500"></td>
                    </tr>
                    {preliminaryMarkupRows.map((markupRow) => (
                      <tr key={`cover-footer-${markupRow.label}`} className="bg-[#c8c8c8]">
                        <td className="px-2 py-1 text-left text-xs font-medium text-slate-700">
                          {markupRow.costCode}
                        </td>
                        <td className="px-2 py-1 text-right text-sm font-medium text-slate-900">
                          {markupRow.label}
                        </td>
                        <td className="px-2 py-1 text-center text-sm font-medium text-slate-900">
                          {markupRow.amount === null ? "-" : `$${formatCurrency(markupRow.amount)}`}
                        </td>
                        <td></td>
                        <td></td>
                      </tr>
                    ))}
                    <tr className="bg-[#e8792e] text-white">
                      <td colSpan={2} className="border-t border-[#c96420] px-2 py-2 text-right text-sm font-semibold">
                        TOTAL
                      </td>
                      <td className="border-t border-[#c96420] px-2 py-2 text-center text-sm font-semibold">
                        ${formatCurrency(preliminaryGrandTotal)}
                      </td>
                      <td className="border-t border-[#c96420]"></td>
                      <td className="border-t border-[#c96420]"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : preliminaryWorksheetView ? (
            <div className="p-3">
              {renderRowVisibilityFilterControl(
                "prelim-worksheet-row-visibility-filter",
                prelimWorksheetRowVisibilityFilter,
                setPrelimWorksheetRowVisibilityFilter
              )}
              {worksheetGcMarkupMessage ? (
                <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                  {worksheetGcMarkupMessage}
                </div>
              ) : null}
              <div className="max-h-[75vh] overflow-auto rounded-lg border border-slate-300 bg-white pb-6">
                <table
                  className="w-full border-separate border-spacing-0 text-sm text-slate-800"
                  style={{
                    minWidth: `${prelimColumnWidths.reduce((sum, width) => sum + width, 0)}px`,
                  }}
                >
                  <colgroup>
                    {prelimColumnWidths.map((width, index) => (
                      <col key={`prelim-col-${index}`} style={{ width: `${width}px` }} />
                    ))}
                  </colgroup>
                  <thead className="sticky top-0 z-30 bg-slate-100 text-slate-800">
                    <tr>
                      <th className="sticky top-0 z-20 relative border-b border-r border-slate-400 px-2 py-2 text-left font-semibold">
                        COST CODE
                        <span
                          onMouseDown={(event) => beginPrelimColumnResize(0, event)}
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                        />
                      </th>
                      <th className="sticky top-0 z-20 relative border-b border-r border-slate-400 px-2 py-2 text-left font-semibold">
                        DESCRIPTION
                        <span
                          onMouseDown={(event) => beginPrelimColumnResize(1, event)}
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                        />
                      </th>
                      <th className="sticky top-0 z-20 relative border-b border-r border-slate-400 px-2 py-2 text-center font-semibold">
                        UNIT
                        <span
                          onMouseDown={(event) => beginPrelimColumnResize(2, event)}
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                        />
                      </th>
                      <th className="sticky top-0 z-20 relative border-b border-r border-slate-400 px-2 py-2 text-center font-semibold">
                        QUAN
                        <span
                          onMouseDown={(event) => beginPrelimColumnResize(3, event)}
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                        />
                      </th>
                      <th className="sticky top-0 z-20 relative border-b border-r border-slate-400 px-2 py-2 text-center font-semibold">
                        $/UNIT
                        <span
                          onMouseDown={(event) => beginPrelimColumnResize(4, event)}
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                        />
                      </th>
                      <th className="sticky top-0 z-20 relative border-b border-r border-slate-400 bg-[#f9e3ae] px-2 py-2 text-center font-semibold text-slate-900">
                        GC MARKUP
                        <span
                          onMouseDown={(event) => beginPrelimColumnResize(5, event)}
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                        />
                      </th>
                      <th className="sticky top-0 z-20 relative border-b border-r border-slate-400 px-2 py-2 text-center font-semibold">
                        TOTAL
                        <span
                          onMouseDown={(event) => beginPrelimColumnResize(6, event)}
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                        />
                      </th>
                      <th className="sticky top-0 z-20 relative border-b border-slate-400 px-2 py-2 text-center font-semibold">
                        COMMENTS
                        <span
                          onMouseDown={(event) => beginPrelimColumnResize(7, event)}
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {worksheetLoading ? (
                      <tr className="bg-white">
                        <td colSpan={8} className="px-4 py-4 text-base font-medium text-slate-700">
                          Loading cost codes...
                        </td>
                      </tr>
                    ) : null}
                    {worksheetError ? (
                      <tr className="bg-red-50">
                        <td colSpan={8} className="px-4 py-3 text-sm font-medium text-red-700">
                          {worksheetError}
                        </td>
                      </tr>
                    ) : null}
                    {!worksheetLoading &&
                    !worksheetError &&
                    filteredWorksheetDivisionGroups.length === 0 ? (
                      <tr className="bg-white">
                        <td colSpan={8} className="px-4 py-4 text-base font-medium text-slate-700">
                          No cost codes found.
                        </td>
                      </tr>
                    ) : null}
                    {!worksheetLoading &&
                      !worksheetError &&
                      filteredWorksheetDivisionGroups.map((group) => (
                        <Fragment key={group.division}>
                          <tr key={`division-${group.division}`} className="bg-[#bcbcbc]">
                            <td
                              colSpan={8}
                              className="border-b border-slate-400 px-2 py-2 text-sm font-semibold uppercase tracking-wide text-slate-900"
                            >
                              <button
                                type="button"
                                onClick={() => toggleWorksheetDivisionExpanded(group.division)}
                                className="flex w-full items-center gap-2 text-left"
                              >
                                <span className="inline-block w-4 text-center text-xs leading-none">
                                  {(expandedWorksheetDivisionKeys[group.division] ?? true)
                                    ? "▾"
                                    : "▸"}
                                </span>
                                {group.divisionCode ? (
                                  <span className="inline-block min-w-6 text-left">
                                    {group.divisionCode}
                                  </span>
                                ) : null}
                                <span>{group.divisionTitle}</span>
                              </button>
                            </td>
                          </tr>
                          {(expandedWorksheetDivisionKeys[group.division] ?? true)
                            ? group.costCodeGroups.map((costCodeGroup) => (
                            <Fragment key={costCodeGroup.id}>
                              <tr className="bg-slate-50">
                                <td className="border-b border-slate-300 p-0 align-top">
                                  <div className="px-2 py-2 text-xs text-slate-600">{costCodeGroup.code}</div>
                                </td>
                                <td className="border-b border-slate-300 p-0">
                                  {costCodeGroup.readOnlyRollup ? (
                                    <div className="flex h-8 w-full items-center gap-2 px-2 text-left text-sm font-semibold text-slate-700">
                                      {costCodeGroup.title}
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleWorksheetCostCodeExpanded(costCodeGroup.id)
                                      }
                                      className="flex h-8 w-full items-center gap-2 px-2 text-left text-sm font-semibold text-slate-700 hover:bg-white"
                                    >
                                      <span className="inline-block w-4 text-center text-xs leading-none">
                                        {expandedWorksheetCostCodeIds[costCodeGroup.id] ? "▾" : "▸"}
                                      </span>
                                      <input
                                        value={costCodeGroup.title}
                                        onChange={(event) =>
                                          updateWorksheetCostCodeTitle(
                                            costCodeGroup.id,
                                            event.target.value
                                          )
                                        }
                                        onClick={(event) => event.stopPropagation()}
                                        className="h-full w-full border-0 bg-transparent text-sm font-semibold text-slate-700 focus:bg-white focus:outline-none"
                                      />
                                    </button>
                                  )}
                                </td>
                                <td colSpan={3} className="border-b border-slate-300 p-0"></td>
                                <td className="border-b border-r border-slate-300 p-0"></td>
                                <td className="border-b border-slate-300 px-2 py-2 align-middle text-right text-sm font-semibold text-slate-700">
                                  ${formatCurrency(costCodeGroup.total)}
                                </td>
                                <td className="border-b border-slate-300 p-0"></td>
                              </tr>
                              {!costCodeGroup.readOnlyRollup &&
                              expandedWorksheetCostCodeIds[costCodeGroup.id]
                                ? (costCodeGroup.filteredLineItems ?? costCodeGroup.lineItems).map((lineItem) => {
                                    const originalLineIndex = costCodeGroup.lineItems.findIndex(
                                      (candidate) => candidate.id === lineItem.id
                                    );
                                    const isExcluded = isExcludedWorksheetUnit(lineItem.unit);
                                    const quantity = parseNumericInput(lineItem.quantity);
                                    const unitPrice = parseNumericInput(lineItem.unitPrice);
                                    const gcMarkup = parseNumericInput(lineItem.gcMarkup);
                                    const lineTotal = isExcluded ? 0 : quantity * unitPrice + gcMarkup;
                                    const parsedUnitPrice = parseDerivedNumericInput(lineItem.unitPrice);
                                    const canEditGcMarkup =
                                      !isExcluded && parsedUnitPrice !== null && parsedUnitPrice > 0;
                                    const canRemoveLineItem = originalLineIndex > 0;
                                    return (
                                      <tr
                                        key={lineItem.id}
                                        className={isExcluded ? "bg-slate-100 text-slate-500" : "bg-white"}
                                      >
                                        <td className="border-b border-r border-slate-300 p-0 align-top">
                                          <div
                                            className={`px-2 py-0 text-xs ${
                                              isExcluded ? "text-slate-400" : "text-transparent"
                                            }`}
                                          >
                                            {costCodeGroup.code}
                                          </div>
                                        </td>
                                        <td className="group/worksheet-line border-b border-r border-slate-300 p-0 align-top">
                                          <div className="relative">
                                            {canRemoveLineItem ? (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setWorksheetLineItemPendingDelete({
                                                    costCodeId: costCodeGroup.id,
                                                    lineItemId: lineItem.id,
                                                    label: lineItem.description.trim(),
                                                  })
                                                }
                                                className={`absolute left-1 top-1 z-10 inline-flex h-6 w-6 items-center justify-center rounded text-sm font-semibold opacity-0 transition-opacity group-hover/worksheet-line:opacity-100 ${
                                                  isExcluded
                                                    ? "text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                                                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                                }`}
                                                aria-label="Remove line item"
                                                title="Remove line item"
                                              >
                                                ×
                                              </button>
                                            ) : null}
                                            <textarea
                                              value={lineItem.description}
                                              onChange={(event) =>
                                                updateWorksheetLineItemCell(
                                                  costCodeGroup.id,
                                                  lineItem.id,
                                                  "description",
                                                  event.target.value
                                                )
                                              }
                                              onInput={autoResizeWorksheetTextarea}
                                              rows={1}
                                              className={`min-h-8 w-full resize-none border-0 bg-transparent py-1 pr-2 text-sm font-semibold leading-5 focus:outline-none ${
                                                isExcluded
                                                  ? "text-slate-500 focus:bg-slate-50"
                                                  : "text-slate-700 focus:bg-white"
                                              } ${
                                                canRemoveLineItem
                                                  ? "pl-6 transition-[padding] group-hover/worksheet-line:pl-9"
                                                  : "px-6"
                                              }`}
                                            />
                                          </div>
                                        </td>
                                        <td
                                          className={`border-b border-r border-slate-300 p-0 align-top ${
                                            isExcluded ? "bg-slate-200" : "bg-[#efdfd4]"
                                          }`}
                                        >
                                          <select
                                            value={lineItem.unit}
                                            onChange={(event) =>
                                              updateWorksheetLineItemCell(
                                                costCodeGroup.id,
                                                lineItem.id,
                                                "unit",
                                                event.target.value
                                              )
                                            }
                                            className={`h-8 w-full border-0 bg-transparent px-1 text-center text-xs focus:outline-none ${
                                              isExcluded
                                                ? "text-slate-600 focus:bg-slate-100"
                                                : "text-slate-700 focus:bg-[#f6e7dd]"
                                            }`}
                                          >
                                            {WORKSHEET_UNIT_OPTIONS.map((unitOption) => (
                                              <option key={unitOption || "blank"} value={unitOption}>
                                                {unitOption === ""
                                                  ? "Select"
                                                  : unitOption === "excluded"
                                                    ? "Excluded"
                                                    : unitOption}
                                              </option>
                                            ))}
                                          </select>
                                        </td>
                                        <td
                                          className={`border-b border-r border-slate-300 p-0 align-top ${
                                            isExcluded ? "bg-slate-200" : "bg-[#efdfd4]"
                                          }`}
                                        >
                                          <div className="flex h-8 items-center">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                stepWorksheetLineItemQuantity(
                                                  costCodeGroup.id,
                                                  lineItem.id,
                                                  -1
                                                )
                                              }
                                              className={`h-full w-6 border-r border-slate-300 text-xs font-semibold ${
                                                isExcluded
                                                  ? "text-slate-500 hover:bg-slate-300"
                                                  : "text-slate-700 hover:bg-[#ead9cf]"
                                              }`}
                                            >
                                              -
                                            </button>
                                            <input
                                              value={lineItem.quantity}
                                              onChange={(event) =>
                                                updateWorksheetLineItemCell(
                                                  costCodeGroup.id,
                                                  lineItem.id,
                                                  "quantity",
                                                  event.target.value
                                                )
                                              }
                                              className={`h-8 w-full border-0 bg-transparent px-1 text-center text-sm font-semibold focus:outline-none ${
                                                isExcluded
                                                  ? "text-slate-500 focus:bg-slate-100"
                                                  : "text-slate-700 focus:bg-[#f6e7dd]"
                                              }`}
                                            />
                                            <button
                                              type="button"
                                              onClick={() =>
                                                stepWorksheetLineItemQuantity(
                                                  costCodeGroup.id,
                                                  lineItem.id,
                                                  1
                                                )
                                              }
                                              className={`h-full w-6 border-l border-slate-300 text-xs font-semibold ${
                                                isExcluded
                                                  ? "text-slate-500 hover:bg-slate-300"
                                                  : "text-slate-700 hover:bg-[#ead9cf]"
                                              }`}
                                            >
                                              +
                                            </button>
                                          </div>
                                        </td>
                                        <td className="border-b border-r border-slate-300 p-0 align-top">
                                          <div className="flex h-8 items-center gap-1 px-1 text-sm">
                                            <span className={`w-2 ${isExcluded ? "text-slate-400" : "text-slate-700"}`}>
                                              $
                                            </span>
                                            <input
                                              value={
                                                activeWorksheetUnitPriceCell ===
                                                  worksheetUnitPriceCellKey(
                                                    costCodeGroup.id,
                                                    lineItem.id
                                                  ) &&
                                                worksheetUnitPriceFormulas[
                                                  worksheetUnitPriceCellKey(
                                                    costCodeGroup.id,
                                                    lineItem.id
                                                  )
                                                ]
                                                  ? worksheetUnitPriceFormulas[
                                                      worksheetUnitPriceCellKey(
                                                        costCodeGroup.id,
                                                        lineItem.id
                                                      )
                                                    ]
                                                  : lineItem.unitPrice
                                              }
                                              onChange={(event) =>
                                                {
                                                  const cellKey = worksheetUnitPriceCellKey(
                                                    costCodeGroup.id,
                                                    lineItem.id
                                                  );
                                                  const nextValue = event.target.value;
                                                  const formattedValue = nextValue.trim().startsWith("=")
                                                    ? nextValue
                                                    : formatCurrencyInputWhileTyping(nextValue);
                                                  updateWorksheetLineItemCell(
                                                    costCodeGroup.id,
                                                    lineItem.id,
                                                    "unitPrice",
                                                    formattedValue
                                                  );
                                                  if (nextValue.trim().startsWith("=")) {
                                                    setWorksheetUnitPriceFormulas((prev) => ({
                                                      ...prev,
                                                      [cellKey]: nextValue,
                                                    }));
                                                  } else {
                                                    setWorksheetUnitPriceFormulas((prev) => {
                                                      const next = { ...prev };
                                                      delete next[cellKey];
                                                      return next;
                                                    });
                                                  }
                                                }
                                              }
                                              onFocus={() =>
                                                setActiveWorksheetUnitPriceCell(
                                                  worksheetUnitPriceCellKey(
                                                    costCodeGroup.id,
                                                    lineItem.id
                                                  )
                                                )
                                              }
                                              onBlur={(event) => {
                                                const cellKey = worksheetUnitPriceCellKey(
                                                  costCodeGroup.id,
                                                  lineItem.id
                                                );
                                                const normalized = normalizeUnitPriceInput(
                                                  event.target.value
                                                );
                                                updateWorksheetLineItemCell(
                                                  costCodeGroup.id,
                                                  lineItem.id,
                                                  "unitPrice",
                                                  normalized.normalizedValue
                                                );
                                                setWorksheetUnitPriceFormulas((prev) => {
                                                  const next = { ...prev };
                                                  if (normalized.formula) {
                                                    next[cellKey] = normalized.formula;
                                                  } else {
                                                    delete next[cellKey];
                                                  }
                                                  return next;
                                                });
                                                setActiveWorksheetUnitPriceCell((prev) =>
                                                  prev === cellKey ? null : prev
                                                );
                                              }}
                                              placeholder="0.00"
                                              className={`h-full w-full border-0 bg-transparent text-right text-sm focus:outline-none ${
                                                isExcluded
                                                  ? "text-slate-500 focus:bg-slate-50"
                                                  : "text-slate-700 focus:bg-white"
                                              }`}
                                            />
                                          </div>
                                        </td>
                                        <td
                                          className={`border-b border-r border-slate-300 p-0 align-top ${
                                            isExcluded ? "bg-slate-200" : "bg-[#f9e3ae]"
                                          }`}
                                        >
                                          <div className="flex h-8 items-center gap-1 px-1 text-sm">
                                            <span className={`w-2 ${isExcluded ? "text-slate-400" : "text-slate-700"}`}>
                                              $
                                            </span>
                                            <input
                                              value={lineItem.gcMarkup}
                                              onChange={(event) =>
                                                canEditGcMarkup
                                                  ? updateWorksheetLineItemCell(
                                                      costCodeGroup.id,
                                                      lineItem.id,
                                                      "gcMarkup",
                                                      formatCurrencyInputWhileTyping(event.target.value)
                                                    )
                                                  : undefined
                                              }
                                              onBlur={(event) => {
                                                if (!canEditGcMarkup) return;
                                                updateWorksheetLineItemCell(
                                                  costCodeGroup.id,
                                                  lineItem.id,
                                                  "gcMarkup",
                                                  formatCurrencyDisplayString(event.target.value)
                                                );
                                              }}
                                              onMouseDown={(event) => {
                                                if (canEditGcMarkup) return;
                                                event.preventDefault();
                                                showWorksheetGcMarkupMessage();
                                              }}
                                              onFocus={(event) => {
                                                if (canEditGcMarkup) return;
                                                event.currentTarget.blur();
                                                showWorksheetGcMarkupMessage();
                                              }}
                                              readOnly={!canEditGcMarkup}
                                              placeholder="0.00"
                                              className={`h-full w-full border-0 bg-transparent text-right text-sm focus:outline-none ${
                                                canEditGcMarkup
                                                  ? "text-slate-700 focus:bg-[#faedca]"
                                                  : isExcluded
                                                    ? "cursor-not-allowed text-slate-400"
                                                    : "cursor-not-allowed text-slate-700"
                                              }`}
                                            />
                                          </div>
                                        </td>
                                        <td className="border-b border-r border-slate-300 p-0 align-top">
                                          <div
                                            className={`flex h-8 items-center justify-end px-1 text-sm ${
                                              isExcluded ? "text-slate-500" : "text-slate-700"
                                            }`}
                                          >
                                            {isExcluded ? "Excluded" : `$${formatCurrency(lineTotal)}`}
                                          </div>
                                        </td>
                                        <td className="border-b border-slate-300 p-0 align-top">
                                          <textarea
                                            value={lineItem.comments ?? ""}
                                            onChange={(event) =>
                                              updateWorksheetLineItemCell(
                                                costCodeGroup.id,
                                                lineItem.id,
                                                "comments",
                                                event.target.value
                                              )
                                            }
                                            onInput={autoResizeWorksheetTextarea}
                                            rows={1}
                                            className={`min-h-8 w-full resize-none border-0 bg-transparent px-2 py-1 text-sm leading-5 focus:outline-none ${
                                              isExcluded
                                                ? "text-slate-500 focus:bg-slate-50"
                                                : "text-slate-700 focus:bg-white"
                                            }`}
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })
                                : null}
                              {!costCodeGroup.readOnlyRollup &&
                              expandedWorksheetCostCodeIds[costCodeGroup.id] ? (
                                <tr className="bg-slate-50/70">
                                  <td className="border-b border-r border-t border-dashed border-slate-300 p-0"></td>
                                  <td className="border-b border-r border-t border-dashed border-slate-300 px-2 py-1">
                                    <button
                                      type="button"
                                      onClick={() => addWorksheetLineItem(costCodeGroup.id)}
                                      className="ml-4 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                                    >
                                      + Add line item
                                    </button>
                                  </td>
                                  <td className="border-b border-r border-t border-dashed border-slate-300 bg-[#f4ebe5] p-0"></td>
                                  <td className="border-b border-r border-t border-dashed border-slate-300 bg-[#f4ebe5] p-0"></td>
                                  <td className="border-b border-r border-t border-dashed border-slate-300 p-0"></td>
                                  <td className="border-b border-r border-t border-dashed border-slate-300 p-0"></td>
                                  <td className="border-b border-t border-dashed border-slate-300 p-0"></td>
                                  <td className="border-b border-t border-dashed border-slate-300 p-0"></td>
                                </tr>
                              ) : null}
                            </Fragment>
                          ))
                            : null}
                          {(expandedWorksheetDivisionKeys[group.division] ?? true) ? (
                            <tr key={`subtotal-${group.division}`} className="bg-slate-100">
                              <td colSpan={5} className="border-b border-slate-400 px-2 py-2 text-right text-sm font-semibold text-slate-700">
                                Subtotal
                              </td>
                              <td className="border-b border-r border-slate-400 p-0"></td>
                              <td className="border-b border-r border-slate-400 px-2 py-2 text-right text-sm font-semibold text-slate-700">
                                ${formatCurrency(group.subtotal)}
                              </td>
                              <td className="border-b border-slate-400 p-0"></td>
                            </tr>
                          ) : null}
                        </Fragment>
                      ))}
                    {!worksheetLoading &&
                    !worksheetError &&
                    filteredWorksheetDivisionGroups.length > 0 ? (
                      <>
                        <tr className="bg-[#e8792e]">
                          <td colSpan={5} className="border-b border-[#c96420] px-2 py-2 text-right text-sm font-semibold text-white">
                            SUBTOTAL
                          </td>
                          <td className="border-b border-r border-[#c96420] p-0"></td>
                          <td className="border-b border-r border-[#c96420] px-2 py-2 text-right text-sm font-semibold text-white">
                            ${formatCurrency(preliminarySubtotal)}
                          </td>
                          <td className="border-b border-[#c96420] p-0"></td>
                        </tr>
                        <tr className="bg-[#f9e3ae]">
                          <td
                            colSpan={5}
                            className="border-b border-[#e1c987] px-2 py-2 text-right text-sm font-semibold text-slate-800"
                          >
                            GC MARKUP TOTAL (Internal)
                          </td>
                          <td className="border-b border-r border-[#e1c987] px-2 py-2 text-right text-sm font-semibold text-slate-900">
                            ${formatCurrency(preliminaryGcMarkupTotal)}
                          </td>
                          <td className="border-b border-r border-[#e1c987] p-0"></td>
                          <td className="border-b border-[#e1c987] p-0"></td>
                        </tr>
                        <tr className="bg-[#c8c8c8]">
                          <td colSpan={8} className="h-5 border-b border-slate-300"></td>
                        </tr>
                        {preliminaryMarkupRows.map((markupRow) => (
                          <tr key={markupRow.label} className="bg-[#c8c8c8]">
                            <td className="px-2 py-1 text-left text-xs font-medium text-slate-700">
                              {markupRow.costCode}
                            </td>
                            <td colSpan={4} className="px-2 py-1 text-right text-sm font-medium text-slate-900">
                              {markupRow.label}
                            </td>
                            <td className="p-0"></td>
                            <td className="px-2 py-1 text-right text-sm font-medium text-slate-900">
                              {markupRow.amount === null ? "-" : `$${formatCurrency(markupRow.amount)}`}
                            </td>
                            <td className="p-0"></td>
                          </tr>
                        ))}
                        <tr className="bg-[#e8792e]">
                          <td colSpan={5} className="border-t border-[#c96420] px-2 py-2 text-right text-sm font-semibold text-white">
                            TOTAL
                          </td>
                          <td className="border-r border-t border-[#c96420] p-0"></td>
                          <td className="border-r border-t border-[#c96420] px-2 py-2 text-right text-sm font-semibold text-white">
                            ${formatCurrency(preliminaryGrandTotal)}
                          </td>
                          <td className="border-t border-[#c96420] p-0"></td>
                        </tr>
                      </>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                Worksheet section coming soon.
              </div>
            </div>
          )}
        </div>
      </div>
      {worksheetLineItemPendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete line item?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Remove{" "}
              <span className="font-semibold text-slate-900">
                {worksheetLineItemPendingDelete.label || "this line item"}
              </span>{" "}
              from the preliminary estimate worksheet?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setWorksheetLineItemPendingDelete(null)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  removeWorksheetLineItem(
                    worksheetLineItemPendingDelete.costCodeId,
                    worksheetLineItemPendingDelete.lineItemId
                  );
                  setWorksheetLineItemPendingDelete(null);
                }}
                className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
