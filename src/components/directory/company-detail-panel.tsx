"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Company, ProjectDirectoryEntry } from "@/lib/directory/types";
import { getBidProjectDetail, listBidProjects } from "@/lib/bidding/store";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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

type Props = {
  company: Company | null;
  tradeOptions: string[];
  assignedProjects: ProjectDirectoryEntry[];
  allProjects: ProjectDirectoryEntry[];
  projectPickerOpen: boolean;
  initialTab?: DrawerTab;
  startAddingContact?: boolean;
  onClose: () => void;
  onSaveCompanyInfo: (updates: {
    name: string;
    trade?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    website?: string;
    phone?: string;
    email?: string;
    isActive: boolean;
  }) => Promise<void>;
  onSaveCompanyContacts: (updates: {
    contacts: CompanyContactRecord[];
    notes: string | undefined;
    primaryContact?: string;
    contactTitle?: string;
    email?: string;
    phone?: string;
  }) => Promise<void>;
  onSaveCompanyNotes: (updates: { notes: string | undefined }) => Promise<void>;
  onSaveCompanyDocuments: (updates: { notes: string | undefined }) => Promise<void>;
  onAssignProject: (projectId: string) => void;
};

type DrawerTab = "company-info" | "contacts" | "bid-history" | "performance" | "notes" | "documents";

type CompanyInfoDraft = {
  name: string;
  trades: string[];
  primaryTrade: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  website: string;
  phone: string;
  email: string;
  isActive: boolean;
};

type CompanyContactRecord = {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  isPrimary: boolean;
};

type NewContactDraft = {
  name: string;
  role: string;
  phone: string;
  email: string;
  setAsPrimary: boolean;
};

type CompanyNoteRecord = {
  id: string;
  body: string;
  createdAt: string | null;
};

type CompanyDocumentRecord = {
  id: string;
  name: string;
  kind: string;
  uploadedAt: string;
  expiresAt?: string;
  dataUrl: string;
};

type BidHistoryRow = {
  id: string;
  projectName: string;
  tradeName: string;
  invitedAt: string | null;
  status: "submitted";
  amount: number | null;
  outcome: "—";
};

const CONTACTS_MARKER_START = "[[DIRECTORY_CONTACTS]]";
const CONTACTS_MARKER_END = "[[/DIRECTORY_CONTACTS]]";
const DOCUMENTS_MARKER_START = "[[DIRECTORY_DOCUMENTS]]";
const DOCUMENTS_MARKER_END = "[[/DIRECTORY_DOCUMENTS]]";
const NOTE_TIMESTAMP_PREFIX = "[[DIRECTORY_NOTE_TS:";
const NOTE_TIMESTAMP_SUFFIX = "]]";

const TABS: Array<{ id: DrawerTab; label: string }> = [
  { id: "company-info", label: "Company Info" },
  { id: "contacts", label: "Contacts" },
  { id: "bid-history", label: "Bid History" },
  { id: "performance", label: "Performance" },
  { id: "notes", label: "Notes" },
  { id: "documents", label: "Documents" },
];

function stripTradeCodePrefix(value: string) {
  return value
    .replace(/^\s*\d{2}(?:[.\-\s/]*\d{2}){0,4}\s*[:-]?\s*/u, "")
    .trim();
}

function getTradeTitles(value?: string) {
  if (!value?.trim()) return [];
  return value
    .split(/\s*\|\s*|\s*;\s*|\s*,\s*/)
    .map((entry) => stripTradeCodePrefix(entry.trim()))
    .filter(Boolean);
}

function getContactIdentityKey(contact: Pick<CompanyContactRecord, "name" | "email" | "phone">) {
  return `${contact.name.trim()}|${contact.email.trim().toLowerCase()}|${contact.phone.trim()}`.toLowerCase();
}

function normalizeCompareValue(value?: string | null) {
  return value?.trim().toLowerCase() || "";
}

function toDraft(company: Company): CompanyInfoDraft {
  const trades = getTradeTitles(company.trade);
  return {
    name: company.name ?? "",
    trades,
    primaryTrade: trades[0] ?? "",
    address: company.address ?? "",
    city: company.city ?? "",
    state: company.state ?? "",
    zip: company.zip ?? "",
    website: company.website ?? "",
    phone: company.phone ?? "",
    email: company.email ?? "",
    isActive: company.isActive,
  };
}

function normalizeContacts(contacts: CompanyContactRecord[]) {
  const seenIds = new Set<string>();
  const seenIdentity = new Set<string>();
  const unique = contacts
    .map((contact) => ({
      ...contact,
      name: contact.name.trim(),
      role: contact.role.trim(),
      email: contact.email.trim(),
      phone: contact.phone.trim(),
    }))
    .flatMap((contact) => {
      const identityKey = getContactIdentityKey(contact);

      if (!contact.name) return [];
      if (seenIdentity.has(identityKey)) return [];

      seenIdentity.add(identityKey);

      if (seenIds.has(contact.id)) {
        return [{ ...contact, id: crypto.randomUUID() }];
      }

      seenIds.add(contact.id);
      return [contact];
    });
  const firstPrimaryIndex = unique.findIndex((contact) => contact.isPrimary);
  const hasSingleContact = unique.length === 1;
  return unique.map((contact, index) => ({
    ...contact,
    isPrimary: hasSingleContact || (firstPrimaryIndex === -1 ? index === 0 : index === firstPrimaryIndex),
  }));
}

function parseCompanyDocuments(notes: string) {
  const startIndex = notes.indexOf(DOCUMENTS_MARKER_START);
  const endIndex = notes.indexOf(DOCUMENTS_MARKER_END);
  let documents: CompanyDocumentRecord[] = [];
  let notesWithoutDocuments = notes;

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const jsonPayload = notes
      .slice(startIndex + DOCUMENTS_MARKER_START.length, endIndex)
      .trim();
    try {
      const parsed = JSON.parse(jsonPayload) as { documents?: CompanyDocumentRecord[] };
      documents = Array.isArray(parsed.documents)
        ? parsed.documents
            .map((document) => ({
              id: document.id || crypto.randomUUID(),
              name: document.name ?? "Uploaded document",
              kind: document.kind ?? "Document",
              uploadedAt: document.uploadedAt ?? new Date().toISOString(),
              expiresAt: document.expiresAt || undefined,
              dataUrl: document.dataUrl ?? "",
            }))
            .filter((document) => document.dataUrl)
        : [];
    } catch {
      documents = [];
    }

    notesWithoutDocuments = `${notes.slice(0, startIndex)}${notes.slice(
      endIndex + DOCUMENTS_MARKER_END.length
    )}`.trim();
  }

  return { documents, notesWithoutDocuments };
}

