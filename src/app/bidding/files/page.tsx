"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import BiddingTabPageHeader from "@/components/bidding-tab-page-header";
import {
  CheckCircle2,
  ChevronDown,
  Ellipsis,
  Eye,
  FileText,
  FolderOpen,
  Search,
  Star,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";

type FileSectionKey = "drawings" | "documents" | "specifications";
type FileStatus = "Current" | "Updated";
type FileCategory = "Drawing" | "Spec" | "Document";

type UploadedBidFile = {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  section: FileSectionKey;
  url: string;
};

type PackageChange = {
  id: string;
  label: string;
  tone: "neutral" | "danger";
  detail?: string;
};

const BID_PACKAGE_FILES_STORAGE_KEY = "bidding-package-files-v1";

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
        if (!item || typeof item !== "object") return [];
        const row = item as Partial<UploadedBidFile>;
        if (
          typeof row.id !== "string" ||
          typeof row.name !== "string" ||
          typeof row.size !== "number" ||
          typeof row.uploadedAt !== "string" ||
          typeof row.url !== "string" ||
          (row.section !== "drawings" &&
            row.section !== "documents" &&
            row.section !== "specifications")
        ) {
          return [];
        }
        return [
          {
            id: row.id,
            name: row.name,
            size: row.size,
            uploadedAt: row.uploadedAt,
            section: row.section,
            url: row.url,
          },
        ];
      });
    }
    return next;
  } catch {
    return {};
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getCategoryFromSection(section: FileSectionKey): FileCategory {
  if (section === "drawings") return "Drawing";
  if (section === "specifications") return "Spec";
  return "Document";
}

function getSectionLabel(section: FileSectionKey) {
  if (section === "drawings") return "Drawings";
  if (section === "specifications") return "Specifications";
  return "Documents";
}

function getFileAccent(section: FileSectionKey) {
  if (section === "drawings") return "text-rose-500";
  if (section === "specifications") return "text-cyan-700";
  return "text-blue-600";
}

function getStatusClasses(status: FileStatus) {
  return status === "Current"
    ? "bg-emerald-500 text-white"
    : "bg-amber-400 text-white";
}

function getChangeIcon(tone: PackageChange["tone"]) {
  return tone === "danger" ? (
    <FileText className="h-4 w-4 text-rose-500" />
  ) : (
    <FileText className="h-4 w-4 text-slate-400" />
  );
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

function openUploadedFile(file: UploadedBidFile) {
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
}

export default function BiddingFilesPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project") ?? "";
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All Types" | FileCategory>("All Types");
  const [statusFilter, setStatusFilter] = useState<"All" | FileStatus>("All");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [packageFiles, setPackageFiles] = useState<UploadedBidFile[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<FileSectionKey, boolean>>({
    drawings: false,
    documents: false,
    specifications: false,
  });

  useEffect(() => {
    if (!projectId) {
      setPackageFiles([]);
      return;
    }
    setPackageFiles(readBidPackageFilesMap()[projectId] ?? []);
  }, [projectId]);

  const filteredFiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return packageFiles.filter((file) => {
      const category = getCategoryFromSection(file.section);
      if (typeFilter !== "All Types" && category !== typeFilter) return false;
      if (statusFilter !== "All" && "Current" !== statusFilter) return false;
      if (!query) return true;
      return `${file.name} ${category} ${file.section}`.toLowerCase().includes(query);
    });
  }, [packageFiles, searchQuery, statusFilter, typeFilter]);

  const filesBySection = useMemo(
    () =>
      (["drawings", "specifications", "documents"] as FileSectionKey[]).map((section) => ({
        section,
        files: filteredFiles.filter((file) => file.section === section),
      })),
    [filteredFiles]
  );
  const recentPackageChanges = useMemo<PackageChange[]>(
    () =>
      [...packageFiles]
        .sort(
          (a, b) =>
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        )
        .slice(0, 8)
        .map((file) => ({
          id: `added-${file.id}`,
          label: `Added: ${file.name}`,
          tone: "neutral",
          detail: `${getSectionLabel(file.section)} · ${new Date(file.uploadedAt).toLocaleString()}`,
        })),
    [packageFiles]
  );

  const hasSelection = selectedIds.length > 0;

  return (
    <main className="space-y-6 bg-slate-50 px-4 pb-6 pt-[2px] sm:px-6">
      <BiddingTabPageHeader label="Files" />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-[20px] font-semibold text-slate-900">Package Files</h2>
          </div>

          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-3 lg:flex-row">
              <label className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search files"
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                />
              </label>

              <label className="relative w-full max-w-[210px]">
                <select
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(event.target.value as "All Types" | FileCategory)
                  }
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-3 pr-10 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="All Types">Filter: All Types</option>
                  <option value="Drawing">Filter: Drawings</option>
                  <option value="Spec">Filter: Specs</option>
                  <option value="Document">Filter: Documents</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </label>

              <label className="relative w-full max-w-[190px]">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as "All" | FileStatus)}
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-3 pr-10 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="All">Status: All</option>
                  <option value="Current">Status: Current</option>
                  <option value="Updated">Status: Updated</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead className="bg-slate-100/90 text-slate-600">
                <tr>
                  <th className="w-12 border-b border-slate-200 px-4 py-4 text-left font-semibold"></th>
                  <th className="border-b border-slate-200 px-4 py-4 text-left font-semibold">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      File Name
                    </div>
                  </th>
                  <th className="border-b border-slate-200 px-4 py-4 text-left font-semibold">Category</th>
                  <th className="border-b border-slate-200 px-4 py-4 text-left font-semibold">Version</th>
                  <th className="border-b border-slate-200 px-4 py-4 text-left font-semibold">Added By</th>
                  <th className="border-b border-slate-200 px-4 py-4 text-left font-semibold">Status</th>
                  <th className="border-b border-slate-200 px-4 py-4 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filesBySection.map(({ section, files }) => (
                  <FileSectionGroup
                    key={section}
                    section={section}
                    files={files}
                    collapsed={collapsedSections[section]}
                    onToggle={() =>
                      setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }))
                    }
                    selectedIds={selectedIds}
                    onToggleSelected={(fileId) =>
                      setSelectedIds((prev) =>
                        prev.includes(fileId)
                          ? prev.filter((id) => id !== fileId)
                          : [...prev, fileId]
                      )
                    }
                  />
                ))}
                {!packageFiles.length ? (
                  <tr className="bg-white">
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">
                      No package files have been uploaded for this bid package yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h3 className="text-[18px] font-semibold text-slate-900">Recent Package Changes</h3>
            </div>
            <div className="px-6 py-4">
              {recentPackageChanges.length ? (
                <div className="space-y-1">
                  {recentPackageChanges.map((change) => (
                    <div
                      key={change.id}
                      className="flex items-start gap-3 border-b border-slate-100 py-4 last:border-b-0"
                    >
                      <div className="pt-0.5">{getChangeIcon(change.tone)}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700">{change.label}</p>
                        {change.detail ? (
                          <p className="mt-1 text-xs text-slate-500">{change.detail}</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-2 text-sm text-slate-500">
                  No package changes yet.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <SidebarAction icon={FolderOpen} label="Add from Project Files" disabled={!hasSelection} />
            <SidebarAction icon={Upload} label="Upload New File" />
            <SidebarAction icon={Star} label="Remove from Package" disabled={!hasSelection} danger />
            <SidebarAction icon={Wrench} label="Replace File" disabled={!hasSelection} />
            <SidebarAction icon={CheckCircle2} label="Mark as Updated" disabled={!hasSelection} />
          </div>
        </aside>
      </section>
    </main>
  );
}

function FileSectionGroup({
  section,
  files,
  collapsed,
  onToggle,
  selectedIds,
  onToggleSelected,
}: {
  section: FileSectionKey;
  files: UploadedBidFile[];
  collapsed: boolean;
  onToggle: () => void;
  selectedIds: string[];
  onToggleSelected: (fileId: string) => void;
}) {
  return (
    <>
      <tr className="bg-white">
        <td colSpan={7} className="border-b border-slate-200 px-4 py-4">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-3 text-left text-[18px] font-semibold text-slate-900"
          >
            <ChevronDown className={`h-5 w-5 transition-transform ${collapsed ? "-rotate-90" : "rotate-0"}`} />
            {getSectionLabel(section)}
          </button>
        </td>
      </tr>

      {!collapsed
        ? files.map((file) => {
            const isSelected = selectedIds.includes(file.id);
            return (
              <tr key={file.id} className="bg-white hover:bg-slate-50/60">
                <td className="border-b border-slate-200 px-4 py-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelected(file.id)}
                    className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="border-b border-slate-200 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <FileText className={`h-7 w-7 ${getFileAccent(file.section)}`} />
                    <div>
                      <div className="text-[16px] font-medium text-slate-800">{file.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatFileSize(file.size)} · Uploaded{" "}
                        {new Date(file.uploadedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="border-b border-slate-200 px-4 py-4 text-[15px] text-slate-700">
                  {getCategoryFromSection(file.section)}
                </td>
                <td className="border-b border-slate-200 px-4 py-4 text-[15px] font-medium text-slate-700">
                  v1
                </td>
                <td className="border-b border-slate-200 px-4 py-4 text-[15px] font-medium text-slate-700">
                  Package Upload
                </td>
                <td className="border-b border-slate-200 px-4 py-4">
                  <span
                    className={`inline-flex rounded-md px-4 py-1.5 text-sm font-semibold ${getStatusClasses(
                      "Current"
                    )}`}
                  >
                    Current
                  </span>
                </td>
                <td className="border-b border-slate-200 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openUploadedFile(file)}
                      className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      aria-label={`More actions for ${file.name}`}
                    >
                      <Ellipsis className="h-5 w-5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })
        : null}
    </>
  );
}

function SidebarAction({
  icon: Icon,
  label,
  disabled = false,
  danger = false,
}: {
  icon: typeof FolderOpen;
  label: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-2xl border px-5 py-4 text-left text-[17px] font-semibold shadow-sm transition ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
          : danger
            ? "border-slate-200 bg-white text-slate-700 hover:border-rose-200 hover:text-rose-700"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {danger ? <Trash2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
      {label}
    </button>
  );
}
