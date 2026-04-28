"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleEllipsis,
  Copy,
  Download,
  FilePlus2,
  Filter,
  Info,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  readEstimateExportSnapshot,
  type EstimateExportSnapshot,
} from "@/lib/bidding/estimate-export";
import {
  getBidProjectIdForProject,
  getProjectIdForBidProject,
} from "@/lib/bidding/project-links";
import {
  formatMoneyInputBlur,
  formatMoneyInputTyping,
  parseMoney,
} from "@/components/bid-leveling/utils";
import { getWorkspaceCostCodes } from "@/lib/settings/company-cost-codes";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type AlternateType = "add" | "deduct";
type AlternateStatus = "pending" | "accepted" | "rejected";
type AlternateFilter = "all" | "pending" | "accepted" | "rejected";

type AlternateLineItem = {
  id: string;
  costCode: string;
  description: string;
  unit: string;
  quantity: string;
  unitCost: string;
};

type AlternateMarkupConfig = {
  overheadPercent: string;
  profitPercent: string;
  taxPercent: string;
  includeOverhead: boolean;
  includeProfit: boolean;
  includeTax: boolean;
};

type AlternateRecord = {
  id: string;
  number: string;
  name: string;
  description: string;
  type: AlternateType;
  status: AlternateStatus;
  includeInFinalTotal: boolean;
  notes: string;
  lineItems: AlternateLineItem[];
  markups: AlternateMarkupConfig;
  createdBy: string;
  updatedAt: string;
};

type AlternateModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: AlternateRecord;
  feePercentages: AlternateFeePercentages;
  projectSquareFeet: number | null;
  onDraftChange: (draft: AlternateRecord) => void;
  onSave: () => void;
  onDelete?: () => void;
  mode: "create" | "edit";
};

type AlternateCostCodeOption = {
  id: string;
  code: string;
  description: string;
  division: string;
};

type AlternateExpandedPanelProps = {
  alternate: AlternateRecord;
  feePercentages: AlternateFeePercentages;
  projectSquareFeet: number | null;
};

type AlternateRowProps = {
  alternate: AlternateRecord;
  feePercentages: AlternateFeePercentages;
  expanded: boolean;
  onToggleExpand: (alternateId: string) => void;
  onEdit: (alternate: AlternateRecord) => void;
  onDuplicate: (alternate: AlternateRecord) => void;
  onDelete: (alternateId: string) => void;
  onStatusChange: (alternateId: string, status: AlternateStatus) => void;
  onToggleIncluded: (alternateId: string) => void;
  projectSquareFeet: number | null;
};

type AlternatesTableProps = {
  alternates: AlternateRecord[];
  feePercentages: AlternateFeePercentages;
  expandedAlternateId: string | null;
  onToggleExpand: (alternateId: string) => void;
  onEdit: (alternate: AlternateRecord) => void;
  onDuplicate: (alternate: AlternateRecord) => void;
  onDelete: (alternateId: string) => void;
  onStatusChange: (alternateId: string, status: AlternateStatus) => void;
  onToggleIncluded: (alternateId: string) => void;
  onCreate: () => void;
  projectSquareFeet: number | null;
};

type AlternateFeePercentages = {
  generalLiabilityInsurance: number;
  buildersRiskInsurance: number;
  overhead: number;
  profit: number;
  performanceBond: number;
  contingency: number;
  salesTaxEntered: number;
  salesTax: number;
};

type AlternateFeeAmount = {
  key: keyof AlternateFeePercentages;
  label: string;
  percent: number;
  amount: number;
};

