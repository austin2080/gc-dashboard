"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent as ReactFormEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

const NAV_ITEMS = [
  "Data, Factors & Rates",
  "General Conditions",
  "Preliminary Estimate Cover Page",
  "Preliminary Estimate Worksheet",
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
  comments: string;
};
type WorksheetCostCodeGroup = {
  id: string;
  code: string;
  title: string;
  division: string;
  lineItems: WorksheetLineItem[];
};
type WorksheetRenderedCostCodeGroup = WorksheetCostCodeGroup & {
  total: number;
  readOnlyRollup?: boolean;
};
type SectionKey =
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

const formatCurrency = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const parseNumericInput = (value: string) => {
  const parsed = Number.parseFloat(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatToTwoDecimals = (value: string) => {
  const parsed = Number.parseFloat(value.replace(/[$,]/g, "").trim());
  if (!Number.isFinite(parsed)) return "";
  return parsed.toFixed(2);
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
      normalizedValue: formulaResult.toFixed(2),
      formula: value.trim(),
    };
  }
  return {
    normalizedValue: formatToTwoDecimals(value),
    formula: null,
  };
};

const WORKSHEET_UNIT_OPTIONS = [
  "",
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

const PRELIM_COLUMN_MIN_WIDTHS = [72, 220, 56, 64, 72, 90, 120] as const;
const PRELIM_DEFAULT_COLUMN_WIDTHS = [92, 340, 64, 78, 84, 118, 150] as const;

const createWorksheetLineItem = (seed: string): WorksheetLineItem => ({
  id: `${seed}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString(36)}`,
  description: "",
  unit: "ls",
  quantity: "",
  unitPrice: "",
  comments: "",
});

const parsePercentValue = (value: string) => {
  const parsed = Number.parseFloat(value.replace("%", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
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

export default function EstimateWorkspaceV2() {
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
    INITIAL_GENERAL_CONDITIONS_ROWS
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
  const prelimResizeRef = useRef<{
    columnIndex: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    fees: true,
    projectData: true,
    projectPlanning: true,
    salesTax: true,
    costSummary: true,
  });
  const feeRows = useMemo(() => rows.filter((row) => row.category === "Fees"), [rows]);
  const startDateValue =
    projectPlanningRows.find((row) => row.id === "pp-start-date")?.value ?? "";
  const completionDateValue =
    projectPlanningRows.find((row) => row.id === "pp-completion-date")?.value ?? "";
  const closeoutDateValue =
    projectPlanningRows.find((row) => row.id === "pp-closeout-date")?.value ?? "";

  useEffect(() => {
    let isMounted = true;

    const loadWorksheetCostCodes = async () => {
      setWorksheetLoading(true);
      setWorksheetError(null);
      try {
        const response = await fetch("/api/cost-codes", { cache: "no-store" });
        const payload = (await response.json()) as {
          costCodes?: WorksheetCostCode[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load cost codes.");
        }

        const groupsFromCodes = (payload.costCodes ?? []).map((costCode) => ({
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
              comments: "",
            },
          ],
        }));

        if (isMounted) {
          setWorksheetCostCodeGroups(groupsFromCodes);
          setExpandedWorksheetDivisionKeys(
            groupsFromCodes.reduce<Record<string, boolean>>((acc, group) => {
              const divisionKey = group.division?.trim() || "Other";
              if (acc[divisionKey] === undefined) {
                acc[divisionKey] = true;
              }
              return acc;
            }, {})
          );
          setExpandedWorksheetCostCodeIds(
            groupsFromCodes.reduce<Record<string, boolean>>((acc, group) => {
              acc[group.id] = true;
              return acc;
            }, {})
          );
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
    const nextCloseoutDate = addDaysToIsoDate(completionDateValue, 7);
    if (!nextCloseoutDate) return;
    setProjectPlanningRows((prev) => {
      const currentCloseout = prev.find((row) => row.id === "pp-closeout-date")?.value ?? "";
      if (currentCloseout === nextCloseoutDate) return prev;
      return prev.map((row) =>
        row.id === "pp-closeout-date" ? { ...row, value: nextCloseoutDate } : row
      );
    });
  }, [completionDateValue]);
  useEffect(() => {
    const constructionWeeks = calculateDurationWeeks(startDateValue, completionDateValue);
    const projectWeeks = calculateDurationWeeks(startDateValue, closeoutDateValue);
    setProjectPlanningRows((prev) =>
      prev.map((row) => {
        if (row.id === "pp-construction-duration") {
          const nextValue = constructionWeeks === null ? "" : String(constructionWeeks);
          return row.value === nextValue ? row : { ...row, value: nextValue };
        }
        if (row.id === "pp-project-duration") {
          const nextValue = projectWeeks === null ? "" : String(projectWeeks);
          return row.value === nextValue ? row : { ...row, value: nextValue };
        }
        return row;
      })
    );
  }, [startDateValue, completionDateValue, closeoutDateValue]);

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
  const updateGeneralConditionsCell = (
    rowId: string,
    key: keyof GeneralConditionsRow,
    value: string
  ) => {
    setGeneralConditionsRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [key]: value } : row))
    );
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
  const generalConditionsTotal = useMemo(() => {
    return generalConditionsRows.reduce((sum, row) => {
      const numericTotal = Number.parseFloat(row.total.replace(/[$,]/g, ""));
      return sum + (Number.isNaN(numericTotal) ? 0 : numericTotal);
    }, 0);
  }, [generalConditionsRows]);
  const generalConditionsWeekly = generalConditionsTotal / 14;
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
            const quantity = parseNumericInput(line.quantity);
            const unitPrice = parseNumericInput(line.unitPrice);
            return sum + quantity * unitPrice;
          }, 0);
          return { ...group, total };
        });
        const renderedCostCodeGroups =
          divisionCode === "01"
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
        const subtotal = renderedCostCodeGroups.reduce((sum, group) => sum + group.total, 0);
        return {
          division,
          divisionCode,
          divisionTitle,
          costCodeGroups: renderedCostCodeGroups,
          subtotal,
        };
      })
      .sort((a, b) => {
        const aRank = a.divisionCode ? Number.parseInt(a.divisionCode, 10) : Number.MAX_SAFE_INTEGER;
        const bRank = b.divisionCode ? Number.parseInt(b.divisionCode, 10) : Number.MAX_SAFE_INTEGER;
        if (aRank !== bRank) return aRank - bRank;
        return a.divisionTitle.localeCompare(b.divisionTitle, undefined, { numeric: true });
      });
  }, [worksheetCostCodeGroups, generalConditionsTotal]);
  const preliminarySubtotal = useMemo(
    () => worksheetDivisionGroups.reduce((sum, group) => sum + group.subtotal, 0),
    [worksheetDivisionGroups]
  );
  const preliminaryMarkupRows = useMemo(() => {
    const lookup = feeRows.reduce<Record<string, string>>((acc, row) => {
      acc[row.factorName.toLowerCase()] = row.value;
      return acc;
    }, {});
    const getAmountFromPercent = (factorName: string) => {
      const raw = lookup[factorName.toLowerCase()];
      if (!raw) return null;
      const percent = parsePercentValue(raw);
      if (percent === null) return null;
      const amount = (preliminarySubtotal * percent) / 100;
      return Number.isFinite(amount) && amount > 0 ? amount : null;
    };

    return [
      {
        costCode: "90 01 00",
        label: "GENERAL LIABILITY INSURANCE",
        amount: getAmountFromPercent("General Liability Insurance"),
      },
      {
        costCode: "90 02 00",
        label: "BUILDERS RISK INSURANCE",
        amount: getAmountFromPercent("Builder's Risk Insurance"),
      },
      { costCode: "90 03 00", label: "OVERHEAD", amount: getAmountFromPercent("Overhead") },
      { costCode: "90 04 00", label: "PROFIT", amount: getAmountFromPercent("Profit") },
      {
        costCode: "90 05 00",
        label: "PERFORMANCE BOND",
        amount: getAmountFromPercent("Performance Bond"),
      },
      { costCode: "90 06 00", label: "CONTINGENCY", amount: getAmountFromPercent("Contingency") },
      { costCode: "90 07 00", label: "TAX", amount: null },
    ];
  }, [feeRows, preliminarySubtotal]);
  const preliminaryMarkupTotal = useMemo(
    () =>
      preliminaryMarkupRows.reduce(
        (sum, row) => sum + (row.amount !== null && Number.isFinite(row.amount) ? row.amount : 0),
        0
      ),
    [preliminaryMarkupRows]
  );
  const preliminaryGrandTotal = preliminarySubtotal + preliminaryMarkupTotal;
  const getCoverPageFieldValue = (fieldId: string) =>
    coverPageFields.find((field) => field.id === fieldId)?.value ?? "";
  const coverProjectSquareFeet = useMemo(() => {
    const projectSizeRaw =
      projectPlanningRows.find((row) => row.id === "pp-project-size")?.value ?? "";
    const parsed = Number.parseFloat(projectSizeRaw.replace(/,/g, ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [projectPlanningRows]);
  const coverDivisionRows = useMemo(() => {
    return worksheetDivisionGroups.map((group) => {
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
    });
  }, [worksheetDivisionGroups, coverProjectSquareFeet, preliminarySubtotal]);

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
                                readOnly={
                                  row.id === "pp-construction-duration" ||
                                  row.id === "pp-project-duration"
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
                            $0.00
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
                      {projectDataRows.map((row) => (
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
                                className="h-full w-full border-0 bg-transparent text-right text-base text-slate-900 focus:bg-white focus:outline-none"
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
                    {generalConditionsRows.map((row) => (
                      <tr key={row.id} className="bg-white">
                        <td className="border-b border-r border-slate-300 p-0">
                          <input
                            value={row.costCode}
                            onChange={(event) =>
                              updateGeneralConditionsCell(row.id, "costCode", event.target.value)
                            }
                            className="h-8 w-full border-0 bg-transparent px-2 text-xs text-slate-600 focus:bg-white focus:outline-none"
                          />
                        </td>
                        <td
                          colSpan={row.percentage ? 1 : 2}
                          className="border-b border-r border-slate-300 p-0"
                        >
                          <input
                            value={row.description}
                            onChange={(event) =>
                              updateGeneralConditionsCell(row.id, "description", event.target.value)
                            }
                            className="h-8 w-full border-0 bg-transparent px-2 text-sm font-semibold text-slate-700 focus:bg-white focus:outline-none"
                          />
                        </td>
                        {row.percentage ? (
                          <td className="border-b border-r border-slate-300 bg-[#efdfd4] p-0">
                            <input
                              value={row.percentage}
                              onChange={(event) =>
                                updateGeneralConditionsCell(row.id, "percentage", event.target.value)
                              }
                              className="h-8 w-full border-0 bg-transparent px-2 text-right text-base font-semibold text-slate-700 focus:bg-[#f6e7dd] focus:outline-none"
                            />
                          </td>
                        ) : null}
                        <td className="border-b border-r border-slate-300 p-0">
                          <input
                            value={row.unit}
                            onChange={(event) =>
                              updateGeneralConditionsCell(row.id, "unit", event.target.value)
                            }
                            className="h-8 w-full border-0 bg-transparent px-2 text-center text-sm text-slate-700 focus:bg-white focus:outline-none"
                          />
                        </td>
                        <td className="border-b border-r border-slate-300 p-0">
                          <input
                            value={row.quantity}
                            onChange={(event) =>
                              updateGeneralConditionsCell(row.id, "quantity", event.target.value)
                            }
                            className={`h-8 w-full border-0 bg-transparent px-2 text-center text-sm font-semibold focus:bg-white focus:outline-none ${
                              row.quantity !== "0" && row.quantity !== "" ? "text-orange-600" : "text-slate-700"
                            }`}
                          />
                        </td>
                        <td className="border-b border-r border-slate-300 p-0">
                          {row.unitPrice === "-" || row.unitPrice === "" ? (
                            <input
                              value={row.unitPrice}
                              onChange={(event) =>
                                updateGeneralConditionsCell(row.id, "unitPrice", event.target.value)
                              }
                              className="h-8 w-full border-0 bg-transparent px-2 text-center text-sm text-slate-700 focus:bg-white focus:outline-none"
                            />
                          ) : (
                            <div className="flex h-8 items-center gap-2 px-2 text-sm">
                              <span className="text-slate-700">$</span>
                              <input
                                value={row.unitPrice}
                                onChange={(event) =>
                                  updateGeneralConditionsCell(row.id, "unitPrice", event.target.value)
                                }
                                className="h-full w-full border-0 bg-transparent text-right text-sm text-slate-700 focus:bg-white focus:outline-none"
                              />
                            </div>
                          )}
                        </td>
                        <td className="border-b border-r border-slate-300 p-0">
                          {row.total === "-" || row.total === "" ? (
                            <input
                              value={row.total}
                              onChange={(event) =>
                                updateGeneralConditionsCell(row.id, "total", event.target.value)
                              }
                              className="h-8 w-full border-0 bg-transparent px-2 text-center text-sm text-slate-700 focus:bg-white focus:outline-none"
                            />
                          ) : (
                            <div className="flex h-8 items-center gap-2 px-2 text-sm">
                              <span className="text-slate-700">$</span>
                              <input
                                value={row.total}
                                onChange={(event) =>
                                  updateGeneralConditionsCell(row.id, "total", event.target.value)
                                }
                                className="h-full w-full border-0 bg-transparent text-right text-sm text-slate-700 focus:bg-white focus:outline-none"
                              />
                            </div>
                          )}
                        </td>
                        <td className="border-b border-slate-300 p-0">
                          <input
                            value={row.comments}
                            onChange={(event) =>
                              updateGeneralConditionsCell(row.id, "comments", event.target.value)
                            }
                            className="h-8 w-full border-0 bg-transparent px-2 text-sm text-slate-700 focus:bg-white focus:outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#e8792e]">
                      <td colSpan={8} className="border-b border-[#c96420] px-4 py-2 text-right text-2xl font-semibold text-white">
                        ${generalConditionsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="bg-slate-200">
                      <td colSpan={5} className="border-b border-slate-300 px-2 py-2"></td>
                      <td colSpan={3} className="border-b border-slate-300 px-4 py-2 text-right">
                        <div className="space-y-1 text-2xl leading-tight text-slate-900">
                          <div>
                            <span className="mr-4 font-semibold">Wkly</span>
                            <span className="mr-3">$</span>
                            <span>{generalConditionsWeekly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div>
                            <span className="mr-4 font-semibold">Monthly</span>
                            <span className="mr-3">$</span>
                            <span>{generalConditionsMonthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : coverPageView ? (
            <div className="p-3">
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
                      <Fragment key={`cover-division-${row.divisionLabel}`}>
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
              <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
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
                  <thead className="bg-slate-100 text-slate-800">
                    <tr>
                      <th className="relative border-b border-r border-slate-400 px-2 py-2 text-left font-semibold">
                        COST CODE
                        <span
                          onMouseDown={(event) => beginPrelimColumnResize(0, event)}
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                        />
                      </th>
                      <th className="relative border-b border-r border-slate-400 px-2 py-2 text-left font-semibold">
                        DESCRIPTION
                        <span
                          onMouseDown={(event) => beginPrelimColumnResize(1, event)}
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                        />
                      </th>
                      <th className="relative border-b border-r border-slate-400 px-2 py-2 text-center font-semibold">
                        UNIT
                        <span
                          onMouseDown={(event) => beginPrelimColumnResize(2, event)}
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                        />
                      </th>
                      <th className="relative border-b border-r border-slate-400 px-2 py-2 text-center font-semibold">
                        QUAN
                        <span
                          onMouseDown={(event) => beginPrelimColumnResize(3, event)}
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                        />
                      </th>
                      <th className="relative border-b border-r border-slate-400 px-2 py-2 text-center font-semibold">
                        $/UNIT
                        <span
                          onMouseDown={(event) => beginPrelimColumnResize(4, event)}
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                        />
                      </th>
                      <th className="relative border-b border-r border-slate-400 px-2 py-2 text-center font-semibold">
                        TOTAL
                        <span
                          onMouseDown={(event) => beginPrelimColumnResize(5, event)}
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                        />
                      </th>
                      <th className="relative border-b border-slate-400 px-2 py-2 text-center font-semibold">
                        COMMENTS
                        <span
                          onMouseDown={(event) => beginPrelimColumnResize(6, event)}
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {worksheetLoading ? (
                      <tr className="bg-white">
                        <td colSpan={7} className="px-4 py-4 text-base font-medium text-slate-700">
                          Loading cost codes...
                        </td>
                      </tr>
                    ) : null}
                    {worksheetError ? (
                      <tr className="bg-red-50">
                        <td colSpan={7} className="px-4 py-3 text-sm font-medium text-red-700">
                          {worksheetError}
                        </td>
                      </tr>
                    ) : null}
                    {!worksheetLoading &&
                    !worksheetError &&
                    worksheetDivisionGroups.length === 0 ? (
                      <tr className="bg-white">
                        <td colSpan={7} className="px-4 py-4 text-base font-medium text-slate-700">
                          No cost codes found.
                        </td>
                      </tr>
                    ) : null}
                    {!worksheetLoading &&
                      !worksheetError &&
                      worksheetDivisionGroups.map((group) => (
                        <Fragment key={group.division}>
                          <tr key={`division-${group.division}`} className="bg-[#bcbcbc]">
                            <td
                              colSpan={7}
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
                                <td className="border-b border-slate-300 px-2 py-2 text-right text-sm font-semibold text-slate-700">
                                  ${formatCurrency(costCodeGroup.total)}
                                </td>
                                <td className="border-b border-slate-300 p-0"></td>
                              </tr>
                              {!costCodeGroup.readOnlyRollup &&
                              expandedWorksheetCostCodeIds[costCodeGroup.id]
                                ? costCodeGroup.lineItems.map((lineItem) => {
                                    const quantity = parseNumericInput(lineItem.quantity);
                                    const unitPrice = parseNumericInput(lineItem.unitPrice);
                                    const lineTotal = quantity * unitPrice;
                                    return (
                                      <tr key={lineItem.id} className="bg-white">
                                        <td className="border-b border-r border-slate-300 p-0 align-top">
                                          <div className="px-2 py-0 text-xs text-transparent">
                                            {costCodeGroup.code}
                                          </div>
                                        </td>
                                        <td className="border-b border-r border-slate-300 p-0 align-top">
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
                                            className="min-h-8 w-full resize-none border-0 bg-transparent px-6 py-1 text-sm font-semibold leading-5 text-slate-700 focus:bg-white focus:outline-none"
                                          />
                                        </td>
                                        <td className="border-b border-r border-slate-300 bg-[#efdfd4] p-0 align-top">
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
                                            className="h-8 w-full border-0 bg-transparent px-1 text-center text-xs text-slate-700 focus:bg-[#f6e7dd] focus:outline-none"
                                          >
                                            {WORKSHEET_UNIT_OPTIONS.map((unitOption) => (
                                              <option key={unitOption || "blank"} value={unitOption}>
                                                {unitOption || "Select"}
                                              </option>
                                            ))}
                                          </select>
                                        </td>
                                        <td className="border-b border-r border-slate-300 bg-[#efdfd4] p-0 align-top">
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
                                              className="h-full w-6 border-r border-slate-300 text-xs font-semibold text-slate-700 hover:bg-[#ead9cf]"
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
                                              className="h-8 w-full border-0 bg-transparent px-1 text-center text-sm font-semibold text-slate-700 focus:bg-[#f6e7dd] focus:outline-none"
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
                                              className="h-full w-6 border-l border-slate-300 text-xs font-semibold text-slate-700 hover:bg-[#ead9cf]"
                                            >
                                              +
                                            </button>
                                          </div>
                                        </td>
                                        <td className="border-b border-r border-slate-300 p-0 align-top">
                                          <div className="flex h-8 items-center gap-1 px-1 text-sm">
                                            <span className="w-2 text-slate-700">$</span>
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
                                                  updateWorksheetLineItemCell(
                                                    costCodeGroup.id,
                                                    lineItem.id,
                                                    "unitPrice",
                                                    nextValue
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
                                              className="h-full w-full border-0 bg-transparent text-right text-sm text-slate-700 focus:bg-white focus:outline-none"
                                            />
                                          </div>
                                        </td>
                                        <td className="border-b border-r border-slate-300 px-1 py-0 align-top text-right text-sm text-slate-700">
                                          ${formatCurrency(lineTotal)}
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
                                            className="min-h-8 w-full resize-none border-0 bg-transparent px-2 py-1 text-sm leading-5 text-slate-700 focus:bg-white focus:outline-none"
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
                              <td className="border-b border-r border-slate-400 px-2 py-2 text-right text-sm font-semibold text-slate-700">
                                ${formatCurrency(group.subtotal)}
                              </td>
                              <td className="border-b border-slate-400 p-0"></td>
                            </tr>
                          ) : null}
                        </Fragment>
                      ))}
                    {!worksheetLoading && !worksheetError && worksheetDivisionGroups.length > 0 ? (
                      <>
                        <tr className="bg-[#e8792e]">
                          <td colSpan={5} className="border-b border-[#c96420] px-2 py-2 text-right text-sm font-semibold text-white">
                            SUBTOTAL
                          </td>
                          <td className="border-b border-r border-[#c96420] px-2 py-2 text-right text-sm font-semibold text-white">
                            ${formatCurrency(preliminarySubtotal)}
                          </td>
                          <td className="border-b border-[#c96420] p-0"></td>
                        </tr>
                        <tr className="bg-[#c8c8c8]">
                          <td colSpan={7} className="h-5 border-b border-slate-300"></td>
                        </tr>
                        {preliminaryMarkupRows.map((markupRow) => (
                          <tr key={markupRow.label} className="bg-[#c8c8c8]">
                            <td className="px-2 py-1 text-left text-xs font-medium text-slate-700">
                              {markupRow.costCode}
                            </td>
                            <td colSpan={4} className="px-2 py-1 text-right text-sm font-medium text-slate-900">
                              {markupRow.label}
                            </td>
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
    </section>
  );
}
