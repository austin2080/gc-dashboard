"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addDays } from "date-fns";
import {
  createBidProject,
  createBidSubcontractor,
  createBidTrades,
  createTradeBid,
  getNextBidProjectPackageNumber,
  getBidProjectDetail,
  inviteSubToProject,
  isBidProjectPackageNumberAvailable,
  listBidSubcontractors,
  updateBidProject,
  updateBidProjectEmailTemplate,
  updateBidTrades,
} from "@/lib/bidding/store";
import { getWorkspaceTaxRates, type WorkspaceTaxRate } from "@/lib/settings/tax-rates";
import { getWorkspaceCostCodes } from "@/lib/settings/company-cost-codes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  EmailRichTextEditor,
  type EmailRichTextEditorHandle,
} from "@/components/email-rich-text-editor";
import {
  isLikelyHtml,
  plainTextToEmailHtml,
  sanitizeEmailHtml,
} from "@/lib/email/html";
import {
  CalendarIcon,
  Check,
  ChevronDown,
  ChevronRight,
  Ellipsis,
  Eye,
  File,
  FileCode2,
  FileText,
  FileStack,
  FolderPlus,
  FolderOpen,
  Info,
  MoreHorizontal,
  Pencil,
  Plus,
  Tag,
  Trash2Icon,
  Upload,
} from "lucide-react";

type BidPackageDraft = {
  project_name: string;
  package_number: string;
  status: string;
  architect: string;
  bid_set_date: string;
  owner: string;
  client_phone: string;
  client_email: string;
  location: string;
  project_address: string;
  project_city: string;
  project_state: string;
  project_zip: string;
  budget: string;
  due_date: string;
  due_hour: string;
  due_minute: string;
  due_period: string;
  due_time_enabled: boolean;
  tbd_due_date: boolean;
  primary_bidding_contact: string;
  bidding_cc_group: string;
  bidding_instructions: string;
  rfi_deadline_enabled: boolean;
  rfi_deadline_date: string;
  rfi_deadline_hour: string;
  rfi_deadline_minute: string;
  rfi_deadline_period: string;
  rfi_deadline_time_enabled: boolean;
  site_walkthrough_enabled: boolean;
  site_walkthrough_date: string;
  site_walkthrough_hour: string;
  site_walkthrough_minute: string;
  site_walkthrough_period: string;
  site_walkthrough_time_enabled: boolean;
  project_size_sqft: string;
  project_site_size_sqft: string;
  construction_start_date: string;
  construction_completion_date: string;
  closeout_completion_date: string;
  construction_duration_weeks: string;
  project_duration_weeks: string;
  tax_city_number: string;
  tax_city_name: string;
  tax_rate: string;
  tax_exempt: boolean;
  anticipated_award_date: string;
  countdown_emails: boolean;
  accept_submissions_past_due: boolean;
  enable_blind_bidding: boolean;
  disable_electronic_submission: boolean;
  include_bid_documents: boolean;
  bid_submission_confirmation_message: string;
};

type FileSectionKey = "plans" | "specs" | "addenda" | "reports" | "scope_sheets" | "other";
type DocumentSetId = "version_1" | `addendum_${number}`;

type UploadedBidFile = {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  section: FileSectionKey;
  documentSetId: DocumentSetId;
  folderId?: string | null;
  url: string;
};

type CustomFileFolder = {
  id: string;
  name: string;
  section: FileSectionKey;
};

type RenameFileDialogState = {
  fileId: string;
  originalName: string;
  draftName: string;
};

type DeleteFileDialogState = {
  fileId: string;
  fileName: string;
};

type NewFolderDialogState = {
  draftName: string;
};

const FILE_SECTION_META: Record<
  FileSectionKey,
  {
    label: string;
    shortLabel: string;
    emptyLabel: string;
    folderLabel: string;
    badgeLabel: string;
    groupKey: "plans" | "specs" | "addenda" | "reports";
  }
> = {
  plans: {
    label: "Plans",
    shortLabel: "Plans",
    emptyLabel: "No plans uploaded yet.",
    folderLabel: "Plans",
    badgeLabel: "Plan",
    groupKey: "plans",
  },
  specs: {
    label: "Specs",
    shortLabel: "Specs",
    emptyLabel: "No specs uploaded yet.",
    folderLabel: "Specs",
    badgeLabel: "Spec",
    groupKey: "specs",
  },
  addenda: {
    label: "Addenda",
    shortLabel: "Addenda",
    emptyLabel: "No addenda uploaded yet.",
    folderLabel: "Addenda",
    badgeLabel: "Addendum",
    groupKey: "addenda",
  },
  reports: {
    label: "Reports",
    shortLabel: "Reports",
    emptyLabel: "No reports uploaded yet.",
    folderLabel: "Reports",
    badgeLabel: "Report",
    groupKey: "reports",
  },
  scope_sheets: {
    label: "Scope Sheets",
    shortLabel: "Scope Sheets",
    emptyLabel: "No scope sheets uploaded yet.",
    folderLabel: "Reports",
    badgeLabel: "Scope Sheet",
    groupKey: "reports",
  },
  other: {
    label: "Other",
    shortLabel: "Other",
    emptyLabel: "No other files uploaded yet.",
    folderLabel: "Reports",
    badgeLabel: "Other",
    groupKey: "reports",
  },
};

const FILE_UPLOAD_SECTION_OPTIONS = [
  { value: "plans", label: "Plans" },
  { value: "specs", label: "Specs" },
  { value: "addenda", label: "Addenda" },
  { value: "reports", label: "Reports" },
  { value: "scope_sheets", label: "Scope Sheets" },
  { value: "other", label: "Other" },
] as const satisfies Array<{ value: FileSectionKey; label: string }>;

const FILE_FOLDER_OPTIONS = [
  { value: "plans", label: "Plans" },
  { value: "specs", label: "Specs" },
  { value: "addenda", label: "Addenda" },
  { value: "reports", label: "Reports" },
] as const satisfies Array<{
  value: (typeof FILE_UPLOAD_SECTION_OPTIONS)[number]["value"] extends infer T
    ? T extends "plans" | "specs" | "addenda" | "reports"
      ? T
      : never
    : never;
  label: string;
}>;

const DEFAULT_DOCUMENT_SET_ID: DocumentSetId = "version_1";

function normalizeFileSectionKey(value: unknown): FileSectionKey {
  if (value === "drawings") return "plans";
  if (value === "specifications") return "specs";
  if (value === "documents") return "addenda";
  if (
    value === "plans" ||
    value === "specs" ||
    value === "addenda" ||
    value === "reports" ||
    value === "scope_sheets" ||
    value === "other"
  ) {
    return value;
  }
  return "other";
}

function normalizeDocumentSetId(value: unknown): DocumentSetId {
  if (value === DEFAULT_DOCUMENT_SET_ID) return DEFAULT_DOCUMENT_SET_ID;
  if (typeof value === "string" && /^addendum_\d+$/.test(value)) {
    return value as DocumentSetId;
  }
  return DEFAULT_DOCUMENT_SET_ID;
}

function mergeDocumentSetIds(
  documentSetIds: readonly DocumentSetId[] | null | undefined,
  files: readonly UploadedBidFile[] = []
): DocumentSetId[] {
  const next: DocumentSetId[] = [DEFAULT_DOCUMENT_SET_ID];
  const seen = new Set<DocumentSetId>(next);

  for (const value of documentSetIds ?? []) {
    const normalized = normalizeDocumentSetId(value);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(normalized);
  }

  for (const file of files) {
    const normalized = normalizeDocumentSetId(file.documentSetId);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(normalized);
  }

  return next;
}

function normalizeUploadedBidFile(value: unknown): UploadedBidFile | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<UploadedBidFile> & {
    section?: unknown;
    documentSetId?: unknown;
    document_set_id?: unknown;
    folderId?: unknown;
    folder_id?: unknown;
  };
  if (
    typeof row.id !== "string" ||
    typeof row.name !== "string" ||
    typeof row.size !== "number" ||
    typeof row.uploadedAt !== "string" ||
    typeof row.url !== "string"
  ) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    size: row.size,
    uploadedAt: row.uploadedAt,
    section: normalizeFileSectionKey(row.section),
    documentSetId: normalizeDocumentSetId(row.documentSetId ?? row.document_set_id),
    folderId:
      typeof (row.folderId ?? row.folder_id) === "string"
        ? (row.folderId ?? row.folder_id) as string
        : null,
    url: row.url,
  };
}

function normalizeCustomFileFolder(value: unknown): CustomFileFolder | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<CustomFileFolder> & { section?: unknown };
  if (typeof row.id !== "string" || typeof row.name !== "string") return null;
  return {
    id: row.id,
    name: row.name,
    section: normalizeFileSectionKey(row.section),
  };
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return null;
  const mimeType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const dataPart = match[3] ?? "";

  try {
    if (isBase64) {
      const binary = atob(dataPart);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return new Blob([bytes], { type: mimeType });
    }

    return new Blob([decodeURIComponent(dataPart)], { type: mimeType });
  } catch {
    return null;
  }
}

type CostCodeOption = {
  id: string;
  code: string;
  description: string | null;
};

type SelectedTrade = {
  id: string;
  code: string;
  description: string | null;
};

type SubOption = {
  id: string;
  company: string;
  email?: string | null;
};

type AssignedSub = SubOption & {
  invited: boolean;
  willBid: boolean;
  bidInviteEmail: string;
};

type InvitationEmailDraft = {
  subject: string;
  message: string;
  requireAcknowledgement: boolean;
};

type CompanyUserOption = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "Active" | "Invited" | "Deactivated";
};

type ToastState = {
  type: "success" | "error";
  message: string;
};

type MailboxConnectionStatus = "active" | "inactive" | "error";

type MailboxConnectionSummary = {
  id: string;
  provider: "microsoft_365" | "sendgrid_app";
  status: MailboxConnectionStatus;
  email: string;
  displayName: string;
  connectedAt: string | null;
  updatedAt: string | null;
  tokenExpiresAt: string | null;
};

type NewSubTradeSelection = {
  id: string;
  code: string;
  description: string | null;
};

type BidPackageAutosavePayload = {
  draft: BidPackageDraft;
  activePanel: "general" | "files" | "trade-coverage" | "invite-subs" | "bid-email";
  activeFileSection: FileSectionKey;
  costCodeQuery: string;
  selectedTrades: SelectedTrade[];
  assignedSubsByTradeId: Record<string, AssignedSub[]>;
  inviteQueryByTradeId: Record<string, string>;
  documentSetIds: DocumentSetId[];
  customFolders: CustomFileFolder[];
  uploadedFiles: UploadedBidFile[];
};

type DatePickerPreset = {
  label: string;
  daysFromToday: number;
};

const INVITATION_EMAIL_DRAFT_STORAGE_KEY = "bidding-all-new-invitation-email-draft";
const BID_PACKAGE_AUTOSAVE_STORAGE_KEY = "bidding-all-new-package-autosave-v1";
const BID_PROJECT_GENERAL_INFO_STORAGE_KEY = "bidding-project-general-info-v1";
const BID_PACKAGE_FILES_STORAGE_KEY = "bidding-package-files-v1";
const BID_PACKAGE_FOLDERS_STORAGE_KEY = "bidding-package-folders-v1";
const BID_PACKAGE_DOCUMENT_SETS_STORAGE_KEY = "bidding-package-document-sets-v1";
const TOKEN_LIST = [
  "{project_name}",
  "{bid_package_name}",
  "{bid_due_date}",
  "{prebid_info}",
  "{portal_link}",
  "{contact_name}",
  "{contact_email}",
  "{project_addess}",
  "{project_address}",
  "{primary_bid_contact}",
  "{secondary_bid_contact}",
  "{primary bid contact email}",
  "{secondary bid contact email}",
  "{construction start date}",
  "{construction_duration}",
  "{project_size}",
  "{project_site_size}",
  "{Primary bid contact signature}",
] as const;

const LEGACY_INVITATION_SUBJECT = "Invitation to Bid: {bid_package_name} for {project_name}";
const DEFAULT_INVITATION_SUBJECT = "Invitation to Bid: {project_name}";
const LEGACY_INVITATION_MESSAGE = [
  "Hello,",
  "",
  "You are invited to bid on {bid_package_name} for {project_name}.",
  "Bid due date: {bid_due_date}",
  "",
  "Pre-bid information:",
  "{prebid_info}",
  "",
  "Submit your bid here: {portal_link}",
  "",
  "For questions, contact {contact_name} at {contact_email}.",
  "",
  "Thank you,",
  "{contact_name}",
].join("\n");
const DEFAULT_INVITATION_MESSAGE = sanitizeEmailHtml(
  [
    '<p><span style="font-size:14px">Hello,</span></p>',
    '<p><span style="font-size:14px">You are invited to bid on the {project_name} project! You can access the plans via the link below. Please let me know if you are interested in bidding on this project with us.</span></p>',
    '<p><span style="font-size:14px"><strong>Location and Project Information</strong></span></p>',
    "<ul>",
    "<li><p>Hours are expected to be 7am-4pm</p></li>",
    "<li><p>{project_address}</p></li>",
    "<li><p>Building Area Square Footage: {project_size}</p></li>",
    "<li><p>Net Site Area Square Footage: {project_site_size}</p></li>",
    "</ul>",
    '<p><span style="font-size:14px"><strong>Bid Information</strong></span></p>',
    "<ul>",
    "<li><p>Bids are due by {bid_due_date}</p></li>",
    "<li><p>If proposing substitutions, please do not include in your base bid, please list as an add alt/ deduct.</p></li>",
    "<li><p>Please send all question to {primary bid contact email} for discussion and distribution.</p></li>",
    "<li><p>Start date is expected to be {construction start date}, please advise on your availability (manpower and material)</p></li>",
    "<li><p>Project duration is expected to be {construction_duration} weeks.</p></li>",
    "<li><p>All addendums, if any, will be distributed upon receipt</p></li>",
    "</ul>",
    "<p>Thank you, <br />{Primary bid contact signature}</p>",
  ].join("")
);
const PROJECT_SITE_SIZE_LIST_ITEM = "<li><p>Net Site Area Square Footage: {project_site_size}</p></li>";
const EMAIL_PREVIEW_CLASS =
  "text-sm leading-6 [&_ol]:ml-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:ml-5 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-4";
const PREVIOUS_DEFAULT_INVITATION_MESSAGE = [
  "Hello,",
  "",
  "You are invited to bid on {project_name}.",
  "Bid due date: {bid_due_date}",
  "",
  "Pre-bid information:",
  "{prebid_info}",
  "",
  "For questions, contact {contact_name} at {contact_email}.",
  "",
  "Thank you,",
  "{contact_name}",
].join("\n");

function removeBidPortalLine(message: string) {
  if (isLikelyHtml(message)) return sanitizeEmailHtml(message);
  return message
    .split("\n")
    .filter((line) => !/^submit your bid here:\s*(?:\{portal_link\}|https?:\/\/\S+)?\s*$/i.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function normalizeInvitationMessage(message: string) {
  const cleanMessage = removeBidPortalLine(message);
  return isLikelyHtml(cleanMessage)
    ? sanitizeEmailHtml(cleanMessage)
    : plainTextToEmailHtml(cleanMessage);
}

function normalizeComparableSize(value: string) {
  return value.trim().replace(/,/g, "").toLowerCase();
}

const PREBID_TIMEZONE_OPTIONS = ["EST", "CST", "MST", "PST"] as const;

const DATE_DISPLAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "2-digit",
  day: "2-digit",
  year: "numeric",
});

function parseIsoDate(value: string): Date | undefined {
  if (!value) return undefined;
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return undefined;
  }
  return new Date(year, month - 1, day);
}

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatOptionalDateTimeLabel(
  date: string,
  hour: string,
  minute: string,
  period: string,
  includeTime: boolean,
  fallback = "TBD"
) {
  const selectedDate = parseIsoDate(date);
  if (!selectedDate) return fallback;
  const dateLabel = DATE_DISPLAY_FORMATTER.format(selectedDate);
  if (!includeTime) return dateLabel;
  return `${dateLabel} ${hour}:${minute} ${period.toUpperCase()}`;
}

function formatBidDueDateLabel(
  draft: Pick<BidPackageDraft, "due_date" | "due_hour" | "due_minute" | "due_period" | "due_time_enabled">
) {
  return formatOptionalDateTimeLabel(
    draft.due_date,
    draft.due_hour,
    draft.due_minute,
    draft.due_period,
    draft.due_time_enabled
  );
}

function addDaysToIsoDate(isoDate: string, days: number) {
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
}

function sanitizeTaxRateInput(value: string): string {
  return value.replace(/[^0-9.]/g, "");
}

function formatTaxRateDisplay(value: string): string {
  const sanitized = sanitizeTaxRateInput(value).trim();
  if (!sanitized) return "";
  const numeric = Number(sanitized);
  if (!Number.isFinite(numeric)) return "";
  return `${numeric.toFixed(2)}%`;
}

function formatActualTaxRateDisplay(value: string, state: string): string {
  const sanitized = sanitizeTaxRateInput(value).trim();
  if (!sanitized) return "";
  const numeric = Number(sanitized);
  if (!Number.isFinite(numeric)) return "";
  const actualRate = state.trim().toUpperCase() === "AZ" ? numeric * 0.65 : numeric;
  return `${actualRate.toFixed(2)}%`;
}

function formatCombinedAndActualTaxRateDisplay(value: string, state: string): string {
  const combined = formatTaxRateDisplay(value);
  const actual = formatActualTaxRateDisplay(value, state);
  if (!combined || !actual) return "";
  return `${combined} - Actual ${actual}`;
}

function normalizeTaxRateValue(value: string): string {
  const sanitized = sanitizeTaxRateInput(value).trim();
  if (!sanitized) return "";
  const numeric = Number(sanitized);
  if (!Number.isFinite(numeric)) return "";
  return numeric.toFixed(2);
}

function calculateDurationWeeks(startIsoDate: string, endIsoDate: string) {
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
}

function sanitizeWholeNumberInput(value: string) {
  return value.replace(/\D/g, "");
}

function formatTradeLabel(trade: { code: string; description: string | null }) {
  return `${trade.code}${trade.description ? ` ${trade.description}` : ""}`.trim();
}

