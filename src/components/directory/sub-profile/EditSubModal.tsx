"use client";

import { useEffect, useMemo, useState } from "react";
import CompanyFormModal, {
  type CompanyFormDraft,
  type TradeSelection,
} from "@/components/directory/company-form-modal";
import type { SubProfileCompany } from "@/components/directory/sub-profile/types";
import { listCompanyCostCodesForCurrentCompany, type CompanyCostCode } from "@/lib/bidding/store";

type EditDraft = {
  company_name: string;
  trade: string;
  contact_title: string;
  vendor_type: string | null;
  primary_contact: string;
  email: string;
  phone: string;
  office_phone: string;
  status: "Active" | "Inactive";
  address: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
};

type Props = {
  open: boolean;
  company: SubProfileCompany | null;
  error: string;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: EditDraft) => void;
};

export type { EditDraft };

function normalizeTradeValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function tradeSelectionKey(selection: TradeSelection): string {
  if (selection.type === "cost_code" && selection.id) return `cost_code:${selection.id}`;
  return `custom:${normalizeTradeValue(selection.code ? `${selection.code} ${selection.title}` : selection.title)}`;
}

function selectionLabel(selection: TradeSelection): string {
  if (selection.type === "cost_code") {
    return `${selection.code ?? ""}${selection.title ? ` ${selection.title}` : ""}`.trim();
  }
  return selection.title.trim();
}

function dedupeTradeSelections(selections: TradeSelection[]): TradeSelection[] {
  const seen = new Set<string>();
  const next: TradeSelection[] = [];
  for (const selection of selections) {
    const key = tradeSelectionKey(selection);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(selection);
  }
  return next;
}

function parseTradeSelectionsFromValue(value?: string | null): TradeSelection[] {
  if (!value?.trim()) return [];
  return dedupeTradeSelections(
    value
      .split(/\s*\|\s*|\s*;\s*|\s*,\s*/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => ({
        type: "custom" as const,
        title: entry,
      }))
  );
}

function alignSelectionsToCostCodes(
  selections: TradeSelection[],
  costCodes: CompanyCostCode[]
): TradeSelection[] {
  if (!selections.length || !costCodes.length) return selections;
  const byLabel = new Map(
    costCodes.map((code) => [
      normalizeTradeValue(`${code.code}${code.title ? ` ${code.title}` : ""}`.trim()),
      code,
    ])
  );
  return dedupeTradeSelections(
    selections.map((selection) => {
      if (selection.type === "cost_code" && selection.id) return selection;
      const matchedCode = byLabel.get(normalizeTradeValue(selectionLabel(selection)));
      if (!matchedCode) return selection;
      return {
        type: "cost_code",
        id: matchedCode.id,
        code: matchedCode.code,
        title: matchedCode.title ?? "",
        division: matchedCode.division ?? undefined,
      };
    })
  );
}

function toCompanyFormDraft(company: SubProfileCompany | null): CompanyFormDraft {
  if (!company) {
    return {
      companyName: "",
      trades: [],
      contactTitle: "",
      primaryContact: "",
      email: "",
      cellPhone: "",
      officePhone: "",
      vendorType: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      notes: "",
      isActive: true,
    };
  }
  return {
    companyName: company.company_name ?? "",
    trades: parseTradeSelectionsFromValue(company.trade),
    contactTitle: company.contact_title ?? "",
    primaryContact: company.primary_contact ?? "",
    email: company.email ?? "",
    cellPhone: company.phone ?? "",
    officePhone: company.office_phone ?? "",
    vendorType:
      company.vendor_type === "Approved Vendor" || company.vendor_type === "Bidding Only"
        ? company.vendor_type
        : "",
    address: company.address ?? "",
    city: company.city ?? "",
    state: company.state ?? "",
    zip: company.zip ?? "",
    notes: company.notes ?? "",
    isActive: company.status !== "Inactive",
  };
}

export default function EditSubModal({ open, company, error, saving, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<CompanyFormDraft>(() => toCompanyFormDraft(company));
  const [costCodeOptions, setCostCodeOptions] = useState<CompanyCostCode[]>([]);
  const [loadingCostCodes, setLoadingCostCodes] = useState(false);
  const [costCodeError, setCostCodeError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(toCompanyFormDraft(company));
  }, [company, open]);

  useEffect(() => {
    let active = true;
    async function loadCostCodes() {
      if (!open) return;
      setLoadingCostCodes(true);
      setCostCodeError("");
      try {
        const codes = await listCompanyCostCodesForCurrentCompany({ includeInactive: true });
        if (!active) return;
        setCostCodeOptions(codes);
      } catch {
        if (!active) return;
        setCostCodeOptions([]);
        setCostCodeError("Unable to load cost codes from Settings.");
      } finally {
        if (active) setLoadingCostCodes(false);
      }
    }
    void loadCostCodes();
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !costCodeOptions.length) return;
    setDraft((prev) => ({
      ...prev,
      trades: alignSelectionsToCostCodes(prev.trades, costCodeOptions),
    }));
  }, [costCodeOptions, open]);

  if (!open || !company) return null;

  return (
    <CompanyFormModal
      open={open}
      title="Edit Company"
      draft={draft}
      costCodeOptions={costCodeOptions}
      loadingCostCodes={loadingCostCodes}
      costCodeError={costCodeError}
      error={error}
      saving={saving}
      onClose={onClose}
      onChange={setDraft}
      onSave={() =>
        onSave({
          company_name: draft.companyName.trim(),
          trade: dedupeTradeSelections(draft.trades).map(selectionLabel).join(" | "),
          contact_title: draft.contactTitle.trim(),
          vendor_type: draft.vendorType || null,
          primary_contact: draft.primaryContact.trim(),
          email: draft.email.trim(),
          phone: draft.cellPhone.trim(),
          office_phone: draft.officePhone.trim(),
          status: draft.isActive ? "Active" : "Inactive",
          address: draft.address.trim(),
          city: draft.city.trim(),
          state: draft.state.trim(),
          zip: draft.zip.trim(),
          notes: draft.notes.trim(),
        })
      }
    />
  );
}

