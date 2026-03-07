"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

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
};
type WorksheetCostCodeGroup = {
  id: string;
  code: string;
  title: string;
  division: string;
  lineItems: WorksheetLineItem[];
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
  { id: "pp-start-date", label: "Construction Start Date", value: "3/9/2026" },
  { id: "pp-completion-date", label: "Construction Completion Date", value: "6/5/2026" },
  {
    id: "pp-closeout-date",
    label: "Closeout Completion Date (Plan 1 wks)",
    value: "6/12/2026",
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
  const [costSummaryPercent, setCostSummaryPercent] = useState<string>("28");
  const [generalConditionsRows, setGeneralConditionsRows] = useState<GeneralConditionsRow[]>(
    INITIAL_GENERAL_CONDITIONS_ROWS
  );
  const [worksheetCostCodeGroups, setWorksheetCostCodeGroups] = useState<WorksheetCostCodeGroup[]>(
    []
  );
  const [expandedWorksheetCostCodeIds, setExpandedWorksheetCostCodeIds] = useState<
    Record<string, boolean>
  >({});
  const [worksheetLoading, setWorksheetLoading] = useState<boolean>(false);
  const [worksheetError, setWorksheetError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    fees: true,
    projectData: true,
    projectPlanning: true,
    salesTax: true,
    costSummary: true,
  });
  const feeRows = useMemo(() => rows.filter((row) => row.category === "Fees"), [rows]);

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
              unit: "",
              quantity: "",
              unitPrice: "",
            },
          ],
        }));

        if (isMounted) {
          setWorksheetCostCodeGroups(groupsFromCodes);
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
  const toggleWorksheetCostCodeExpanded = (costCodeId: string) => {
    setExpandedWorksheetCostCodeIds((prev) => ({ ...prev, [costCodeId]: !prev[costCodeId] }));
  };
  const updateWorksheetCostCodeTitle = (costCodeId: string, value: string) => {
    setWorksheetCostCodeGroups((prev) =>
      prev.map((group) => (group.id === costCodeId ? { ...group, title: value } : group))
    );
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

  const worksheetView = selectedItem === "Data, Factors & Rates";
  const generalConditionsView = selectedItem === "General Conditions";
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
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([division, costCodeGroups]) => {
        const sortedGroups = [...costCodeGroups].sort((a, b) =>
          a.code.localeCompare(b.code, undefined, { numeric: true })
        );
        const groupsWithTotals = sortedGroups.map((group) => {
          const total = group.lineItems.reduce((sum, line) => {
            const quantity = parseNumericInput(line.quantity);
            const unitPrice = parseNumericInput(line.unitPrice);
            return sum + quantity * unitPrice;
          }, 0);
          return { ...group, total };
        });
        const subtotal = groupsWithTotals.reduce((sum, group) => sum + group.total, 0);
        return { division, costCodeGroups: groupsWithTotals, subtotal };
      });
  }, [worksheetCostCodeGroups]);

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
                            <input
                              value={row.value}
                              onChange={(event) =>
                                updateProjectPlanningValue(row.id, event.target.value)
                              }
                              className="h-11 w-full border-0 bg-transparent px-3 text-right text-base text-slate-900 focus:bg-white focus:outline-none"
                            />
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
          ) : preliminaryWorksheetView ? (
            <div className="p-3">
              <div className="overflow-x-auto rounded-lg border border-slate-400 bg-[#d8d8d8]">
                <table className="w-full min-w-[1280px] border-separate border-spacing-0 text-slate-900">
                  <colgroup>
                    <col className="w-[9%]" />
                    <col className="w-[38%]" />
                    <col className="w-[7%]" />
                    <col className="w-[8%]" />
                    <col className="w-[13%]" />
                    <col className="w-[12%]" />
                    <col className="w-[13%]" />
                  </colgroup>
                  <thead className="bg-[#cfcfcf]">
                    <tr>
                      <th className="border-b-2 border-r border-slate-500 px-3 py-3 text-left text-3xl font-black uppercase tracking-tight">
                        COST CODE
                      </th>
                      <th className="border-b-2 border-r border-slate-500 px-3 py-3 text-left text-3xl font-black uppercase tracking-tight">
                        DESCRIPTION
                      </th>
                      <th className="border-b-2 border-r border-slate-500 px-3 py-3 text-center text-3xl font-black uppercase tracking-tight">
                        UNIT
                      </th>
                      <th className="border-b-2 border-r border-slate-500 px-3 py-3 text-center text-3xl font-black uppercase tracking-tight">
                        QUAN
                      </th>
                      <th className="border-b-2 border-r border-slate-500 px-3 py-3 text-center text-3xl font-black uppercase tracking-tight">
                        $/UNIT
                      </th>
                      <th className="border-b-2 border-r border-slate-500 px-3 py-3 text-center text-3xl font-black uppercase tracking-tight">
                        TOTAL
                      </th>
                      <th className="border-b-2 border-slate-500 px-3 py-3 text-center text-3xl font-black uppercase tracking-tight">
                        TOTAL
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {worksheetLoading ? (
                      <tr className="bg-[#dedede]">
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
                      <tr className="bg-[#dedede]">
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
                              className="border-b-2 border-t-4 border-slate-500 px-3 py-2 text-base font-black uppercase tracking-wide text-slate-900"
                            >
                              Division {group.division}
                            </td>
                          </tr>
                          {group.costCodeGroups.map((costCodeGroup) => (
                            <Fragment key={costCodeGroup.id}>
                              <tr className="bg-[#cecece]">
                                <td className="border-b border-r border-slate-500 p-0 align-top">
                                  <div className="px-3 py-2 text-2xl font-bold">{costCodeGroup.code}</div>
                                </td>
                                <td className="border-b border-r border-slate-500 p-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleWorksheetCostCodeExpanded(costCodeGroup.id)
                                    }
                                    className="flex h-12 w-full items-center gap-3 px-3 text-left text-[1.8rem] font-bold leading-none text-slate-900 hover:bg-[#d8d8d8]"
                                  >
                                    <span className="inline-block w-6 text-center text-xl leading-none">
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
                                      className="h-full w-full border-0 bg-transparent text-[1.8rem] font-bold leading-none text-slate-900 focus:bg-[#ececec] focus:outline-none"
                                    />
                                  </button>
                                </td>
                                <td className="border-b border-r border-slate-500 bg-[#ead5c8] px-2 py-2 text-center text-2xl"></td>
                                <td className="border-b border-r border-slate-500 bg-[#ead5c8] px-2 py-2 text-center text-2xl"></td>
                                <td className="border-b border-r border-slate-500 px-3 py-2 text-right text-2xl"></td>
                                <td className="border-b border-r border-slate-500 px-3 py-2 text-right text-[2rem] font-semibold leading-none">
                                  ${formatCurrency(costCodeGroup.total)}
                                </td>
                                <td className="border-b border-slate-500 px-3 py-2 text-right text-[2rem] font-semibold leading-none">
                                  ${formatCurrency(costCodeGroup.total)}
                                </td>
                              </tr>
                              {expandedWorksheetCostCodeIds[costCodeGroup.id]
                                ? costCodeGroup.lineItems.map((lineItem) => {
                                    const quantity = parseNumericInput(lineItem.quantity);
                                    const unitPrice = parseNumericInput(lineItem.unitPrice);
                                    const lineTotal = quantity * unitPrice;
                                    return (
                                      <tr key={lineItem.id} className="bg-[#d8d8d8]">
                                        <td className="border-b border-r border-slate-500 p-0 align-top">
                                          <div className="px-3 py-2 text-2xl font-medium text-transparent">
                                            {costCodeGroup.code}
                                          </div>
                                        </td>
                                        <td className="border-b border-r border-slate-500 p-0">
                                          <input
                                            value={lineItem.description}
                                            onChange={(event) =>
                                              updateWorksheetLineItemCell(
                                                costCodeGroup.id,
                                                lineItem.id,
                                                "description",
                                                event.target.value
                                              )
                                            }
                                            className="h-12 w-full border-0 bg-transparent px-12 text-[2rem] font-semibold leading-none text-slate-900 focus:bg-[#ececec] focus:outline-none"
                                          />
                                        </td>
                                        <td className="border-b border-r border-slate-500 bg-[#ead5c8] p-0">
                                          <input
                                            value={lineItem.unit}
                                            onChange={(event) =>
                                              updateWorksheetLineItemCell(
                                                costCodeGroup.id,
                                                lineItem.id,
                                                "unit",
                                                event.target.value
                                              )
                                            }
                                            className="h-12 w-full border-0 bg-transparent px-2 text-center text-[2rem] leading-none text-slate-900 focus:bg-[#f2dfd3] focus:outline-none"
                                          />
                                        </td>
                                        <td className="border-b border-r border-slate-500 bg-[#ead5c8] p-0">
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
                                            className="h-12 w-full border-0 bg-transparent px-2 text-center text-[2rem] leading-none text-slate-900 focus:bg-[#f2dfd3] focus:outline-none"
                                          />
                                        </td>
                                        <td className="border-b border-r border-slate-500 p-0">
                                          <div className="flex h-12 items-center px-3 text-[2rem] leading-none">
                                            <span className="mr-2">$</span>
                                            <input
                                              value={lineItem.unitPrice}
                                              onChange={(event) =>
                                                updateWorksheetLineItemCell(
                                                  costCodeGroup.id,
                                                  lineItem.id,
                                                  "unitPrice",
                                                  event.target.value
                                                )
                                              }
                                              className="h-full w-full border-0 bg-transparent text-right text-[2rem] leading-none text-slate-900 focus:bg-[#ececec] focus:outline-none"
                                            />
                                          </div>
                                        </td>
                                        <td className="border-b border-r border-slate-500 px-3 py-2 text-right text-[2rem] leading-none">
                                          ${formatCurrency(lineTotal)}
                                        </td>
                                        <td className="border-b border-slate-500 px-3 py-2 text-right text-[2rem] leading-none">
                                          ${formatCurrency(lineTotal)}
                                        </td>
                                      </tr>
                                    );
                                  })
                                : null}
                            </Fragment>
                          ))}
                          <tr key={`subtotal-${group.division}`} className="bg-[#d0d0d0]">
                            <td colSpan={5} className="border-b-2 border-slate-500 px-3 py-2 text-right text-4xl font-black">
                              Subtotal
                            </td>
                            <td className="border-b-2 border-r border-slate-500 px-3 py-2 text-right text-4xl font-black">
                              ${formatCurrency(group.subtotal)}
                            </td>
                            <td className="border-b-2 border-slate-500 px-3 py-2 text-right text-4xl font-black">
                              ${formatCurrency(group.subtotal)}
                            </td>
                          </tr>
                        </Fragment>
                      ))}
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