function DatePickerField({
  value,
  onChange,
  disabled,
  className,
  presets,
  placeholder = "Select date",
  iconPosition = "left",
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
  presets?: DatePickerPreset[];
  placeholder?: string;
  iconPosition?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = parseIsoDate(value);
  const [currentMonth, setCurrentMonth] = useState<Date>(
    selectedDate ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          if (selectedDate) {
            setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
          } else {
            const today = new Date();
            setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
          }
        }
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={`${
            iconPosition === "right" ? "justify-between" : "justify-start"
          } !h-auto min-h-[40px] ${inputClass} font-normal hover:!border-accent hover:!bg-accent hover:!text-accent-foreground hover:[&_svg]:!text-accent-foreground aria-expanded:!border-accent aria-expanded:!bg-accent aria-expanded:!text-accent-foreground aria-expanded:[&_svg]:!text-accent-foreground ${className ?? "w-[170px]"}`}
        >
          {iconPosition === "left" ? <CalendarIcon className="mr-2 size-4 text-slate-500" /> : null}
          <span>{selectedDate ? DATE_DISPLAY_FORMATTER.format(selectedDate) : placeholder}</span>
          {iconPosition === "right" ? <CalendarIcon className="size-5 text-current" /> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="max-h-[var(--radix-popover-content-available-height)] w-[340px] min-w-[340px] overflow-y-auto p-0"
        align="start"
        side="bottom"
        sideOffset={6}
        collisionPadding={{ top: 88, right: 16, bottom: 16, left: 16 }}
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          captionLayout="dropdown"
          fromYear={2000}
          toYear={2100}
          fixedWeeks
          className="w-full bg-transparent p-2 pb-1 [--cell-size:--spacing(10)]"
          classNames={{
            dropdowns: "flex h-(--cell-size) w-full items-center justify-center gap-2 text-base font-medium",
            caption_label: "text-base font-medium",
            weekday: "flex-1 rounded-(--cell-radius) text-sm font-medium text-muted-foreground select-none",
          }}
          onSelect={(date) => {
            if (date) {
              setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
            }
            onChange(date ? toIsoDate(date) : "");
            setOpen(false);
          }}
        />
        {presets?.length ? (
          <div className="grid grid-cols-2 gap-2 border-t px-3 py-2">
            {presets.map((preset, index) => (
              <Button
                key={preset.label}
                type="button"
                variant="outline"
                size="sm"
                className={index === presets.length - 1 && presets.length % 2 === 1 ? "col-span-2" : "w-full"}
                onClick={() => {
                  const nextDate = addDays(new Date(), preset.daysFromToday);
                  setCurrentMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
                  onChange(toIsoDate(nextDate));
                  setOpen(false);
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        ) : null}
        <div className="border-t px-3 py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setOpen(false)}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const inputClass =
  "rounded-lg border-[1px] border-slate-300 bg-white px-3 py-2 text-[15px] leading-[28px] font-medium text-slate-900 shadow-none placeholder:text-slate-500 focus-visible:border-sky-500 focus-visible:ring-4 focus-visible:ring-sky-100";
const selectFieldClass =
  "w-full border-[1px] border-slate-300 bg-white leading-[28px] font-medium text-slate-900 shadow-none focus-visible:border-sky-500 focus-visible:ring-4 focus-visible:ring-sky-100 [&_svg]:text-slate-400";
const filesSectionHeadingClass =
  "text-[20px] font-semibold leading-tight tracking-tight text-foreground [font-family:'Plus_Jakarta_Sans',Inter,sans-serif]";

function FormCard({
  id,
  title,
  description,
  icon,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_rgba(15,23,42,0.04)]"
    >
      <div className="border-b border-slate-200 px-7 pb-6 pt-7">
        <div className="flex items-start gap-4">
          {icon ? (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100 [&_svg]:text-sky-600">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h3 className="text-[20px] font-semibold leading-tight text-slate-950 [font-family:'Plus_Jakarta_Sans',Inter,sans-serif]">
              {title}
            </h3>
            {description ? <p className="mt-1.5 text-[15px] leading-6 text-slate-500">{description}</p> : null}
          </div>
        </div>
      </div>
      <div className="px-7 pt-6 pb-7">{children}</div>
    </section>
  );
}

function Field({
  label,
  helper,
  helperClassName = "",
  required,
  className = "",
  children,
}: {
  label: string;
  helper?: string;
  helperClassName?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center gap-1.5 text-[15px] font-semibold tracking-[0.01em] text-slate-800">
        <span>{label}</span>
        {required ? <span className="text-rose-600">*</span> : null}
      </div>
      <div className="mt-2">{children}</div>
      {helper ? <p className={`mt-2 text-sm leading-5 text-slate-500 ${helperClassName}`}>{helper}</p> : null}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function createDefaultDraft(): BidPackageDraft {
  const defaultRfiDeadlineDate = addDays(new Date(), 7).toISOString().slice(0, 10);

  return {
    project_name: "",
    package_number: "",
    status: "bidding",
    architect: "",
    bid_set_date: "",
    owner: "",
    client_phone: "",
    client_email: "",
    location: "",
    project_address: "",
    project_city: "",
    project_state: "",
    project_zip: "",
    budget: "",
    due_date: "",
    due_hour: "04",
    due_minute: "00",
    due_period: "pm",
    due_time_enabled: true,
    tbd_due_date: false,
    primary_bidding_contact: "Project Manager",
    bidding_cc_group: "",
    bidding_instructions: "",
    rfi_deadline_enabled: true,
    rfi_deadline_date: defaultRfiDeadlineDate,
    rfi_deadline_hour: "12",
    rfi_deadline_minute: "00",
    rfi_deadline_period: "am",
    rfi_deadline_time_enabled: false,
    site_walkthrough_enabled: false,
    site_walkthrough_date: "",
    site_walkthrough_hour: "12",
    site_walkthrough_minute: "00",
    site_walkthrough_period: "am",
    site_walkthrough_time_enabled: false,
    project_size_sqft: "",
    project_site_size_sqft: "",
    construction_start_date: "",
    construction_completion_date: "",
    closeout_completion_date: "",
    construction_duration_weeks: "",
    project_duration_weeks: "",
    tax_city_number: "",
    tax_city_name: "",
    tax_rate: "",
    tax_exempt: false,
    anticipated_award_date: "",
    countdown_emails: false,
    accept_submissions_past_due: false,
    enable_blind_bidding: false,
    disable_electronic_submission: false,
    include_bid_documents: true,
    bid_submission_confirmation_message: "",
  };
}

function buildTradeLabel(trade: { code: string; description: string | null }): string {
  return `${trade.code}${trade.description ? ` ${trade.description}` : ""}`.trim();
}

function mapSettingsCostCodeOptions(settingsRows: ReturnType<typeof getWorkspaceCostCodes>) {
  const merged: CostCodeOption[] = [];
  const seenCodes = new Set<string>();

  for (const row of settingsRows) {
    if (!row.usedIn.prelimEstimate) continue;
    const normalizedCode = row.code.trim().toLowerCase();
    if (!normalizedCode || seenCodes.has(normalizedCode)) continue;
    seenCodes.add(normalizedCode);
    merged.push({
      id: `settings-cost-code-${row.id}`,
      code: row.code.trim(),
      description: row.description.trim() || null,
    });
  }

  return merged.sort((left, right) =>
    left.code.localeCompare(right.code, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

function buildInviteRecipientsPayload(
  assignedSubsByTradeId: Record<string, AssignedSub[]>,
  selectedTrades: SelectedTrade[]
) {
  const tradeLabelById = new Map(selectedTrades.map((trade) => [trade.id, buildTradeLabel(trade)]));
  const recipients = new Map<
    string,
    {
      contactName: string;
      companyName: string;
      email: string;
      tradeNames: Set<string>;
    }
  >();

  for (const [tradeId, assignedSubs] of Object.entries(assignedSubsByTradeId)) {
    const tradeName = tradeLabelById.get(tradeId);
    if (!tradeName) continue;

    for (const sub of assignedSubs) {
      const email = (sub.bidInviteEmail || sub.email || "").trim().toLowerCase();
      const companyName = sub.company.trim();
      if (!email || !companyName) continue;

      const recipientKey = `${companyName.toLowerCase()}::${email}`;
      const existing = recipients.get(recipientKey);
      if (!existing) {
        recipients.set(recipientKey, {
          contactName: companyName,
          companyName,
          email,
          tradeNames: new Set([tradeName]),
        });
        continue;
      }

      existing.tradeNames.add(tradeName);
    }
  }

  return Array.from(recipients.values()).map((recipient) => ({
    contactName: recipient.contactName,
    companyName: recipient.companyName,
    email: recipient.email,
    tradeNames: Array.from(recipient.tradeNames),
  }));
}

function formatProjectLocation(parts: {
  project_address: string;
  project_city: string;
  project_state: string;
  project_zip: string;
}): string {
  const address = parts.project_address.trim();
  const city = parts.project_city.trim();
  const state = parts.project_state.trim();
  const zip = parts.project_zip.trim();
  const locality = [city, state].filter(Boolean).join(", ");
  const trailing = [locality, zip].filter(Boolean).join(" ");
  return [address, trailing].filter(Boolean).join(", ");
}

function parseProjectLocation(value: string): Pick<
  BidPackageDraft,
  "project_address" | "project_city" | "project_state" | "project_zip"
> {
  const raw = value.trim();
  if (!raw) {
    return {
      project_address: "",
      project_city: "",
      project_state: "",
      project_zip: "",
    };
  }

  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const address = parts.slice(0, -2).join(", ");
    const city = parts[parts.length - 2] ?? "";
    const stateZip = parts[parts.length - 1] ?? "";
    const stateZipMatch = stateZip.match(/^([A-Za-z]{2})(?:\s+(.+))?$/);
    return {
      project_address: address,
      project_city: city,
      project_state: stateZipMatch?.[1] ?? stateZip,
      project_zip: stateZipMatch?.[2] ?? "",
    };
  }

  if (parts.length === 2) {
    const stateZipMatch = parts[1].match(/^(.*?)(?:,\s*)?([A-Za-z]{2})(?:\s+(.+))?$/);
    if (stateZipMatch) {
      return {
        project_address: parts[0],
        project_city: stateZipMatch[1].trim(),
        project_state: stateZipMatch[2] ?? "",
        project_zip: stateZipMatch[3] ?? "",
      };
    }
  }

  return {
    project_address: raw,
    project_city: "",
    project_state: "",
    project_zip: "",
  };
}

function normalizeContactName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function readBidPackageFilesMap(): Record<string, UploadedBidFile[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(BID_PACKAGE_FILES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const next: Record<string, UploadedBidFile[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue;
      next[key] = value.flatMap((item) => {
        const normalized = normalizeUploadedBidFile(item);
        return normalized ? [normalized] : [];
      });
    }
    return next;
  } catch {
    return {};
  }
}

function writeBidPackageFiles(projectId: string, files: UploadedBidFile[]) {
  if (typeof window === "undefined") return;
  const current = readBidPackageFilesMap();
  current[projectId] = files;
  localStorage.setItem(BID_PACKAGE_FILES_STORAGE_KEY, JSON.stringify(current));
}

function readBidPackageFoldersMap(): Record<string, CustomFileFolder[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(BID_PACKAGE_FOLDERS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const next: Record<string, CustomFileFolder[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue;
      next[key] = value.flatMap((item) => {
        const normalized = normalizeCustomFileFolder(item);
        return normalized ? [normalized] : [];
      });
    }
    return next;
  } catch {
    return {};
  }
}

function writeBidPackageFolders(projectId: string, folders: CustomFileFolder[]) {
  if (typeof window === "undefined") return;
  const current = readBidPackageFoldersMap();
  current[projectId] = folders;
  localStorage.setItem(BID_PACKAGE_FOLDERS_STORAGE_KEY, JSON.stringify(current));
}

function readBidPackageDocumentSetsMap(): Record<string, DocumentSetId[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(BID_PACKAGE_DOCUMENT_SETS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const next: Record<string, DocumentSetId[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      next[key] = mergeDocumentSetIds(
        Array.isArray(value) ? value.map((item) => normalizeDocumentSetId(item)) : undefined
      );
    }
    return next;
  } catch {
    return {};
  }
}

function writeBidPackageDocumentSets(projectId: string, documentSetIds: DocumentSetId[]) {
  if (typeof window === "undefined") return;
  const current = readBidPackageDocumentSetsMap();
  current[projectId] = mergeDocumentSetIds(documentSetIds);
  localStorage.setItem(BID_PACKAGE_DOCUMENT_SETS_STORAGE_KEY, JSON.stringify(current));
}

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
  taxExempt: boolean;
};

const MANUAL_TAX_CITY_VALUE = "__manual";

function getBidPackageAutosaveStorageKey(projectId?: string | null): string {
  return projectId ? `${BID_PACKAGE_AUTOSAVE_STORAGE_KEY}:${projectId}` : BID_PACKAGE_AUTOSAVE_STORAGE_KEY;
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
        taxExempt: typeof row.taxExempt === "boolean" ? row.taxExempt : false,
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

function writeBidProjectGeneralInfo(projectId: string, draft: BidPackageDraft) {
  const current = readBidProjectGeneralInfoMap();
  current[projectId] = {
    projectName: (draft.project_name ?? "").trim(),
    projectNumber: (draft.package_number ?? "").trim(),
    clientName: (draft.owner ?? "").trim(),
    projectAddress: (draft.project_address ?? "").trim(),
    projectCity: (draft.project_city ?? "").trim(),
    projectState: (draft.project_state ?? "").trim(),
    projectZip: (draft.project_zip ?? "").trim(),
    architect: (draft.architect ?? "").trim(),
    bidSetDate: (draft.bid_set_date ?? "").trim(),
    clientPhone: (draft.client_phone ?? "").trim(),
    clientEmail: (draft.client_email ?? "").trim(),
    primaryBiddingContact: (draft.primary_bidding_contact ?? "").trim(),
    projectSizeSqft: (draft.project_size_sqft ?? "").trim(),
    projectSiteSizeSqft: (draft.project_site_size_sqft ?? "").trim(),
    constructionStartDate: (draft.construction_start_date ?? "").trim(),
    constructionCompletionDate: (draft.construction_completion_date ?? "").trim(),
    constructionDurationWeeks: (draft.construction_duration_weeks ?? "").trim(),
    projectDurationWeeks: (draft.project_duration_weeks ?? "").trim(),
    taxCityNumber: (draft.tax_city_number ?? "").trim(),
    taxCityName: (draft.tax_city_name ?? "").trim(),
    taxRate: (draft.tax_rate ?? "").trim(),
    taxExempt: Boolean(draft.tax_exempt),
  };
  writeBidProjectGeneralInfoMap(current);
}

function getCachedNextBidProjectPackageNumber(referenceDate = new Date()): string | null {
  const yearPrefix = String(referenceDate.getFullYear() % 100).padStart(2, "0");
  let maxSequence = 0;

  for (const row of Object.values(readBidProjectGeneralInfoMap())) {
    const value = row.projectNumber?.trim() ?? "";
    if (!new RegExp(`^${yearPrefix}\\d{3}$`).test(value)) continue;
    const sequence = Number.parseInt(value.slice(2), 10);
    if (Number.isFinite(sequence)) {
      maxSequence = Math.max(maxSequence, sequence);
    }
  }

  if (maxSequence === 0) return null;
  return `${yearPrefix}${String(maxSequence + 1).padStart(3, "0")}`;
}

function getHigherPackageNumber(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Number.parseInt(b, 10) > Number.parseInt(a, 10) ? b : a;
}

async function getNextAvailableBidProjectPackageNumber(): Promise<string | null> {
  const databaseNext = await getNextBidProjectPackageNumber();
  const cachedNext = getCachedNextBidProjectPackageNumber();
  return getHigherPackageNumber(databaseNext, cachedNext);
}

function isBidProjectPackageNumberUsedInCache(packageNumber: string): boolean {
  const value = packageNumber.trim();
  if (!value) return false;
  return Object.values(readBidProjectGeneralInfoMap()).some(
    (row) => row.projectNumber?.trim() === value
  );
}

export default function NewBidPackagePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editingProjectId = searchParams.get("project");
  const isEditMode = Boolean(editingProjectId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingExistingProject, setLoadingExistingProject] = useState(false);
  const [activePanel, setActivePanel] = useState<"general" | "files" | "trade-coverage" | "invite-subs" | "bid-email">("general");
  const [activeFileSection, setActiveFileSection] = useState<FileSectionKey>("plans");
  const [selectedUploadSection, setSelectedUploadSection] = useState<FileSectionKey>("plans");
  const [selectedUploadFolderId, setSelectedUploadFolderId] = useState<string>("__root__");
  const [expandedFileGroups, setExpandedFileGroups] = useState({
    plans: true,
    specs: true,
    addenda: true,
    reports: false,
  });
  const [costCodes, setCostCodes] = useState<CostCodeOption[]>([]);
  const [loadingCostCodes, setLoadingCostCodes] = useState(false);
  const [costCodeLoadError, setCostCodeLoadError] = useState<string | null>(null);
  const [costCodeQuery, setCostCodeQuery] = useState("");
  const [selectedTrades, setSelectedTrades] = useState<SelectedTrade[]>([]);
  const [subOptions, setSubOptions] = useState<SubOption[]>([]);
  const [loadingSubOptions, setLoadingSubOptions] = useState(false);
  const [companyUserOptions, setCompanyUserOptions] = useState<CompanyUserOption[]>([]);
  const [assignedSubsByTradeId, setAssignedSubsByTradeId] = useState<Record<string, AssignedSub[]>>({});
  const [inviteQueryByTradeId, setInviteQueryByTradeId] = useState<Record<string, string>>({});
  const [expandedInviteTradeId, setExpandedInviteTradeId] = useState<string | null>(null);
  const [newSubDrawerTradeId, setNewSubDrawerTradeId] = useState<string | null>(null);
  const [newSubDraft, setNewSubDraft] = useState({
    company_name: "",
    primary_contact: "",
    email: "",
    phone: "",
  });
  const [newSubTrades, setNewSubTrades] = useState<NewSubTradeSelection[]>([]);
  const [newSubTradeQuery, setNewSubTradeQuery] = useState("");
  const [newSubSaving, setNewSubSaving] = useState(false);
  const [newSubError, setNewSubError] = useState<string | null>(null);
  const [invitationEmailDraft, setInvitationEmailDraft] = useState<InvitationEmailDraft>({
    subject: DEFAULT_INVITATION_SUBJECT,
    message: DEFAULT_INVITATION_MESSAGE,
    requireAcknowledgement: false,
  });
  const [bidPackageAutosaveHydrated, setBidPackageAutosaveHydrated] = useState(false);
  const [invitationDraftHydrated, setInvitationDraftHydrated] = useState(false);
  const [invitationSaving, setInvitationSaving] = useState(false);
  const [invitationSavedAt, setInvitationSavedAt] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [tokenValuesOpen, setTokenValuesOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testSendEmail, setTestSendEmail] = useState("");
  const [testSendLoading, setTestSendLoading] = useState(false);
  const [newFolderDialog, setNewFolderDialog] = useState<NewFolderDialogState | null>(null);
  const [renameFileDialog, setRenameFileDialog] = useState<RenameFileDialogState | null>(null);
  const [renameFileSaving, setRenameFileSaving] = useState(false);
  const [deleteFileDialog, setDeleteFileDialog] = useState<DeleteFileDialogState | null>(null);
  const [deleteFileSaving, setDeleteFileSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [mailboxConnection, setMailboxConnection] = useState<MailboxConnectionSummary | null>(null);
  const [loadingMailboxConnection, setLoadingMailboxConnection] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [documentSetIds, setDocumentSetIds] = useState<DocumentSetId[]>([DEFAULT_DOCUMENT_SET_ID]);
  const [customFolders, setCustomFolders] = useState<CustomFileFolder[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedBidFile[]>([]);
  const [draft, setDraft] = useState<BidPackageDraft>(createDefaultDraft());
  const [prebidTimezone, setPrebidTimezone] = useState<(typeof PREBID_TIMEZONE_OPTIONS)[number]>("MST");
  const [projectTaxCityOptions, setProjectTaxCityOptions] = useState<WorkspaceTaxRate[]>([]);
  const [projectTaxCityOpen, setProjectTaxCityOpen] = useState(false);
  const constructionScheduleSyncSourceRef = useRef<
    "dates" | "construction-duration" | "project-duration" | null
  >(null);
  const messageEditorRef = useRef<EmailRichTextEditorHandle | null>(null);
  const autosaveStorageKey = useMemo(
    () => getBidPackageAutosaveStorageKey(editingProjectId),
    [editingProjectId]
  );
  const filesInActiveSection = useMemo(
    () =>
      uploadedFiles.filter((file) =>
        activeFileSection === "reports"
          ? FILE_SECTION_META[file.section].groupKey === "reports"
          : file.section === activeFileSection
      ),
    [activeFileSection, uploadedFiles]
  );
  const filesBySection = useMemo(
    () => ({
      plans: uploadedFiles.filter((file) => file.section === "plans"),
      specs: uploadedFiles.filter((file) => file.section === "specs"),
      addenda: uploadedFiles.filter((file) => file.section === "addenda"),
      reports: uploadedFiles.filter((file) => FILE_SECTION_META[file.section].groupKey === "reports"),
    }),
    [uploadedFiles]
  );
  const selectedUploadFolder = useMemo(
    () => customFolders.find((folder) => folder.id === selectedUploadFolderId) ?? null,
    [customFolders, selectedUploadFolderId]
  );
  const selectedUploadTargetValue =
    selectedUploadFolderId === "__root__"
      ? `section:${selectedUploadSection}`
      : `folder:${selectedUploadFolderId}`;
  const projectFileGroups = useMemo(() => {
    const builtInGroups = [
      {
        key: "plans",
        label: "Plans",
        section: "plans" as const,
        files: uploadedFiles.filter((file) => file.section === "plans" && !file.folderId),
      },
      {
        key: "specs",
        label: "Specs",
        section: "specs" as const,
        files: uploadedFiles.filter((file) => file.section === "specs" && !file.folderId),
      },
      {
        key: "addenda",
        label: "Addenda",
        section: "addenda" as const,
        files: uploadedFiles.filter((file) => file.section === "addenda" && !file.folderId),
      },
      {
        key: "reports",
        label: "Reports",
        section: "reports" as const,
        files: uploadedFiles.filter(
          (file) => FILE_SECTION_META[file.section].groupKey === "reports" && !file.folderId
        ),
      },
    ];

    const customFolderGroups = customFolders.map((folder) => ({
      key: folder.id,
      label: folder.name,
      section: FILE_SECTION_META[folder.section].groupKey as "plans" | "specs" | "addenda" | "reports",
      files: uploadedFiles.filter((file) => file.folderId === folder.id),
    }));

    return [...builtInGroups, ...customFolderGroups].map((group) => ({
      ...group,
      count: group.files.length,
    }));
  }, [customFolders, uploadedFiles]);
  const latestUploadedFile = useMemo(
    () =>
      uploadedFiles.length
        ? [...uploadedFiles].sort(
            (left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime()
          )[0]
        : null,
    [uploadedFiles]
  );
  const earliestUploadedFile = useMemo(
    () =>
      uploadedFiles.length
        ? [...uploadedFiles].sort(
            (left, right) => new Date(left.uploadedAt).getTime() - new Date(right.uploadedAt).getTime()
          )[0]
        : null,
    [uploadedFiles]
  );
  const totalUploadedBytes = useMemo(
    () => uploadedFiles.reduce((sum, file) => sum + file.size, 0),
    [uploadedFiles]
  );
  const selectedPrimaryBiddingUser = useMemo(() => {
    if (!companyUserOptions.length) return null;
    const normalizedCurrent = normalizeContactName(draft.primary_bidding_contact || "");
    return (
      companyUserOptions.find(
        (user) => normalizeContactName(user.name) === normalizedCurrent
      ) ?? null
    );
  }, [companyUserOptions, draft.primary_bidding_contact]);
  const biddingCcUserOptions = useMemo(
    () =>
      companyUserOptions.map((user) => ({
        ...user,
        disabled: Boolean(selectedPrimaryBiddingUser?.id && user.id === selectedPrimaryBiddingUser.id),
      })),
    [companyUserOptions, selectedPrimaryBiddingUser?.id]
  );
  const hasSelectableCcUser = useMemo(
    () => biddingCcUserOptions.some((user) => !user.disabled),
    [biddingCcUserOptions]
  );
  const primaryBiddingContactDisplay = useMemo(() => {
    if (!companyUserOptions.length) return draft.primary_bidding_contact;
    const normalizedCurrent = normalizeContactName(draft.primary_bidding_contact || "");
    const matchingUser = companyUserOptions.find(
      (user) => normalizeContactName(user.name) === normalizedCurrent
    );
    return matchingUser?.name ?? draft.primary_bidding_contact;
  }, [companyUserOptions, draft.primary_bidding_contact]);
  const primaryBiddingContactEmail = useMemo(() => {
    if (!companyUserOptions.length) return "test@builderos.com";
    const normalizedCurrent = normalizeContactName(draft.primary_bidding_contact || "");
    const matchingUser = companyUserOptions.find(
      (user) => normalizeContactName(user.name) === normalizedCurrent
    );
    return matchingUser?.email || "test@builderos.com";
  }, [companyUserOptions, draft.primary_bidding_contact]);
  const secondaryBiddingContact = useMemo(
    () => companyUserOptions.find((user) => user.id === draft.bidding_cc_group) ?? null,
    [companyUserOptions, draft.bidding_cc_group]
  );
  const activeSenderEmail = mailboxConnection?.email || primaryBiddingContactEmail;

  useEffect(() => {
    setProjectTaxCityOptions(getWorkspaceTaxRates());
  }, []);

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setActiveFileSection(FILE_SECTION_META[selectedUploadSection].groupKey);
    const next = Array.from(files);
    if (next.length > 25) {
      setFileError("Upload up to 25 files at a time.");
      return;
    }
    setFileError(null);
    const now = new Date().toISOString();
    const mapped = await Promise.all(
      next.map(
        (file) =>
          new Promise<UploadedBidFile>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result !== "string") {
                reject(new Error("Unable to read file."));
                return;
              }
              resolve({
                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                name: file.name,
                size: file.size,
                uploadedAt: now,
                section: selectedUploadSection,
                documentSetId: DEFAULT_DOCUMENT_SET_ID,
                folderId: selectedUploadFolderId === "__root__" ? null : selectedUploadFolderId,
                url: reader.result,
              });
            };
            reader.onerror = () => reject(new Error("Unable to read file."));
            reader.readAsDataURL(file);
          })
      )
    ).catch(() => {
      setFileError("Unable to upload one or more files.");
      return null;
    });
    if (!mapped) return;
    setUploadedFiles((prev) => [...mapped, ...prev]);
  };

  useEffect(() => {
    let active = true;
    async function loadCostCodes() {
      setLoadingCostCodes(true);
      setCostCodeLoadError(null);
      const settingsCostCodes = getWorkspaceCostCodes();
      const settingsCostCodeOptions = mapSettingsCostCodeOptions(settingsCostCodes);
      if (settingsCostCodeOptions.length) {
        setCostCodes(settingsCostCodeOptions);
        setLoadingCostCodes(false);
        return;
      }
      try {
        const response = await fetch("/api/cost-codes", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as { costCodes?: unknown; error?: string } | null;
        if (!active) return;
        if (!response.ok) {
          setCostCodeLoadError(payload?.error ?? "Unable to load cost codes.");
          setCostCodes([]);
          return;
        }
        const rows = Array.isArray(payload?.costCodes) ? payload.costCodes : [];
        const mapped = rows
          .map((row) => {
            if (!row || typeof row !== "object") return null;
            const raw = row as { id?: unknown; code?: unknown; description?: unknown };
            if (typeof raw.id !== "string" || typeof raw.code !== "string") return null;
            return {
              id: raw.id,
              code: raw.code,
              description: typeof raw.description === "string" ? raw.description : null,
            } satisfies CostCodeOption;
          })
          .filter((row): row is CostCodeOption => Boolean(row));
        setCostCodes(mapped);
      } catch {
        if (!active) return;
        setCostCodeLoadError("Unable to load cost codes.");
        setCostCodes([]);
      } finally {
        if (active) setLoadingCostCodes(false);
      }
    }
    loadCostCodes();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadCompanyUsers() {
      try {
        const response = await fetch("/api/settings/team-users", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | { users?: CompanyUserOption[]; error?: string }
          | null;
        if (!active || !response.ok) {
          if (active) setCompanyUserOptions([]);
          return;
        }
        const users = Array.isArray(payload?.users) ? payload.users : [];
        const activeUsers = users.filter((user) => user.status === "Active");
        setCompanyUserOptions(activeUsers);
        if (activeUsers.length) {
          setDraft((prev) => {
            const normalizedCurrent = normalizeContactName(prev.primary_bidding_contact || "");
            const matchingUser = activeUsers.find(
              (user) => normalizeContactName(user.name) === normalizedCurrent
            );
            const isLegacyValue =
              prev.primary_bidding_contact === "Project Manager" ||
              prev.primary_bidding_contact === "Estimator" ||
              prev.primary_bidding_contact === "Precon Manager";
            if (matchingUser && matchingUser.name !== prev.primary_bidding_contact) {
              return { ...prev, primary_bidding_contact: matchingUser.name };
            }
            if (!prev.primary_bidding_contact || isLegacyValue || !matchingUser) {
              return { ...prev, primary_bidding_contact: activeUsers[0].name };
            }
            return prev;
          });
        }
      } catch {
        if (!active) return;
        setCompanyUserOptions([]);
      }
    }
    void loadCompanyUsers();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadMailboxConnection() {
      setLoadingMailboxConnection(true);
      try {
        const response = await fetch("/api/settings/email-sending/connection", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { connection?: MailboxConnectionSummary | null }
          | null;
        if (!active) return;
        if (!response.ok) {
          setMailboxConnection(null);
          return;
        }
        setMailboxConnection(payload?.connection ?? null);
      } catch {
        if (!active) return;
        setMailboxConnection(null);
      } finally {
        if (active) {
          setLoadingMailboxConnection(false);
        }
      }
    }

    void loadMailboxConnection();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadSubOptions() {
      setLoadingSubOptions(true);
      try {
        const response = await fetch("/api/directory/overview", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | { companies?: Array<{ id?: string; name?: string; email?: string | null }>; error?: string }
          | null;
        if (!active) return;
        if (!response.ok) {
          setSubOptions([]);
          setLoadingSubOptions(false);
          return;
        }
        const mapped = Array.isArray(payload?.companies)
          ? payload.companies.flatMap((company): SubOption[] => {
              if (!company?.id || !company?.name) return [];
              return [
                { id: company.id, company: company.name, email: company.email ?? null },
              ];
            })
          : [];
        setSubOptions(mapped);
      } catch {
        if (!active) return;
        setSubOptions([]);
      } finally {
        if (active) setLoadingSubOptions(false);
      }
    }
    loadSubOptions();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!editingProjectId) return;
    const projectId: string = editingProjectId;
    let active = true;
    async function loadExistingProject() {
      setLoadingExistingProject(true);
      const detail = await getBidProjectDetail(projectId);
      if (!active) return;
      if (!detail) {
        setError("Unable to load bid package for editing.");
        setLoadingExistingProject(false);
        return;
      }
      const cachedGeneralInfo = readBidProjectGeneralInfoMap()[projectId];
      let autosaveDraft: Partial<BidPackageDraft> | null = null;
      let autosaveSelectedTrades: SelectedTrade[] | null = null;
      let autosaveAssignedSubsByTradeId: Record<string, AssignedSub[]> | null = null;
      let autosaveInviteQueryByTradeId: Record<string, string> | null = null;
      let autosaveActivePanel:
        | "general"
        | "files"
        | "trade-coverage"
        | "invite-subs"
        | "bid-email"
        | null = null;
      let autosaveActiveFileSection: FileSectionKey | null = null;
      let autosaveCostCodeQuery: string | null = null;
      let autosaveDocumentSetIds: DocumentSetId[] | null = null;
      let autosaveCustomFolders: CustomFileFolder[] | null = null;
      try {
        const raw = localStorage.getItem(getBidPackageAutosaveStorageKey(projectId));
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<BidPackageAutosavePayload>;
          autosaveDraft = parsed.draft && typeof parsed.draft === "object" ? parsed.draft : null;
          autosaveSelectedTrades = Array.isArray(parsed.selectedTrades) ? parsed.selectedTrades : null;
          autosaveAssignedSubsByTradeId =
            parsed.assignedSubsByTradeId && typeof parsed.assignedSubsByTradeId === "object"
              ? parsed.assignedSubsByTradeId
              : null;
          autosaveInviteQueryByTradeId =
            parsed.inviteQueryByTradeId && typeof parsed.inviteQueryByTradeId === "object"
              ? parsed.inviteQueryByTradeId
              : null;
          autosaveActivePanel = parsed.activePanel ?? null;
          autosaveActiveFileSection = parsed.activeFileSection
            ? normalizeFileSectionKey(parsed.activeFileSection)
            : null;
          autosaveCostCodeQuery =
            typeof parsed.costCodeQuery === "string" ? parsed.costCodeQuery : null;
          autosaveDocumentSetIds = Array.isArray(parsed.documentSetIds)
            ? parsed.documentSetIds.map((item) => normalizeDocumentSetId(item))
            : null;
          autosaveCustomFolders = Array.isArray(parsed.customFolders)
            ? parsed.customFolders.flatMap((item) => {
                const normalized = normalizeCustomFileFolder(item);
                return normalized ? [normalized] : [];
              })
            : null;
        }
      } catch {
        // Ignore malformed autosave payloads.
      }
      setDraft((prev) => {
        const parsedLocation = parseProjectLocation(detail.project.location ?? "");
        return {
          ...prev,
          project_name: detail.project.project_name ?? "",
          package_number:
            cachedGeneralInfo?.projectNumber ?? detail.project.package_number ?? prev.package_number,
          status: prev.status,
          architect: cachedGeneralInfo?.architect ?? "",
          bid_set_date: cachedGeneralInfo?.bidSetDate ?? "",
          owner: detail.project.owner ?? "",
          client_phone: cachedGeneralInfo?.clientPhone ?? "",
          client_email: cachedGeneralInfo?.clientEmail ?? "",
          location: detail.project.location ?? "",
          project_address: cachedGeneralInfo?.projectAddress ?? parsedLocation.project_address,
          project_city: cachedGeneralInfo?.projectCity ?? parsedLocation.project_city,
          project_state: cachedGeneralInfo?.projectState ?? parsedLocation.project_state,
          project_zip: cachedGeneralInfo?.projectZip ?? parsedLocation.project_zip,
          project_size_sqft: cachedGeneralInfo?.projectSizeSqft ?? "",
          project_site_size_sqft: cachedGeneralInfo?.projectSiteSizeSqft ?? "",
          construction_start_date: cachedGeneralInfo?.constructionStartDate ?? "",
          construction_completion_date: cachedGeneralInfo?.constructionCompletionDate ?? "",
          construction_duration_weeks: cachedGeneralInfo?.constructionDurationWeeks ?? "",
          project_duration_weeks: cachedGeneralInfo?.projectDurationWeeks ?? "",
          tax_city_number: cachedGeneralInfo?.taxCityNumber ?? "",
          tax_city_name: cachedGeneralInfo?.taxCityName ?? "",
          tax_rate: cachedGeneralInfo?.taxRate ?? "",
          tax_exempt: cachedGeneralInfo?.taxExempt ?? false,
          budget:
            detail.project.budget !== null && detail.project.budget !== undefined
              ? String(detail.project.budget)
              : "",
          due_date: detail.project.due_date ?? "",
          tbd_due_date: !detail.project.due_date,
          ...(autosaveDraft ?? {}),
        };
      });
      setSelectedTrades(
        autosaveSelectedTrades ??
          detail.trades.map((trade) => ({
          id: trade.id,
          code: trade.trade_name ?? "",
          description: null,
        }))
      );
      const projectSubById = new Map(
        detail.projectSubs.map((projectSub) => [projectSub.id, projectSub])
      );
      const assignedByTrade: Record<string, AssignedSub[]> = {};
      detail.tradeBids.forEach((bid) => {
        const projectSub = projectSubById.get(bid.project_sub_id);
        const subcontractor = projectSub?.subcontractor;
        if (!projectSub || !subcontractor) return;
        const current = assignedByTrade[bid.trade_id] ?? [];
        if (current.some((item) => item.id === subcontractor.id)) return;
        current.push({
          id: subcontractor.id,
          company: subcontractor.company_name,
          email: subcontractor.email ?? null,
          invited: bid.status !== "ghosted",
          willBid: bid.status === "bidding" || bid.status === "submitted",
          bidInviteEmail: subcontractor.email ?? "",
        });
        assignedByTrade[bid.trade_id] = current;
      });
      setAssignedSubsByTradeId(autosaveAssignedSubsByTradeId ?? assignedByTrade);
      if (detail.project.bid_email_subject || detail.project.bid_email_body_html) {
        setInvitationEmailDraft((prev) => ({
          subject: detail.project.bid_email_subject ?? prev.subject,
          message: detail.project.bid_email_body_html
            ? normalizeInvitationMessage(detail.project.bid_email_body_html)
            : prev.message,
          requireAcknowledgement: prev.requireAcknowledgement,
        }));
      }
      const storedFiles = readBidPackageFilesMap()[projectId] ?? [];
      setCustomFolders(autosaveCustomFolders ?? readBidPackageFoldersMap()[projectId] ?? []);
      setUploadedFiles(storedFiles);
      setDocumentSetIds(
        mergeDocumentSetIds(
          autosaveDocumentSetIds ?? readBidPackageDocumentSetsMap()[projectId],
          storedFiles
        )
      );
      if (autosaveInviteQueryByTradeId) {
        setInviteQueryByTradeId(autosaveInviteQueryByTradeId);
      }
      if (autosaveActivePanel) {
        setActivePanel(autosaveActivePanel);
      }
      if (autosaveActiveFileSection) {
        setActiveFileSection(autosaveActiveFileSection);
        setSelectedUploadSection(autosaveActiveFileSection);
      }
      if (autosaveCostCodeQuery !== null) {
        setCostCodeQuery(autosaveCostCodeQuery);
      }
      setLoadingExistingProject(false);
      setBidPackageAutosaveHydrated(true);
    }
    loadExistingProject();
    return () => {
      active = false;
    };
  }, [editingProjectId]);

  useEffect(() => {
    if (!bidPackageAutosaveHydrated || !companyUserOptions.length) return;
    setDraft((prev) => {
      const normalizedCurrent = normalizeContactName(prev.primary_bidding_contact || "");
      const matchingUser = companyUserOptions.find(
        (user) => normalizeContactName(user.name) === normalizedCurrent
      );
      const isLegacyValue =
        prev.primary_bidding_contact === "Project Manager" ||
        prev.primary_bidding_contact === "Estimator" ||
        prev.primary_bidding_contact === "Precon Manager";
      if (matchingUser && matchingUser.name !== prev.primary_bidding_contact) {
        return { ...prev, primary_bidding_contact: matchingUser.name };
      }
      if (!prev.primary_bidding_contact || isLegacyValue || !matchingUser) {
        return { ...prev, primary_bidding_contact: companyUserOptions[0].name };
      }
      return prev;
    });
  }, [bidPackageAutosaveHydrated, companyUserOptions]);

  useEffect(() => {
    if (!companyUserOptions.length) return;
    setDraft((prev) => {
      const current = prev.bidding_cc_group?.trim() || "";
      if (!current) return prev;
      const byId = companyUserOptions.find((user) => user.id === current);
      const mappedUser =
        byId ??
        companyUserOptions.find(
          (user) =>
            user.email.toLowerCase() === current.toLowerCase() ||
            normalizeContactName(user.name) === normalizeContactName(current)
        ) ??
        null;
      const nextId = mappedUser?.id ?? "";
      if (selectedPrimaryBiddingUser?.id && nextId === selectedPrimaryBiddingUser.id) {
        return { ...prev, bidding_cc_group: "" };
      }
      if (nextId !== current) {
        return { ...prev, bidding_cc_group: nextId };
      }
      return prev;
    });
  }, [companyUserOptions, selectedPrimaryBiddingUser?.id]);

  useEffect(() => {
    if (constructionScheduleSyncSourceRef.current === "construction-duration") {
      const nextConstructionDuration = sanitizeWholeNumberInput(
        draft.construction_duration_weeks ?? ""
      ).trim();
      const durationWeeks = Number.parseInt(nextConstructionDuration, 10);
      const nextCompletionDate =
        draft.construction_start_date && Number.isFinite(durationWeeks) && durationWeeks >= 0
          ? addDaysToIsoDate(draft.construction_start_date, durationWeeks * 7) ?? ""
          : "";
      const nextCloseoutDate = addDaysToIsoDate(nextCompletionDate, 7) ?? "";
      const nextProjectDuration = nextCloseoutDate
        ? calculateDurationWeeks(draft.construction_start_date, nextCloseoutDate)
        : null;

      setDraft((prev) => {
        const nextProjectDurationValue =
          nextProjectDuration === null ? "" : String(nextProjectDuration);
        if (
          prev.construction_duration_weeks === nextConstructionDuration &&
          prev.construction_completion_date === nextCompletionDate &&
          prev.closeout_completion_date === nextCloseoutDate &&
          prev.project_duration_weeks === nextProjectDurationValue
        ) {
          return prev;
        }
        return {
          ...prev,
          construction_duration_weeks: nextConstructionDuration,
          construction_completion_date: nextCompletionDate,
          closeout_completion_date: nextCloseoutDate,
          project_duration_weeks: nextProjectDurationValue,
        };
      });
      return;
    }

    if (constructionScheduleSyncSourceRef.current === "project-duration") {
      const nextProjectDuration = sanitizeWholeNumberInput(
        draft.project_duration_weeks ?? ""
      ).trim();
      const projectDurationWeeks = Number.parseInt(nextProjectDuration, 10);
      const nextCloseoutDate =
        draft.construction_start_date && Number.isFinite(projectDurationWeeks) && projectDurationWeeks >= 0
          ? addDaysToIsoDate(draft.construction_start_date, projectDurationWeeks * 7) ?? ""
          : "";
      const nextCompletionDate = addDaysToIsoDate(nextCloseoutDate, -7) ?? "";
      const nextConstructionDuration = calculateDurationWeeks(
        draft.construction_start_date,
        nextCompletionDate
      );

      setDraft((prev) => {
        const nextConstructionDurationValue =
          nextConstructionDuration === null ? "" : String(nextConstructionDuration);
        if (
          prev.project_duration_weeks === nextProjectDuration &&
          prev.construction_completion_date === nextCompletionDate &&
          prev.closeout_completion_date === nextCloseoutDate &&
          prev.construction_duration_weeks === nextConstructionDurationValue
        ) {
          return prev;
        }
        return {
          ...prev,
          project_duration_weeks: nextProjectDuration,
          construction_completion_date: nextCompletionDate,
          closeout_completion_date: nextCloseoutDate,
          construction_duration_weeks: nextConstructionDurationValue,
        };
      });
      return;
    }

    const nextCloseoutDate = addDaysToIsoDate(draft.construction_completion_date, 7) ?? "";
    const constructionWeeks = calculateDurationWeeks(
      draft.construction_start_date,
      draft.construction_completion_date
    );
    const projectWeeks = nextCloseoutDate
      ? calculateDurationWeeks(draft.construction_start_date, nextCloseoutDate)
      : null;

    setDraft((prev) => {
      const nextConstructionDuration = constructionWeeks === null ? "" : String(constructionWeeks);
      const nextProjectDuration = projectWeeks === null ? "" : String(projectWeeks);
      if (
        prev.closeout_completion_date === nextCloseoutDate &&
        prev.construction_duration_weeks === nextConstructionDuration &&
        prev.project_duration_weeks === nextProjectDuration
      ) {
        return prev;
      }
      return {
        ...prev,
        closeout_completion_date: nextCloseoutDate,
        construction_duration_weeks: nextConstructionDuration,
        project_duration_weeks: nextProjectDuration,
      };
    });
  }, [
    draft.construction_completion_date,
    draft.construction_duration_weeks,
    draft.project_duration_weeks,
    draft.construction_start_date,
  ]);

  const handleConstructionStartDateChange = (next: string) => {
    const hasProjectDurationValue =
      sanitizeWholeNumberInput(draft.project_duration_weeks ?? "").trim().length > 0;
    const hasConstructionDurationValue =
      sanitizeWholeNumberInput(draft.construction_duration_weeks ?? "").trim().length > 0;
    constructionScheduleSyncSourceRef.current =
      constructionScheduleSyncSourceRef.current === "project-duration" ||
      (!draft.construction_completion_date && hasProjectDurationValue)
        ? "project-duration"
        : constructionScheduleSyncSourceRef.current === "construction-duration" ||
            (!draft.construction_completion_date && hasConstructionDurationValue)
          ? "construction-duration"
          : "dates";
    setDraft((prev) => ({ ...prev, construction_start_date: next }));
  };

  const handleConstructionCompletionDateChange = (next: string) => {
    constructionScheduleSyncSourceRef.current = "dates";
    setDraft((prev) => ({ ...prev, construction_completion_date: next }));
  };

  const handleConstructionDurationChange = (value: string) => {
    constructionScheduleSyncSourceRef.current = "construction-duration";
    setDraft((prev) => ({
      ...prev,
      construction_duration_weeks: sanitizeWholeNumberInput(value),
    }));
  };

  const handleProjectDurationChange = (value: string) => {
    constructionScheduleSyncSourceRef.current = "project-duration";
    setDraft((prev) => ({
      ...prev,
      project_duration_weeks: sanitizeWholeNumberInput(value),
    }));
  };

  useEffect(() => {
    if (editingProjectId) return;

    try {
      const raw = localStorage.getItem(getBidPackageAutosaveStorageKey(null));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<BidPackageAutosavePayload>;
        if (parsed.draft) {
          const { package_number: _stalePackageNumber, ...autosavedDraft } = parsed.draft;
          setDraft((prev) => ({ ...prev, ...autosavedDraft }));
        }
        setActivePanel("general");
        if (parsed.activeFileSection) {
          const normalizedSection = normalizeFileSectionKey(parsed.activeFileSection);
          setActiveFileSection(normalizedSection);
          setSelectedUploadSection(normalizedSection);
        }
        if (typeof parsed.costCodeQuery === "string") {
          setCostCodeQuery(parsed.costCodeQuery);
        }
        if (Array.isArray(parsed.selectedTrades)) {
          setSelectedTrades(parsed.selectedTrades);
        }
        if (parsed.assignedSubsByTradeId && typeof parsed.assignedSubsByTradeId === "object") {
          setAssignedSubsByTradeId(parsed.assignedSubsByTradeId);
        }
        if (parsed.inviteQueryByTradeId && typeof parsed.inviteQueryByTradeId === "object") {
          setInviteQueryByTradeId(parsed.inviteQueryByTradeId);
        }
        const autosavedFiles = Array.isArray(parsed.uploadedFiles)
          ? parsed.uploadedFiles.flatMap((item) => {
              const normalized = normalizeUploadedBidFile(item);
              return normalized ? [normalized] : [];
            })
          : [];
        if (Array.isArray(parsed.customFolders)) {
          setCustomFolders(
            parsed.customFolders.flatMap((item) => {
              const normalized = normalizeCustomFileFolder(item);
              return normalized ? [normalized] : [];
            })
          );
        }
        if (Array.isArray(parsed.documentSetIds)) {
          setDocumentSetIds(mergeDocumentSetIds(parsed.documentSetIds, autosavedFiles));
        } else {
          setDocumentSetIds(mergeDocumentSetIds(undefined, autosavedFiles));
        }
        if (Array.isArray(parsed.uploadedFiles)) {
          setUploadedFiles(autosavedFiles);
        }
      }
    } catch {
      // Ignore malformed autosave payloads.
    } finally {
      setBidPackageAutosaveHydrated(true);
    }
  }, [editingProjectId]);

  useEffect(() => {
    if (isEditMode || !bidPackageAutosaveHydrated) return;

    let active = true;
    async function loadNextPackageNumber() {
      const nextPackageNumber = await getNextAvailableBidProjectPackageNumber();
      if (!active || !nextPackageNumber) return;
      setDraft((prev) => {
        if ((prev.package_number ?? "").trim()) return prev;
        return { ...prev, package_number: nextPackageNumber };
      });
    }

    void loadNextPackageNumber();
    return () => {
      active = false;
    };
  }, [bidPackageAutosaveHydrated, isEditMode]);

  useEffect(() => {
    if (!bidPackageAutosaveHydrated) return;
    const timer = window.setTimeout(() => {
      const payload: BidPackageAutosavePayload = {
        draft,
        activePanel,
        activeFileSection,
        costCodeQuery,
        selectedTrades,
        assignedSubsByTradeId,
        inviteQueryByTradeId,
        documentSetIds,
        customFolders,
        uploadedFiles,
      };
      try {
        localStorage.setItem(autosaveStorageKey, JSON.stringify(payload));
      } catch {
        // Ignore storage quota/private mode issues.
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    activeFileSection,
    activePanel,
    assignedSubsByTradeId,
    autosaveStorageKey,
    bidPackageAutosaveHydrated,
    costCodeQuery,
    customFolders,
    documentSetIds,
    draft,
    inviteQueryByTradeId,
    selectedTrades,
    uploadedFiles,
  ]);

  const filteredCostCodes = useMemo(() => {
    const assigned = new Set(selectedTrades.map((trade) => trade.id));
    const query = costCodeQuery.trim().toLowerCase();
    return costCodes.filter((code) => {
      if (assigned.has(code.id)) return false;
      if (!query) return true;
      return `${code.code} ${code.description ?? ""}`.toLowerCase().includes(query);
    });
  }, [costCodeQuery, costCodes, selectedTrades]);

  const sortedProjectTaxCityOptions = useMemo(
    () =>
      [...projectTaxCityOptions].sort((left, right) => {
        const stateCompare = left.state.localeCompare(right.state, undefined, {
          numeric: true,
          sensitivity: "base",
        });
        if (stateCompare !== 0) return stateCompare;
        return left.city.localeCompare(right.city, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }),
    [projectTaxCityOptions]
  );

  const projectTaxCityOptionsByState = useMemo(
    () =>
      sortedProjectTaxCityOptions.reduce<Array<{ state: string; cities: WorkspaceTaxRate[] }>>(
        (groups, option) => {
          const state = option.state.trim().toUpperCase();
          const currentGroup = groups[groups.length - 1];
          if (currentGroup?.state === state) {
            currentGroup.cities.push(option);
            return groups;
          }

          groups.push({ state, cities: [option] });
          return groups;
        },
        []
      ),
    [sortedProjectTaxCityOptions]
  );

  const selectedProjectTaxCity =
    projectTaxCityOptions.find((option) => option.id === draft.tax_city_number) ?? null;
  const isManualTaxRate = draft.tax_city_number === MANUAL_TAX_CITY_VALUE;
  const combinedProjectTaxRate = isManualTaxRate
    ? draft.tax_rate ?? ""
    : selectedProjectTaxCity?.rate ?? "";
  const selectedProjectTaxState = selectedProjectTaxCity?.state ?? "AZ";
  const displayedProjectTaxRate = formatCombinedAndActualTaxRateDisplay(
    combinedProjectTaxRate,
    selectedProjectTaxState
  );

  const selectProjectTaxCity = (value: string) => {
    setDraft((prev) => ({
      ...prev,
      tax_city_number: value === "__none" ? "" : value,
      tax_city_name:
        value === MANUAL_TAX_CITY_VALUE
          ? prev.tax_city_name ?? ""
          : projectTaxCityOptions.find((option) => option.id === value)?.city ?? "",
      tax_rate:
        value === MANUAL_TAX_CITY_VALUE
          ? prev.tax_rate
          : projectTaxCityOptions.find((option) => option.id === value)?.rate ?? "",
    }));
    setProjectTaxCityOpen(false);
  };

  const addTradeFromCostCode = (costCode: CostCodeOption) => {
    setSelectedTrades((prev) => {
      if (prev.some((trade) => trade.id === costCode.id)) return prev;
      return [...prev, { id: costCode.id, code: costCode.code, description: costCode.description }];
    });
  };

  const removeTrade = (tradeId: string) => {
    setSelectedTrades((prev) => prev.filter((trade) => trade.id !== tradeId));
    setAssignedSubsByTradeId((prev) => {
      const next = { ...prev };
      delete next[tradeId];
      return next;
    });
  };

  const addSubToTrade = (tradeId: string, sub: SubOption) => {
    setAssignedSubsByTradeId((prev) => {
      const current = prev[tradeId] ?? [];
      if (current.some((item) => item.id === sub.id)) return prev;
      return {
        ...prev,
        [tradeId]: [...current, { ...sub, invited: false, willBid: false, bidInviteEmail: sub.email ?? "" }],
      };
    });
  };

  const removeSubFromTrade = (tradeId: string, subId: string) => {
    setAssignedSubsByTradeId((prev) => ({
      ...prev,
      [tradeId]: (prev[tradeId] ?? []).filter((item) => item.id !== subId),
    }));
  };

  const setSubInviteEmail = (tradeId: string, subId: string, value: string) => {
    setAssignedSubsByTradeId((prev) => ({
      ...prev,
      [tradeId]: (prev[tradeId] ?? []).map((item) =>
        item.id === subId
          ? {
              ...item,
              bidInviteEmail: value,
            }
          : item
      ),
    }));
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(INVITATION_EMAIL_DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<InvitationEmailDraft>;
        const parsedSubject =
          typeof parsed.subject === "string" ? parsed.subject : DEFAULT_INVITATION_SUBJECT;
        const parsedMessage =
          typeof parsed.message === "string" ? parsed.message : DEFAULT_INVITATION_MESSAGE;
        const normalizedParsedMessage = removeBidPortalLine(parsedMessage);
        const shouldUseDefaultMessage =
          parsedMessage === LEGACY_INVITATION_MESSAGE ||
          normalizedParsedMessage === PREVIOUS_DEFAULT_INVITATION_MESSAGE;
        setInvitationEmailDraft({
          subject:
            parsedSubject === LEGACY_INVITATION_SUBJECT ? DEFAULT_INVITATION_SUBJECT : parsedSubject,
          message: shouldUseDefaultMessage
            ? DEFAULT_INVITATION_MESSAGE
            : normalizeInvitationMessage(normalizedParsedMessage),
          requireAcknowledgement: Boolean(parsed.requireAcknowledgement),
        });
      }
    } catch {
      setInvitationEmailDraft({
        subject: DEFAULT_INVITATION_SUBJECT,
        message: DEFAULT_INVITATION_MESSAGE,
        requireAcknowledgement: false,
      });
    } finally {
      setInvitationDraftHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!invitationDraftHydrated) return;
    setInvitationSaving(true);
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(INVITATION_EMAIL_DRAFT_STORAGE_KEY, JSON.stringify(invitationEmailDraft));
        const now = new Date().toISOString();
        setInvitationSavedAt(now);
      } finally {
        setInvitationSaving(false);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [invitationDraftHydrated, invitationEmailDraft]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (selectedUploadFolderId === "__root__") return;
    const folderStillExists = customFolders.some(
      (folder) => folder.id === selectedUploadFolderId && folder.section === selectedUploadSection
    );
    if (!folderStillExists) {
      setSelectedUploadFolderId("__root__");
    }
  }, [customFolders, selectedUploadFolderId, selectedUploadSection]);

  useEffect(() => {
    if (!renameFileDialog) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setRenameFileDialog(null);
        setRenameFileSaving(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [renameFileDialog]);

  useEffect(() => {
    if (!deleteFileDialog) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDeleteFileDialog(null);
        setDeleteFileSaving(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteFileDialog]);

  const updateUploadedFile = (
    fileId: string,
    updater: (current: UploadedBidFile) => UploadedBidFile
  ) => {
    setUploadedFiles((prev) =>
      prev.map((current) => (current.id === fileId ? updater(current) : current))
    );
  };

  const getFolderSectionValue = (file: UploadedBidFile): "plans" | "specs" | "addenda" | "reports" =>
    FILE_SECTION_META[file.section].groupKey;

  const handlePreviewUploadedFile = (file: UploadedBidFile) => {
    if (typeof window === "undefined") return;

    let targetUrl = file.url;
    if (file.url.startsWith("data:")) {
      const blob = dataUrlToBlob(file.url);
      if (blob) {
        targetUrl = URL.createObjectURL(blob);
        window.setTimeout(() => URL.revokeObjectURL(targetUrl), 60_000);
      }
    }

    const link = document.createElement("a");
    link.href = targetUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  };

  const handleRenameUploadedFile = (file: UploadedBidFile) => {
    setRenameFileDialog({
      fileId: file.id,
      originalName: file.name,
      draftName: file.name,
    });
  };

  const closeRenameFileDialog = () => {
    if (renameFileSaving) return;
    setRenameFileDialog(null);
  };

  const submitRenameFileDialog = async () => {
    if (!renameFileDialog) return;

    const nextName = renameFileDialog.draftName.trim();
    if (!nextName || nextName === renameFileDialog.originalName) return;

    setRenameFileSaving(true);
    try {
      updateUploadedFile(renameFileDialog.fileId, (current) => ({
        ...current,
        name: nextName,
      }));
      setRenameFileDialog(null);
      setToast({ type: "success", message: `${renameFileDialog.originalName} was renamed.` });
    } finally {
      setRenameFileSaving(false);
    }
  };

  const handleChangeUploadedFileTag = (file: UploadedBidFile, nextSection: FileSectionKey) => {
    if (file.section === nextSection) return;

    updateUploadedFile(file.id, (current) => ({
      ...current,
      section: nextSection,
    }));
    setToast({
      type: "success",
      message: `${file.name} is now tagged as ${FILE_SECTION_META[nextSection].label}.`,
    });
  };

  const handleMoveUploadedFile = (
    file: UploadedBidFile,
    nextFolder: "plans" | "specs" | "addenda" | "reports"
  ) => {
    const currentFolder = getFolderSectionValue(file);
    if (currentFolder === nextFolder) return;

    updateUploadedFile(file.id, (current) => ({
      ...current,
      section:
        nextFolder === "reports"
          ? current.section === "reports" ||
            current.section === "scope_sheets" ||
            current.section === "other"
            ? current.section
            : "reports"
          : nextFolder,
    }));
    setToast({
      type: "success",
      message: `${file.name} was moved to ${FILE_FOLDER_OPTIONS.find((option) => option.value === nextFolder)?.label}.`,
    });
  };

  const handleDeleteUploadedFile = (file: UploadedBidFile) => {
    setDeleteFileDialog({
      fileId: file.id,
      fileName: file.name,
    });
  };

  const closeDeleteFileDialog = () => {
    if (deleteFileSaving) return;
    setDeleteFileDialog(null);
  };

  const submitDeleteFileDialog = async () => {
    if (!deleteFileDialog) return;

    setDeleteFileSaving(true);
    try {
      setUploadedFiles((prev) =>
        prev.filter((current) => current.id !== deleteFileDialog.fileId)
      );
      setDeleteFileDialog(null);
      setToast({ type: "success", message: `${deleteFileDialog.fileName} was deleted.` });
    } finally {
      setDeleteFileSaving(false);
    }
  };

  const closeNewFolderDialog = () => setNewFolderDialog(null);

  const handleCreateFolder = () => {
    setNewFolderDialog({ draftName: "" });
  };

  const submitNewFolderDialog = () => {
    if (!newFolderDialog) return;
    const nextName = newFolderDialog.draftName.trim();
    if (!nextName) return;
    const duplicateExists = customFolders.some(
      (folder) =>
        folder.section === selectedUploadSection &&
        folder.name.trim().toLowerCase() === nextName.toLowerCase()
    );
    if (duplicateExists) {
      setToast({ type: "error", message: `${nextName} already exists in this section.` });
      return;
    }

    const nextFolder: CustomFileFolder = {
      id: `folder-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: nextName,
      section: selectedUploadSection,
    };

    setCustomFolders((prev) => [...prev, nextFolder]);
    setExpandedFileGroups((prev) => ({ ...prev, [nextFolder.id]: true }));
    setSelectedUploadFolderId(nextFolder.id);
    setActiveFileSection(FILE_SECTION_META[selectedUploadSection].groupKey as FileSectionKey);
    setNewFolderDialog(null);
    setToast({ type: "success", message: `${nextName} folder created.` });
  };

  const includedAttachments = useMemo(
    () => ({
      plans: uploadedFiles.filter((file) => file.section === "plans").length,
      addenda: uploadedFiles.filter((file) => file.section === "addenda").length,
      specs: uploadedFiles.filter((file) => file.section === "specs").length,
    }),
    [uploadedFiles]
  );

  const selectedSubsCount = useMemo(
    () =>
      Object.values(assignedSubsByTradeId).reduce((sum, subs) => {
        return sum + subs.length;
      }, 0),
    [assignedSubsByTradeId]
  );

  const uniqueInviteRecipients = useMemo(
    () => buildInviteRecipientsPayload(assignedSubsByTradeId, selectedTrades),
    [assignedSubsByTradeId, selectedTrades]
  );

  const mailboxBadge = useMemo(() => {
    if (loadingMailboxConnection) {
      return {
        label: "Loading",
        className: "bg-slate-200 text-slate-700",
      };
    }

    if (!mailboxConnection || mailboxConnection.status === "inactive") {
      return {
        label: "Not Connected",
        className: "bg-slate-200 text-slate-700",
      };
    }

    const expiresAt = mailboxConnection.tokenExpiresAt
      ? new Date(mailboxConnection.tokenExpiresAt).getTime()
      : 0;
    if (mailboxConnection.status === "error" || (!!expiresAt && expiresAt <= Date.now())) {
      return {
        label: "Expired",
        className: "bg-amber-100 text-amber-700",
      };
    }

    return {
      label: "Connected",
      className: "bg-emerald-100 text-emerald-700",
    };
  }, [loadingMailboxConnection, mailboxConnection]);

  const canSendInvites =
    mailboxBadge.label === "Connected" &&
    !submitting &&
    uniqueInviteRecipients.length > 0;

  const tokenValues = useMemo(() => {
    const dueLabel = formatBidDueDateLabel(draft);
    const prebidParts: string[] = [];
    if (draft.rfi_deadline_enabled && draft.rfi_deadline_date) {
      prebidParts.push(
        `RFI Deadline: ${formatOptionalDateTimeLabel(
          draft.rfi_deadline_date,
          draft.rfi_deadline_hour,
          draft.rfi_deadline_minute,
          draft.rfi_deadline_period,
          draft.rfi_deadline_time_enabled
        )}`
      );
    }
    if (draft.site_walkthrough_enabled && draft.site_walkthrough_date) {
      prebidParts.push(
        `Site Walkthrough: ${formatOptionalDateTimeLabel(
          draft.site_walkthrough_date,
          draft.site_walkthrough_hour,
          draft.site_walkthrough_minute,
          draft.site_walkthrough_period,
          draft.site_walkthrough_time_enabled
        )}`
      );
    }
    const portalLink = typeof window !== "undefined" ? `${window.location.origin}/bidding/all` : "/bidding/all";
    const projectAddress = formatProjectLocation({
      project_address: draft.project_address,
      project_city: draft.project_city,
      project_state: draft.project_state,
      project_zip: draft.project_zip,
    });
    const constructionStartDate = formatOptionalDateTimeLabel(
      draft.construction_start_date,
      "7",
      "00",
      "am",
      false
    );
    const secondaryContactName = secondaryBiddingContact?.name ?? "";
    const secondaryContactEmail = secondaryBiddingContact?.email ?? "";
    return {
      "{project_name}": draft.project_name.trim() || "Project Name",
      "{bid_package_name}": draft.project_name.trim() || "Bid Package Name",
      "{bid_due_date}": dueLabel,
      "{prebid_info}": prebidParts.length ? prebidParts.join(" | ") : "No pre-bid details available.",
      "{portal_link}": portalLink,
      "{contact_name}": draft.primary_bidding_contact || "Primary bidding contact",
      "{contact_email}": primaryBiddingContactEmail,
      "{project_addess}": projectAddress || "Project address",
      "{project_address}": projectAddress || "Project address",
      "{primary_bid_contact}": draft.primary_bidding_contact || "Primary bidding contact",
      "{secondary_bid_contact}": secondaryContactName || "Secondary bidding contact",
      "{primary bid contact email}": primaryBiddingContactEmail,
      "{secondary bid contact email}": secondaryContactEmail,
      "{construction start date}": constructionStartDate,
      "{construction_duration}": draft.construction_duration_weeks.trim() || "TBD",
      "{project_size}": draft.project_size_sqft.trim() || "TBD",
      "{project_site_size}": draft.project_site_size_sqft.trim() || "TBD",
      "{Primary bid contact signature}": draft.primary_bidding_contact || "Primary bidding contact",
    } as Record<(typeof TOKEN_LIST)[number], string>;
  }, [
    draft.construction_duration_weeks,
    draft.construction_start_date,
    draft.due_date,
    draft.due_hour,
    draft.due_minute,
    draft.due_period,
    draft.due_time_enabled,
    draft.primary_bidding_contact,
    draft.project_address,
    draft.project_city,
    draft.project_name,
    draft.project_size_sqft,
    draft.project_site_size_sqft,
    draft.project_state,
    draft.project_zip,
    draft.rfi_deadline_date,
    draft.rfi_deadline_enabled,
    draft.rfi_deadline_hour,
    draft.rfi_deadline_minute,
    draft.rfi_deadline_period,
    draft.rfi_deadline_time_enabled,
    draft.site_walkthrough_date,
    draft.site_walkthrough_enabled,
    draft.site_walkthrough_hour,
    draft.site_walkthrough_minute,
    draft.site_walkthrough_period,
    draft.site_walkthrough_time_enabled,
    primaryBiddingContactEmail,
    secondaryBiddingContact?.email,
    secondaryBiddingContact?.name,
  ]);

  const handleDueDateChange = (next: string) => {
    setDraft((prev) => ({
      ...prev,
      due_date: next,
      tbd_due_date: !next,
    }));
  };

  const renderIncludeTimeToggle = (enabled: boolean, onClick: () => void) => (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onClick}
      className="inline-flex items-center gap-3 text-sm font-semibold text-slate-500 transition"
    >
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? "bg-blue-600" : "bg-slate-200"
        }`}
      >
        <span
          className={`inline-block size-5 rounded-full bg-white shadow-sm transition ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
      Include time
    </button>
  );

  const renderTimeControls = ({
    hour,
    minute,
    period,
    onHourChange,
    onMinuteChange,
    onPeriodChange,
  }: {
    hour: string;
    minute: string;
    period: string;
    onHourChange: (value: string) => void;
    onMinuteChange: (value: string) => void;
    onPeriodChange: (value: string) => void;
  }) => (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-11 w-full items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 text-[15px] font-medium text-slate-900 hover:bg-slate-50"
            aria-label="Select time"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5 text-slate-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{hour}:{minute} {period.toUpperCase()}</span>
            <svg
              viewBox="0 0 24 24"
              className="ml-auto size-5 text-slate-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden rounded-md border border-slate-300 bg-slate-100 p-0 shadow-lg" align="start">
          <div className="grid grid-cols-[auto_auto_auto] divide-x divide-slate-300">
            <div className="max-h-[260px] overflow-y-auto px-[6px] py-1">
              {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((option) => (
                <button
                  key={`time-picker-hour-${option}`}
                  type="button"
                  onClick={() => onHourChange(option)}
                  className={`mb-1 flex h-9 items-center justify-center rounded-sm px-[6px] text-base font-semibold ${
                    hour === option
                      ? "border border-blue-300 bg-blue-200 text-slate-900"
                      : "text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="max-h-[260px] overflow-y-auto px-[6px] py-1">
              {Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0")).map((option) => (
                <button
                  key={`time-picker-minute-${option}`}
                  type="button"
                  onClick={() => onMinuteChange(option)}
                  className={`mb-1 flex h-9 items-center justify-center rounded-sm px-[6px] text-base font-semibold ${
                    minute === option
                      ? "border border-blue-300 bg-blue-200 text-slate-900"
                      : "text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="px-[6px] py-1">
              {(["pm", "am"] as const).map((option) => (
                <button
                  key={`time-picker-period-${option}`}
                  type="button"
                  onClick={() => onPeriodChange(option)}
                  className={`mb-1 flex h-9 items-center justify-center rounded-sm px-[6px] text-base font-semibold uppercase ${
                    period === option
                      ? "border border-blue-300 bg-blue-200 text-slate-900"
                      : "text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-11 w-full items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 text-[15px] font-medium text-slate-900 hover:bg-slate-50"
            aria-label="Timezone"
          >
            {prebidTimezone}
            <svg viewBox="0 0 20 20" className="size-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="m5 7 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto rounded-md border border-slate-300 bg-white p-1 shadow-lg" align="start">
          <div className="grid gap-1">
            {PREBID_TIMEZONE_OPTIONS.map((option) => (
              <button
                key={`prebid-timezone-${option}`}
                type="button"
                onClick={() => setPrebidTimezone(option)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-accent hover:text-accent-foreground ${
                  prebidTimezone === option ? "text-slate-900" : ""
                }`}
              >
                <span className="flex h-4 w-4 items-center justify-center">
                  {prebidTimezone === option ? <Check className="h-4 w-4" /> : null}
                </span>
                {option}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );

  const renderTokens = (input: string) =>
    TOKEN_LIST.reduce((text, token) => text.split(token).join(tokenValues[token]), input);

  const renderedSubject = renderTokens(invitationEmailDraft.subject);
  const projectSizeValue = draft.project_size_sqft.trim();
  const projectSiteSizeValue = draft.project_site_size_sqft.trim();
  const shouldOmitProjectSiteSize =
    Boolean(projectSizeValue) &&
    normalizeComparableSize(projectSizeValue) === normalizeComparableSize(projectSiteSizeValue);
  const invitationMessageHtml = sanitizeEmailHtml(
    removeBidPortalLine(invitationEmailDraft.message).replace(
      shouldOmitProjectSiteSize ? PROJECT_SITE_SIZE_LIST_ITEM : "",
      ""
    )
  );
  const renderedMessage = sanitizeEmailHtml(renderTokens(invitationMessageHtml));

  const saveInvitationDraftNow = async () => {
    try {
      localStorage.setItem(
        INVITATION_EMAIL_DRAFT_STORAGE_KEY,
        JSON.stringify({
          ...invitationEmailDraft,
          message: invitationMessageHtml,
        })
      );
      if (editingProjectId) {
        const savedToDatabase = await updateBidProjectEmailTemplate(editingProjectId, {
          bid_email_subject: invitationEmailDraft.subject,
          bid_email_body_html: invitationMessageHtml,
        });
        if (!savedToDatabase) {
          setToast({
            type: "error",
            message: "Draft saved locally. Apply the bid email Supabase migration to save it to the database.",
          });
          return;
        }
      }
      const now = new Date().toISOString();
      setInvitationSavedAt(now);
      setToast({
        type: "success",
        message: editingProjectId
          ? "Draft saved to this bid package."
          : "Draft saved locally. It will save to the bid package when you create it.",
      });
    } catch {
      setToast({ type: "error", message: "Unable to save draft." });
    }
  };
  const discardBidPackageDraft = () => {
    try {
      localStorage.removeItem(getBidPackageAutosaveStorageKey(editingProjectId));
      localStorage.removeItem(INVITATION_EMAIL_DRAFT_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
    router.push("/bidding/all");
  };
  const activeDrawerTrade = newSubDrawerTradeId
    ? selectedTrades.find((trade) => trade.id === newSubDrawerTradeId) ?? null
    : null;
  const filteredNewSubTradeOptions = useMemo(() => {
    const selectedIds = new Set(newSubTrades.map((trade) => trade.id));
    const query = newSubTradeQuery.trim().toLowerCase();
    return selectedTrades.filter((trade) => {
      if (selectedIds.has(trade.id)) return false;
      if (!query) return true;
      return `${trade.code} ${trade.description ?? ""}`.toLowerCase().includes(query);
    });
  }, [newSubTradeQuery, newSubTrades, selectedTrades]);

  useEffect(() => {
    if (!newSubDrawerTradeId) {
      setNewSubTradeQuery("");
      return;
    }
    setNewSubTradeQuery("");
    setNewSubTrades(
      activeDrawerTrade
        ? [{ id: activeDrawerTrade.id, code: activeDrawerTrade.code, description: activeDrawerTrade.description }]
        : []
    );
  }, [activeDrawerTrade, newSubDrawerTradeId]);
  const persistAssignedSubsForTrades = async (projectId: string): Promise<boolean> => {
    const allAssignedSubs = Object.values(assignedSubsByTradeId).flat();
    if (!allAssignedSubs.length) return true;

    const detail = await getBidProjectDetail(projectId);
    if (!detail) return false;

    const tradeIdByName = new Map(
      detail.trades.map((trade) => [trade.trade_name.trim().toLowerCase(), trade.id])
    );
    const existingBidPairs = new Set(
      detail.tradeBids.map((bid) => `${bid.trade_id}:${bid.project_sub_id}`)
    );

    const projectSubIdByBidSubId = new Map(
      detail.projectSubs.map((projectSub) => [projectSub.subcontractor_id, projectSub.id])
    );

    const bidSubcontractors = await listBidSubcontractors();
    const bidSubByCompany = new Map(
      bidSubcontractors.map((sub) => [sub.company_name.trim().toLowerCase(), sub])
    );
    let nextProjectSubSort =
      detail.projectSubs.reduce((max, sub) => Math.max(max, sub.sort_order ?? 0), 0) + 1;

    const projectSubIdByAssignedSubId = new Map<string, string>();
    const uniqueAssignedSubs = new Map<string, AssignedSub>();
    allAssignedSubs.forEach((sub) => {
      uniqueAssignedSubs.set(sub.id, sub);
    });

    for (const sub of uniqueAssignedSubs.values()) {
      const companyKey = sub.company.trim().toLowerCase();
      let bidSubId = bidSubByCompany.get(companyKey)?.id ?? null;
      if (!bidSubId) {
        const createdBidSub = await createBidSubcontractor({
          company_name: sub.company,
          email: sub.email ?? null,
        });
        if (!createdBidSub) return false;
        bidSubId = createdBidSub.id;
        bidSubByCompany.set(companyKey, {
          ...createdBidSub,
          email: sub.email ?? null,
          phone: null,
        });
      }

      let projectSubId = projectSubIdByBidSubId.get(bidSubId) ?? null;
      if (!projectSubId) {
        const invited = await inviteSubToProject({
          project_id: projectId,
          subcontractor_id: bidSubId,
          sort_order: nextProjectSubSort,
        });
        if (!invited) return false;
        projectSubId = invited.id;
        projectSubIdByBidSubId.set(bidSubId, projectSubId);
        nextProjectSubSort += 1;
      }

      projectSubIdByAssignedSubId.set(sub.id, projectSubId);
    }

    for (const trade of selectedTrades) {
      const tradeName = buildTradeLabel(trade).toLowerCase();
      const tradeId = tradeIdByName.get(tradeName);
      if (!tradeId) continue;

      const assignedForTrade = assignedSubsByTradeId[trade.id] ?? [];
      for (const sub of assignedForTrade) {
        const projectSubId = projectSubIdByAssignedSubId.get(sub.id);
        if (!projectSubId) continue;
        const pairKey = `${tradeId}:${projectSubId}`;
        if (existingBidPairs.has(pairKey)) continue;
        const createdBid = await createTradeBid({
          project_id: projectId,
          trade_id: tradeId,
          project_sub_id: projectSubId,
          status: sub.willBid ? "bidding" : "invited",
          contact_name: null,
          bid_amount: null,
          notes: null,
        });
        if (!createdBid) return false;
        existingBidPairs.add(pairKey);
      }
    }

    return true;
  };

  const stepMetaByPanel: Record<
    "general" | "files" | "trade-coverage" | "invite-subs" | "bid-email",
    { step: number; label: string }
  > = {
    general: { step: 1, label: "General Information" },
    files: { step: 2, label: "Files" },
    "trade-coverage": { step: 3, label: "Trade Coverage" },
    "invite-subs": { step: 4, label: "Invite Subs" },
    "bid-email": { step: 5, label: "Bid Email" },
  };
  const currentStepMeta = stepMetaByPanel[activePanel];
  const completedStepsCount = Math.max(currentStepMeta.step - 1, 0);

  return (
    <main className="bid-package-builder bg-slate-50 px-2 pb-8">
      <header className="border-b border-border bg-surface">
        <div className="flex flex-col gap-8 px-6 pb-6 pt-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="m-0 mb-4 flex items-center gap-3 text-sm leading-5 font-medium text-muted-foreground [font-family:Inter,ui-sans-serif,system-ui,-apple-system,'Segoe_UI',sans-serif]">
              <Link href="/projects" className="text-muted-foreground transition hover:text-foreground">
                Projects
              </Link>
              <svg
                viewBox="0 0 20 20"
                className="size-4 text-muted-foreground/50"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="m7 4 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-semibold text-foreground">{isEditMode ? "Edit Project" : "New Project"}</span>
            </div>
            <h1 className="m-0 p-0 text-3xl font-extrabold leading-9 tracking-[-0.025em] text-foreground [font-family:'Plus_Jakarta_Sans',Inter,sans-serif]">
              {isEditMode ? "Edit Project" : "Create Project"}
            </h1>
            <p className="m-0 mt-1.5 max-w-2xl text-sm leading-5 text-muted-foreground [font-family:Inter,ui-sans-serif,system-ui,-apple-system,'Segoe_UI',sans-serif]">
              Set up your project and prepare your first bid package. Subs won&apos;t be notified until you reach the Bid
              Email step.
            </p>
          </div>
          <div className="mb-5 shrink-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-muted px-4 py-2 text-sm font-semibold text-muted-foreground shadow-soft-sm">
              <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
              <span>
                Step {currentStepMeta.step} of 5 · {currentStepMeta.label}
              </span>
            </div>
          </div>
        </div>
      </header>

      {loadingExistingProject ? (
        <div className="mx-4 mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 sm:mx-6">
          Loading bid package details...
        </div>
      ) : null}

      <form
        className="bid-package-builder__form"
        onSubmit={async (event) => {
          event.preventDefault();
          const submitter = (event.nativeEvent as SubmitEvent).submitter as
            | HTMLButtonElement
            | HTMLInputElement
            | null;
          const submitIntent = submitter?.value === "send" ? "send" : "skip";
          if (submitIntent === "send" && mailboxBadge.label !== "Connected") {
            setError("Configure an active email sender before sending invites.");
            return;
          }
          if (loadingExistingProject) return;
          if (activePanel !== "bid-email") {
            if (activePanel === "general") {
              setActivePanel("files");
            } else if (activePanel === "files") {
              setActivePanel("trade-coverage");
            } else if (activePanel === "trade-coverage") {
              setActivePanel("invite-subs");
            } else if (activePanel === "invite-subs") {
              setActivePanel("bid-email");
            }
            return;
          }
          if (!draft.project_name.trim()) {
            setError("Project name is required.");
            return;
          }

          setSubmitting(true);
          setError(null);

          const budgetValue = draft.budget.trim() ? Number(draft.budget) : null;
          const locationValue = formatProjectLocation(draft);
          const tradePayload = selectedTrades.map((trade, index) => ({
            trade_name: buildTradeLabel(trade),
            sort_order: index + 1,
          }));
          let packageNumberForSubmit = draft.package_number.trim();

          if (editingProjectId) {
            const updated = await updateBidProject(editingProjectId, {
              project_name: draft.project_name.trim(),
              package_number: packageNumberForSubmit || null,
              owner: draft.owner.trim() || null,
              location: locationValue || null,
              budget: Number.isFinite(budgetValue) ? budgetValue : null,
              due_date: draft.tbd_due_date ? null : draft.due_date.trim() || null,
              bid_email_subject: invitationEmailDraft.subject,
              bid_email_body_html: invitationMessageHtml,
            });
            if (!updated) {
              setError("Unable to save bid package changes. Please try again.");
              setSubmitting(false);
              return;
            }

            const currentDetail = await getBidProjectDetail(editingProjectId);
            const currentTrades = currentDetail?.trades ?? [];
            const byTradeName = new Map(
              currentTrades.map((trade) => [trade.trade_name.trim().toLowerCase(), trade])
            );
            const existingTradePayload = tradePayload
              .map((trade) => {
                const existing = byTradeName.get(trade.trade_name.trim().toLowerCase());
                if (!existing) return null;
                return {
                  id: existing.id,
                  trade_name: trade.trade_name,
                  sort_order: trade.sort_order,
                };
              })
              .filter((trade): trade is { id: string; trade_name: string; sort_order: number } => Boolean(trade));
            const newTradePayload = tradePayload.filter(
              (trade) => !byTradeName.has(trade.trade_name.trim().toLowerCase())
            );

            const updatedTrades = await updateBidTrades(editingProjectId, existingTradePayload);
            const createdTrades = await createBidTrades(editingProjectId, newTradePayload);
            if (!updatedTrades || !createdTrades) {
              setError("Project details were saved, but trades could not be fully updated.");
              setSubmitting(false);
              return;
            }

            const syncedAssignedSubs = await persistAssignedSubsForTrades(editingProjectId);
            if (!syncedAssignedSubs) {
              setError("Project details were saved, but assigned subs could not be synced to trade rows.");
              setSubmitting(false);
              return;
            }

            if (submitIntent === "send") {
              const inviteResponse = await fetch("/api/bidding/bid-invites/send", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  bidPackageId: editingProjectId,
                  projectId: editingProjectId,
                  subjectTemplate: invitationEmailDraft.subject,
                  bodyTemplate: invitationMessageHtml,
                  templateContext: {
                    projectName: tokenValues["{project_name}"],
                    bidPackageName: tokenValues["{bid_package_name}"],
                    bidDueDate: tokenValues["{bid_due_date}"],
                    prebidInfo: tokenValues["{prebid_info}"],
                    contactName: tokenValues["{contact_name}"],
                    contactEmail: tokenValues["{contact_email}"],
                    projectAddress: tokenValues["{project_address}"],
                    primaryBidContact: tokenValues["{primary_bid_contact}"],
                    secondaryBidContact: tokenValues["{secondary_bid_contact}"],
                    primaryBidContactEmail: tokenValues["{primary bid contact email}"],
                    secondaryBidContactEmail: tokenValues["{secondary bid contact email}"],
                    constructionStartDate: tokenValues["{construction start date}"],
                    constructionDuration: tokenValues["{construction_duration}"],
                    projectSize: tokenValues["{project_size}"],
                    projectSiteSize: tokenValues["{project_site_size}"],
                    primaryBidContactSignature: tokenValues["{Primary bid contact signature}"],
                  },
                  recipients: uniqueInviteRecipients,
                }),
              });
              const invitePayload = (await inviteResponse.json().catch(() => null)) as
                | { error?: string; results?: Array<{ ok: boolean; error?: string }> }
                | null;
              if (!inviteResponse.ok) {
                setError(invitePayload?.error ?? "Bid package was saved, but invites could not be created.");
                setSubmitting(false);
                return;
              }
              const failedCount =
                invitePayload?.results?.filter((item) => !item.ok).length ?? 0;
              setToast({
                type: failedCount ? "error" : "success",
                message: failedCount
                  ? `Invite records created, but ${failedCount} email send(s) failed.`
                  : "Bid invites queued successfully.",
              });
            }
            writeBidProjectGeneralInfo(editingProjectId, draft);
            writeBidPackageFolders(editingProjectId, customFolders);
            writeBidPackageDocumentSets(editingProjectId, documentSetIds);
            writeBidPackageFiles(editingProjectId, uploadedFiles);
            localStorage.removeItem(getBidPackageAutosaveStorageKey(editingProjectId));

            router.push(`/bidding?project=${editingProjectId}`);
            router.refresh();
            return;
          }

          if (
            !packageNumberForSubmit ||
            isBidProjectPackageNumberUsedInCache(packageNumberForSubmit) ||
            !(await isBidProjectPackageNumberAvailable(packageNumberForSubmit))
          ) {
            const nextPackageNumber = await getNextAvailableBidProjectPackageNumber();
            if (!nextPackageNumber) {
              setError("Unable to generate the next project number. Please try again.");
              setSubmitting(false);
              return;
            }
            packageNumberForSubmit = nextPackageNumber;
            setDraft((prev) => ({ ...prev, package_number: nextPackageNumber }));
          }

          const created = await createBidProject({
            project_name: draft.project_name.trim(),
            package_number: packageNumberForSubmit,
            owner: draft.owner.trim() || null,
            location: locationValue || null,
            budget: Number.isFinite(budgetValue) ? budgetValue : null,
            due_date: draft.tbd_due_date ? null : draft.due_date.trim() || null,
            bid_email_subject: invitationEmailDraft.subject,
            bid_email_body_html: invitationMessageHtml,
          });

          if (!created) {
            setError("Unable to create bid package. Please try again.");
            setSubmitting(false);
            return;
          }

          const tradesCreated = await createBidTrades(created.id, tradePayload);
          if (!tradesCreated) {
            setError("Bid package was created, but selected trades could not be saved. Please add trades from Invites.");
            setSubmitting(false);
            return;
          }

          const syncedAssignedSubs = await persistAssignedSubsForTrades(created.id);
          if (!syncedAssignedSubs) {
            setError("Bid package was created, but assigned subs could not be synced to trade rows.");
            setSubmitting(false);
            return;
          }

          if (submitIntent === "send") {
            const inviteResponse = await fetch("/api/bidding/bid-invites/send", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                bidPackageId: created.id,
                projectId: created.id,
                subjectTemplate: invitationEmailDraft.subject,
                bodyTemplate: invitationMessageHtml,
                templateContext: {
                  projectName: tokenValues["{project_name}"],
                  bidPackageName: tokenValues["{bid_package_name}"],
                  bidDueDate: tokenValues["{bid_due_date}"],
                  prebidInfo: tokenValues["{prebid_info}"],
                  contactName: tokenValues["{contact_name}"],
                  contactEmail: tokenValues["{contact_email}"],
                  projectAddress: tokenValues["{project_address}"],
                  primaryBidContact: tokenValues["{primary_bid_contact}"],
                  secondaryBidContact: tokenValues["{secondary_bid_contact}"],
                  primaryBidContactEmail: tokenValues["{primary bid contact email}"],
                  secondaryBidContactEmail: tokenValues["{secondary bid contact email}"],
                  constructionStartDate: tokenValues["{construction start date}"],
                  constructionDuration: tokenValues["{construction_duration}"],
                  projectSize: tokenValues["{project_size}"],
                  projectSiteSize: tokenValues["{project_site_size}"],
                  primaryBidContactSignature: tokenValues["{Primary bid contact signature}"],
                },
                recipients: uniqueInviteRecipients,
              }),
            });
            const invitePayload = (await inviteResponse.json().catch(() => null)) as
              | { error?: string; results?: Array<{ ok: boolean; error?: string }> }
              | null;
            if (!inviteResponse.ok) {
              setError(invitePayload?.error ?? "Bid package was created, but invites could not be created.");
              setSubmitting(false);
              return;
            }
            const failedCount =
              invitePayload?.results?.filter((item) => !item.ok).length ?? 0;
            setToast({
              type: failedCount ? "error" : "success",
              message: failedCount
                ? `Invite records created, but ${failedCount} email send(s) failed.`
                : "Bid invites queued successfully.",
            });
          }
          writeBidProjectGeneralInfo(created.id, { ...draft, package_number: packageNumberForSubmit });
          writeBidPackageFolders(created.id, customFolders);
          writeBidPackageDocumentSets(created.id, documentSetIds);
          writeBidPackageFiles(created.id, uploadedFiles);

          setDraft(createDefaultDraft());
          localStorage.removeItem(getBidPackageAutosaveStorageKey(null));
          router.push(`/bidding?project=${created.id}`);
          router.refresh();
        }}
      >
        <main className="mx-0 max-w-none px-6 pt-10 pb-32">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 space-y-4">
        {activePanel === "general" ? (
          <>
        <section className="space-y-2">
          <h2 className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em] text-slate-950 [font-family:'Plus_Jakarta_Sans',Inter,sans-serif]">
            General Information
          </h2>
          <p className="text-[15px] leading-6 text-slate-500">
            Tell us about the project. This creates the project record — the next steps prepare your first bid package.
          </p>
        </section>
        <FormCard
          id="general-information"
          title="General Information"
          description="Basic details about the project this bid package belongs to."
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              className="h-5 w-5 text-primary"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
              <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
              <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
              <path d="M10 6h4" />
              <path d="M10 10h4" />
              <path d="M10 14h4" />
              <path d="M10 18h4" />
            </svg>
          }
        >
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <Field label="Project Name" required className="md:col-span-2">
              <input
                value={draft.project_name}
                onChange={(event) => setDraft((prev) => ({ ...prev, project_name: event.target.value }))}
                className={`w-full px-3 ${inputClass}`}
                placeholder="e.g. Riverside Medical Center — Phase II"
              />
            </Field>

            <Field label="Project Number" helper="Internal reference used across reports.">
              <input
                value={draft.package_number}
                onChange={(event) => setDraft((prev) => ({ ...prev, package_number: event.target.value }))}
                className={`w-full px-3 ${inputClass}`}
                placeholder="26001"
              />
            </Field>

            <Field
              label="Status"
              helper="Internal reference used across reports."
              helperClassName="invisible"
            >
              <Select value={draft.status} onValueChange={(value) => setDraft((prev) => ({ ...prev, status: value }))}>
                <SelectTrigger
                  size="field"
                  className={`${selectFieldClass} cursor-pointer`}
                  style={{ borderWidth: 1 }}
                >
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="start"
                  sideOffset={2}
                >
                  <SelectItem value="bidding">
                    Bidding
                  </SelectItem>
                  <SelectItem value="submitted">
                    Submitted
                  </SelectItem>
                  <SelectItem value="awarded">
                    Awarded
                  </SelectItem>
                  <SelectItem value="lost">
                    Lost
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Client Name" className="md:col-span-2">
              <input
                value={draft.owner}
                onChange={(event) => setDraft((prev) => ({ ...prev, owner: event.target.value }))}
                className={`w-full px-3 ${inputClass}`}
                placeholder="Northpoint Healthcare Group"
              />
            </Field>

            <Field label="Project Address" className="md:col-span-2">
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                    className="h-5 w-5"
                  >
                    <path d="M12 22s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11Z" />
                    <circle cx="12" cy="11" r="2.5" />
                  </svg>
                </span>
                <input
                  value={draft.project_address}
                  onChange={(event) => setDraft((prev) => ({ ...prev, project_address: event.target.value }))}
                  className={`w-full pl-11 pr-3 ${inputClass}`}
                  placeholder="1240 Harborview Drive"
                />
              </div>
            </Field>

            <Field label="City">
              <input
                value={draft.project_city}
                onChange={(event) => setDraft((prev) => ({ ...prev, project_city: event.target.value }))}
                className={`w-full px-3 ${inputClass}`}
                placeholder="Phoenix"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="State">
                <input
                  value={draft.project_state}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, project_state: event.target.value.toUpperCase() }))
                  }
                  className={`w-full px-3 ${inputClass}`}
                  placeholder="AZ"
                  maxLength={2}
                />
              </Field>
              <Field label="Zip">
                <input
                  value={draft.project_zip}
                  onChange={(event) => setDraft((prev) => ({ ...prev, project_zip: event.target.value }))}
                  className={`w-full px-3 ${inputClass}`}
                  placeholder="85004"
                />
              </Field>
            </div>

            <Field label="Architect" helper="The firm of record for drawings & specs.">
              <input
                value={draft.architect}
                onChange={(event) => setDraft((prev) => ({ ...prev, architect: event.target.value }))}
                className={`w-full px-3 ${inputClass}`}
                placeholder="Halden & Voss Architects"
              />
            </Field>

            <Field label="Bid Set Date" helper="Date the current drawing set was issued.">
              <DatePickerField
                value={draft.bid_set_date}
                onChange={(next) => setDraft((prev) => ({ ...prev, bid_set_date: next }))}
                className={`w-full ${inputClass} font-normal hover:bg-surface`}
                iconPosition="left"
                placeholder="Pick a date"
              />
            </Field>

            <Field label="Client Phone Number">
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                    className="h-5 w-5"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.62 2.61a2 2 0 0 1-.45 2.11L8 9.91a16 16 0 0 0 6.09 6.09l1.47-1.23a2 2 0 0 1 2.11-.45c.84.29 1.71.5 2.61.62A2 2 0 0 1 22 16.92z" />
                  </svg>
                </span>
                <input
                  value={draft.client_phone}
                  onChange={(event) => setDraft((prev) => ({ ...prev, client_phone: event.target.value }))}
                  className={`w-full pl-11 pr-3 ${inputClass}`}
                  placeholder="(206) 555-0142"
                />
              </div>
            </Field>

            <Field label="Client Email">
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                    className="h-5 w-5"
                  >
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                </span>
                <input
                  type="email"
                  value={draft.client_email}
                  onChange={(event) => setDraft((prev) => ({ ...prev, client_email: event.target.value }))}
                  className={`w-full pl-11 pr-3 ${inputClass}`}
                  placeholder="contracts@northpointhealth.com"
                />
              </div>
            </Field>
          </div>
        </FormCard>

        <FormCard
          title="Package Contacts"
          description="Who at BuildRight is responsible for this bid package."
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              className="h-5 w-5 text-primary"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
              <circle cx="9.5" cy="7" r="3.5" />
              <path d="M20 8v6" />
              <path d="M23 11h-6" />
            </svg>
          }
        >
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <Field
              label="Primary Bidding Contact"
              required
              helper={`Bid communications will be sent from ${activeSenderEmail}.`}
            >
              <Select
                value={draft.primary_bidding_contact}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, primary_bidding_contact: value }))}
              >
                <SelectTrigger size="field" className={selectFieldClass} style={{ borderWidth: 1 }}>
                  <SelectValue>{primaryBiddingContactDisplay}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {companyUserOptions.length ? (
                    companyUserOptions.map((user) => (
                      <SelectItem key={user.id} value={user.name}>
                        {user.name} • {user.role}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="Project Manager">Project Manager</SelectItem>
                      <SelectItem value="Estimator">Estimator</SelectItem>
                      <SelectItem value="Precon Manager">Precon Manager</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Additional Contacts"
              helper={
                !hasSelectableCcUser && companyUserOptions.length
                  ? "Add another active user to CC someone other than the primary contact."
                  : "Optional — they will be copied on bid communications."
              }
            >
              <Select
                value={draft.bidding_cc_group || "__none"}
                onValueChange={(value) =>
                  setDraft((prev) => ({ ...prev, bidding_cc_group: value === "__none" ? "" : value }))
                }
              >
                <SelectTrigger size="field" className={selectFieldClass} style={{ borderWidth: 1 }}>
                  <SelectValue placeholder="Select additional contact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No additional contact</SelectItem>
                  {biddingCcUserOptions.length ? (
                    biddingCcUserOptions.map((user) => (
                      <SelectItem
                        key={user.id}
                        value={user.id}
                        disabled={user.disabled}
                        className={user.disabled ? "text-slate-400" : ""}
                      >
                        {user.name} • {user.role}
                        {user.disabled ? " (Primary contact)" : ""}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__no_users" disabled className="text-slate-400">
                      No company users available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </FormCard>

        <FormCard
          title="Project Details"
          description="Project sizing, tax settings, and schedule dates used throughout bidding."
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              className="h-5 w-5 text-primary"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M8 3h8l5 5v4" />
              <path d="M8 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h5" />
              <path d="M16 3v5h5" />
              <path d="m8.5 10 1.5 1.5 2.5-2.5" />
              <path d="M13.5 10H16" />
              <path d="m8.5 14 1.5 1.5 2.5-2.5" />
              <path d="M13.5 14H16" />
              <path d="m8.5 18 1.5 1.5 2.5-2.5" />
              <path d="M13.5 18H14" />
              <circle cx="18" cy="18" r="2.5" />
              <path d="m18 13.5.7 1.6 1.7.4-1.2 1.3.3 1.7-1.5-.8-1.5.8.3-1.7-1.2-1.3 1.7-.4z" />
            </svg>
          }
        >
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <Field label="Project Size (SQ FT)">
              <input
                value={draft.project_size_sqft}
                onChange={(event) => setDraft((prev) => ({ ...prev, project_size_sqft: event.target.value }))}
                className={`w-full px-3 ${inputClass}`}
                placeholder="3249"
              />
            </Field>

            <Field label="Project Site Size (SQ FT)">
              <input
                value={draft.project_site_size_sqft}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, project_site_size_sqft: event.target.value }))
                }
                className={`w-full px-3 ${inputClass}`}
                placeholder="3249"
              />
            </Field>

            <Field label="City" helper="Used to determine project sales tax.">
              <div className="space-y-3">
                <Popover open={projectTaxCityOpen} onOpenChange={setProjectTaxCityOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between ${inputClass}`}
                      aria-label="Search or select city"
                    >
                      <span>
                        {isManualTaxRate
                          ? "Other"
                          : selectedProjectTaxCity
                            ? `${selectedProjectTaxCity.city} (${selectedProjectTaxCity.state})`
                            : "Select City"}
                      </span>
                      <svg viewBox="0 0 20 20" className="size-4 text-slate-500" aria-hidden>
                        <path fill="currentColor" d="m5.3 7.3 4.7 4.7 4.7-4.7 1.4 1.4-6.1 6.1-6.1-6.1z" />
                      </svg>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search city..." />
                      <CommandList>
                        <CommandEmpty>No city found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="Select City"
                            data-checked={!selectedProjectTaxCity && !isManualTaxRate ? "true" : undefined}
                            onSelect={() => selectProjectTaxCity("__none")}
                          >
                            Select City
                          </CommandItem>
                          <CommandItem
                            value="Other"
                            data-checked={isManualTaxRate ? "true" : undefined}
                            onSelect={() => selectProjectTaxCity(MANUAL_TAX_CITY_VALUE)}
                          >
                            Other
                          </CommandItem>
                        </CommandGroup>
                        {projectTaxCityOptionsByState.map((group) => (
                          <CommandGroup key={`project-tax-state-${group.state}`} heading={group.state}>
                            {group.cities.map((option) => (
                              <CommandItem
                                key={`project-tax-city-${option.id}`}
                                value={`${option.city} ${option.state}`}
                                data-checked={draft.tax_city_number === option.id ? "true" : undefined}
                                onSelect={() => selectProjectTaxCity(option.id)}
                              >
                                {option.city} ({option.state})
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {isManualTaxRate ? (
                  <>
                    <input
                      value={draft.tax_city_name ?? ""}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, tax_city_name: event.target.value }))
                      }
                      className={`w-full px-3 ${inputClass}`}
                      placeholder="Enter city"
                    />
                    <input
                      value={formatTaxRateDisplay(draft.tax_rate ?? "")}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, tax_rate: sanitizeTaxRateInput(event.target.value) }))
                      }
                      onBlur={() =>
                        setDraft((prev) => ({ ...prev, tax_rate: normalizeTaxRateValue(prev.tax_rate ?? "") }))
                      }
                      className={`w-full px-3 ${inputClass}`}
                      placeholder="Combined state/county/city rate"
                    />
                  </>
                ) : null}
              </div>
            </Field>

            <Field
              label="Tax Rate"
              helper="Arizona actual rates use the 65% construction taxable base. Other states use the full rate."
            >
              <div className="space-y-3">
                <input
                  readOnly
                  value={displayedProjectTaxRate || "-"}
                  className={`w-full px-3 ${inputClass} ${draft.tax_exempt ? "line-through text-slate-400" : "text-foreground"}`}
                />
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={draft.tax_exempt}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, tax_exempt: event.target.checked }))
                    }
                    className="size-4 rounded border-input text-primary focus:ring-primary/30"
                  />
                  <span>Tax exempt</span>
                </label>
              </div>
            </Field>

            <Field label="Construction Start Date">
              <DatePickerField
                value={draft.construction_start_date}
                onChange={handleConstructionStartDateChange}
                className={`w-full ${inputClass} font-normal hover:bg-surface`}
                iconPosition="left"
              />
            </Field>

            <Field label="Construction Completion Date">
              <DatePickerField
                value={draft.construction_completion_date}
                onChange={handleConstructionCompletionDateChange}
                className={`w-full ${inputClass} font-normal hover:bg-surface`}
                iconPosition="left"
              />
            </Field>

            <Field label="Construction Duration (Weeks)">
              <input
                value={draft.construction_duration_weeks}
                onChange={(event) => handleConstructionDurationChange(event.target.value)}
                className={`w-full px-3 ${inputClass}`}
                placeholder="13"
              />
            </Field>

            <Field label="Project Duration (Weeks / Includes Close-out)">
              <input
                value={draft.project_duration_weeks}
                onChange={(event) => handleProjectDurationChange(event.target.value)}
                className={`w-full px-3 ${inputClass}`}
                placeholder="14"
              />
            </Field>
          </div>
        </FormCard>

        <FormCard
          title="Prebid Information"
          description="Track the critical bid dates shared with invited subcontractors."
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              className="h-5 w-5 text-primary"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M16 3v4" />
              <path d="M8 3v4" />
              <path d="M3 11h18" />
            </svg>
          }
        >
          <div className="divide-y divide-slate-200">
            <div className="py-8">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-700">
                    Bid due date <span className="text-rose-600">*</span>
                    </div>
                  </div>
                  <div className="shrink-0">{renderIncludeTimeToggle(draft.due_time_enabled, () =>
                    setDraft((prev) => ({ ...prev, due_time_enabled: !prev.due_time_enabled }))
                  )}</div>
                </div>
                <div className="w-full">
                  <DatePickerField
                    value={draft.due_date}
                    onChange={handleDueDateChange}
                    className={`w-full ${inputClass} font-normal hover:bg-surface`}
                    placeholder="mm/dd/yyyy"
                    iconPosition="right"
                    presets={[
                      { label: "Today", daysFromToday: 0 },
                      { label: "Tomorrow", daysFromToday: 1 },
                      { label: "In a week", daysFromToday: 7 },
                      { label: "In 2 weeks", daysFromToday: 14 },
                    ]}
                  />
                </div>
                {draft.due_time_enabled
                  ? renderTimeControls({
                      hour: draft.due_hour,
                      minute: draft.due_minute,
                      period: draft.due_period,
                      onHourChange: (value) => setDraft((prev) => ({ ...prev, due_hour: value })),
                      onMinuteChange: (value) => setDraft((prev) => ({ ...prev, due_minute: value })),
                      onPeriodChange: (value) => setDraft((prev) => ({ ...prev, due_period: value })),
                    })
                  : null}
              </div>
            </div>

            <div className="py-8">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-700">RFI deadline</div>
                  </div>
                  <div className="shrink-0">
                    {renderIncludeTimeToggle(draft.rfi_deadline_time_enabled, () =>
                      setDraft((prev) => ({
                        ...prev,
                        rfi_deadline_time_enabled: !prev.rfi_deadline_time_enabled,
                      }))
                    )}
                  </div>
                </div>
                <div className="w-full">
                  <DatePickerField
                    value={draft.rfi_deadline_date}
                    onChange={(next) =>
                      setDraft((prev) => ({ ...prev, rfi_deadline_date: next, rfi_deadline_enabled: Boolean(next) }))
                    }
                    className={`w-full ${inputClass} font-normal hover:bg-surface`}
                    placeholder="mm/dd/yyyy"
                    iconPosition="right"
                  />
                </div>
                {draft.rfi_deadline_time_enabled
                  ? renderTimeControls({
                      hour: draft.rfi_deadline_hour,
                      minute: draft.rfi_deadline_minute,
                      period: draft.rfi_deadline_period,
                      onHourChange: (value) => setDraft((prev) => ({ ...prev, rfi_deadline_hour: value })),
                      onMinuteChange: (value) => setDraft((prev) => ({ ...prev, rfi_deadline_minute: value })),
                      onPeriodChange: (value) => setDraft((prev) => ({ ...prev, rfi_deadline_period: value })),
                    })
                  : null}
              </div>
            </div>

            <div className="py-8">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-700">Site walkthrough</div>
                  </div>
                  <div className="shrink-0">
                    {renderIncludeTimeToggle(draft.site_walkthrough_time_enabled, () =>
                      setDraft((prev) => ({
                        ...prev,
                        site_walkthrough_time_enabled: !prev.site_walkthrough_time_enabled,
                      }))
                    )}
                  </div>
                </div>
                <div className="w-full">
                  <DatePickerField
                    value={draft.site_walkthrough_date}
                    onChange={(next) =>
                      setDraft((prev) => ({ ...prev, site_walkthrough_date: next, site_walkthrough_enabled: Boolean(next) }))
                    }
                    className={`w-full ${inputClass} font-normal hover:bg-surface`}
                    placeholder="mm/dd/yyyy"
                    iconPosition="right"
                  />
                </div>
                {draft.site_walkthrough_time_enabled
                  ? renderTimeControls({
                      hour: draft.site_walkthrough_hour,
                      minute: draft.site_walkthrough_minute,
                      period: draft.site_walkthrough_period,
                      onHourChange: (value) => setDraft((prev) => ({ ...prev, site_walkthrough_hour: value })),
                      onMinuteChange: (value) => setDraft((prev) => ({ ...prev, site_walkthrough_minute: value })),
                      onPeriodChange: (value) => setDraft((prev) => ({ ...prev, site_walkthrough_period: value })),
                    })
                  : null}
              </div>
            </div>
          </div>
        </FormCard>

        {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-slate-50/85 sm:px-6 lg:px-12">
          <button
            type="button"
            onClick={discardBidPackageDraft}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => setActivePanel("files")}
            className="rounded-md bg-accent px-8 py-2 text-base font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue to Files
          </button>
        </div>
          </>
        ) : activePanel === "files" ? (
          <>
            <div className="space-y-6">
              <section>
                <h3 className="text-2xl font-semibold leading-none text-slate-950 [font-family:'Plus_Jakarta_Sans',Inter,sans-serif]">
                  Files
                </h3>
                <p className="mt-3 max-w-3xl text-[17px] leading-7 text-slate-500">
                  Upload the plans, specifications, and supporting documents subcontractors should receive with this bid package.
                </p>
              </section>

              <FormCard
                title="Upload Documents"
                description="Add the files that should go out with this package. These uploads appear in the package preview below."
                icon={<Upload className="size-5" strokeWidth={2.2} />}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.zip,.dwg,.dxf,image/*"
                  className="hidden"
                  onChange={(event) => {
                    handleUploadFiles(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />

                <div className="rounded-[28px] border-2 border-dashed border-slate-200 bg-slate-50/40 px-8 py-10">
                  <div className="flex flex-col items-center text-center">
                    <div className="mx-auto mb-6 flex w-full max-w-[460px] flex-col text-left">
                      <div className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        <span>File Section</span>
                        <span className="text-red-500">*</span>
                      </div>
                      <Select
                        value={selectedUploadTargetValue}
                        onValueChange={(value) => {
                          if (value.startsWith("folder:")) {
                            const folderId = value.replace("folder:", "");
                            const folder = customFolders.find((entry) => entry.id === folderId);
                            if (!folder) return;
                            setSelectedUploadSection(folder.section);
                            setSelectedUploadFolderId(folder.id);
                            return;
                          }

                          const nextSection = value.replace("section:", "") as FileSectionKey;
                          setSelectedUploadSection(nextSection);
                          setSelectedUploadFolderId("__root__");
                        }}
                      >
                        <SelectTrigger
                          size="field"
                          className="h-10 w-full rounded-2xl border border-border bg-surface px-5 text-lg font-medium text-foreground shadow-soft-sm"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="w-[var(--radix-select-trigger-width)] rounded-2xl border border-border bg-surface p-1 shadow-soft-md">
                          {FILE_UPLOAD_SECTION_OPTIONS.map((option) => (
                            <SelectItem
                              key={`section-${option.value}`}
                              value={`section:${option.value}`}
                              className="rounded-xl text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[state=checked]:bg-transparent data-[state=checked]:text-foreground data-[state=checked]:data-[highlighted]:bg-accent data-[state=checked]:data-[highlighted]:text-accent-foreground"
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                          {customFolders.length ? (
                            <div className="px-3 pt-3 pb-1 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                              Custom folders
                            </div>
                          ) : null}
                          {customFolders.map((folder) => (
                            <SelectItem
                              key={`folder-${folder.id}`}
                              value={`folder:${folder.id}`}
                              className="rounded-xl text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[state=checked]:bg-transparent data-[state=checked]:text-foreground data-[state=checked]:data-[highlighted]:bg-accent data-[state=checked]:data-[highlighted]:text-accent-foreground"
                            >
                              {folder.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-3 text-base text-muted-foreground">
                        Files will be saved under{" "}
                        <span className="font-mono text-[15px] text-slate-700">
                          projects/{(draft.project_name || "project")
                            .trim()
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-+|-+$/g, "") || "project"}
                          /{selectedUploadSection}/{selectedUploadFolder ? `${selectedUploadFolder.name.replace(/[^a-zA-Z0-9-_ ]+/g, "").trim() || selectedUploadFolder.name}/` : ""}
                        </span>
                      </p>
                    </div>
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <Upload className="h-4 w-4" strokeWidth={2.1} />
                    </span>
                    <h4 className="mt-6 text-[15px] font-semibold text-slate-950 [font-family:'Plus_Jakarta_Sans',Inter,sans-serif]">
                      Drag and drop files here, or click to upload
                    </h4>
                    <p className="mt-2 text-sm text-slate-500">
                      Accepts PDF, DWG, DOCX, XLSX · Max 100 MB per file
                    </p>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-6 text-base font-bold text-white shadow-sm hover:bg-blue-600/90"
                      >
                        <Upload className="size-4" />
                        Upload Files
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateFolder}
                        className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 text-base font-semibold text-slate-900 hover:bg-slate-100"
                      >
                        <FolderPlus className="size-4 text-slate-700" />
                        Create Folder
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      {["PDF", "DWG", "DOCX", "XLSX"].map((label) => (
                        <span
                          key={label}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-sm text-slate-500"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {fileError ? (
                  <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {fileError}
                  </p>
                ) : null}
              </FormCard>

              <section className="bg-surface px-7 pt-5">
                <div className="flex items-start gap-4 border-b border-border pb-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                    <FolderOpen className="size-5" strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0">
                    <h3 className={filesSectionHeadingClass}>
                      Project Files
                    </h3>
                    <p className="mt-2 max-w-3xl text-base text-muted-foreground">
                      Organize files into folders. Drag to reorder, tag for clarity, and rename anytime.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-[minmax(0,1.8fr)_140px_180px_160px_32px] gap-4 border-b border-border py-4 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  <div>Name</div>
                  <div>Type</div>
                  <div>Uploaded by</div>
                  <div>Date</div>
                  <div />
                </div>

                {projectFileGroups.map((group) => {
                  const isExpanded = expandedFileGroups[group.key];

                  return (
                    <div key={group.key} className="border-b border-border">
                      <button
                        type="button"
                        onClick={() => {
                          if (group.section) setActiveFileSection(group.section);
                          setExpandedFileGroups((prev) => ({
                            ...prev,
                            [group.key]: !prev[group.key],
                          }));
                        }}
                        className="flex w-full items-center gap-4 py-4 text-left"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-slate-500" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-slate-500" />
                        )}
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                          <FolderOpen className="h-5 w-5" />
                        </span>
                        <span className="text-xl font-bold text-foreground">{group.label}</span>
                        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-surface-muted px-2 text-sm font-semibold text-muted-foreground">
                          {group.count}
                        </span>
                      </button>

                      {isExpanded && group.files.length ? (
                        <ul className="space-y-2 pb-6">
                          {group.files.map((file) => {
                            const typeClasses =
                              file.section === "plans"
                                ? "border-blue-200 bg-blue-50 text-blue-600"
                                : file.section === "specs"
                                  ? "border-violet-200 bg-violet-50 text-violet-600"
                                  : file.section === "addenda"
                                    ? "border-orange-200 bg-orange-50 text-orange-500"
                                    : "border-slate-200 bg-slate-50 text-slate-500";

                            return (
                              <li
                                key={file.id}
                                className="grid grid-cols-[minmax(0,1.8fr)_140px_180px_160px_32px] items-center gap-4 rounded-2xl px-4 py-4 transition-colors hover:bg-surface-muted/60"
                              >
                                <div className="flex min-w-0 items-center gap-4">
                                  <span
                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                                      file.name.toLowerCase().endsWith(".dwg") || file.name.toLowerCase().endsWith(".dxf")
                                        ? "bg-blue-50 text-blue-500"
                                        : file.name.toLowerCase().endsWith(".doc") || file.name.toLowerCase().endsWith(".docx")
                                          ? "bg-sky-50 text-sky-500"
                                          : "bg-rose-50 text-red-500"
                                    }`}
                                  >
                                    {file.name.toLowerCase().endsWith(".dwg") || file.name.toLowerCase().endsWith(".dxf") ? (
                                      <FileCode2 className="h-5 w-5" />
                                    ) : (
                                      <FileText className="h-5 w-5" />
                                    )}
                                  </span>
                                  <div className="min-w-0">
                                    <a
                                      href={file.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block truncate text-sm font-bold text-foreground hover:text-blue-700 hover:underline"
                                    >
                                      {file.name}
                                    </a>
                                    <div className="mt-1 text-sm text-muted-foreground">
                                      {formatFileSize(file.size)} <span className="px-1 text-slate-300">•</span>{" "}
                                    {file.section === "addenda" ? "Add. 1" : "v1"}
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <span
                                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold ${typeClasses}`}
                                  >
                                    <Tag className="h-2 w-2" />
                                    {FILE_SECTION_META[file.section].badgeLabel}
                                  </span>
                                </div>
                                <div className="text-m text-muted-foreground">{primaryBiddingContactDisplay || "Project Manager"}</div>
                                <div className="text-m text-muted-foreground">
                                  {new Date(file.uploadedAt).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </div>
                                <div className="flex justify-center">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        aria-label="Open file actions"
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                                      >
                                        <MoreHorizontal className="h-5 w-5" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      sideOffset={10}
                                      className="min-w-[220px] overflow-hidden rounded-2xl border border-border bg-surface p-0 shadow-soft-md"
                                    >
                                      <DropdownMenuLabel className="px-5 pt-4 pb-2 text-sm font-semibold text-muted-foreground">
                                        File actions
                                      </DropdownMenuLabel>
                                      <DropdownMenuItem
                                        onClick={() => handlePreviewUploadedFile(file)}
                                        className="h-11 cursor-pointer rounded-none px-5 py-3 text-base font-medium text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg]:h-5 [&_svg]:w-5"
                                      >
                                        <Eye className="h-5 w-5" />
                                        Preview
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleRenameUploadedFile(file)}
                                        className="h-11 cursor-pointer rounded-none px-5 py-3 text-base font-medium text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg]:h-5 [&_svg]:w-5"
                                      >
                                        <Pencil className="h-5 w-5" />
                                        Rename
                                      </DropdownMenuItem>
                                      <DropdownMenuSub>
                                        <DropdownMenuSubTrigger className="h-11 cursor-pointer rounded-none px-5 py-3 text-base font-medium text-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg]:h-5 [&_svg]:w-5">
                                          <Tag className="h-5 w-5" />
                                          Change tag
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent className="min-w-[220px] overflow-hidden rounded-2xl border border-border bg-surface p-1 shadow-soft-md">
                                          <DropdownMenuRadioGroup
                                            value={file.section}
                                            onValueChange={(value) =>
                                              handleChangeUploadedFileTag(file, value as FileSectionKey)
                                            }
                                          >
                                            {FILE_UPLOAD_SECTION_OPTIONS.map((option) => (
                                              <DropdownMenuRadioItem
                                                key={option.value}
                                                value={option.value}
                                                className="h-11 cursor-pointer rounded-xl px-5 py-3 pr-10 text-base font-medium text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                                              >
                                                {option.label}
                                              </DropdownMenuRadioItem>
                                            ))}
                                          </DropdownMenuRadioGroup>
                                        </DropdownMenuSubContent>
                                      </DropdownMenuSub>
                                      <DropdownMenuSub>
                                        <DropdownMenuSubTrigger className="h-11 cursor-pointer rounded-none px-5 py-3 text-base font-medium text-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg]:h-5 [&_svg]:w-5">
                                          <File className="h-5 w-5" />
                                          Move to folder
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent className="min-w-[220px] overflow-hidden rounded-2xl border border-border bg-surface p-1 shadow-soft-md">
                                          <DropdownMenuRadioGroup
                                            value={getFolderSectionValue(file)}
                                            onValueChange={(value) =>
                                              handleMoveUploadedFile(
                                                file,
                                                value as "plans" | "specs" | "addenda" | "reports"
                                              )
                                            }
                                          >
                                            {FILE_FOLDER_OPTIONS.map((option) => (
                                              <DropdownMenuRadioItem
                                                key={option.value}
                                                value={option.value}
                                                className="h-11 cursor-pointer rounded-xl px-5 py-3 pr-10 text-base font-medium text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                                              >
                                                <FolderOpen className="h-5 w-5" />
                                                {option.label}
                                              </DropdownMenuRadioItem>
                                            ))}
                                          </DropdownMenuRadioGroup>
                                        </DropdownMenuSubContent>
                                      </DropdownMenuSub>
                                      <DropdownMenuSeparator className="my-0 border-border" />
                                      <DropdownMenuItem
                                        variant="destructive"
                                        onClick={() => handleDeleteUploadedFile(file)}
                                        className="h-11 cursor-pointer rounded-none px-5 py-3 text-base font-medium data-[highlighted]:bg-destructive/10 [&_svg]:h-5 [&_svg]:w-5"
                                      >
                                        <Trash2Icon className="h-5 w-5 text-destructive" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}

                <div className="flex items-center justify-between border-b border-border py-7">
                  <div className="text-base text-muted-foreground">
                    {uploadedFiles.length} file{uploadedFiles.length === 1 ? "" : "s"} across {projectFileGroups.length} folder{projectFileGroups.length === 1 ? "" : "s"}
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateFolder}
                    className="inline-flex items-center gap-3 text-[15px] font-semibold text-blue-600 hover:text-blue-700"
                  >
                    <FolderPlus className="h-5 w-5" />
                    New folder
                  </button>
                </div>
              </section>

              <section>
                <article className="rounded-2xl border border-border bg-surface p-5 shadow-soft-sm">
                  <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        SUBCONTRACTOR PACKAGE PREVIEW
                      </div>
                      <h4 className={`mt-2 ${filesSectionHeadingClass}`}>
                        What subs will receive
                      </h4>
                      <p className="mt-2 max-w-3xl text-base text-muted-foreground">
                        Review the files and sections subcontractors will see before you send bid invites.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewModalOpen(true)}
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-5 text-sm font-semibold text-foreground shadow-soft-sm hover:border-accent hover:bg-accent hover:text-accent-foreground"
                    >
                      <Eye className="h-4 w-4" />
                      Preview Package
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                    <div className="rounded-xl border border-border bg-surface-muted/30 p-5">
                      <div className="text-3xl font-extrabold text-foreground">{uploadedFiles.length}</div>
                      <div className="mt-2 text-sm font-semibold text-muted-foreground">Total Files</div>
                    </div>
                    <div className="rounded-xl border border-border bg-surface-muted/30 p-5">
                      <div className="text-3xl font-extrabold text-foreground">{filesBySection.plans.length}</div>
                      <div className="mt-2 text-sm font-semibold text-muted-foreground">Plans</div>
                    </div>
                    <div className="rounded-xl border border-border bg-surface-muted/30 p-5">
                      <div className="text-3xl font-extrabold text-foreground">{filesBySection.specs.length}</div>
                      <div className="mt-2 text-sm font-semibold text-muted-foreground">Specs</div>
                    </div>
                    <div className="rounded-xl border border-border bg-surface-muted/30 p-5">
                      <div className="text-3xl font-extrabold text-foreground">{filesBySection.addenda.length}</div>
                      <div className="mt-2 text-sm font-semibold text-muted-foreground">Addenda</div>
                    </div>
                    <div className="rounded-xl border border-border bg-surface-muted/30 p-5">
                      <div className="text-3xl font-extrabold text-foreground">
                        {uploadedFiles.filter((file) => file.section === "scope_sheets").length}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-muted-foreground">Scope Sheets</div>
                    </div>
                    <div className="rounded-xl border border-border bg-surface-muted/30 p-5">
                      <div className="text-3xl font-extrabold text-foreground">{formatFileSize(totalUploadedBytes)}</div>
                      <div className="mt-2 text-sm font-semibold text-muted-foreground">Total Size</div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="text-sm font-semibold text-foreground">Included sections</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        { label: "Plans", count: filesBySection.plans.length },
                        { label: "Specs", count: filesBySection.specs.length },
                        { label: "Addenda", count: filesBySection.addenda.length },
                        { label: "Scope Sheets", count: uploadedFiles.filter((file) => file.section === "scope_sheets").length },
                      ].map((item) => (
                        <span
                          key={item.label}
                          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-muted/30 px-3 py-1.5 text-sm font-semibold text-muted-foreground"
                        >
                          <span className="text-foreground">{item.label}</span>
                          <span>{item.count}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-muted-foreground">
                    Latest upload{" "}
                    <span className="px-1">·</span>
                    <span className="font-semibold text-foreground">
                      {latestUploadedFile
                        ? new Date(latestUploadedFile.uploadedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "No uploads yet"}
                    </span>
                  </div>
                </article>
              </section>
            </div>

            {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

            <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-slate-50/85 sm:px-6 lg:px-12">
              <button
                type="button"
                onClick={() => setActivePanel("general")}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={discardBidPackageDraft}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setActivePanel("trade-coverage")}
                disabled={submitting}
                className="rounded-md bg-accent px-8 py-2 text-base font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Continue to Trades
              </button>
            </div>
          </>
        ) : activePanel === "trade-coverage" ? (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-[18px] font-semibold text-slate-900">Trade Coverage</h3>
              <p className="mt-2 text-sm text-slate-600">
                Select the trades you need covered for this package. Subcontractor assignment happens in the next step.
              </p>

              <div className="mt-5 grid items-stretch gap-5 xl:h-[calc(100vh-18rem)] xl:grid-cols-2">
                <div className="flex min-h-[28rem] flex-col rounded-[12px] border-[0.5px] border-[#D3D1C7] bg-[#F8F8F7] p-4 xl:min-h-0 xl:h-full">
                  <div className="text-sm font-semibold text-slate-800">Add Trades By Cost Code</div>
                  <input
                    value={costCodeQuery}
                    onChange={(event) => setCostCodeQuery(event.target.value)}
                    placeholder="Search cost codes"
                    className="mt-3 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                  <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-md border border-slate-200 bg-white">
                    {loadingCostCodes ? (
                      <div className="px-3 py-3 text-sm text-slate-500">Loading cost codes...</div>
                    ) : filteredCostCodes.length ? (
                      filteredCostCodes.map((code) => (
                        <div key={code.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-800">{code.code}</div>
                            <div className="truncate text-sm text-slate-500">{code.description ?? "No description"}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => addTradeFromCostCode(code)}
                            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Add
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-sm text-slate-500">{costCodeLoadError ?? "No cost codes found."}</div>
                    )}
                  </div>
                </div>

                <div className="flex min-h-[28rem] flex-col overflow-hidden rounded-[12px] border-[0.5px] border-[#B5D4F4] bg-[#E6F1FB] text-[#185FA5] xl:min-h-0 xl:h-full">
                  <div className="bg-[#E6F1FB] px-4 py-3 text-sm font-semibold text-[#0C447C]">Selected Trades</div>
                  <div className="min-h-0 flex-1 overflow-auto divide-y divide-[#B5D4F4]">
                    {selectedTrades.length ? (
                      selectedTrades.map((trade) => (
                        <div key={trade.id} className="px-4 py-3 text-sm text-[#185FA5]">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate font-medium text-[#0C447C]">{trade.code}</div>
                              <div className="truncate text-sm text-[#185FA5]">{trade.description ?? "No description"}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeTrade(trade.id)}
                              className="rounded border-[0.5px] border-[#B5D4F4] bg-transparent px-1.5 py-0.5 text-[11px] font-semibold text-[#185FA5] hover:bg-transparent"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-4 text-sm text-[#185FA5]">Select one or more trades above to build coverage rows.</div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

            <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-slate-50/85 sm:px-6 lg:px-12">
              <button
                type="button"
                onClick={() => setActivePanel("files")}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={discardBidPackageDraft}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setActivePanel("invite-subs");
                  setExpandedInviteTradeId(selectedTrades[0]?.id ?? null);
                }}
                className="rounded-md bg-accent px-8 py-2 text-base font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Invite Subcontractors
              </button>
            </div>
          </>
        ) : activePanel === "invite-subs" ? (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-0">
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 className="text-[18px] font-semibold text-slate-900">Invite Subs</h3>
                <p className="mt-1 text-sm text-slate-600">Invite subcontractors by trade and track response status.</p>
              </div>

              <div className="p-4">
                {selectedTrades.length ? (
                  <div className="space-y-4">
                    {selectedTrades.map((trade) => {
                      const assigned = assignedSubsByTradeId[trade.id] ?? [];
                      const expanded = expandedInviteTradeId === trade.id;
                      const dueLabel = formatBidDueDateLabel(draft);
                      const recommended = subOptions.filter((option) => {
                        const assignedIds = new Set(assigned.map((item) => item.id));
                        if (assignedIds.has(option.id)) return false;
                        const query = (inviteQueryByTradeId[trade.id] ?? "").trim().toLowerCase();
                        if (!query) return true;
                        return option.company.toLowerCase().includes(query);
                      });
                      return (
                        <article key={`invite-${trade.id}`} className="overflow-hidden rounded-lg border border-slate-200">
                          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-3">
                            <div className="flex items-center gap-3">
                              {assigned.length > 0 ? (
                                <span
                                  className={`inline-flex size-7 items-center justify-center rounded-full text-sm text-white ${
                                    assigned.length >= 3
                                      ? "bg-emerald-600"
                                      : assigned.length === 2
                                        ? "bg-yellow-500"
                                        : "bg-accent"
                                  }`}
                                >
                                  ✓
                                </span>
                              ) : null}
                              <div className="flex flex-wrap items-baseline gap-x-2 text-slate-900">
                                <span className="text-xl font-semibold">{trade.code}</span>
                                {trade.description ? (
                                  <span className="text-2xl font-medium text-slate-600">{trade.description}</span>
                                ) : null}
                              </div>
                              <span
                                className={`rounded px-2 py-0.5 text-sm font-semibold ${
                                  assigned.length === 0 ? "bg-amber-100 text-amber-700" : "text-slate-600"
                                }`}
                              >
                                {assigned.length === 0
                                  ? "0 Selected"
                                  : `Coverage: ${Math.min(assigned.length, 3)}/3 subs invited`}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-600">
                              <span>Due {dueLabel}</span>
                              <button
                                type="button"
                                onClick={() => setExpandedInviteTradeId((prev) => (prev === trade.id ? null : trade.id))}
                                className="inline-flex items-center rounded border border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-slate-700"
                              >
                                {expanded ? "Hide" : "Manage"}
                              </button>
                            </div>
                          </div>

                          {expanded ? (
                            <>
                              <div className="border-t border-slate-200 px-4 py-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-2xl font-semibold text-slate-900">Invite subs to this trade</div>
                                  <button
                                    type="button"
                                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>

                              <div className="grid border-t border-slate-200 lg:grid-cols-2">
                                <div className="border-r border-slate-200 p-4">
                                  <input
                                    value={inviteQueryByTradeId[trade.id] ?? ""}
                                    onChange={(event) =>
                                      setInviteQueryByTradeId((prev) => ({ ...prev, [trade.id]: event.target.value }))
                                    }
                                    placeholder="Search all subs..."
                                    className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                                  />
                                  <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
                                    {recommended.length ? (
                                      recommended.slice(0, 8).map((sub) => (
                                        <div key={`${trade.id}-rec-${sub.id}`} className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0">
                                          <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold text-slate-800">{sub.company}</div>
                                            <div className="text-sm text-slate-500">{sub.email ?? "No email in directory"}</div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => addSubToTrade(trade.id, sub)}
                                            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                                          >
                                            + Add
                                          </button>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="px-3 py-4 text-sm text-slate-500">No matching subcontractors.</div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNewSubDrawerTradeId(trade.id);
                                      setNewSubDraft({
                                        company_name: "",
                                        primary_contact: "",
                                        email: "",
                                        phone: "",
                                      });
                                      setNewSubError(null);
                                    }}
                                    className="mt-3 text-sm font-semibold text-blue-700 hover:underline"
                                  >
                                    + Add new subcontractor
                                  </button>
                                </div>

                                <div className="p-4">
                                  <div className="mb-3 flex items-center justify-between gap-2">
                                    <div className="text-3xl font-semibold text-slate-900">Invited subs</div>
                                    <div className="text-sm text-slate-600">
                                      Selected: <span className="font-semibold">{assigned.length}</span>
                                    </div>
                                  </div>
                                  <div className="overflow-hidden rounded-md border border-slate-200">
                                    <div className="overflow-x-auto">
                                      <div>
                                        <div className="grid grid-cols-[minmax(0,1fr)_104px_88px_40px] bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                                          <div>Company</div>
                                          <div>Invite Status</div>
                                          <div>Status</div>
                                          <div aria-hidden="true" />
                                        </div>
                                        {assigned.length ? (
                                          assigned.map((sub) => (
                                            <div
                                              key={`${trade.id}-assigned-${sub.id}`}
                                              className="grid grid-cols-[minmax(0,1fr)_104px_88px_40px] border-t border-slate-200 px-3 py-2"
                                            >
                                              <div className="min-w-0">
                                                <div className="truncate text-sm font-semibold text-slate-800">{sub.company}</div>
                                                <div className="text-sm text-slate-500">{sub.bidInviteEmail || "No invite email set"}</div>
                                              </div>
                                              <div className="pr-1 text-sm text-slate-600">{sub.invited ? "Invited" : "Not Sent"}</div>
                                              <div>
                                                <span
                                                  className={`inline-flex rounded px-2 py-0.5 text-sm font-semibold ${
                                                    sub.willBid
                                                      ? "bg-emerald-100 text-emerald-700"
                                                      : sub.invited
                                                        ? "bg-slate-100 text-slate-700"
                                                        : "bg-amber-100 text-amber-700"
                                                  }`}
                                                >
                                                  {sub.willBid ? "Bidding" : sub.invited ? "Viewed" : "Draft"}
                                                </span>
                                              </div>
                                              <div className="flex justify-end">
                                                <DropdownMenu>
                                                  <DropdownMenuTrigger asChild>
                                                    <button
                                                      type="button"
                                                      className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                                      aria-label={`More actions for ${sub.company}`}
                                                      title={`More actions for ${sub.company}`}
                                                    >
                                                      <Ellipsis className="size-4" />
                                                    </button>
                                                  </DropdownMenuTrigger>
                                                  <DropdownMenuContent align="end" className="w-40">
                                                    <DropdownMenuItem
                                                      variant="destructive"
                                                      onClick={() => removeSubFromTrade(trade.id, sub.id)}
                                                    >
                                                      <Trash2Icon className="size-4" />
                                                      Remove sub
                                                    </DropdownMenuItem>
                                                  </DropdownMenuContent>
                                                </DropdownMenu>
                                              </div>
                                            </div>
                                          ))
                                        ) : (
                                          <div className="border-t border-slate-200 px-3 py-4 text-sm text-slate-500">No subs added for this trade yet.</div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                    No trades selected yet. Go to Trade Coverage and add trades first.
                  </div>
                )}
              </div>
            </section>

            {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

            <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-slate-50/85 sm:px-6 lg:px-12">
              <button
                type="button"
                onClick={() => setActivePanel("trade-coverage")}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={discardBidPackageDraft}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setActivePanel("bid-email")}
                disabled={submitting}
                className="rounded-md bg-accent px-8 py-2 text-base font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Review Email
              </button>
            </div>
          </>
        ) : (
          <>
            <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-4">
                <article className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="text-[18px] font-semibold text-slate-900">Invitation Email</h3>
                  <p className="mt-1 text-sm text-slate-600">Compose the email sent to selected subcontractors.</p>

                  <div className="mt-4 space-y-4">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">Subject</span>
                      <input
                        value={invitationEmailDraft.subject}
                        onChange={(event) => setInvitationEmailDraft((prev) => ({ ...prev, subject: event.target.value }))}
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                        placeholder="Invitation subject"
                      />
                      <p className="mt-1 text-sm text-slate-500">Use tokens to auto-fill project details.</p>
                    </label>

                    <div className="block">
                      <span className="text-sm font-semibold text-slate-700">Message</span>
                      <div className="mt-2">
                        <EmailRichTextEditor
                          ref={messageEditorRef}
                          tokens={TOKEN_LIST}
                          value={invitationEmailDraft.message}
                          onChange={(html) => setInvitationEmailDraft((prev) => ({ ...prev, message: html }))}
                          placeholder="Write your invitation email..."
                        />
                      </div>
                      <p className="mt-1 text-sm text-slate-500">Use tokens to auto-fill project details.</p>
                    </div>
                  </div>
                </article>

                <article className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-sm font-semibold text-slate-700">Included Attachments</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      Plans: <span className="font-semibold">{includedAttachments.plans || "None"}</span>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      Specs: <span className="font-semibold">{includedAttachments.specs || "None"}</span>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      Addenda: <span className="font-semibold">{includedAttachments.addenda || "None"}</span>
                    </div>
                  </div>
                </article>
              </div>

              <aside className="space-y-4 lg:sticky lg:top-24">
                <article className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">Sender Mailbox</h4>
                      <p className="mt-1 text-sm text-slate-500">Send invites from the active email sender.</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${mailboxBadge.className}`}>
                      {mailboxBadge.label}
                    </span>
                  </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <div className="font-semibold text-slate-900">
                      {mailboxConnection?.displayName || "No sender configured"}
                      </div>
                      <div className="mt-1">
                      {mailboxConnection?.email || "Configure Send from App or connect Outlook"}
                      </div>
                    </div>
                  {mailboxBadge.label !== "Connected" ? (
                    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Configure an active email sender before sending invites.
                    </div>
                  ) : null}
                  <div className="mt-3">
                    <a
                      href="/settings?section=email-sending"
                      className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Manage Connection
                    </a>
                  </div>
                </article>

                <article className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-800">Preview</h4>
                    <button
                      type="button"
                      onClick={() => setTokenValuesOpen((open) => !open)}
                      className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Show token values
                    </button>
                  </div>
                  {tokenValuesOpen ? (
                    <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-2 text-sm text-slate-600">
                      {TOKEN_LIST.map((token) => (
                        <div key={`token-map-${token}`} className="flex items-start justify-between gap-2 py-0.5">
                          <span className="font-mono text-slate-700">{token}</span>
                          <span className="text-right">{tokenValues[token] || "—"}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <div>
                      <span className="font-semibold">From:</span>{" "}
                      {primaryBiddingContactDisplay || "Primary bidding contact"}
                    </div>
                    <div>
                      <span className="font-semibold">To:</span> {uniqueInviteRecipients.length} recipient{uniqueInviteRecipients.length === 1 ? "" : "s"}
                    </div>
                    <div>
                      <span className="font-semibold">Due Date Preview:</span> {tokenValues["{bid_due_date}"] || "TBD"}
                    </div>
                    <div>
                      <span className="font-semibold">Subject:</span> {renderedSubject || "—"}
                    </div>
                    <div>
                      <span className="font-semibold">Message:</span>
                      {renderedMessage ? (
                        <div
                          className={`mt-1 ${EMAIL_PREVIEW_CLASS}`}
                          dangerouslySetInnerHTML={{ __html: renderedMessage }}
                        />
                      ) : (
                        <p className="mt-1">—</p>
                      )}
                    </div>
                  </div>
                </article>

                <article className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setPreviewModalOpen(true)}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Preview Email
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTestDialogOpen(true);
                        setTestSendEmail("");
                      }}
                      disabled={mailboxBadge.label !== "Connected"}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Send test to myself
                    </button>
                    <button
                      type="button"
                      onClick={saveInvitationDraftNow}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {editingProjectId ? "Save Draft" : "Save Local Draft"}
                    </button>
                  </div>
                  <div className="mt-3 text-sm text-slate-500">
                    {invitationSaving
                      ? "Saving draft..."
                      : invitationSavedAt
                        ? editingProjectId
                          ? `Draft saved to bid package ${new Date(invitationSavedAt).toLocaleTimeString()}`
                          : `Local draft saved ${new Date(invitationSavedAt).toLocaleTimeString()}. It will save to the bid package when created.`
                        : editingProjectId
                          ? "Draft not saved yet."
                          : "Local draft not saved yet. Database save is available after the bid package is created."}
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                    <button
                      type="button"
                      onClick={() => setActivePanel("invite-subs")}
                      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      value="send"
                      disabled={!canSendInvites}
                      className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? "Sending..." : "Send Invites"}
                    </button>
                  </div>
                </article>
              </aside>
            </section>

            <article className="rounded-xl border border-slate-200 bg-white p-5">
              <h4 className="text-sm font-semibold text-slate-800">Recipients</h4>
              {uniqueInviteRecipients.length ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {uniqueInviteRecipients.map((recipient) => (
                    <div
                      key={`${recipient.companyName}-${recipient.email}`}
                      className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <div className="truncate font-semibold text-slate-900">{recipient.companyName}</div>
                      <div className="mt-0.5 break-words text-slate-600">{recipient.email}</div>
                      <div className="mt-1 break-words text-sm leading-5 text-slate-500">
                        {recipient.tradeNames.join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  No recipients selected.
                </div>
              )}
            </article>

            {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
            {selectedSubsCount === 0 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Select at least 1 subcontractor to invite, or choose Skip to create the bid package without invites.
              </p>
            ) : null}
            {mailboxBadge.label !== "Connected" ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Configure an active email sender before sending invites.
              </p>
            ) : null}

            <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-slate-50/85 sm:px-6 lg:px-12">
              <button
                type="button"
                onClick={() => setActivePanel("invite-subs")}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={discardBidPackageDraft}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                value="skip"
                disabled={submitting}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Creating..." : "Skip and Create Bid Package"}
              </button>
              <button
                type="submit"
                value="send"
                disabled={!canSendInvites}
                className="rounded-md bg-accent px-8 py-2 text-base font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Sending..." : "Send Invites"}
              </button>
            </div>
          </>
        )}
          </div>

          <aside className="hidden w-full lg:sticky lg:top-24 lg:block lg:w-[320px] lg:self-start">
            <div>
                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_rgba(15,23,42,0.05)]">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-[17px] font-semibold text-slate-950">Setup progress</h3>
                    <span className="text-[15px] font-semibold text-slate-500">{completedStepsCount}/5</span>
                  </div>

                  <ol className="relative space-y-1">
                    <li className="relative">
                      <span
                        className={`absolute left-[36px] top-[40px] h-[calc(100%-8px)] w-px ${
                          currentStepMeta.step > 1 ? "bg-blue-200" : "bg-slate-200"
                        }`}
                        aria-hidden
                      />
                      <button
                        type="button"
                        onClick={() => setActivePanel("general")}
                        className={`group relative flex w-full cursor-pointer items-center gap-4 rounded-[24px] px-4 py-3 text-left transition-colors ${
                          activePanel === "general" ? "bg-blue-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] transition-all ${
                            currentStepMeta.step > 1
                              ? "border-blue-600 bg-blue-600 text-white"
                              : activePanel === "general"
                                ? "border-blue-600 bg-white text-blue-600"
                                : "border-slate-200 bg-white text-slate-400"
                          }`}
                        >
                          {currentStepMeta.step > 1 ? (
                            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                              <path d="m4.5 10 3.5 3.5 7-7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                              <path d="M6 2.75h6l3 3V17a1.25 1.25 0 0 1-1.25 1.25h-7.5A1.25 1.25 0 0 1 5 17V4a1.25 1.25 0 0 1 1-1.22Z" />
                              <path d="M12 2.75V6h3" />
                              <path d="M7.5 9.5h5M7.5 12h5M7.5 14.5h3.5" />
                            </svg>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[15px] font-semibold leading-tight ${activePanel === "general" ? "text-blue-600" : "text-slate-900"}`}>
                            General Information
                          </span>
                          <span className="mt-0.5 block text-[15px] text-slate-500">Project details</span>
                        </span>
                      </button>
                    </li>

                    <li className="relative">
                      <span
                        className={`absolute left-[36px] top-[40px] h-[calc(100%-8px)] w-px ${
                          currentStepMeta.step > 2 ? "bg-blue-200" : "bg-slate-200"
                        }`}
                        aria-hidden
                      />
                      <button
                        type="button"
                        onClick={() => setActivePanel("files")}
                        className={`group relative flex w-full cursor-pointer items-center gap-4 rounded-[24px] px-4 py-3 text-left transition-colors ${
                          activePanel === "files" ? "bg-blue-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] transition-all ${
                            currentStepMeta.step > 2
                              ? "border-blue-600 bg-blue-600 text-white"
                              : activePanel === "files"
                                ? "border-blue-600 bg-white text-blue-600"
                                : "border-slate-200 bg-white text-slate-400"
                          }`}
                        >
                          {currentStepMeta.step > 2 ? (
                            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                              <path d="m4.5 10 3.5 3.5 7-7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                              <path d="M2.75 5.25A1.25 1.25 0 0 1 4 4h4.2l1.2 1.5H16A1.25 1.25 0 0 1 17.25 6.75v8.5A1.25 1.25 0 0 1 16 16.5H4a1.25 1.25 0 0 1-1.25-1.25z" />
                            </svg>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[15px] font-semibold leading-tight ${activePanel === "files" ? "text-blue-600" : "text-slate-900"}`}>
                            Files
                          </span>
                          <span className="mt-0.5 block text-[15px] text-slate-500">Drawings & specs</span>
                        </span>
                      </button>
                    </li>

                    <li className="relative">
                      <span
                        className={`absolute left-[36px] top-[40px] h-[calc(100%-8px)] w-px ${
                          currentStepMeta.step > 3 ? "bg-blue-200" : "bg-slate-200"
                        }`}
                        aria-hidden
                      />
                      <button
                        type="button"
                        onClick={() => setActivePanel("trade-coverage")}
                        className={`group relative flex w-full cursor-pointer items-center gap-4 rounded-[24px] px-4 py-3 text-left transition-colors ${
                          activePanel === "trade-coverage" ? "bg-blue-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] transition-all ${
                            currentStepMeta.step > 3
                              ? "border-blue-600 bg-blue-600 text-white"
                              : activePanel === "trade-coverage"
                                ? "border-blue-600 bg-white text-blue-600"
                                : "border-slate-200 bg-white text-slate-400"
                          }`}
                        >
                          {currentStepMeta.step > 3 ? (
                            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                              <path d="m4.5 10 3.5 3.5 7-7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                              <path d="M3.5 5.5h13v10h-13z" />
                              <path d="M7 8.5h6M7 11.5h6" />
                            </svg>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[15px] font-semibold leading-tight ${activePanel === "trade-coverage" ? "text-blue-600" : "text-slate-900"}`}>
                            Select Trades
                          </span>
                          <span className="mt-0.5 block text-[15px] text-slate-500">Scopes of work</span>
                        </span>
                      </button>
                    </li>

                    <li className="relative">
                      <span
                        className={`absolute left-[36px] top-[40px] h-[calc(100%-8px)] w-px ${
                          currentStepMeta.step > 4 ? "bg-blue-200" : "bg-slate-200"
                        }`}
                        aria-hidden
                      />
                      <button
                        type="button"
                        onClick={() => setActivePanel("invite-subs")}
                        className={`group relative flex w-full cursor-pointer items-center gap-4 rounded-[24px] px-4 py-3 text-left transition-colors ${
                          activePanel === "invite-subs" ? "bg-blue-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] transition-all ${
                            currentStepMeta.step > 4
                              ? "border-blue-600 bg-blue-600 text-white"
                              : activePanel === "invite-subs"
                                ? "border-blue-600 bg-white text-blue-600"
                                : "border-slate-200 bg-slate-50 text-slate-400"
                          }`}
                        >
                          {currentStepMeta.step > 4 ? (
                            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                              <path d="m4.5 10 3.5 3.5 7-7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                              <path d="M4 6.5h12M4 10h12M4 13.5h12" />
                              <path d="M14.5 3.5v5m-2.5-2.5h5" />
                            </svg>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[15px] font-semibold leading-tight ${activePanel === "invite-subs" ? "text-blue-600" : "text-slate-900"}`}>
                            Invite Subs
                          </span>
                          <span className="mt-0.5 block text-[15px] text-slate-500">Subcontractors</span>
                        </span>
                      </button>
                    </li>

                    <li className="relative">
                      <button
                        type="button"
                        onClick={() => setActivePanel("bid-email")}
                        className={`group relative flex w-full cursor-pointer items-center gap-4 rounded-[24px] px-4 py-3 text-left transition-colors ${
                          activePanel === "bid-email" ? "bg-blue-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] transition-all ${
                            activePanel === "bid-email"
                              ? "border-blue-600 bg-white text-blue-600"
                              : "border-slate-200 bg-white text-slate-400"
                          }`}
                        >
                          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                            <rect x="3" y="5" width="14" height="10" rx="1.5" />
                            <path d="m4 6 6 5 6-5" />
                          </svg>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[15px] font-semibold leading-tight ${activePanel === "bid-email" ? "text-blue-600" : "text-slate-900"}`}>
                            Bid Email
                          </span>
                          <span className="mt-0.5 block text-[15px] text-slate-500">Compose & send</span>
                        </span>
                      </button>
                    </li>
                  </ol>
                </div>

            </div>
          </aside>
        </div>
        </main>
      </form>
      {previewModalOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50"
            aria-label="Close email preview"
            onClick={() => setPreviewModalOpen(false)}
          />
          <div className="absolute inset-x-6 top-8 mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Email Preview</h2>
            </div>
            <div className="space-y-3 px-6 py-5 text-sm text-slate-700">
              <div>
                <span className="font-semibold">From:</span>{" "}
                {primaryBiddingContactDisplay || "Primary bidding contact"}
              </div>
              <div>
                <span className="font-semibold">To:</span> Selected subs across trades
              </div>
              <div>
                <span className="font-semibold">Subject:</span> {renderedSubject}
              </div>
              <div
                className={`rounded-md border border-slate-200 bg-slate-50 p-3 ${EMAIL_PREVIEW_CLASS}`}
                dangerouslySetInnerHTML={{ __html: renderedMessage || "—" }}
              />
            </div>
            <div className="flex justify-end border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {testDialogOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            aria-label="Close test send dialog"
            onClick={() => setTestDialogOpen(false)}
          />
          <div className="absolute left-1/2 top-24 w-full max-w-md -translate-x-1/2 rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">Send Test Email</h2>
            </div>
            <form
              className="space-y-4 px-5 py-4"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!testSendEmail.trim()) {
                  setToast({ type: "error", message: "Enter an email address." });
                  return;
                }
                setTestSendLoading(true);
                await new Promise((resolve) => window.setTimeout(resolve, 600));
                setTestSendLoading(false);
                setTestDialogOpen(false);
                setToast({ type: "success", message: `Test email queued to ${testSendEmail.trim()}.` });
              }}
            >
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Email address</span>
                <input
                  type="email"
                  value={testSendEmail}
                  onChange={(event) => setTestSendEmail(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  placeholder="you@company.com"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTestDialogOpen(false)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={testSendLoading}
                  className="rounded-md bg-accent px-7 py-2 text-base font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {testSendLoading ? "Sending..." : "Send Test"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {renameFileDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close rename file dialog"
            onClick={closeRenameFileDialog}
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-soft-lg">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-xl font-bold text-foreground">Rename file</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Update the file name shown in this bid package.
              </p>
            </div>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                await submitRenameFileDialog();
              }}
            >
              <div className="px-6 pb-5">
                <label className="block">
                  <span className="text-sm font-semibold text-foreground">File name</span>
                  <input
                    autoFocus
                    type="text"
                    value={renameFileDialog.draftName}
                    onChange={(event) =>
                      setRenameFileDialog((current) =>
                        current
                          ? {
                              ...current,
                              draftName: event.target.value,
                            }
                          : current
                      )
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm text-foreground shadow-soft-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </label>
                <p className="mt-2 text-xs text-muted-foreground">
                  Keep the file extension if you still want it displayed.
                </p>
              </div>
              <div className="flex justify-end gap-3 border-t border-border bg-surface-muted/40 px-6 py-4">
                <button
                  type="button"
                  onClick={closeRenameFileDialog}
                  disabled={renameFileSaving}
                  className="h-10 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    renameFileSaving ||
                    !renameFileDialog.draftName.trim() ||
                    renameFileDialog.draftName.trim() === renameFileDialog.originalName
                  }
                  className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {renameFileSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {deleteFileDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close delete file dialog"
            onClick={closeDeleteFileDialog}
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-soft-lg">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-xl font-bold text-foreground">Delete file</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Remove this file from the bid package and project files list.
              </p>
            </div>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                await submitDeleteFileDialog();
              }}
            >
              <div className="px-6 pb-5">
                <div className="text-sm font-semibold text-foreground">File name</div>
                <div className="mt-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-soft-sm">
                  {deleteFileDialog.fileName}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  This action removes the file from this setup flow.
                </p>
              </div>
              <div className="flex justify-end gap-3 border-t border-border bg-surface-muted/40 px-6 py-4">
                <button
                  type="button"
                  onClick={closeDeleteFileDialog}
                  disabled={deleteFileSaving}
                  className="h-10 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteFileSaving}
                  className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleteFileSaving ? "Deleting..." : "Delete File"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {newFolderDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close new folder dialog"
            onClick={closeNewFolderDialog}
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-soft-lg">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-xl font-bold text-foreground">Create folder</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a new folder for files in {FILE_SECTION_META[selectedUploadSection].label}.
              </p>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submitNewFolderDialog();
              }}
            >
              <div className="px-6 pb-5">
                <label className="block">
                  <span className="text-sm font-semibold text-foreground">Folder name</span>
                  <input
                    autoFocus
                    type="text"
                    value={newFolderDialog.draftName}
                    onChange={(event) =>
                      setNewFolderDialog((current) =>
                        current
                          ? {
                              ...current,
                              draftName: event.target.value,
                            }
                          : current
                      )
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm text-foreground shadow-soft-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Enter folder name"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-3 border-t border-border bg-surface-muted/40 px-6 py-4">
                <button
                  type="button"
                  onClick={closeNewFolderDialog}
                  className="h-10 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground hover:bg-surface-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newFolderDialog.draftName.trim()}
                  className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {toast ? (
        <div className="fixed bottom-5 right-5 z-50">
          <div
            className={`rounded-md border px-3 py-2 text-sm shadow-lg ${
              toast.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </div>
        </div>
      ) : null}
      {newSubDrawerTradeId ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            aria-label="Close new contractor drawer"
            onClick={() => {
              setNewSubDrawerTradeId(null);
              setNewSubError(null);
            }}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-2xl font-semibold text-slate-900">New Contractor</h2>
              <p className="mt-1 text-sm text-slate-500">
                {activeDrawerTrade ? `Add to ${activeDrawerTrade.code}` : "Add subcontractor to this trade"}
              </p>
            </div>
            <form
              className="space-y-4 px-6 py-5"
              onSubmit={async (event) => {
                event.preventDefault();
                const tradeId = newSubDrawerTradeId;
                if (!tradeId) return;
                const companyName = newSubDraft.company_name.trim();
                if (!companyName) {
                  setNewSubError("Company name is required.");
                  return;
                }
                setNewSubSaving(true);
                setNewSubError(null);

                const directoryResponse = await fetch("/api/directory/companies", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    companies: [
                      {
                        company_name: companyName,
                        trade: newSubTrades.length
                          ? newSubTrades.map((trade) => formatTradeLabel(trade)).join(" | ")
                          : activeDrawerTrade
                            ? formatTradeLabel(activeDrawerTrade)
                            : null,
                        primary_contact: newSubDraft.primary_contact.trim() || null,
                        email: newSubDraft.email.trim() || null,
                        phone: newSubDraft.phone.trim() || null,
                        status: "Active",
                      },
                    ],
                  }),
                });
                if (!directoryResponse.ok) {
                  const payload = (await directoryResponse.json().catch(() => null)) as { error?: string } | null;
                  setNewSubError(payload?.error ?? "Unable to save contractor to directory.");
                  setNewSubSaving(false);
                  return;
                }
                const directoryPayload = (await directoryResponse.json().catch(() => null)) as
                  | { companies?: Array<{ id?: string; name?: string; email?: string | null }> }
                  | null;
                const directoryCompany = directoryPayload?.companies?.[0];
                if (!directoryCompany?.id || !directoryCompany?.name) {
                  setNewSubError("Contractor saved, but could not read directory record.");
                  setNewSubSaving(false);
                  return;
                }

                const created = await createBidSubcontractor({
                  company_name: companyName,
                  primary_contact: newSubDraft.primary_contact.trim() || null,
                  email: newSubDraft.email.trim() || null,
                  phone: newSubDraft.phone.trim() || null,
                });
                if (!created) {
                  setNewSubError("Unable to create subcontractor.");
                  setNewSubSaving(false);
                  return;
                }

                const newOption = {
                  id: directoryCompany.id,
                  company: directoryCompany.name,
                  email: directoryCompany.email ?? (newSubDraft.email.trim() || null),
                };
                setSubOptions((prev) => {
                  if (prev.some((item) => item.id === newOption.id)) return prev;
                  return [...prev, newOption].sort((a, b) => a.company.localeCompare(b.company));
                });
                const packageTradeIds = new Set(selectedTrades.map((trade) => trade.id));
                const tradeIdsToAssign = new Set<string>([tradeId]);
                newSubTrades.forEach((trade) => {
                  if (packageTradeIds.has(trade.id)) tradeIdsToAssign.add(trade.id);
                });
                tradeIdsToAssign.forEach((id) => addSubToTrade(id, newOption));
                setNewSubDrawerTradeId(null);
                setNewSubSaving(false);
              }}
            >
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Company Name <span className="sr-only">required</span>
                <input
                  value={newSubDraft.company_name}
                  onChange={(event) => setNewSubDraft((prev) => ({ ...prev, company_name: event.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  placeholder="Company name"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Primary Contact
                <input
                  value={newSubDraft.primary_contact}
                  onChange={(event) => setNewSubDraft((prev) => ({ ...prev, primary_contact: event.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  placeholder="Primary contact"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Email
                  <input
                    value={newSubDraft.email}
                    onChange={(event) => setNewSubDraft((prev) => ({ ...prev, email: event.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                    placeholder="name@company.com"
                    type="email"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Phone
                  <input
                    value={newSubDraft.phone}
                    onChange={(event) => setNewSubDraft((prev) => ({ ...prev, phone: event.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                    placeholder="(555) 555-5555"
                  />
                </label>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-slate-700">Trades / Cost Codes</div>
                  <p className="mt-1 text-sm text-slate-500">
                    Add the trades this subcontractor performs. Matching trades in this bid package will be invited automatically.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {newSubTrades.map((trade) => {
                    const locked = trade.id === activeDrawerTrade?.id;
                    return (
                      <span
                        key={`new-sub-trade-${trade.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700"
                      >
                        {formatTradeLabel(trade)}
                        {locked ? (
                          <span className="text-[11px] font-medium text-slate-500">Current trade</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setNewSubTrades((prev) => prev.filter((item) => item.id !== trade.id))
                            }
                            className="text-slate-400 hover:text-slate-700"
                            aria-label={`Remove ${formatTradeLabel(trade)}`}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
                <div className="rounded-lg border border-slate-300 p-3">
                  <input
                    value={newSubTradeQuery}
                    onChange={(event) => setNewSubTradeQuery(event.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                    placeholder="Search cost codes to add"
                  />
                  <div className="mt-3 max-h-56 overflow-auto rounded-md border border-slate-200">
                    {loadingCostCodes ? (
                      <div className="px-3 py-3 text-sm text-slate-500">Loading trades...</div>
                    ) : filteredNewSubTradeOptions.length ? (
                      filteredNewSubTradeOptions.slice(0, 10).map((trade) => (
                        <button
                          key={`new-sub-trade-option-${trade.id}`}
                          type="button"
                          onClick={() => {
                            setNewSubTrades((prev) => [
                              ...prev,
                              { id: trade.id, code: trade.code, description: trade.description },
                            ]);
                            setNewSubTradeQuery("");
                          }}
                          className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-800">{trade.code}</div>
                            <div className="text-sm text-slate-500">{trade.description ?? "No description"}</div>
                          </div>
                          <span className="text-sm font-semibold text-blue-600">Add</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-sm text-slate-500">
                        No matching trades found.
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {newSubError ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{newSubError}</p>
              ) : null}
              <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setNewSubDrawerTradeId(null);
                    setNewSubError(null);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newSubSaving}
                  className="rounded-md bg-accent px-8 py-2 text-base font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {newSubSaving ? "Saving..." : "Save Contractor"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