const ALTERNATES_STORAGE_KEY = "builderos.bidding.alternates.v1";
export const ESTIMATE_ALTERNATE_CREATE_REQUEST_EVENT = "estimate-alternate-create-request";
const ALTERNATE_UNIT_OPTIONS = [
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
const DEFAULT_ALTERNATE_FEE_PERCENTAGES: AlternateFeePercentages = {
  generalLiabilityInsurance: 0,
  buildersRiskInsurance: 0,
  overhead: 0,
  profit: 0,
  performanceBond: 0,
  contingency: 0,
  salesTaxEntered: 0,
  salesTax: 0,
};
const ALTERNATE_FEE_CONFIG: Array<{
  key: keyof AlternateFeePercentages;
  label: string;
}> = [
  { key: "generalLiabilityInsurance", label: "General Liability Insurance" },
  { key: "buildersRiskInsurance", label: "Builders Risk Insurance" },
  { key: "overhead", label: "Overhead" },
  { key: "profit", label: "Profit" },
  { key: "performanceBond", label: "Performance Bond" },
  { key: "contingency", label: "Contingency" },
  { key: "salesTax", label: "Sales Tax" },
];

function createLineItem(
  overrides: Partial<AlternateLineItem> = {}
): AlternateLineItem {
  return {
    id: crypto.randomUUID(),
    costCode: "",
    description: "",
    unit: "LS",
    quantity: "1",
    unitCost: "",
    ...overrides,
  };
}

function isLegacySeededAlternates(alternates: AlternateRecord[]) {
  if (!alternates.length) return false;
  const legacyIds = new Set(["alt-01", "alt-02", "alt-03", "alt-04"]);
  return alternates.every((alternate) => legacyIds.has(alternate.id));
}

function getStorageKey(projectId: string) {
  return `${ALTERNATES_STORAGE_KEY}:${projectId}`;
}

function parseNumber(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[$,% ,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCurrency(value: string): number {
  return parseNumber(value);
}

function formatCurrency(value: number): string {
  const absolute = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return value < 0 ? `(${absolute})` : absolute;
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatFeeRate(
  feeKey: keyof AlternateFeePercentages,
  value: number,
  feePercentages: AlternateFeePercentages
): string {
  if (feeKey === "generalLiabilityInsurance") {
    return `$${value.toFixed(2)} / $1,000`;
  }
  if (feeKey === "buildersRiskInsurance") {
    return `$${value.toFixed(2)} / $100`;
  }
  if (feeKey === "salesTax") {
    return `${feePercentages.salesTaxEntered.toFixed(2)}% - Actual ${feePercentages.salesTax.toFixed(2)}%`;
  }
  return formatPercent(value);
}

function formatDollarPerSf(value: number | null): string {
  if (value === null) return "--";
  return formatCurrency(value);
}

function parseProjectSquareFeet(snapshot: EstimateExportSnapshot | null): number | null {
  if (!snapshot) return null;
  const candidates = [
    snapshot.projectPlanning["pp-project-size"],
    snapshot.coverFields["cover-project-size"],
  ];
  for (const candidate of candidates) {
    const parsed = parseNumber(candidate ?? "");
    if (parsed > 0) return parsed;
  }
  return null;
}

function getInitialsStatusCount(
  alternates: AlternateRecord[],
  status: AlternateFilter
): number {
  if (status === "all") return alternates.length;
  return alternates.filter((alternate) => alternate.status === status).length;
}

function getAlternateFinancials(
  alternate: AlternateRecord,
  feePercentages: AlternateFeePercentages = DEFAULT_ALTERNATE_FEE_PERCENTAGES
) {
  const subtotal = alternate.lineItems.reduce((sum, lineItem) => {
    return sum + parseNumber(lineItem.quantity) * parseCurrency(lineItem.unitCost);
  }, 0);
  const generalLiabilityAmount =
    feePercentages.generalLiabilityInsurance > 0
      ? (subtotal / 1000) * feePercentages.generalLiabilityInsurance
      : 0;
  const buildersRiskBase = subtotal + generalLiabilityAmount;
  const buildersRiskAmount =
    feePercentages.buildersRiskInsurance > 0
      ? (buildersRiskBase * feePercentages.buildersRiskInsurance) / 100
      : 0;
  const overheadBase = subtotal + generalLiabilityAmount + buildersRiskAmount;
  const overheadAmount =
    feePercentages.overhead > 0 ? (overheadBase * feePercentages.overhead) / 100 : 0;
  const profitBase = overheadBase + overheadAmount;
  const profitAmount =
    feePercentages.profit > 0 ? (profitBase * feePercentages.profit) / 100 : 0;
  const performanceBondAmount =
    feePercentages.performanceBond > 0 ? (subtotal * feePercentages.performanceBond) / 100 : 0;
  const contingencyAmount =
    feePercentages.contingency > 0 ? (subtotal * feePercentages.contingency) / 100 : 0;
  const salesTaxBase =
    subtotal +
    generalLiabilityAmount +
    buildersRiskAmount +
    overheadAmount +
    profitAmount +
    performanceBondAmount +
    contingencyAmount;
  const salesTaxAmount =
    feePercentages.salesTax > 0 ? (salesTaxBase * feePercentages.salesTax) / 100 : 0;
  const feeAmounts: AlternateFeeAmount[] = [
    {
      key: "generalLiabilityInsurance",
      label: "General Liability Insurance",
      percent: feePercentages.generalLiabilityInsurance,
      amount: generalLiabilityAmount,
    },
    {
      key: "buildersRiskInsurance",
      label: "Builders Risk Insurance",
      percent: feePercentages.buildersRiskInsurance,
      amount: buildersRiskAmount,
    },
    {
      key: "overhead",
      label: "Overhead",
      percent: feePercentages.overhead,
      amount: overheadAmount,
    },
    {
      key: "profit",
      label: "Profit",
      percent: feePercentages.profit,
      amount: profitAmount,
    },
    {
      key: "performanceBond",
      label: "Performance Bond",
      percent: feePercentages.performanceBond,
      amount: performanceBondAmount,
    },
    {
      key: "contingency",
      label: "Contingency",
      percent: feePercentages.contingency,
      amount: contingencyAmount,
    },
    {
      key: "salesTax",
      label: "Sales Tax",
      percent: feePercentages.salesTax,
      amount: salesTaxAmount,
    },
  ];
  const grossTotal = subtotal + feeAmounts.reduce((sum, item) => sum + item.amount, 0);
  const signedMultiplier = alternate.type === "deduct" ? -1 : 1;

  return {
    subtotal,
    feeAmounts,
    generalLiabilityAmount,
    buildersRiskAmount,
    overheadAmount,
    profitAmount,
    performanceBondAmount,
    contingencyAmount,
    salesTaxAmount,
    grossTotal,
    signedTotal: grossTotal * signedMultiplier,
  };
}

function getAcceptedAlternatesTotal(
  alternates: AlternateRecord[],
  feePercentages: AlternateFeePercentages
): number {
  return alternates.reduce((sum, alternate) => {
    if (alternate.status !== "accepted" || !alternate.includeInFinalTotal) return sum;
    return sum + getAlternateFinancials(alternate, feePercentages).signedTotal;
  }, 0);
}

function getAlternatePerSquareFoot(
  alternate: AlternateRecord,
  feePercentages: AlternateFeePercentages,
  projectSquareFeet: number | null
): number | null {
  if (!projectSquareFeet || projectSquareFeet <= 0) return null;
  return getAlternateFinancials(alternate, feePercentages).signedTotal / projectSquareFeet;
}

function getTypeBadgeClassName(type: AlternateType) {
  return type === "add"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-rose-200 bg-rose-50 text-rose-700";
}

function getStatusBadgeClassName(status: AlternateStatus) {
  if (status === "accepted") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function IncludeToggle({
  checked,
  disabled,
  disabledReason,
  onToggle,
  compact = false,
}: {
  checked: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onToggle: () => void;
  compact?: boolean;
}) {
  const toggleButton = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        "relative inline-flex items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-45",
        compact ? "h-6 w-11" : "h-7 w-12",
        checked ? "bg-blue-600" : "bg-slate-300"
      )}
    >
      <span
        className={cn(
          "absolute rounded-full bg-white shadow-sm transition",
          compact ? "h-5 w-5" : "h-6 w-6",
          checked ? (compact ? "left-5" : "left-5") : "left-0.5"
        )}
      />
      <span className="sr-only">Toggle include in final total</span>
    </button>
  );

  if (!disabled || checked || !disabledReason) {
    return toggleButton;
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{toggleButton}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-center leading-5">
          {disabledReason}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SummaryCard({
  label,
  value,
  subtext,
  emphasis = false,
}: {
  label: string;
  value: string;
  subtext: string;
  emphasis?: boolean;
}) {
  return (
    <Card className="border border-slate-200 bg-white py-0 shadow-sm">
      <CardContent className="space-y-2 px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {label}
        </div>
        <div
          className={cn(
            "text-[28px] font-semibold tracking-tight text-slate-900",
            emphasis && "text-blue-600"
          )}
        >
          {value}
        </div>
        <div className="text-xs text-slate-500">{subtext}</div>
      </CardContent>
    </Card>
  );
}

function AlternateSummaryCards({
  baseEstimateTotal,
  acceptedAlternatesTotal,
  finalTotal,
  hasEstimateSnapshot,
}: {
  baseEstimateTotal: number;
  acceptedAlternatesTotal: number;
  finalTotal: number;
  hasEstimateSnapshot: boolean;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-3">
      <SummaryCard
        label="Base Estimate Total"
        value={formatCurrency(baseEstimateTotal)}
        subtext={
          hasEstimateSnapshot
            ? "Pulled from the current estimate snapshot."
            : "Estimate total unavailable until the estimate page is opened."
        }
      />
      <SummaryCard
        label="Accepted Alternates Total"
        value={formatCurrency(acceptedAlternatesTotal)}
        subtext="Includes accepted alternates marked for final total only."
      />
      <SummaryCard
        label="Final Total"
        value={formatCurrency(finalTotal)}
        subtext="Base estimate plus included accepted alternates."
        emphasis
      />
    </div>
  );
}

function AlternateSummaryStrip({
  baseEstimateTotal,
  acceptedAlternatesTotal,
  finalTotal,
}: {
  baseEstimateTotal: number;
  acceptedAlternatesTotal: number;
  finalTotal: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          {
            label: "Base Estimate Total",
            value: formatCurrency(baseEstimateTotal),
            valueClassName: "text-slate-900",
          },
          {
            label: "Accepted Alternates Total",
            value: formatCurrency(acceptedAlternatesTotal),
            valueClassName: "text-emerald-600",
          },
          {
            label: "Final Total (With Accepted)",
            value: formatCurrency(finalTotal),
            valueClassName: "text-blue-600",
          },
        ].map((item) => (
          <div key={item.label} className="grid min-h-[132px] grid-rows-[48px_auto] px-5 py-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {item.label}
            </div>
            <div className={cn("self-start text-[24px] font-semibold tracking-tight", item.valueClassName)}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlternateExpandedPanel({
  alternate,
  feePercentages,
  projectSquareFeet,
}: AlternateExpandedPanelProps) {
  const financials = getAlternateFinancials(alternate, feePercentages);

  return (
    <div className="rounded-b-2xl border-x border-b border-slate-200 bg-slate-50/80 px-5 py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm font-semibold text-slate-900">{alternate.number}</div>
            <div className="text-lg font-semibold text-slate-900">{alternate.name}</div>
            <Badge className={cn("border", getStatusBadgeClassName(alternate.status))}>
              {alternate.status.toUpperCase()}
            </Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{alternate.description}</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <Table>
            <TableHeader className="bg-slate-100/90">
              <TableRow className="border-slate-200 hover:bg-transparent">
                <TableHead className="px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Cost Code
                </TableHead>
                <TableHead className="px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Description
                </TableHead>
                <TableHead className="px-4 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Unit
                </TableHead>
                <TableHead className="px-4 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Qty
                </TableHead>
                <TableHead className="px-4 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Unit Cost
                </TableHead>
                <TableHead className="px-4 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alternate.lineItems.map((lineItem) => {
                const lineTotal =
                  parseNumber(lineItem.quantity) * parseCurrency(lineItem.unitCost);
                return (
                  <TableRow key={lineItem.id} className="border-slate-200">
                    <TableCell className="px-4 py-3 font-medium text-slate-700">
                      {lineItem.costCode || "--"}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="font-medium text-slate-900">{lineItem.description || "Untitled line item"}</div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right text-slate-600">
                      {lineItem.unit || "--"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right text-slate-600">
                      {parseNumber(lineItem.quantity) || "--"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-medium text-slate-900">
                      {formatCurrency(parseCurrency(lineItem.unitCost))}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatCurrency(lineTotal)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div
            className="grid gap-px border-t border-slate-200 bg-slate-200"
            style={{
              gridTemplateColumns: `repeat(${
                2 + financials.feeAmounts.filter((item) => item.amount > 0).length
              }, minmax(0, 1fr))`,
            }}
          >
            {[
              { label: "Subtotal", value: financials.subtotal },
              ...financials.feeAmounts
                .filter((item) => item.amount > 0)
                .map((item) => ({
                  label: `${item.label} (${formatFeeRate(item.key, item.percent, feePercentages)})`,
                  value: item.amount,
                })),
              { label: "Final Total", value: financials.signedTotal, emphasis: true },
            ].map((item) => (
              <div
                key={item.label}
                className={cn(
                  "grid min-w-0 grid-rows-[minmax(3.5rem,auto)_auto] bg-white px-4 py-3",
                  item.emphasis && "bg-emerald-50/80"
                )}
              >
                <div className="whitespace-normal break-words text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {item.label}
                </div>
                <div
                  className={cn(
                    "mt-1 self-start text-lg font-semibold text-slate-900",
                    item.emphasis && "text-emerald-700"
                  )}
                >
                  {formatCurrency(item.value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AlternateActionsMenu({
  alternate,
  onEdit,
  onDuplicate,
  onDelete,
  onStatusChange,
  onToggleIncluded,
}: {
  alternate: AlternateRecord;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onStatusChange: (status: AlternateStatus) => void;
  onToggleIncluded: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-slate-500 hover:text-slate-900"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Open actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          Edit Alternate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="h-4 w-4" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onStatusChange("accepted")}>
          <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">A</Badge>
          Mark as Accepted
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStatusChange("pending")}>
          <Badge className="border border-amber-200 bg-amber-50 text-amber-700">P</Badge>
          Mark as Pending
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStatusChange("rejected")}>
          <Badge className="border border-rose-200 bg-rose-50 text-rose-700">R</Badge>
          Mark as Rejected
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onToggleIncluded}
          disabled={alternate.status !== "accepted"}
        >
          <FilePlus2 className="h-4 w-4" />
          Toggle Include in Final Total
        </DropdownMenuItem>
        <DropdownMenuItem disabled={alternate.status !== "accepted"}>
          <CircleEllipsis className="h-4 w-4" />
          Convert to Change Order
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AlternateRow({
  alternate,
  feePercentages,
  expanded,
  onToggleExpand,
  onEdit,
  onDuplicate,
  onDelete,
  onStatusChange,
  onToggleIncluded,
  projectSquareFeet,
}: AlternateRowProps) {
  const financials = getAlternateFinancials(alternate, feePercentages);
  const perSquareFoot = getAlternatePerSquareFoot(alternate, feePercentages, projectSquareFeet);

  return (
    <Fragment>
      <TableRow
        className="cursor-pointer border-slate-200 bg-white hover:bg-slate-50"
        onClick={() => onToggleExpand(alternate.id)}
      >
        <TableCell className="px-4 py-4 font-semibold text-slate-900">
          <div className="flex items-center gap-2">
            <span>{alternate.number}</span>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </div>
        </TableCell>
        <TableCell className="px-4 py-4">
          <div className="max-w-[380px]">
            <div className="font-semibold text-slate-900">{alternate.name}</div>
            <div className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">
              {alternate.description}
            </div>
          </div>
        </TableCell>
        <TableCell className="px-4 py-4">
          <Badge className={cn("border", getTypeBadgeClassName(alternate.type))}>
            {alternate.type === "add" ? "ADD" : "DEDUCT"}
          </Badge>
        </TableCell>
        <TableCell className="px-4 py-4">
          <Badge className={cn("border", getStatusBadgeClassName(alternate.status))}>
            {alternate.status.toUpperCase()}
          </Badge>
        </TableCell>
        <TableCell className="px-4 py-4">
          <div className="flex flex-col items-start gap-2">
            <IncludeToggle
              checked={alternate.includeInFinalTotal}
              disabled={alternate.status !== "accepted"}
              disabledReason="Status needs changed to Approved before alternate can be added to final total."
              compact
              onToggle={() => onToggleIncluded(alternate.id)}
            />
            <span className="text-xs text-slate-500">
              {alternate.status === "accepted" && alternate.includeInFinalTotal
                ? "Included"
                : "Not included"}
            </span>
          </div>
        </TableCell>
        <TableCell className="px-4 py-4 text-right font-semibold text-slate-900">
          {formatCurrency(financials.signedTotal)}
        </TableCell>
        <TableCell className="px-4 py-4 text-right font-medium text-slate-600">
          {formatDollarPerSf(perSquareFoot)}
        </TableCell>
        <TableCell className="px-4 py-4 text-right">
          <AlternateActionsMenu
            alternate={alternate}
            onEdit={() => onEdit(alternate)}
            onDuplicate={() => onDuplicate(alternate)}
            onDelete={() => onDelete(alternate.id)}
            onStatusChange={(status) => onStatusChange(alternate.id, status)}
            onToggleIncluded={() => onToggleIncluded(alternate.id)}
          />
        </TableCell>
      </TableRow>

      {expanded ? (
        <TableRow className="border-0 bg-transparent hover:bg-transparent">
          <TableCell colSpan={8} className="p-0">
            <AlternateExpandedPanel
              alternate={alternate}
              feePercentages={feePercentages}
              projectSquareFeet={projectSquareFeet}
            />
          </TableCell>
        </TableRow>
      ) : null}
    </Fragment>
  );
}

function AlternatesTable({
  alternates,
  feePercentages,
  expandedAlternateId,
  onToggleExpand,
  onEdit,
  onDuplicate,
  onDelete,
  onStatusChange,
  onToggleIncluded,
  onCreate,
  projectSquareFeet,
}: AlternatesTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <Table>
        <TableHeader className="bg-slate-50/90">
          <TableRow className="border-slate-200 hover:bg-transparent">
            <TableHead className="px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Alt #
            </TableHead>
            <TableHead className="px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Name / Description
            </TableHead>
            <TableHead className="px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Type
            </TableHead>
            <TableHead className="px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Status
            </TableHead>
            <TableHead className="px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              <div className="flex items-center gap-1">
                <span>Include in Final Total</span>
                <Info className="h-3.5 w-3.5 text-slate-400" />
              </div>
            </TableHead>
            <TableHead className="px-4 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Total
            </TableHead>
            <TableHead className="px-4 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              $/SF
            </TableHead>
            <TableHead className="px-4 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alternates.length ? (
            alternates.map((alternate) => (
              <AlternateRow
                key={alternate.id}
                alternate={alternate}
                feePercentages={feePercentages}
                expanded={expandedAlternateId === alternate.id}
                onToggleExpand={onToggleExpand}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                onToggleIncluded={onToggleIncluded}
                projectSquareFeet={projectSquareFeet}
              />
            ))
          ) : (
            <TableRow className="border-slate-200 hover:bg-white">
              <TableCell colSpan={8} className="px-4 py-14 text-center">
                <div className="mx-auto max-w-md space-y-3">
                  <div className="text-lg font-semibold text-slate-900">
                    No alternates match this filter
                  </div>
                  <div className="text-sm text-slate-500">
                    Add a new alternate to capture owner options, pricing deltas, and contract-ready add/deduct decisions.
                  </div>
                  <Button variant="outline" onClick={onCreate}>
                    <Plus className="h-4 w-4" />
                    Add Alternate
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function PricingSummary({
  alternate,
  feePercentages,
  projectSquareFeet,
}: {
  alternate: AlternateRecord;
  feePercentages: AlternateFeePercentages;
  projectSquareFeet: number | null;
}) {
  const financials = getAlternateFinancials(alternate, feePercentages);
  const perSquareFoot = getAlternatePerSquareFoot(alternate, feePercentages, projectSquareFeet);

  return (
    <Card className="border border-slate-200 bg-white py-0">
      <CardContent className="space-y-4 px-5 py-5">
        <div className="text-base font-semibold text-slate-900">Pricing Summary</div>
        <div className="space-y-3 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span className="font-medium text-slate-900">{formatCurrency(financials.subtotal)}</span>
          </div>
          {financials.feeAmounts.map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <span>
                {item.label} ({formatFeeRate(item.key, item.percent, feePercentages)})
              </span>
              <span className="font-medium text-slate-900">{formatCurrency(item.amount)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Total
            </div>
            <div className="text-3xl font-semibold text-emerald-700">
              {formatCurrency(financials.signedTotal)}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
            <span>$/SF</span>
            <span className="font-medium text-slate-900">{formatDollarPerSf(perSquareFoot)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AlternateModal({
  open,
  onOpenChange,
  draft,
  feePercentages,
  projectSquareFeet,
  onDraftChange,
  onSave,
  onDelete,
  mode,
}: AlternateModalProps) {
  const [costCodePopoverLineItemId, setCostCodePopoverLineItemId] = useState<string | null>(null);
  const [costCodeSearchQuery, setCostCodeSearchQuery] = useState("");
  const costCodeOptions = useMemo<AlternateCostCodeOption[]>(
    () =>
      getWorkspaceCostCodes()
        .map((costCode) => ({
          id: costCode.id,
          code: costCode.code,
          description: costCode.description?.trim() || "No description",
          division: costCode.usedIn.divisionTitle ? "Division Title" : "Cost Code",
        }))
        .sort((left, right) =>
          left.code.localeCompare(right.code, undefined, {
            numeric: true,
            sensitivity: "base",
          })
        ),
    []
  );
  const filteredCostCodeOptions = useMemo(() => {
    const normalizedQuery = costCodeSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) return costCodeOptions;
    return costCodeOptions.filter((option) =>
      [option.code, option.description, option.division]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [costCodeOptions, costCodeSearchQuery]);

  const updateLineItem = (
    lineItemId: string,
    key: keyof AlternateLineItem,
    value: string
  ) => {
    onDraftChange({
      ...draft,
      lineItems: draft.lineItems.map((lineItem) =>
        lineItem.id === lineItemId ? { ...lineItem, [key]: value } : lineItem
      ),
    });
  };

  const selectLineItemCostCode = (lineItemId: string, option: AlternateCostCodeOption) => {
    onDraftChange({
      ...draft,
      lineItems: draft.lineItems.map((lineItem) =>
        lineItem.id === lineItemId
          ? {
              ...lineItem,
              costCode: option.code,
              description: lineItem.description.trim() ? lineItem.description : option.description,
            }
          : lineItem
      ),
    });
    setCostCodePopoverLineItemId(null);
  };

  const addLineItem = () => {
    onDraftChange({
      ...draft,
      lineItems: [...draft.lineItems, createLineItem()],
    });
  };

  const removeLineItem = (lineItemId: string) => {
    onDraftChange({
      ...draft,
      lineItems:
        draft.lineItems.length > 1
          ? draft.lineItems.filter((lineItem) => lineItem.id !== lineItemId)
          : [createLineItem()],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="h-[92vh] w-[min(1280px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden p-0 sm:max-w-[calc(100vw-2rem)] lg:max-w-[1200px] xl:max-w-[1280px]"
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <DialogHeader className="gap-1">
                <DialogTitle className="text-[28px] font-semibold tracking-tight text-slate-900">
                  {mode === "create" ? "Add Alternate" : "Edit Alternate"}
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500">
                  Build add/deduct alternates separate from the base estimate and control whether accepted scope flows into the final contract total.
                </DialogDescription>
              </DialogHeader>
              <Badge className={cn("border", getStatusBadgeClassName(draft.status))}>
                {draft.status.toUpperCase()}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {mode === "edit" && onDelete ? (
                <Button variant="outline" onClick={onDelete}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={onSave}>Save Alternate</Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-6 py-6 overscroll-contain">
            <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-6">
                <Card className="border border-slate-200 bg-white py-0">
                  <CardContent className="space-y-5 px-5 py-5">
                    <div className="text-base font-semibold text-slate-900">
                      Alternate Information
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Alternate #</label>
                        <Input
                          value={draft.number}
                          onChange={(event) =>
                            onDraftChange({ ...draft, number: event.target.value.toUpperCase() })
                          }
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium text-slate-700">
                          Name / Description
                        </label>
                        <Input
                          value={draft.name}
                          onChange={(event) =>
                            onDraftChange({ ...draft, name: event.target.value })
                          }
                          placeholder="New entry door and store front"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Type</label>
                        <Select
                          value={draft.type}
                          onValueChange={(value) =>
                            onDraftChange({
                              ...draft,
                              type: value as AlternateType,
                            })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="add">Add</SelectItem>
                            <SelectItem value="deduct">Deduct</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 md:col-span-4">
                        <label className="text-sm font-medium text-slate-700">Status</label>
                        <Select
                          value={draft.status}
                          onValueChange={(value) =>
                            onDraftChange({
                              ...draft,
                              status: value as AlternateStatus,
                              includeInFinalTotal:
                                value === "accepted" ? draft.includeInFinalTotal : false,
                            })
                          }
                        >
                          <SelectTrigger className="w-full md:max-w-[220px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="accepted">Accepted</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">
                        Detailed Description
                      </label>
                      <Textarea
                        value={draft.description}
                        onChange={(event) =>
                          onDraftChange({ ...draft, description: event.target.value })
                        }
                        placeholder="Describe the scope and intent of this alternate."
                        className="min-h-[120px]"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-slate-200 bg-white py-0">
                  <CardContent className="space-y-4 px-5 py-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-base font-semibold text-slate-900">
                        Alternate Line Items
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" onClick={addLineItem}>
                          <Plus className="h-4 w-4" />
                          Add Line Item
                        </Button>
                        <Button variant="outline" disabled>
                          Import from Estimate
                        </Button>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow className="border-slate-200 hover:bg-transparent">
                            <TableHead className="px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Cost Code
                            </TableHead>
                            <TableHead className="px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Description
                            </TableHead>
                            <TableHead className="w-[148px] px-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Unit
                            </TableHead>
                            <TableHead className="w-[88px] px-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Qty
                            </TableHead>
                            <TableHead className="w-[132px] px-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Unit Cost
                            </TableHead>
                            <TableHead className="px-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Total
                            </TableHead>
                            <TableHead className="w-12 px-3" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {draft.lineItems.map((lineItem) => {
                            const lineTotal =
                              parseNumber(lineItem.quantity) * parseCurrency(lineItem.unitCost);
                            const selectedCostCode =
                              costCodeOptions.find((option) => option.code === lineItem.costCode) ?? null;
                            return (
                              <TableRow key={lineItem.id} className="border-slate-200">
                                <TableCell className="px-3 py-3">
                                  <Popover
                                    open={costCodePopoverLineItemId === lineItem.id}
                                    onOpenChange={(nextOpen) => {
                                      setCostCodePopoverLineItemId(nextOpen ? lineItem.id : null);
                                      setCostCodeSearchQuery("");
                                    }}
                                  >
                                    <PopoverTrigger asChild>
                                      <button
                                        type="button"
                                        className="flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 text-left text-sm text-slate-900 transition-colors hover:bg-slate-50 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                                      >
                                        <span className={cn("truncate", !lineItem.costCode && "text-slate-400")}>
                                          {lineItem.costCode || "Select cost code"}
                                        </span>
                                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                      align="start"
                                      className="w-[420px] p-0"
                                    >
                                      <div className="overflow-hidden rounded-lg">
                                        <div className="border-b border-slate-200 p-2">
                                          <Input
                                            value={costCodeSearchQuery}
                                            onChange={(event) =>
                                              setCostCodeSearchQuery(event.target.value)
                                            }
                                            placeholder="Search cost codes..."
                                            className="h-9"
                                            onWheel={(event) => event.stopPropagation()}
                                            onTouchMove={(event) => event.stopPropagation()}
                                            onPointerMove={(event) => event.stopPropagation()}
                                          />
                                        </div>
                                        <div
                                          className="h-[260px] overflow-y-auto overscroll-contain"
                                          onWheel={(event) => event.stopPropagation()}
                                          onWheelCapture={(event) => event.stopPropagation()}
                                          onTouchMove={(event) => event.stopPropagation()}
                                          onPointerMove={(event) => event.stopPropagation()}
                                        >
                                          {filteredCostCodeOptions.length ? (
                                            <div className="p-1">
                                              {filteredCostCodeOptions.map((option) => (
                                                <button
                                                  key={option.id}
                                                  type="button"
                                                  onClick={() =>
                                                    selectLineItemCostCode(lineItem.id, option)
                                                  }
                                                  className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition hover:bg-slate-100"
                                                >
                                                  <div className="min-w-0 flex-1">
                                                    <div className="font-medium text-slate-900">
                                                      {option.code}
                                                    </div>
                                                    <div className="truncate text-xs text-slate-500">
                                                      {option.description}
                                                    </div>
                                                  </div>
                                                  {selectedCostCode?.id === option.id ? (
                                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" />
                                                  ) : null}
                                                </button>
                                              ))}
                                            </div>
                                          ) : (
                                            <div className="px-3 py-6 text-center text-sm text-slate-500">
                                              No cost codes found.
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </TableCell>
                                <TableCell className="px-3 py-3">
                                  <Input
                                    value={lineItem.description}
                                    onChange={(event) =>
                                      updateLineItem(
                                        lineItem.id,
                                        "description",
                                        event.target.value
                                      )
                                    }
                                  />
                                </TableCell>
                                <TableCell className="w-[148px] px-3 py-3">
                                  <select
                                    value={lineItem.unit}
                                    onChange={(event) =>
                                      updateLineItem(lineItem.id, "unit", event.target.value)
                                    }
                                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-right text-sm text-slate-900 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                                  >
                                    {ALTERNATE_UNIT_OPTIONS.map((unitOption) => (
                                      <option key={unitOption || "blank"} value={unitOption}>
                                        {unitOption === ""
                                          ? "Select"
                                          : unitOption === "excluded"
                                            ? "Excluded"
                                            : unitOption}
                                      </option>
                                    ))}
                                  </select>
                                </TableCell>
                                <TableCell className="w-[88px] px-3 py-3">
                                  <Input
                                    value={lineItem.quantity}
                                    onChange={(event) =>
                                      updateLineItem(
                                        lineItem.id,
                                        "quantity",
                                        event.target.value
                                      )
                                    }
                                    className="text-right"
                                  />
                                </TableCell>
                                <TableCell className="w-[132px] px-3 py-3">
                                  <Input
                                    value={lineItem.unitCost}
                                    onChange={(event) =>
                                      updateLineItem(
                                        lineItem.id,
                                        "unitCost",
                                        formatMoneyInputTyping(event.target.value)
                                      )
                                    }
                                    onFocus={() => {
                                      const parsed = parseMoney(lineItem.unitCost);
                                      if (parsed !== null) {
                                        updateLineItem(lineItem.id, "unitCost", String(parsed));
                                      }
                                    }}
                                    onBlur={() =>
                                      updateLineItem(
                                        lineItem.id,
                                        "unitCost",
                                        formatMoneyInputBlur(lineItem.unitCost)
                                      )
                                    }
                                    className="text-right"
                                  />
                                </TableCell>
                                <TableCell className="px-3 py-3 text-right font-semibold text-slate-900">
                                  {formatCurrency(lineTotal)}
                                </TableCell>
                                <TableCell className="px-3 py-3 text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => removeLineItem(lineItem.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Remove line item</span>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-6 xl:grid-cols-2">
                  <Card className="border border-slate-200 bg-white py-0">
                    <CardContent className="space-y-4 px-5 py-5">
                      <div className="text-base font-semibold text-slate-900">
                        Markups & Fees
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {ALTERNATE_FEE_CONFIG.map((fee) => (
                          <div
                            key={fee.key}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                          >
                            <div className="text-sm font-medium text-slate-900">{fee.label}</div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">
                              {formatFeeRate(fee.key, feePercentages[fee.key], feePercentages)}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-slate-500">
                        Managed from Data, Factors & Rates.
                      </div>
                    </CardContent>
                  </Card>

                  <PricingSummary
                    alternate={draft}
                    feePercentages={feePercentages}
                    projectSquareFeet={projectSquareFeet}
                  />
                </div>

                <div className="grid gap-6">
                  <Card className="border border-slate-200 bg-white py-0">
                    <CardContent className="space-y-3 px-5 py-5">
                      <div className="text-base font-semibold text-slate-900">Notes (Internal)</div>
                      <Textarea
                        value={draft.notes}
                        onChange={(event) =>
                          onDraftChange({ ...draft, notes: event.target.value })
                        }
                        placeholder="Internal notes for the project team."
                        className="min-h-[140px]"
                      />
                      <div className="text-xs text-slate-500">
                        These notes are only visible to internal users.
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function makeEmptyAlternate(nextNumber: string): AlternateRecord {
  return {
    id: crypto.randomUUID(),
    number: nextNumber,
    name: "",
    description: "",
    type: "add",
    status: "pending",
    includeInFinalTotal: false,
    notes: "",
    lineItems: [createLineItem()],
    markups: {
      overheadPercent: "10.00",
      profitPercent: "10.00",
      taxPercent: "8.25",
      includeOverhead: true,
      includeProfit: true,
      includeTax: true,
    },
    createdBy: "Estimator John Smith",
    updatedAt: new Date().toISOString(),
  };
}

function cloneAlternate(alternate: AlternateRecord): AlternateRecord {
  return {
    ...alternate,
    lineItems: alternate.lineItems.map((lineItem) => ({ ...lineItem, id: crypto.randomUUID() })),
    markups: { ...alternate.markups },
  };
}

function getNextAlternateNumber(alternates: AlternateRecord[]): string {
  const nextIndex =
    alternates.reduce((max, alternate) => {
      const numeric = Number.parseInt(alternate.number.replace(/[^\d]/g, ""), 10);
      return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
    }, 0) + 1;
  return `ALT-${String(nextIndex).padStart(2, "0")}`;
}

export default function AlternatesWorkspace({
  embedded = false,
  autoOpenCreateToken = 0,
  baseEstimateTotalOverride = null,
  projectSquareFeetOverride = null,
  feePercentages = DEFAULT_ALTERNATE_FEE_PERCENTAGES,
}: {
  embedded?: boolean;
  autoOpenCreateToken?: number;
  baseEstimateTotalOverride?: number | null;
  projectSquareFeetOverride?: number | null;
  feePercentages?: AlternateFeePercentages;
}) {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project") ?? "default";
  const alternateStorageProjectIds = useMemo(() => {
    const mappedBidProjectId = getBidProjectIdForProject(projectId);
    const reverseMappedProjectId = getProjectIdForBidProject(projectId);
    return [mappedBidProjectId, reverseMappedProjectId, projectId].filter(
      (id, index, list): id is string => Boolean(id) && list.indexOf(id) === index
    );
  }, [projectId]);
  const [alternates, setAlternates] = useState<AlternateRecord[]>([]);
  const [expandedAlternateId, setExpandedAlternateId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<AlternateFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [draft, setDraft] = useState<AlternateRecord | null>(null);
  const [editingAlternateId, setEditingAlternateId] = useState<string | null>(null);
  const [estimateSnapshot, setEstimateSnapshot] = useState<EstimateExportSnapshot | null>(null);
  const alternatesHydratedRef = useRef(false);
  const skipNextAlternatesSaveRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    alternatesHydratedRef.current = false;
    skipNextAlternatesSaveRef.current = true;
    const raw =
      alternateStorageProjectIds
        .map((storageProjectId) => window.localStorage.getItem(getStorageKey(storageProjectId)))
        .find((value) => Boolean(value)) ?? null;
    if (!raw) {
      setAlternates([]);
      setExpandedAlternateId(null);
      alternatesHydratedRef.current = true;
      return;
    }

    try {
      const parsed = JSON.parse(raw) as AlternateRecord[];
      if (Array.isArray(parsed) && parsed.length) {
        if (isLegacySeededAlternates(parsed)) {
          setAlternates([]);
          setExpandedAlternateId(null);
          alternateStorageProjectIds.forEach((storageProjectId) => {
            window.localStorage.removeItem(getStorageKey(storageProjectId));
          });
          alternatesHydratedRef.current = true;
          return;
        }
        setAlternates(parsed);
        setExpandedAlternateId(parsed[0]?.id ?? null);
        alternatesHydratedRef.current = true;
        return;
      }
    } catch {
      // Reset to an empty state when persisted data is malformed.
    }

    setAlternates([]);
    setExpandedAlternateId(null);
    alternatesHydratedRef.current = true;
  }, [alternateStorageProjectIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!alternatesHydratedRef.current) return;
    if (skipNextAlternatesSaveRef.current) {
      skipNextAlternatesSaveRef.current = false;
      return;
    }
    alternateStorageProjectIds.forEach((storageProjectId) => {
      window.localStorage.setItem(getStorageKey(storageProjectId), JSON.stringify(alternates));
    });
  }, [alternateStorageProjectIds, alternates]);

  useEffect(() => {
    setEstimateSnapshot(readEstimateExportSnapshot(projectId));
  }, [projectId]);

  const projectSquareFeet = useMemo(
    () =>
      projectSquareFeetOverride !== null
        ? projectSquareFeetOverride
        : parseProjectSquareFeet(estimateSnapshot),
    [estimateSnapshot, projectSquareFeetOverride]
  );
  const baseEstimateTotal = useMemo(
    () =>
      baseEstimateTotalOverride !== null
        ? baseEstimateTotalOverride
        : parseCurrency(estimateSnapshot?.grandTotal ?? ""),
    [baseEstimateTotalOverride, estimateSnapshot]
  );
  const acceptedAlternatesTotal = useMemo(
    () => getAcceptedAlternatesTotal(alternates, feePercentages),
    [alternates, feePercentages]
  );
  const finalTotal = baseEstimateTotal + acceptedAlternatesTotal;

  const filteredAlternates = useMemo(() => {
    return alternates.filter((alternate) => {
      if (activeFilter !== "all" && alternate.status !== activeFilter) return false;
      if (!searchQuery.trim()) return true;
      const haystack = [
        alternate.number,
        alternate.name,
        alternate.description,
        alternate.notes,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchQuery.trim().toLowerCase());
    });
  }, [activeFilter, alternates, searchQuery]);

  const openCreateModal = () => {
    setModalMode("create");
    setEditingAlternateId(null);
    setDraft(makeEmptyAlternate(getNextAlternateNumber(alternates)));
    setModalOpen(true);
  };

  useEffect(() => {
    if (autoOpenCreateToken <= 0) return;
    openCreateModal();
  }, [autoOpenCreateToken]);

  const openEditModal = (alternate: AlternateRecord) => {
    setModalMode("edit");
    setEditingAlternateId(alternate.id);
    setDraft(cloneAlternate(alternate));
    setModalOpen(true);
  };

  const closeModal = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      setEditingAlternateId(null);
      setDraft(null);
    }
  };

  const handleSaveDraft = () => {
    if (!draft) return;
    const nextDraft = {
      ...draft,
      updatedAt: new Date().toISOString(),
      includeInFinalTotal: draft.status === "accepted" ? draft.includeInFinalTotal : false,
    };

    if (modalMode === "create") {
      setAlternates((prev) => [nextDraft, ...prev]);
      setExpandedAlternateId(nextDraft.id);
    } else {
      setAlternates((prev) =>
        prev.map((alternate) =>
          alternate.id === editingAlternateId ? nextDraft : alternate
        )
      );
    }

    closeModal(false);
  };

  const handleDelete = (alternateId: string) => {
    setAlternates((prev) => prev.filter((alternate) => alternate.id !== alternateId));
    setExpandedAlternateId((prev) => (prev === alternateId ? null : prev));
    if (editingAlternateId === alternateId) closeModal(false);
  };

  const handleDuplicate = (alternate: AlternateRecord) => {
    const duplicated = {
      ...cloneAlternate(alternate),
      id: crypto.randomUUID(),
      number: getNextAlternateNumber(alternates),
      name: `${alternate.name} Copy`,
      status: "pending" as const,
      includeInFinalTotal: false,
      updatedAt: new Date().toISOString(),
    };
    setAlternates((prev) => [duplicated, ...prev]);
    setExpandedAlternateId(duplicated.id);
  };

  const handleStatusChange = (alternateId: string, status: AlternateStatus) => {
    setAlternates((prev) =>
      prev.map((alternate) =>
        alternate.id === alternateId
          ? {
              ...alternate,
              status,
              includeInFinalTotal:
                status === "accepted" ? alternate.includeInFinalTotal : false,
              updatedAt: new Date().toISOString(),
            }
          : alternate
      )
    );
  };

  const handleToggleIncluded = (alternateId: string) => {
    setAlternates((prev) =>
      prev.map((alternate) =>
        alternate.id === alternateId && alternate.status === "accepted"
          ? {
              ...alternate,
              includeInFinalTotal: !alternate.includeInFinalTotal,
              updatedAt: new Date().toISOString(),
            }
          : alternate
      )
    );
  };

  const handleExport = () => {
    const payload = {
      projectId,
      exportedAt: new Date().toISOString(),
      baseEstimateTotal,
      acceptedAlternatesTotal,
      finalTotal,
        alternates: alternates.map((alternate) => ({
          ...alternate,
          financials: getAlternateFinancials(alternate, feePercentages),
        })),
      };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `alternates-${projectId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {embedded ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(540px,680px)] xl:items-start">
          <div className="px-1 py-2">
            <div className="space-y-3">
              <h1 className="text-[32px] font-semibold tracking-tight text-slate-900">
                Alternates
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-500">
                  Alternates are not included in the preliminary estimate total.
                  Accepted alternates can be included in the final contract total.
              </p>
            </div>
          </div>

          <AlternateSummaryStrip
            baseEstimateTotal={baseEstimateTotal}
            acceptedAlternatesTotal={acceptedAlternatesTotal}
            finalTotal={finalTotal}
          />
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-start">
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <h1 className="text-[32px] font-semibold tracking-tight text-slate-900">
                  Alternates
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-slate-500">
                  Alternates are not included in the preliminary estimate total.
                  Accepted alternates can be included in the final contract total.
                </p>
              </div>

              <div />
            </div>
          </div>

          <AlternateSummaryCards
            baseEstimateTotal={baseEstimateTotal}
            acceptedAlternatesTotal={acceptedAlternatesTotal}
            finalTotal={finalTotal}
            hasEstimateSnapshot={Boolean(estimateSnapshot)}
          />
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <Tabs
            value={activeFilter}
            onValueChange={(value) => setActiveFilter(value as AlternateFilter)}
            className="gap-0"
          >
            <TabsList className="h-auto rounded-xl bg-slate-100 p-1">
              {(["all", "pending", "accepted", "rejected"] as AlternateFilter[]).map(
                (tab) => (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    className="rounded-lg px-4 py-2 text-sm font-medium capitalize"
                  >
                    {tab} ({getInitialsStatusCount(alternates, tab)})
                  </TabsTrigger>
                )
              )}
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <Button variant="outline" className="justify-start">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
            <div className="relative min-w-[280px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search alternates..."
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </section>

          <AlternatesTable
            alternates={filteredAlternates}
            feePercentages={feePercentages}
            expandedAlternateId={expandedAlternateId}
            onToggleExpand={(alternateId) =>
              setExpandedAlternateId((prev) => (prev === alternateId ? null : alternateId))
        }
        onEdit={openEditModal}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
        onToggleIncluded={handleToggleIncluded}
        onCreate={openCreateModal}
        projectSquareFeet={projectSquareFeet}
      />

      {draft ? (
          <AlternateModal
            open={modalOpen}
            onOpenChange={closeModal}
            draft={draft}
            feePercentages={feePercentages}
            projectSquareFeet={projectSquareFeet}
            onDraftChange={setDraft}
            onSave={handleSaveDraft}
            onDelete={
            modalMode === "edit" && editingAlternateId
              ? () => handleDelete(editingAlternateId)
              : undefined
          }
          mode={modalMode}
        />
      ) : null}
    </div>
  );
}