function parseCompanyContacts(company: Company) {
  const notes = company.notes ?? "";
  const { documents, notesWithoutDocuments } = parseCompanyDocuments(notes);
  const fallbackPrimaryId = `${company.id}-primary-contact`;
  const fallbackIdentityKey = company.primaryContact?.trim()
    ? getContactIdentityKey({
        name: company.primaryContact.trim(),
        email: company.email?.trim() || "",
        phone: company.phone?.trim() || company.officePhone?.trim() || "",
      })
    : null;
  const startIndex = notesWithoutDocuments.indexOf(CONTACTS_MARKER_START);
  const endIndex = notesWithoutDocuments.indexOf(CONTACTS_MARKER_END);
  let storedContacts: CompanyContactRecord[] = [];
  let notesWithoutContacts = notesWithoutDocuments;

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const jsonPayload = notesWithoutDocuments
      .slice(startIndex + CONTACTS_MARKER_START.length, endIndex)
      .trim();
    try {
      const parsed = JSON.parse(jsonPayload) as { contacts?: CompanyContactRecord[] };
      storedContacts = Array.isArray(parsed.contacts)
        ? parsed.contacts
            .map((contact) => {
              const mappedContact = {
                id: contact.id || crypto.randomUUID(),
                name: contact.name ?? "",
                role: contact.role ?? "",
                email: contact.email ?? "",
                phone: contact.phone ?? "",
                isPrimary: Boolean(contact.isPrimary),
              };
              if (
                mappedContact.id === fallbackPrimaryId &&
                fallbackIdentityKey &&
                getContactIdentityKey(mappedContact) !== fallbackIdentityKey
              ) {
                return {
                  ...mappedContact,
                  id: crypto.randomUUID(),
                };
              }
              return mappedContact;
            })
            .filter((contact) => contact.name.trim())
        : [];
    } catch {
      storedContacts = [];
    }

    notesWithoutContacts = `${notesWithoutDocuments.slice(0, startIndex)}${notesWithoutDocuments.slice(
      endIndex + CONTACTS_MARKER_END.length
    )}`.trim();
  }

  const fallbackPrimary =
    company.primaryContact?.trim()
      ? {
          id: fallbackPrimaryId,
          name: company.primaryContact.trim(),
          role: company.contactTitle?.trim() || "Primary contact",
          email: company.email?.trim() || "",
          phone: company.phone?.trim() || company.officePhone?.trim() || "",
          isPrimary: true,
        }
      : null;

  return {
    contacts: normalizeContacts([...(fallbackPrimary ? [fallbackPrimary] : []), ...storedContacts]),
    notesWithoutContacts,
    documents,
  };
}

function buildCompanyNotes(
  baseNotes: string,
  contacts: CompanyContactRecord[],
  documents: CompanyDocumentRecord[] = []
) {
  const normalizedBase = baseNotes.trim();
  const normalizedContacts = normalizeContacts(
    contacts.map((contact) => ({
      ...contact,
      name: contact.name.trim(),
      role: contact.role.trim(),
      email: contact.email.trim(),
      phone: contact.phone.trim(),
    }))
  );

  if (!normalizedContacts.length) {
    if (!documents.length) {
      return normalizedBase || undefined;
    }
    const documentPayload = JSON.stringify({ documents });
    return [normalizedBase, `${DOCUMENTS_MARKER_START}${documentPayload}${DOCUMENTS_MARKER_END}`]
      .filter(Boolean)
      .join("\n\n");
  }

  const payload = JSON.stringify({ contacts: normalizedContacts });
  const documentPayload = documents.length
    ? `${DOCUMENTS_MARKER_START}${JSON.stringify({ documents })}${DOCUMENTS_MARKER_END}`
    : "";
  return [normalizedBase, `${CONTACTS_MARKER_START}${payload}${CONTACTS_MARKER_END}`, documentPayload]
    .filter(Boolean)
    .join("\n\n");
}

function inferDocumentKind(name: string) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("w9") || lowerName.includes("w-9")) return "W9";
  if (lowerName.includes("insurance") || lowerName.includes("coi")) return "Insurance";
  if (lowerName.includes("license")) return "License";
  return "Document";
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return null;

  const mimeType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const dataPart = match[3] || "";

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

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

function openDocumentPreview(dataUrl: string) {
  const blob = dataUrlToBlob(dataUrl);
  if (blob) {
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    return;
  }

  window.open(dataUrl, "_blank", "noopener,noreferrer");
}

function parseCompanyNotes(notes: string) {
  return notes
    .split(/\n{2,}/)
    .map((block, index) => {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) return null;

      const lines = trimmedBlock.split("\n");
      const firstLine = lines[0]?.trim() || "";
      const hasTimestampMarker =
        firstLine.startsWith(NOTE_TIMESTAMP_PREFIX) && firstLine.endsWith(NOTE_TIMESTAMP_SUFFIX);
      const createdAt = hasTimestampMarker
        ? firstLine.slice(NOTE_TIMESTAMP_PREFIX.length, firstLine.length - NOTE_TIMESTAMP_SUFFIX.length)
        : null;
      const body = (hasTimestampMarker ? lines.slice(1).join("\n") : trimmedBlock).trim();

      if (!body) return null;

      return {
        id: createdAt ? `${createdAt}-${index}` : `legacy-note-${index}`,
        body,
        createdAt,
      } satisfies CompanyNoteRecord;
    })
    .filter((note): note is CompanyNoteRecord => Boolean(note));
}

function serializeCompanyNotes(notes: CompanyNoteRecord[]) {
  return notes
    .map((note) =>
      note.createdAt
        ? `${NOTE_TIMESTAMP_PREFIX}${note.createdAt}${NOTE_TIMESTAMP_SUFFIX}\n${note.body.trim()}`
        : note.body.trim()
    )
    .filter(Boolean)
    .join("\n\n");
}

