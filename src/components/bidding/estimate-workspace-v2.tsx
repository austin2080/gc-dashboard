"use client";

import { useMemo, useState } from "react";

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

export default function EstimateWorkspaceV2() {
  const [selectedItem, setSelectedItem] = useState<string>(NAV_ITEMS[0]);
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
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    fees: true,
    projectData: true,
    projectPlanning: true,
    salesTax: true,
    costSummary: true,
  });
  const feeRows = useMemo(() => rows.filter((row) => row.category === "Fees"), [rows]);

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

  const worksheetView = selectedItem === "Data, Factors & Rates";
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

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid min-h-[720px] grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-r border-slate-200 bg-slate-50">
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
