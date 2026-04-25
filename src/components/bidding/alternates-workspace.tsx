"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
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
  onDraftChange: (draft: AlternateRecord) => void;
  onSave: () => void;
  onDelete?: () => void;
  mode: "create" | "edit";
};

type AlternateExpandedPanelProps = {
  alternate: AlternateRecord;
  projectSquareFeet: number | null;
  onToggleIncluded: (alternateId: string) => void;
};

type AlternateRowProps = {
  alternate: AlternateRecord;
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

const ALTERNATES_STORAGE_KEY = "builderos.bidding.alternates.v1";
export const ESTIMATE_ALTERNATE_CREATE_REQUEST_EVENT = "estimate-alternate-create-request";

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

function createSampleAlternates(): AlternateRecord[] {
  return [
    {
      id: "alt-01",
      number: "ALT-01",
      name: "Demo store front per KN 18 on page A.01",
      description:
        "Remove existing storefront and associated framing. Patch and prepare opening.",
      type: "add",
      status: "pending",
      includeInFinalTotal: false,
      notes: "Waiting on owner direction before pricing acceptance.",
      lineItems: [
        createLineItem({
          id: "alt-01-line-1",
          costCode: "02-41-00",
          description: "Selective demolition and opening prep",
          unit: "LS",
          quantity: "1",
          unitCost: "1500",
        }),
      ],
      markups: {
        overheadPercent: "0.00",
        profitPercent: "0.00",
        taxPercent: "0.00",
        includeOverhead: false,
        includeProfit: false,
        includeTax: false,
      },
      createdBy: "Estimator John Smith",
      updatedAt: "2026-04-25T08:00:00.000Z",
    },
    {
      id: "alt-02",
      number: "ALT-02",
      name: "New entry door and store front",
      description:
        "Furnish and install new aluminum storefront and entry door system.",
      type: "add",
      status: "accepted",
      includeInFinalTotal: true,
      notes:
        "Client requested upgraded storefront system with matching entry door. See spec section 08 50 00.",
      lineItems: [
        createLineItem({
          id: "alt-02-line-1",
          costCode: "08-50-00",
          description: "Aluminum storefront system, complete",
          unit: "LS",
          quantity: "1",
          unitCost: "2450",
        }),
        createLineItem({
          id: "alt-02-line-2",
          costCode: "08-71-00",
          description: "Glazed aluminum entry door",
          unit: "EA",
          quantity: "1",
          unitCost: "800",
        }),
      ],
      markups: {
        overheadPercent: "10.00",
        profitPercent: "10.00",
        taxPercent: "8.25",
        includeOverhead: true,
        includeProfit: true,
        includeTax: true,
      },
      createdBy: "Estimator John Smith",
      updatedAt: "2026-04-25T08:14:00.000Z",
    },
    {
      id: "alt-03",
      number: "ALT-03",
      name: "Upgrade interior finishes",
      description: "Upgrade flooring, wall finish, and accent paint at bar area.",
      type: "add",
      status: "pending",
      includeInFinalTotal: false,
      notes: "Keep this separate from the base finish package in proposal review.",
      lineItems: [
        createLineItem({
          id: "alt-03-line-1",
          costCode: "09-65-00",
          description: "Luxury vinyl tile upgrade",
          unit: "SF",
          quantity: "800",
          unitCost: "3.75",
        }),
        createLineItem({
          id: "alt-03-line-2",
          costCode: "09-90-00",
          description: "Accent paint and wall finish upgrade",
          unit: "LS",
          quantity: "1",
          unitCost: "1000",
        }),
      ],
      markups: {
        overheadPercent: "0.00",
        profitPercent: "0.00",
        taxPercent: "0.00",
        includeOverhead: false,
        includeProfit: false,
        includeTax: false,
      },
      createdBy: "Estimator John Smith",
      updatedAt: "2026-04-25T08:13:00.000Z",
    },
    {
      id: "alt-04",
      number: "ALT-04",
      name: "Deduct existing hood cleaning",
      description:
        "Deduct existing hood cleaning scope to remain and be professionally cleaned by owner.",
      type: "deduct",
      status: "rejected",
      includeInFinalTotal: false,
      notes: "Rejected by client. Retained for proposal history and acceptance-rate tracking.",
      lineItems: [
        createLineItem({
          id: "alt-04-line-1",
          costCode: "23-05-53",
          description: "Kitchen exhaust hood cleaning scope removal",
          unit: "LS",
          quantity: "1",
          unitCost: "2000",
        }),
      ],
      markups: {
        overheadPercent: "0.00",
        profitPercent: "0.00",
        taxPercent: "0.00",
        includeOverhead: false,
        includeProfit: false,
        includeTax: false,
      },
      createdBy: "Estimator John Smith",
      updatedAt: "2026-04-25T08:20:00.000Z",
    },
  ];
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

function getAlternateFinancials(alternate: AlternateRecord) {
  const subtotal = alternate.lineItems.reduce((sum, lineItem) => {
    return sum + parseNumber(lineItem.quantity) * parseCurrency(lineItem.unitCost);
  }, 0);
  const overheadAmount = alternate.markups.includeOverhead
    ? subtotal * (parseNumber(alternate.markups.overheadPercent) / 100)
    : 0;
  const profitAmount = alternate.markups.includeProfit
    ? subtotal * (parseNumber(alternate.markups.profitPercent) / 100)
    : 0;
  const taxAmount = alternate.markups.includeTax
    ? subtotal * (parseNumber(alternate.markups.taxPercent) / 100)
    : 0;
  const grossTotal = subtotal + overheadAmount + profitAmount + taxAmount;
  const signedMultiplier = alternate.type === "deduct" ? -1 : 1;

  return {
    subtotal,
    overheadAmount,
    profitAmount,
    taxAmount,
    grossTotal,
    signedTotal: grossTotal * signedMultiplier,
  };
}

function getAcceptedAlternatesTotal(alternates: AlternateRecord[]): number {
  return alternates.reduce((sum, alternate) => {
    if (alternate.status !== "accepted" || !alternate.includeInFinalTotal) return sum;
    return sum + getAlternateFinancials(alternate).signedTotal;
  }, 0);
}

function getAlternatePerSquareFoot(
  alternate: AlternateRecord,
  projectSquareFeet: number | null
): number | null {
  if (!projectSquareFeet || projectSquareFeet <= 0) return null;
  return getAlternateFinancials(alternate).signedTotal / projectSquareFeet;
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
  onToggle,
  compact = false,
}: {
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
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
  projectSquareFeet,
  onToggleIncluded,
}: AlternateExpandedPanelProps) {
  const financials = getAlternateFinancials(alternate);
  const perSquareFoot = getAlternatePerSquareFoot(alternate, projectSquareFeet);

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
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <IncludeToggle
            checked={alternate.includeInFinalTotal}
            disabled={alternate.status !== "accepted"}
            onToggle={() => onToggleIncluded(alternate.id)}
          />
          <div>
            <div className="text-sm font-medium text-slate-900">Included in final total</div>
            <div className="text-xs text-slate-500">
              {alternate.status === "accepted"
                ? "Included when accepted and switched on."
                : "Available after the alternate is accepted."}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
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

          <div className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-5">
            {[
              { label: "Subtotal", value: financials.subtotal },
              {
                label: `Overhead (${formatPercent(parseNumber(alternate.markups.overheadPercent))})`,
                value: financials.overheadAmount,
              },
              {
                label: `Profit (${formatPercent(parseNumber(alternate.markups.profitPercent))})`,
                value: financials.profitAmount,
              },
              {
                label: `Tax (${formatPercent(parseNumber(alternate.markups.taxPercent))})`,
                value: financials.taxAmount,
              },
              { label: "Final Total", value: financials.signedTotal, emphasis: true },
            ].map((item) => (
              <div
                key={item.label}
                className={cn(
                  "bg-white px-4 py-3",
                  item.emphasis && "bg-emerald-50/80"
                )}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {item.label}
                </div>
                <div
                  className={cn(
                    "mt-1 text-lg font-semibold text-slate-900",
                    item.emphasis && "text-emerald-700"
                  )}
                >
                  {formatCurrency(item.value)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Card className="border border-slate-200 bg-white py-0 shadow-sm">
          <CardContent className="space-y-5 px-5 py-5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Notes
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {alternate.notes || "No internal notes yet."}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Pricing Snapshot
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Type</span>
                  <span className="font-medium text-slate-900">
                    {alternate.type === "add" ? "Add" : "Deduct"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <span className="font-medium capitalize text-slate-900">{alternate.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>$/SF</span>
                  <span className="font-medium text-slate-900">
                    {formatDollarPerSf(perSquareFoot)}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
              <div>{alternate.createdBy}</div>
              <div>{new Date(alternate.updatedAt).toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>
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
  expanded,
  onToggleExpand,
  onEdit,
  onDuplicate,
  onDelete,
  onStatusChange,
  onToggleIncluded,
  projectSquareFeet,
}: AlternateRowProps) {
  const financials = getAlternateFinancials(alternate);
  const perSquareFoot = getAlternatePerSquareFoot(alternate, projectSquareFeet);

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
              projectSquareFeet={projectSquareFeet}
              onToggleIncluded={onToggleIncluded}
            />
          </TableCell>
        </TableRow>
      ) : null}
    </Fragment>
  );
}

function AlternatesTable({
  alternates,
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
  projectSquareFeet,
}: {
  alternate: AlternateRecord;
  projectSquareFeet: number | null;
}) {
  const financials = getAlternateFinancials(alternate);
  const perSquareFoot = getAlternatePerSquareFoot(alternate, projectSquareFeet);

  return (
    <Card className="border border-slate-200 bg-white py-0">
      <CardContent className="space-y-4 px-5 py-5">
        <div className="text-base font-semibold text-slate-900">Pricing Summary</div>
        <div className="space-y-3 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span className="font-medium text-slate-900">{formatCurrency(financials.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Overhead ({formatPercent(parseNumber(alternate.markups.overheadPercent))})</span>
            <span className="font-medium text-slate-900">
              {formatCurrency(financials.overheadAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Profit ({formatPercent(parseNumber(alternate.markups.profitPercent))})</span>
            <span className="font-medium text-slate-900">
              {formatCurrency(financials.profitAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Tax ({formatPercent(parseNumber(alternate.markups.taxPercent))})</span>
            <span className="font-medium text-slate-900">{formatCurrency(financials.taxAmount)}</span>
          </div>
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
  onDraftChange,
  onSave,
  onDelete,
  mode,
}: AlternateModalProps) {
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
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
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
                            <TableHead className="px-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Unit
                            </TableHead>
                            <TableHead className="px-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Qty
                            </TableHead>
                            <TableHead className="px-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
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
                            return (
                              <TableRow key={lineItem.id} className="border-slate-200">
                                <TableCell className="px-3 py-3">
                                  <Input
                                    value={lineItem.costCode}
                                    onChange={(event) =>
                                      updateLineItem(
                                        lineItem.id,
                                        "costCode",
                                        event.target.value
                                      )
                                    }
                                  />
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
                                <TableCell className="px-3 py-3">
                                  <Input
                                    value={lineItem.unit}
                                    onChange={(event) =>
                                      updateLineItem(lineItem.id, "unit", event.target.value)
                                    }
                                    className="text-right"
                                  />
                                </TableCell>
                                <TableCell className="px-3 py-3">
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
                                <TableCell className="px-3 py-3">
                                  <Input
                                    value={lineItem.unitCost}
                                    onChange={(event) =>
                                      updateLineItem(
                                        lineItem.id,
                                        "unitCost",
                                        event.target.value
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

                <Card className="border border-slate-200 bg-white py-0">
                  <CardContent className="space-y-4 px-5 py-5">
                    <div className="text-base font-semibold text-slate-900">Markups</div>
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow className="border-slate-200 hover:bg-transparent">
                            <TableHead className="px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Markup Type
                            </TableHead>
                            <TableHead className="px-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              %
                            </TableHead>
                            <TableHead className="px-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Amount
                            </TableHead>
                            <TableHead className="px-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Include in Total
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[
                            {
                              label: "Overhead",
                              percentKey: "overheadPercent" as const,
                              includedKey: "includeOverhead" as const,
                              amount: getAlternateFinancials(draft).overheadAmount,
                            },
                            {
                              label: "Profit",
                              percentKey: "profitPercent" as const,
                              includedKey: "includeProfit" as const,
                              amount: getAlternateFinancials(draft).profitAmount,
                            },
                            {
                              label: "Tax",
                              percentKey: "taxPercent" as const,
                              includedKey: "includeTax" as const,
                              amount: getAlternateFinancials(draft).taxAmount,
                            },
                          ].map((markup) => (
                            <TableRow key={markup.label} className="border-slate-200">
                              <TableCell className="px-3 py-3 font-medium text-slate-900">
                                {markup.label}
                              </TableCell>
                              <TableCell className="px-3 py-3">
                                <Input
                                  value={draft.markups[markup.percentKey]}
                                  onChange={(event) =>
                                    onDraftChange({
                                      ...draft,
                                      markups: {
                                        ...draft.markups,
                                        [markup.percentKey]: event.target.value,
                                      },
                                    })
                                  }
                                  className="max-w-[120px] text-right"
                                />
                              </TableCell>
                              <TableCell className="px-3 py-3 text-right font-semibold text-slate-900">
                                {formatCurrency(markup.amount)}
                              </TableCell>
                              <TableCell className="px-3 py-3 text-right">
                                <div className="flex justify-end">
                                  <IncludeToggle
                                    checked={draft.markups[markup.includedKey]}
                                    onToggle={() =>
                                      onDraftChange({
                                        ...draft,
                                        markups: {
                                          ...draft.markups,
                                          [markup.includedKey]:
                                            !draft.markups[markup.includedKey],
                                        },
                                      })
                                    }
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <PricingSummary alternate={draft} projectSquareFeet={null} />

                <Card className="border border-slate-200 bg-white py-0">
                  <CardContent className="space-y-4 px-5 py-5">
                    <div className="text-base font-semibold text-slate-900">Inclusion</div>
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div>
                        <div className="font-medium text-slate-900">Include in final total</div>
                        <div className="text-sm text-slate-500">
                          Accepted alternates can flow into the final contract total.
                        </div>
                      </div>
                      <IncludeToggle
                        checked={draft.includeInFinalTotal}
                        disabled={draft.status !== "accepted"}
                        onToggle={() =>
                          onDraftChange({
                            ...draft,
                            includeInFinalTotal: !draft.includeInFinalTotal,
                          })
                        }
                      />
                    </div>
                  </CardContent>
                </Card>

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
}: {
  embedded?: boolean;
  autoOpenCreateToken?: number;
}) {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project") ?? "default";
  const [alternates, setAlternates] = useState<AlternateRecord[]>([]);
  const [expandedAlternateId, setExpandedAlternateId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<AlternateFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [draft, setDraft] = useState<AlternateRecord | null>(null);
  const [editingAlternateId, setEditingAlternateId] = useState<string | null>(null);
  const [estimateSnapshot, setEstimateSnapshot] = useState<EstimateExportSnapshot | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem(getStorageKey(projectId));
    if (!raw) {
      const seeded = createSampleAlternates();
      setAlternates(seeded);
      setExpandedAlternateId("alt-02");
      return;
    }

    try {
      const parsed = JSON.parse(raw) as AlternateRecord[];
      if (Array.isArray(parsed) && parsed.length) {
        setAlternates(parsed);
        setExpandedAlternateId(parsed[0]?.id ?? null);
        return;
      }
    } catch {
      // Fall back to sample alternates when persisted data is malformed.
    }

    const seeded = createSampleAlternates();
    setAlternates(seeded);
    setExpandedAlternateId("alt-02");
  }, [projectId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(getStorageKey(projectId), JSON.stringify(alternates));
  }, [alternates, projectId]);

  useEffect(() => {
    setEstimateSnapshot(readEstimateExportSnapshot(projectId));
  }, [projectId]);

  const projectSquareFeet = useMemo(
    () => parseProjectSquareFeet(estimateSnapshot),
    [estimateSnapshot]
  );
  const baseEstimateTotal = useMemo(
    () => parseCurrency(estimateSnapshot?.grandTotal ?? ""),
    [estimateSnapshot]
  );
  const acceptedAlternatesTotal = useMemo(
    () => getAcceptedAlternatesTotal(alternates),
    [alternates]
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
        financials: getAlternateFinancials(alternate),
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