function TradeSearchSelect({
  value,
  placeholder,
  options,
  onSelect,
}: {
  value: string;
  placeholder: string;
  options: string[];
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="mt-2 flex h-10 w-full items-center justify-between rounded-[20px] border border-slate-200 bg-slate-100/40 px-5 text-left text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none transition-colors hover:border-slate-300"
        >
          <span className={value ? "" : "text-slate-400"}>{value || placeholder}</span>
          <ChevronDown className="h-5 w-5 text-slate-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={8}
        collisionPadding={16}
        className="w-[var(--radix-popover-trigger-width)] rounded-2xl border border-slate-200 bg-white p-2 shadow-soft-md"
      >
        <Command>
          <CommandInput placeholder="Search trades..." />
          <CommandList>
            <CommandEmpty>No trade found.</CommandEmpty>
            {options.map((option) => (
              <CommandItem
                key={option}
                value={option}
                onSelect={() => {
                  onSelect(option);
                  setOpen(false);
                }}
                className="cursor-pointer rounded-xl text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
              >
                <span className="flex items-center gap-2">
                  {value === option ? <Check className="h-4 w-4" /> : <span className="h-4 w-4" />}
                  {option}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function CompanyDetailPanel({
  company,
  tradeOptions,
  assignedProjects,
  allProjects,
  projectPickerOpen,
  initialTab = "company-info",
  startAddingContact = false,
  onClose,
  onSaveCompanyInfo,
  onSaveCompanyContacts,
  onSaveCompanyNotes,
  onSaveCompanyDocuments,
  onAssignProject,
}: Props) {
  const [activeTab, setActiveTab] = useState<DrawerTab>(initialTab);
  const [isEditingCompanyInfo, setIsEditingCompanyInfo] = useState(false);
  const [isSavingCompanyInfo, setIsSavingCompanyInfo] = useState(false);
  const [companyInfoError, setCompanyInfoError] = useState("");
  const [contactError, setContactError] = useState("");
  const [pendingClose, setPendingClose] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [pendingTrade, setPendingTrade] = useState("");
  const [customTradeInput, setCustomTradeInput] = useState("");
  const [bidHistoryRows, setBidHistoryRows] = useState<BidHistoryRow[]>([]);
  const [bidHistoryError, setBidHistoryError] = useState("");
  const [isLoadingBidHistory, setIsLoadingBidHistory] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [isSavingDocument, setIsSavingDocument] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editingDocumentName, setEditingDocumentName] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteDraft, setEditingNoteDraft] = useState("");
  const [noteError, setNoteError] = useState("");
  const [newContactDraft, setNewContactDraft] = useState<NewContactDraft>({
    name: "",
    role: "",
    phone: "",
    email: "",
    setAsPrimary: false,
  });
  const [editingContactDraft, setEditingContactDraft] = useState<NewContactDraft>({
    name: "",
    role: "",
    phone: "",
    email: "",
    setAsPrimary: false,
  });
  const [companyInfoDraft, setCompanyInfoDraft] = useState<CompanyInfoDraft>({
    name: "",
    trades: [],
    primaryTrade: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    website: "",
    phone: "",
    email: "",
    isActive: true,
  });
  const previousCompanyIdRef = useRef<string | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!company) return;
    const isNewCompany = previousCompanyIdRef.current !== company.id;
    previousCompanyIdRef.current = company.id;
    if (isNewCompany) {
      setActiveTab(initialTab);
    }
    setIsEditingCompanyInfo(false);
    setCompanyInfoError("");
    setContactError("");
    setBidHistoryError("");
    setPendingClose(false);
    setIsClosing(false);
    setBidHistoryRows([]);
    setIsLoadingBidHistory(false);
    setPendingTrade("");
    setCustomTradeInput("");
    setIsAddingContact(startAddingContact);
    setIsAddingNote(false);
    setEditingContactId(null);
    setEditingDocumentId(null);
    setEditingDocumentName("");
    setEditingNoteId(null);
    setIsSavingContact(false);
    setIsSavingDocument(false);
    setIsSavingNote(false);
    setNoteDraft("");
    setEditingNoteDraft("");
    setNoteError("");
    setNewContactDraft({
      name: "",
      role: "",
      phone: "",
      email: "",
      setAsPrimary: false,
    });
    setEditingContactDraft({
      name: "",
      role: "",
      phone: "",
      email: "",
      setAsPrimary: false,
    });
    setCompanyInfoDraft(toDraft(company));
  }, [company, initialTab, startAddingContact]);

  const tradeTitles = useMemo(() => getTradeTitles(company?.trade), [company?.trade]);

  const allTradeTitles = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const entry of [...tradeOptions.map(stripTradeCodePrefix), ...tradeTitles]) {
      const value = entry.trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      ordered.push(value);
    }
    return ordered;
  }, [tradeOptions, tradeTitles]);

  const orderedDraftTrades = useMemo(() => {
    const primary = companyInfoDraft.primaryTrade.trim();
    const remainder = companyInfoDraft.trades.filter((trade) => trade !== primary);
    return primary ? [primary, ...remainder] : companyInfoDraft.trades;
  }, [companyInfoDraft.primaryTrade, companyInfoDraft.trades]);
  const baselineDraft = company ? toDraft(company) : null;
  const hasUnsavedCompanyInfoChanges =
    Boolean(company) &&
    isEditingCompanyInfo &&
    Boolean(
      baselineDraft &&
      (
        companyInfoDraft.name !== baselineDraft.name ||
        companyInfoDraft.primaryTrade !== baselineDraft.primaryTrade ||
        companyInfoDraft.address !== baselineDraft.address ||
        companyInfoDraft.city !== baselineDraft.city ||
        companyInfoDraft.state !== baselineDraft.state ||
        companyInfoDraft.zip !== baselineDraft.zip ||
        companyInfoDraft.website !== baselineDraft.website ||
        companyInfoDraft.phone !== baselineDraft.phone ||
        companyInfoDraft.email !== baselineDraft.email ||
        companyInfoDraft.isActive !== baselineDraft.isActive ||
        orderedDraftTrades.join(" | ") !== baselineDraft.trades.join(" | ") ||
        Boolean(pendingTrade) ||
        Boolean(customTradeInput.trim())
      )
    );
  const hasStartedNewContact =
    Boolean(newContactDraft.name.trim()) ||
    Boolean(newContactDraft.role.trim()) ||
    Boolean(newContactDraft.phone.trim()) ||
    Boolean(newContactDraft.email.trim()) ||
    newContactDraft.setAsPrimary;
  const hasStartedEditingContact =
    Boolean(editingContactDraft.name.trim()) ||
    Boolean(editingContactDraft.role.trim()) ||
    Boolean(editingContactDraft.phone.trim()) ||
    Boolean(editingContactDraft.email.trim()) ||
    editingContactDraft.setAsPrimary;

  function requestClose() {
    if (isClosing) return;
    if (hasUnsavedCompanyInfoChanges) {
      setPendingClose(true);
      return;
    }
    setIsClosing(true);
  }

  function resetCompanyInfoDraft() {
    if (!company) return;
    setCompanyInfoError("");
    setIsEditingCompanyInfo(false);
    setPendingClose(false);
    setIsClosing(false);
    setPendingTrade("");
    setCustomTradeInput("");
    setCompanyInfoDraft(toDraft(company));
  }

  useEffect(() => {
    if (!company) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.paddingRight = previousBodyPaddingRight;
    };
  }, [company, hasUnsavedCompanyInfoChanges]);

  useEffect(() => {
    if (!company || !isClosing) return;
    const timeout = window.setTimeout(() => {
      onClose();
    }, 260);
    return () => window.clearTimeout(timeout);
  }, [company, isClosing, onClose]);

  useEffect(() => {
    if (!company || activeTab !== "bid-history") return;

    let active = true;
    const currentCompany = company;
    setBidHistoryError("");
    setIsLoadingBidHistory(true);

    async function loadBidHistory() {
      try {
        const projects = await listBidProjects();
        const details = await Promise.all(projects.map((project) => getBidProjectDetail(project.id)));

        if (!active) return;

        const companyName = normalizeCompareValue(currentCompany.name);
        const companyEmail = normalizeCompareValue(currentCompany.email);

        const rows = details
          .filter((detail): detail is NonNullable<typeof detail> => Boolean(detail))
          .flatMap((detail) => {
            const tradeById = new Map(detail.trades.map((trade) => [trade.id, trade.trade_name]));
            const matchingProjectSubs = detail.projectSubs.filter((projectSub) => {
              const sub = projectSub.subcontractor;
              if (!sub) return false;
              const subName = normalizeCompareValue(sub.company_name);
              const subEmail = normalizeCompareValue(sub.email);
              return (
                (companyName && subName === companyName) ||
                (companyEmail && subEmail === companyEmail)
              );
            });

            const matchingProjectSubIds = new Set(matchingProjectSubs.map((projectSub) => projectSub.id));
            const invitedAtByProjectSubId = new Map(
              matchingProjectSubs.map((projectSub) => [projectSub.id, projectSub.invited_at])
            );

            return detail.tradeBids
              .filter(
                (bid) => bid.status === "submitted" && matchingProjectSubIds.has(bid.project_sub_id)
              )
              .map((bid) => ({
                id: bid.id,
                projectName: detail.project.project_name,
                tradeName: stripTradeCodePrefix(tradeById.get(bid.trade_id) || "—"),
                invitedAt: invitedAtByProjectSubId.get(bid.project_sub_id) ?? null,
                status: "submitted" as const,
                amount: bid.bid_amount,
                outcome: "—" as const,
              }));
          })
          .sort((a, b) => {
            const aTime = a.invitedAt ? new Date(a.invitedAt).getTime() : 0;
            const bTime = b.invitedAt ? new Date(b.invitedAt).getTime() : 0;
            return bTime - aTime;
          });

        setBidHistoryRows(rows);
      } catch (error) {
        if (!active) return;
        setBidHistoryError(error instanceof Error ? error.message : "Failed to load bid history.");
      } finally {
        if (active) {
          setIsLoadingBidHistory(false);
        }
      }
    }

    void loadBidHistory();

    return () => {
      active = false;
    };
  }, [activeTab, company]);

  if (!company) return null;

  const subtitleParts = [tradeTitles[0] || "No trade selected", company.city, company.state].filter(Boolean);
  const subtitle = subtitleParts.join(" · ");
  const addressParts = [company.address, company.city, company.state, company.zip].filter(Boolean);
  const addressLabel = addressParts.length ? addressParts.join(", ") : "—";
  const displayIsActive = isEditingCompanyInfo ? companyInfoDraft.isActive : company.isActive;
  const { contacts: contactCards, notesWithoutContacts, documents: documentCards } = useMemo(
    () => parseCompanyContacts(company),
    [company]
  );
  const noteCards = useMemo(() => parseCompanyNotes(notesWithoutContacts), [notesWithoutContacts]);

  function addTradeToDraft(nextTrade: string) {
    const cleanedTrade = stripTradeCodePrefix(nextTrade).trim();
    if (!cleanedTrade) return;
    setCompanyInfoDraft((current) => {
      if (current.trades.includes(cleanedTrade)) {
        return current.primaryTrade ? current : { ...current, primaryTrade: cleanedTrade };
      }
      return {
        ...current,
        trades: [...current.trades, cleanedTrade],
        primaryTrade: current.primaryTrade || cleanedTrade,
      };
    });
  }

  async function handleSaveCompanyInfo() {
    if (!companyInfoDraft.name.trim()) {
      setCompanyInfoError("Company name is required.");
      return;
    }
    if (!orderedDraftTrades.length) {
      setCompanyInfoError("At least one trade is required.");
      return;
    }
    if (!companyInfoDraft.email.trim()) {
      setCompanyInfoError("Email is required.");
      return;
    }
    if (!companyInfoDraft.phone.trim()) {
      setCompanyInfoError("Phone is required.");
      return;
    }

    setCompanyInfoError("");
    setIsSavingCompanyInfo(true);
    try {
      await onSaveCompanyInfo({
        name: companyInfoDraft.name.trim(),
        trade: orderedDraftTrades.join(" | "),
        address: companyInfoDraft.address.trim() || undefined,
        city: companyInfoDraft.city.trim() || undefined,
        state: companyInfoDraft.state.trim() || undefined,
        zip: companyInfoDraft.zip.trim() || undefined,
        website: companyInfoDraft.website.trim() || undefined,
        phone: companyInfoDraft.phone.trim() || undefined,
        email: companyInfoDraft.email.trim() || undefined,
        isActive: companyInfoDraft.isActive,
      });
      setIsEditingCompanyInfo(false);
    } catch (error) {
      setCompanyInfoError(error instanceof Error ? error.message : "Failed to update company.");
    } finally {
      setIsSavingCompanyInfo(false);
    }
  }

  async function handleSaveContact() {
    if (!newContactDraft.name.trim()) {
      setContactError("Contact name is required.");
      return;
    }
    if (!newContactDraft.email.trim()) {
      setContactError("Email is required.");
      return;
    }

    setContactError("");
    setIsSavingContact(true);

    const nextContact: CompanyContactRecord = {
      id: crypto.randomUUID(),
      name: newContactDraft.name.trim(),
      role: newContactDraft.role.trim() || "Contact",
      email: newContactDraft.email.trim(),
      phone: newContactDraft.phone.trim(),
      isPrimary: newContactDraft.setAsPrimary || contactCards.length === 0,
    };

    const nextContacts = normalizeContacts(
      newContactDraft.setAsPrimary
        ? [...contactCards.map((contact) => ({ ...contact, isPrimary: false })), nextContact]
        : [...contactCards, nextContact]
    );
    const primaryContact = nextContacts.find((contact) => contact.isPrimary) ?? nextContacts[0];

    try {
      await onSaveCompanyContacts({
        contacts: nextContacts,
        notes: buildCompanyNotes(notesWithoutContacts, nextContacts, documentCards),
        primaryContact: primaryContact?.name || undefined,
        contactTitle: primaryContact?.role || undefined,
        email: primaryContact?.email || undefined,
        phone: primaryContact?.phone || undefined,
      });
      setNewContactDraft({
        name: "",
        role: "",
        phone: "",
        email: "",
        setAsPrimary: false,
      });
      setIsAddingContact(false);
    } catch (error) {
      setContactError(error instanceof Error ? error.message : "Failed to save contact.");
    } finally {
      setIsSavingContact(false);
    }
  }

  function startEditingContact(contact: CompanyContactRecord) {
    setContactError("");
    setIsAddingContact(false);
    setEditingContactId(contact.id);
    setEditingContactDraft({
      name: contact.name,
      role: contact.role,
      phone: contact.phone,
      email: contact.email,
      setAsPrimary: contact.isPrimary,
    });
  }

  async function handleUpdateContact(contactId: string) {
    if (!editingContactDraft.name.trim()) {
      setContactError("Contact name is required.");
      return;
    }
    if (!editingContactDraft.email.trim()) {
      setContactError("Email is required.");
      return;
    }

    setContactError("");
    setIsSavingContact(true);

    const nextContacts = normalizeContacts(
      contactCards.map((contact) =>
        contact.id === contactId
          ? {
              ...contact,
              name: editingContactDraft.name.trim(),
              role: editingContactDraft.role.trim() || "Contact",
              email: editingContactDraft.email.trim(),
              phone: editingContactDraft.phone.trim(),
              isPrimary: editingContactDraft.setAsPrimary,
            }
          : {
              ...contact,
              isPrimary: editingContactDraft.setAsPrimary ? false : contact.isPrimary,
            }
      )
    );
    const primaryContact = nextContacts.find((contact) => contact.isPrimary) ?? nextContacts[0];

    try {
      await onSaveCompanyContacts({
        contacts: nextContacts,
        notes: buildCompanyNotes(notesWithoutContacts, nextContacts, documentCards),
        primaryContact: primaryContact?.name || undefined,
        contactTitle: primaryContact?.role || undefined,
        email: primaryContact?.email || undefined,
        phone: primaryContact?.phone || undefined,
      });
      setEditingContactId(null);
      setEditingContactDraft({
        name: "",
        role: "",
        phone: "",
        email: "",
        setAsPrimary: false,
      });
    } catch (error) {
      setContactError(error instanceof Error ? error.message : "Failed to update contact.");
    } finally {
      setIsSavingContact(false);
    }
  }

  async function handleDeleteContact(contactId: string) {
    setContactError("");
    setIsSavingContact(true);

    const remainingContacts = normalizeContacts(contactCards.filter((contact) => contact.id !== contactId));
    const primaryContact = remainingContacts.find((contact) => contact.isPrimary) ?? remainingContacts[0];

    try {
      await onSaveCompanyContacts({
        contacts: remainingContacts,
        notes: buildCompanyNotes(notesWithoutContacts, remainingContacts, documentCards),
        primaryContact: primaryContact?.name ?? "",
        contactTitle: primaryContact?.role ?? "",
        email: primaryContact?.email ?? "",
        phone: primaryContact?.phone ?? "",
      });
      setEditingContactId(null);
      setEditingContactDraft({
        name: "",
        role: "",
        phone: "",
        email: "",
        setAsPrimary: false,
      });
    } catch (error) {
      setContactError(error instanceof Error ? error.message : "Failed to delete contact.");
    } finally {
      setIsSavingContact(false);
    }
  }

  async function handleSaveNote() {
    const trimmedNote = noteDraft.trim();
    if (!trimmedNote) {
      setNoteError("Note text is required.");
      return;
    }

    setNoteError("");
    setIsSavingNote(true);

    const nextNotes: CompanyNoteRecord[] = [
      {
        id: crypto.randomUUID(),
        body: trimmedNote,
        createdAt: new Date().toISOString(),
      },
      ...noteCards,
    ];

    try {
      await onSaveCompanyNotes({
        notes: buildCompanyNotes(serializeCompanyNotes(nextNotes), contactCards, documentCards),
      });
      setIsAddingNote(false);
      setNoteDraft("");
    } catch (error) {
      setNoteError(error instanceof Error ? error.message : "Failed to save note.");
    } finally {
      setIsSavingNote(false);
    }
  }

  async function handleUpdateNote(noteId: string) {
    const trimmedNote = editingNoteDraft.trim();
    if (!trimmedNote) {
      setNoteError("Note text is required.");
      return;
    }

    setNoteError("");
    setIsSavingNote(true);

    const nextNotes = noteCards.map((note) =>
      note.id === noteId
        ? {
            ...note,
            body: trimmedNote,
          }
        : note
    );

    try {
      await onSaveCompanyNotes({
        notes: buildCompanyNotes(serializeCompanyNotes(nextNotes), contactCards, documentCards),
      });
      setEditingNoteId(null);
      setEditingNoteDraft("");
    } catch (error) {
      setNoteError(error instanceof Error ? error.message : "Failed to update note.");
    } finally {
      setIsSavingNote(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    setNoteError("");
    setIsSavingNote(true);

    const nextNotes = noteCards.filter((note) => note.id !== noteId);

    try {
      await onSaveCompanyNotes({
        notes: buildCompanyNotes(serializeCompanyNotes(nextNotes), contactCards, documentCards),
      });
      setEditingNoteId(null);
      setEditingNoteDraft("");
    } catch (error) {
      setNoteError(error instanceof Error ? error.message : "Failed to delete note.");
    } finally {
      setIsSavingNote(false);
    }
  }

  async function handleUploadDocument(file: File) {
    setIsSavingDocument(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const nextDocuments: CompanyDocumentRecord[] = [
        {
          id: crypto.randomUUID(),
          name: file.name,
          kind: inferDocumentKind(file.name),
          uploadedAt: new Date().toISOString(),
          dataUrl,
        },
        ...documentCards,
      ];
      await onSaveCompanyDocuments({
        notes: buildCompanyNotes(notesWithoutContacts, contactCards, nextDocuments),
      });
    } finally {
      setIsSavingDocument(false);
      if (documentInputRef.current) {
        documentInputRef.current.value = "";
      }
    }
  }

  async function handleUpdateDocument(documentId: string) {
    const trimmedName = editingDocumentName.trim();
    if (!trimmedName) return;

    setIsSavingDocument(true);
    try {
      const nextDocuments = documentCards.map((document) =>
        document.id === documentId
          ? {
              ...document,
              name: trimmedName,
              kind: inferDocumentKind(trimmedName),
            }
          : document
      );
      await onSaveCompanyDocuments({
        notes: buildCompanyNotes(notesWithoutContacts, contactCards, nextDocuments),
      });
      setEditingDocumentId(null);
      setEditingDocumentName("");
    } finally {
      setIsSavingDocument(false);
    }
  }

  async function handleDeleteDocument(documentId: string) {
    setIsSavingDocument(true);
    try {
      const nextDocuments = documentCards.filter((document) => document.id !== documentId);
      await onSaveCompanyDocuments({
        notes: buildCompanyNotes(notesWithoutContacts, contactCards, nextDocuments),
      });
      setEditingDocumentId(null);
      setEditingDocumentName("");
    } finally {
      setIsSavingDocument(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close subcontractor profile"
        className={`absolute inset-0 bg-black/80 duration-300 ${
          isClosing ? "animate-out fade-out-0" : "animate-in fade-in-0"
        }`}
        onClick={requestClose}
      />

      <aside
        className={`absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col overflow-hidden border-l border-slate-200 bg-[#F8F8F7] shadow-2xl duration-300 ease-out sm:max-w-3xl ${
          isClosing ? "animate-out slide-out-to-right-full" : "animate-in slide-in-from-right-full"
        }`}
      >
        <div className="flex items-start justify-between gap-6 border-b border-slate-200 bg-white px-9 pb-0 pt-7">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[22px] font-semibold leading-none tracking-tight text-slate-950">
                {company.name}
              </h2>
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-semibold ${
                  displayIsActive
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                {displayIsActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>

            <div className="mt-1 flex flex-wrap items-center justify-end gap-3 pb-7">
              {isEditingCompanyInfo ? (
                <>
                  <button
                    type="button"
                    onClick={handleSaveCompanyInfo}
                    disabled={isSavingCompanyInfo}
                    className="inline-flex h-11 items-center gap-2 rounded-[16px] bg-[#356DFF] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#2456dc] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingCompanyInfo ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={resetCompanyInfoDraft}
                    className="inline-flex h-11 items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm hover:border-accent hover:bg-accent hover:text-accent-foreground"
                  >
                    Cancel
                  </button>
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap items-end gap-8">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`border-b-[3px] pb-1 text-[15px] font-semibold transition-colors ${
                      isActive
                        ? "border-[#356DFF] text-[#356DFF]"
                        : "border-transparent text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={requestClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close drawer"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-9 py-8">
          {activeTab === "company-info" ? (
            <div className="space-y-8">
              {companyInfoError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                  {companyInfoError}
                </div>
              ) : null}

              <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-soft-sm">
                {isEditingCompanyInfo ? (
                  <div className="space-y-6">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Company Details</div>

                    <div className="space-y-3">
                      <label className="text-[13px] font-semibold text-slate-950">Company name</label>
                      <input
                        value={companyInfoDraft.name}
                        onChange={(event) =>
                          setCompanyInfoDraft((current) => ({ ...current, name: event.target.value }))
                        }
                        className="h-10 w-full rounded-[20px] mt-2 border border-slate-200 bg-slate-100/40 px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
                      <div className="space-y-3">
                        <label className="text-[13px] font-semibold text-slate-950">Primary trade</label>
                        <TradeSearchSelect
                          value={companyInfoDraft.primaryTrade}
                          placeholder="Select trade"
                          options={allTradeTitles}
                          onSelect={(value) =>
                            setCompanyInfoDraft((current) => ({
                              ...current,
                              primaryTrade: value,
                              trades: current.trades.includes(value)
                                ? current.trades
                                : [value, ...current.trades],
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-[13px] font-semibold text-slate-950">Status</label>
                        <Select
                          value={companyInfoDraft.isActive ? "active" : "inactive"}
                          onValueChange={(value) =>
                            setCompanyInfoDraft((current) => ({ ...current, isActive: value === "active" }))
                          }
                        >
                          <SelectTrigger
                            size="field"
                            className="mt-2 h-10 w-full rounded-[20px] border border-slate-200 bg-white px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="min-w-[220px] rounded-2xl border border-slate-200 bg-white p-1 shadow-soft-md">
                            <SelectItem value="active" className="rounded-xl text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
                              Active
                            </SelectItem>
                            <SelectItem value="inactive" className="rounded-xl text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
                              Inactive
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[13px] font-semibold text-slate-950">Address</label>
                      <input
                        value={companyInfoDraft.address}
                        onChange={(event) =>
                          setCompanyInfoDraft((current) => ({ ...current, address: event.target.value }))
                        }
                        className="mt-2 h-10 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-3">
                        <label className="text-[13px] font-semibold text-slate-950">City</label>
                        <input
                          value={companyInfoDraft.city}
                          onChange={(event) =>
                            setCompanyInfoDraft((current) => ({ ...current, city: event.target.value }))
                          }
                          className="mt-2 h-10 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-[13px] font-semibold text-slate-950">State</label>
                        <input
                          value={companyInfoDraft.state}
                          onChange={(event) =>
                            setCompanyInfoDraft((current) => ({ ...current, state: event.target.value }))
                          }
                          className="mt-2 h-10 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-3">
                        <label className="text-[13px] font-semibold text-slate-950">Website</label>
                        <input
                          value={companyInfoDraft.website}
                          onChange={(event) =>
                            setCompanyInfoDraft((current) => ({ ...current, website: event.target.value }))
                          }
                          className="mt-2 h-10 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-[13px] font-semibold text-slate-950">Phone</label>
                        <input
                          value={companyInfoDraft.phone}
                          onChange={(event) =>
                            setCompanyInfoDraft((current) => ({ ...current, phone: event.target.value }))
                          }
                          className="mt-2 h-10 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[13px] font-semibold text-slate-950">Email</label>
                      <input
                        value={companyInfoDraft.email}
                        onChange={(event) =>
                          setCompanyInfoDraft((current) => ({ ...current, email: event.target.value }))
                        }
                        className="mt-2 h-10 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>
                    <div className="border-t border-slate-200 pt-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Additional Trades Performed</div>
                          <p className="mt-2 text-sm text-slate-500">
                            Add additional scopes this subcontractor regularly performs beyond their primary trade.
                          </p>
                        </div>
                        <div className="text-sm font-medium text-slate-500">{orderedDraftTrades.length} selected</div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2.5">
                        {orderedDraftTrades.map((trade) => {
                          const isPrimary = trade === companyInfoDraft.primaryTrade;
                          return (
                            <span
                              key={trade}
                              className={`inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[12px] font-semibold leading-none ${
                                isPrimary ? "text-[#356DFF]" : "text-slate-500"
                              }`}
                            >
                              <span>{trade}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setCompanyInfoDraft((current) => {
                                    const nextTrades = current.trades.filter((entry) => entry !== trade);
                                    return {
                                      ...current,
                                      trades: nextTrades,
                                      primaryTrade:
                                        current.primaryTrade === trade ? nextTrades[0] ?? "" : current.primaryTrade,
                                    };
                                  })
                                }
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-500"
                                aria-label={`Remove ${trade}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          );
                        })}
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(280px,0.95fr)_minmax(0,1.05fr)_128px]">
                        <TradeSearchSelect
                          value={pendingTrade}
                          placeholder="Add from list..."
                          options={allTradeTitles.filter((trade) => !companyInfoDraft.trades.includes(trade))}
                          onSelect={(trade) => {
                            addTradeToDraft(trade);
                            setPendingTrade("");
                          }}
                        />

                        <input
                          value={customTradeInput}
                          onChange={(event) => setCustomTradeInput(event.target.value)}
                          placeholder="Or type a custom trade..."
                          className="h-10 mt-2 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-5 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />

                        <button
                          type="button"
                          onClick={() => {
                            if (pendingTrade) {
                              addTradeToDraft(pendingTrade);
                              setPendingTrade("");
                              return;
                            }
                            if (customTradeInput.trim()) {
                              addTradeToDraft(customTradeInput);
                              setCustomTradeInput("");
                            }
                          }}
                          className="inline-flex h-10 mt-2 items-center justify-center gap-2 rounded-[20px] border border-slate-200 bg-white px-5 text-[15px] font-semibold text-slate-900 shadow-soft-sm hover:border-accent hover:bg-accent hover:text-accent-foreground"
                        >
                          <Plus className="h-5 w-5" />
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative grid gap-x-10 gap-y-8 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("company-info");
                        setCompanyInfoError("");
                        setIsEditingCompanyInfo(true);
                      }}
                      className="absolute right-0 top-0 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-soft-sm transition-colors hover:border-accent hover:bg-accent hover:text-accent-foreground"
                      aria-label="Edit company info"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Company</div>
                      <div className="mt-2 flex items-start gap-3 text-slate-950">
                        <Building2 className="mt-1 h-4 w-4 text-slate-400" />
                        <span className="text-[16px] font-medium leading-7">{company.name}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Status</div>
                      <div className="mt-2 text-[16px] font-medium leading-7 text-slate-950">
                        {company.isActive ? "Active" : "Inactive"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Address</div>
                      <div className="mt-2 flex items-start gap-3 text-slate-950">
                        <MapPin className="mt-1 h-4 w-4 text-slate-400" />
                        <span className="text-[16px] font-medium leading-7">{addressLabel}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Website</div>
                      <div className="mt-2 flex items-start gap-3 text-slate-950">
                        <Globe className="mt-1 h-4 w-4 text-slate-400" />
                        <span className="text-[16px] font-medium leading-7">{company.website || "—"}</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Phone</div>
                      <div className="mt-2 flex items-start gap-3 text-slate-950">
                        <Phone className="mt-1 h-4 w-4 text-slate-400" />
                        <span className="text-[16px] font-medium leading-7">{company.phone || "—"}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Email</div>
                      <div className="mt-2 flex items-start gap-3 text-slate-950">
                        <span className="text-[16px] font-medium leading-7">{company.email || "—"}</span>
                      </div>
                    </div>

                    <div className="md:col-span-2 border-t border-slate-200 pt-6">
                      <div className="text-[14px] font-medium uppercase tracking-wider text-slate-500">Trades</div>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {tradeTitles.length ? (
                          tradeTitles.map((trade, index) => (
                            <span
                              key={`${company.id}-${trade}`}
                              className={`inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-[14px] font-semibold leading-none ${
                                index === 0 ? "text-[#356DFF]" : "text-slate-500"
                              }`}
                            >
                              {trade}
                            </span>
                          ))
                        ) : (
                          <span className="text-[16px] text-slate-500">No trades listed.</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {projectPickerOpen ? (
                <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-soft-sm">
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Assign to Project</div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {allProjects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => onAssignProject(project.id)}
                        className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${
                          assignedProjects.some((entry) => entry.id === project.id)
                            ? "border-[#356DFF] bg-[#EEF2FF] text-[#356DFF]"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {project.name}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : activeTab === "contacts" ? (
            <div className="space-y-6">
              {contactError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                  {contactError}
                </div>
              ) : null}
              {contactCards.length ? (
                contactCards.map((contact) => (
                  <section
                    key={contact.id}
                    className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-soft-sm"
                  >
                    {editingContactId === contact.id ? (
                      <div className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                          <div className="space-y-3 md:col-span-2">
                            <label className="text-[12px] font-semibold text-slate-950">
                              Name <span className="text-rose-500">*</span>
                            </label>
                            <input
                              value={editingContactDraft.name}
                              onChange={(event) =>
                                setEditingContactDraft((current) => ({ ...current, name: event.target.value }))
                              }
                              className="h-9 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-6 text-sm font-medium text-slate-900 shadow-soft-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                          </div>

                          <div className="space-y-3">
                            <label className="text-[12px] font-semibold text-slate-950">Role</label>
                            <input
                              value={editingContactDraft.role}
                              onChange={(event) =>
                                setEditingContactDraft((current) => ({ ...current, role: event.target.value }))
                              }
                              className="h-9 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                          </div>

                          <div className="space-y-3">
                            <label className="text-[12px] font-semibold text-slate-950">Phone</label>
                            <input
                              value={editingContactDraft.phone}
                              onChange={(event) =>
                                setEditingContactDraft((current) => ({ ...current, phone: event.target.value }))
                              }
                              className="h-9 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                          </div>

                          <div className="space-y-3 md:col-span-2">
                            <label className="text-[12px] font-semibold text-slate-950">
                              Email <span className="text-rose-500">*</span>
                            </label>
                            <input
                              value={editingContactDraft.email}
                              onChange={(event) =>
                                setEditingContactDraft((current) => ({ ...current, email: event.target.value }))
                              }
                              className="h-9 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                          </div>
                        </div>

                        <label className="flex items-center gap-2 text-[14px] font-medium text-slate-500">
                          <input
                            type="checkbox"
                            checked={editingContactDraft.setAsPrimary}
                            onChange={(event) =>
                              setEditingContactDraft((current) => ({
                                ...current,
                                setAsPrimary: event.target.checked,
                              }))
                            }
                            className="h-4 w-4 rounded border border-slate-400 text-[#356DFF] focus:ring-2 focus:ring-blue-100"
                          />
                          <span>Set as primary contact</span>
                        </label>

                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleUpdateContact(contact.id)}
                            disabled={isSavingContact || !hasStartedEditingContact}
                            className="inline-flex h-10 items-center gap-3 rounded-[14px] bg-[#356DFF] px-3 text-sm font-semibold text-white shadow-sm hover:bg-[#2456dc] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" />
                            {isSavingContact ? "Saving..." : "Save Changes"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setContactError("");
                              setEditingContactId(null);
                              setEditingContactDraft({
                                name: "",
                                role: "",
                                phone: "",
                                email: "",
                                setAsPrimary: false,
                              });
                            }}
                            className="inline-flex h-10 items-center rounded-[14px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-soft-sm hover:border-accent hover:bg-accent hover:text-accent-foreground"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteContact(contact.id)}
                            disabled={isSavingContact}
                            className="inline-flex h-10 items-center rounded-[14px] border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-600 shadow-soft-sm hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Delete User
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-start gap-2">
                              <h3 className="text-[20px] font-bold tracking-tight text-slate-950">{contact.name}</h3>
                              {contact.isPrimary ? (
                                <span className="inline-flex rounded-full bg-[#EEF2FF] mt-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#356DFF]">
                                  Primary
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-[12px] font-medium text-slate-500">{contact.role}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => startEditingContact(contact)}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-soft-sm transition-colors hover:border-accent hover:bg-accent hover:text-accent-foreground"
                            aria-label={`Edit ${contact.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-3 grid gap-x-3 gap-y-5 md:grid-cols-2">
                          <div className="flex items-center gap-3 text-slate-500">
                            <Mail className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                            <span className="text-[14px] font-medium leading-7">{contact.email}</span>
                          </div>
                          <div className="flex items-center gap-3 text-slate-500">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                            <span className="text-[14px] font-medium leading-7">{contact.phone}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </section>
                ))
              ) : (
                <section className="rounded-[24px] border border-slate-200 bg-white p-8 text-center shadow-soft-sm">
                  <div className="text-lg font-semibold text-slate-900">No contacts added</div>
                  <p className="mt-2 text-sm text-slate-500">
                    Add a company contact to track who should receive bid invites and updates.
                  </p>
                </section>
              )}

              {isAddingContact ? (
                <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-soft-sm">
                  <div className="text-sm font-semibold tracking-tight text-slate-950">New Contact</div>

                  <div className="mt-8 space-y-6">
                    <div className="space-y-3">
                      <label className="text-[12px] font-semibold text-slate-950">
                        Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        value={newContactDraft.name}
                        onChange={(event) =>
                          setNewContactDraft((current) => ({ ...current, name: event.target.value }))
                        }
                        placeholder="e.g. Dana Lee"
                        className="h-9 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-6 text-sm font-medium text-slate-900 shadow-soft-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-3">
                        <label className="text-[12px] font-semibold text-slate-950">Role</label>
                        <input
                          value={newContactDraft.role}
                          onChange={(event) =>
                            setNewContactDraft((current) => ({ ...current, role: event.target.value }))
                          }
                          placeholder="e.g. PM"
                          className="h-9 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-[12px] font-semibold text-slate-950">Phone</label>
                        <input
                          value={newContactDraft.phone}
                          onChange={(event) =>
                            setNewContactDraft((current) => ({ ...current, phone: event.target.value }))
                          }
                          placeholder="(602) 555-0000"
                          className="h-9 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[12px] font-semibold text-slate-950">
                        Email <span className="text-rose-500">*</span>
                      </label>
                      <input
                        value={newContactDraft.email}
                        onChange={(event) =>
                          setNewContactDraft((current) => ({ ...current, email: event.target.value }))
                        }
                        placeholder="dana@company.com"
                        className="h-9 w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-6 text-[15px] font-medium text-slate-900 shadow-soft-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-[14px] font-medium text-slate-500">
                      <input
                        type="checkbox"
                        checked={newContactDraft.setAsPrimary}
                        onChange={(event) =>
                          setNewContactDraft((current) => ({
                            ...current,
                            setAsPrimary: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border border-slate-400 text-[#356DFF] focus:ring-2 focus:ring-blue-100"
                      />
                      <span>Set as primary contact</span>
                    </label>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleSaveContact}
                        disabled={isSavingContact || !hasStartedNewContact}
                        className="inline-flex h-10 items-center gap-3 rounded-[14px] bg-[#356DFF] px-3 text-sm font-semibold text-white shadow-sm hover:bg-[#2456dc] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        {isSavingContact ? "Saving..." : "Save Contact"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setContactError("");
                          setIsAddingContact(false);
                          setNewContactDraft({
                            name: "",
                            role: "",
                            phone: "",
                            email: "",
                            setAsPrimary: false,
                          });
                        }}
                        className="inline-flex h-10 items-center rounded-[14px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-soft-sm hover:border-accent hover:bg-accent hover:text-accent-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </section>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setContactError("");
                    setIsAddingContact(true);
                  }}
                  className="inline-flex h-9 w-full items-center justify-center gap-3 rounded-[20px] border border-slate-200 bg-white px-3 text-[16px] font-medium text-slate-900 shadow-soft-sm hover:border-accent hover:bg-accent hover:text-accent-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Add Contact
                </button>
              )}
            </div>
          ) : activeTab === "bid-history" ? (
            <div className="space-y-6">
              {bidHistoryError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                  {bidHistoryError}
                </div>
              ) : null}

              <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-soft-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-[820px] table-fixed">
                    <colgroup>
                      <col className="w-[24%]" />
                      <col className="w-[20%]" />
                      <col className="w-[18%]" />
                      <col className="w-[14%]" />
                      <col className="w-[16%]" />
                      <col className="w-[8%]" />
                    </colgroup>
                    <thead className="border-b border-slate-200 bg-slate-50/70 text-left">
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Project</th>
                        <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Trade</th>
                        <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Invited</th>
                        <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Status</th>
                        <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Amount</th>
                        <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingBidHistory ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                            Loading bid history...
                          </td>
                        </tr>
                      ) : bidHistoryRows.length ? (
                        bidHistoryRows.map((row) => (
                          <tr key={row.id} className="border-b border-slate-200 last:border-b-0">
                            <td className="px-3 py-2 text-medium font-semibold tracking-tight text-slate-950">
                              {row.projectName}
                            </td>
                            <td className="px-3 py-2 text-medium font-medium text-slate-500 whitespace-normal break-words leading-5">
                              {row.tradeName}
                            </td>
                            <td className="px-3 py-2 text-medium font-[11px] text-slate-500">
                              {row.invitedAt
                                ? new Date(row.invitedAt).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "—"}
                            </td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                Submitted
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-[14px] font-semibold text-slate-950">
                              {row.amount !== null
                                ? new Intl.NumberFormat("en-US", {
                                    style: "currency",
                                    currency: "USD",
                                    maximumFractionDigits: 0,
                                  }).format(row.amount)
                                : "—"}
                            </td>
                            <td className="px-3 py-2 text-[14px] font-semibold text-slate-400">{row.outcome}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                            No submitted bid history found for this subcontractor.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          ) : activeTab === "notes" ? (
            <div className="space-y-4">
              {noteError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                  {noteError}
                </div>
              ) : null}
              <section className="rounded-[24px] border border-amber-200 bg-amber-50/60 px-3 py-2 shadow-soft-sm">
                <div className="flex items-center gap-3 text-xs font-medium text-amber-900">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
                  <span>Internal notes only — never visible to subcontractors.</span>
                </div>
              </section>

              {noteCards.length ? (
                noteCards.map((note) => (
                  <section
                    key={`${company.id}-${note.id}`}
                    className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-soft-sm"
                  >
                    {editingNoteId === note.id ? (
                      <div className="space-y-4">
                        <textarea
                          value={editingNoteDraft}
                          onChange={(event) => setEditingNoteDraft(event.target.value)}
                          rows={3}
                          className="min-h-[120px] w-full resize-none rounded-[20px] border border-blue-500 bg-white px-5 py-4 text-sm font-medium leading-7 text-slate-900 shadow-soft-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleUpdateNote(note.id)}
                            disabled={isSavingNote || !editingNoteDraft.trim()}
                            className="inline-flex h-10 items-center gap-3 rounded-[14px] bg-[#356DFF] px-3 text-sm font-semibold text-white shadow-sm hover:bg-[#2456dc] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" />
                            {isSavingNote ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNoteError("");
                              setEditingNoteId(null);
                              setEditingNoteDraft("");
                            }}
                            className="inline-flex h-10 items-center rounded-[14px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-soft-sm hover:border-accent hover:bg-accent hover:text-accent-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium leading-7 text-slate-900">{note.body}</p>
                        <div className="mt-2 flex items-center justify-between gap-4">
                          {note.createdAt ? (
                            <div className="text-[11px] font-medium text-slate-500">
                              {new Date(note.createdAt).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </div>
                          ) : (
                            <div />
                          )}
                          <div className="flex items-center gap-1 text-slate-500">
                            <button
                              type="button"
                              onClick={() => {
                                setNoteError("");
                                setIsAddingNote(false);
                                setEditingNoteId(note.id);
                                setEditingNoteDraft(note.body);
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-accent hover:text-accent-foreground"
                              aria-label="Edit note"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteNote(note.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-accent hover:text-accent-foreground"
                              aria-label="Delete note"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </section>
                ))
              ) : (
                <section className="rounded-[24px] border border-slate-200 bg-white p-5 text-center shadow-soft-sm">
                  <div className="text-medium font-semibold text-slate-900">No internal notes yet</div>
                  <p className="mt-2 text-sm text-slate-500">
                    Add private notes for your team about this subcontractor.
                  </p>
                </section>
              )}

              {isAddingNote ? (
                <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-soft-sm">
                  <div className="text-sm font-semibold tracking-tight text-slate-950">New Note</div>
                  <div className="mt-5 space-y-4">
                    <textarea
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      placeholder="Type an internal note..."
                      rows={5}
                      className="w-full rounded-[20px] border border-slate-200 bg-slate-100/40 px-5 py-4 text-sm font-medium text-slate-900 shadow-soft-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleSaveNote}
                        disabled={isSavingNote || !noteDraft.trim()}
                        className="inline-flex h-10 items-center gap-3 rounded-[14px] bg-[#356DFF] px-3 text-sm font-semibold text-white shadow-sm hover:bg-[#2456dc] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        {isSavingNote ? "Saving..." : "Save Note"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNoteError("");
                          setIsAddingNote(false);
                          setNoteDraft("");
                        }}
                        className="inline-flex h-10 items-center rounded-[14px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-soft-sm hover:border-accent hover:bg-accent hover:text-accent-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </section>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNoteError("");
                    setEditingNoteId(null);
                    setEditingNoteDraft("");
                    setIsAddingNote(true);
                  }}
                  className="inline-flex h-9 w-full items-center justify-center gap-3 rounded-[20px] border border-slate-200 bg-white px-3 text-[16px] font-medium text-slate-900 shadow-soft-sm hover:border-accent hover:bg-accent hover:text-accent-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Add Note
                </button>
              )}
            </div>
          ) : activeTab === "documents" ? (
            <div className="space-y-4">
              {documentCards.length ? (
                documentCards.map((document) => (
                  <section
                    key={`${company.id}-${document.id}`}
                    className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-soft-sm"
                  >
                    {editingDocumentId === document.id ? (
                      <div className="space-y-4">
                        <div className="flex items-start gap-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[20px] bg-[#EEF2FF] text-[#356DFF]">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <input
                              value={editingDocumentName}
                              onChange={(event) => setEditingDocumentName(event.target.value)}
                              className="h-10 w-full rounded-[20px] border border-blue-500 bg-white px-5 text-sm font-semibold text-slate-950 shadow-soft-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                            <div className="mt-2 text-[11px] font-medium text-slate-500">
                              {document.kind} · Uploaded{" "}
                              {new Date(document.uploadedAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                              {document.expiresAt
                                ? ` · Expires ${new Date(document.expiresAt).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}`
                                : ""}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleUpdateDocument(document.id)}
                            disabled={isSavingDocument || !editingDocumentName.trim()}
                            className="inline-flex h-10 items-center gap-3 rounded-[14px] bg-[#356DFF] px-3 text-sm font-semibold text-white shadow-sm hover:bg-[#2456dc] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" />
                            {isSavingDocument ? "Saving..." : "Save Changes"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDocumentId(null);
                              setEditingDocumentName("");
                            }}
                            className="inline-flex h-10 items-center rounded-[14px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-soft-sm hover:border-accent hover:bg-accent hover:text-accent-foreground"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteDocument(document.id)}
                            disabled={isSavingDocument}
                            className="inline-flex h-10 items-center rounded-[14px] border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-600 shadow-soft-sm hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Delete File
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[20px] bg-[#EEF2FF] text-[#356DFF]">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-950">{document.name}</div>
                            <div className="text-[11px] font-medium text-slate-500">
                              {document.kind} · Uploaded{" "}
                              {new Date(document.uploadedAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                              {document.expiresAt
                                ? ` · Expires ${new Date(document.expiresAt).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}`
                                : ""}
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDocumentId(document.id);
                              setEditingDocumentName(document.name);
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-accent hover:text-accent-foreground"
                            aria-label={`Edit ${document.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDocumentPreview(document.dataUrl)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-accent hover:text-accent-foreground"
                            aria-label={`Open ${document.name}`}
                          >
                            <ArrowUpRight className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                ))
              ) : (
                <section className="rounded-[24px] border border-slate-200 bg-white p-5 text-center shadow-soft-sm">
                  <div className="text-medium font-semibold text-slate-900">No documents uploaded</div>
                  <p className="mt-2 text-sm text-slate-500">
                    Upload licenses, tax forms, insurance, and other subcontractor documents.
                  </p>
                </section>
              )}

              <input
                ref={documentInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void handleUploadDocument(file);
                }}
              />
              <button
                type="button"
                disabled={isSavingDocument}
                onClick={() => documentInputRef.current?.click()}
                className="inline-flex h-9 w-full items-center justify-center gap-3 rounded-[20px] border border-slate-200 bg-white px-3 text-[16px] font-medium text-slate-900 shadow-soft-sm hover:border-accent hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {isSavingDocument ? "Uploading..." : "Upload Document"}
              </button>
            </div>
          ) : (
            <section className="rounded-[24px] border border-slate-200 bg-white p-8 text-center shadow-soft-sm">
              <div className="text-lg font-semibold text-slate-900">{TABS.find((tab) => tab.id === activeTab)?.label}</div>
              <p className="mt-2 text-sm text-slate-500">This section is not wired yet in the drawer.</p>
            </section>
          )}
        </div>
      </aside>

      {pendingClose ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Leave without saving?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              You have unsaved company changes. If you leave now, those changes will be lost.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                onClick={() => setPendingClose(false)}
              >
                Stay
              </button>
              <button
                type="button"
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
                onClick={() => {
                  setPendingClose(false);
                  resetCompanyInfoDraft();
                  setIsClosing(true);
                }}
              >
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
