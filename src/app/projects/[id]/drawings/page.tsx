"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

const Document = dynamic(() => import("react-pdf").then((mod) => mod.Document), {
  ssr: false,
});
const Page = dynamic(() => import("react-pdf").then((mod) => mod.Page), {
  ssr: false,
});

type DrawingFile = {
  id: string;
  drawingGroupId: string;
  name: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  discipline: string;
  version: string;
  versionNumber: number;
  isCurrent: boolean;
  revisionNote?: string;
  supersededAt?: string;
  objectUrl?: string;
};

const MOCK_FILES: DrawingFile[] = [];
const DISCIPLINES = [
  "All",
  "Architectural",
  "Structural",
  "Civil",
  "Mechanical",
  "Electrical",
  "Plumbing",
  "Fire Protection",
  "Low Voltage",
  "Other",
];

export default function DrawingsPage() {
  const [files, setFiles] = useState<DrawingFile[]>(
    () =>
      MOCK_FILES.map((file) => ({
        ...file,
        drawingGroupId: file.drawingGroupId ?? file.id,
        versionNumber: file.versionNumber ?? 1,
        isCurrent: file.isCurrent ?? true,
      })) as DrawingFile[]
  );
  const [showUpload, setShowUpload] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewerFile, setViewerFile] = useState<DrawingFile | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [search, setSearch] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState("All");
  const [sort, setSort] = useState("newest");
  const [showOldVersions, setShowOldVersions] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [versionTarget, setVersionTarget] = useState<DrawingFile | null>(null);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionNote, setVersionNote] = useState("");
  const [versionError, setVersionError] = useState<string | null>(null);

  useEffect(() => {
    import("react-pdf").then(({ pdfjs }) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
    });
  }, []);

  const totalSize = useMemo(
    () => queuedFiles.reduce((sum, file) => sum + file.size, 0),
    [queuedFiles]
  );

  const filteredFiles = useMemo(() => {
    const base = showOldVersions ? files : files.filter((file) => file.isCurrent);
    const bySearch = base.filter((file) =>
      file.name.toLowerCase().includes(search.trim().toLowerCase())
    );
    const byDiscipline =
      disciplineFilter === "All"
        ? bySearch
        : bySearch.filter((file) => file.discipline === disciplineFilter);

    const sorted = [...byDiscipline];
    const compare = (a: DrawingFile, b: DrawingFile) => {
      if (sort === "oldest") {
        return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      }
      if (sort === "name-asc") return a.name.localeCompare(b.name);
      if (sort === "name-desc") return b.name.localeCompare(a.name);
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    };
    sorted.sort(compare);

    if (!showOldVersions) return sorted;

    const grouped = new Map<string, DrawingFile[]>();
    sorted.forEach((file) => {
      const list = grouped.get(file.drawingGroupId) ?? [];
      list.push(file);
      grouped.set(file.drawingGroupId, list);
    });
    const flattened: DrawingFile[] = [];
    grouped.forEach((list) => {
      const current = list.find((item) => item.isCurrent) ?? list[0];
      const others = list
        .filter((item) => item.id !== current.id)
        .sort((a, b) => b.versionNumber - a.versionNumber);
      flattened.push(current, ...others);
    });
    return flattened;
  }, [files, search, disciplineFilter, sort, showOldVersions]);

  const visibleIds = useMemo(() => filteredFiles.map((file) => file.id), [filteredFiles]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) return new Set();
      return new Set(visibleIds);
    });
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let idx = 0;
    while (size >= 1024 && idx < units.length - 1) {
      size /= 1024;
      idx += 1;
    }
    return `${size.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
  };

  const handleFileSelect = (incoming: FileList | null) => {
    if (!incoming) return;
    const next: File[] = [];
    let invalid = false;
    Array.from(incoming).forEach((file) => {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        invalid = true;
        return;
      }
      next.push(file);
    });
    if (invalid) {
      setError("Only PDF files are supported right now.");
    } else {
      setError(null);
    }
    if (next.length) {
      setQueuedFiles((prev) => [...prev, ...next]);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFileSelect(event.dataTransfer.files);
  };

  const handleUpload = () => {
    if (!queuedFiles.length) return;
    const now = new Date();
    const uploads: DrawingFile[] = queuedFiles.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      drawingGroupId: `group-${Date.now()}-${index}`,
      name: file.name,
      size: file.size,
      uploadedAt: now.toISOString(),
      uploadedBy: "You",
      discipline: "Other",
      version: "v1",
      versionNumber: 1,
      isCurrent: true,
      objectUrl: URL.createObjectURL(file),
    }));
    setFiles((prev) => [...uploads, ...prev]);
    setQueuedFiles([]);
    setError(null);
    setShowUpload(false);
  };

  const openViewer = (file: DrawingFile) => {
    setViewerFile(file);
    setPageNumber(1);
    setNumPages(0);
    setScale(1);
  };

  const openNewVersionModal = (file: DrawingFile) => {
    setVersionTarget(file);
    setVersionFile(null);
    setVersionNote("");
    setVersionError(null);
    setShowNewVersionModal(true);
  };

  const handleVersionUpload = () => {
    if (!versionTarget || !versionFile) return;
    if (
      versionFile.type !== "application/pdf" &&
      !versionFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setVersionError("Only PDF files are supported right now.");
      return;
    }
    const now = new Date();
    const groupFiles = files.filter(
      (file) => file.drawingGroupId === versionTarget.drawingGroupId
    );
    const nextVersion =
      groupFiles.reduce((max, file) => Math.max(max, file.versionNumber), 0) + 1;
    const newEntry: DrawingFile = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      drawingGroupId: versionTarget.drawingGroupId,
      name: versionFile.name,
      size: versionFile.size,
      uploadedAt: now.toISOString(),
      uploadedBy: "You",
      discipline: versionTarget.discipline,
      version: `v${nextVersion}`,
      versionNumber: nextVersion,
      isCurrent: true,
      revisionNote: versionNote.trim() || undefined,
      objectUrl: URL.createObjectURL(versionFile),
    };
    setFiles((prev) =>
      prev
        .map((file) =>
          file.drawingGroupId === versionTarget.drawingGroupId
            ? { ...file, isCurrent: false, supersededAt: now.toISOString() }
            : file
        )
        .concat(newEntry)
    );
    setShowNewVersionModal(false);
  };

  const handleDeleteSelected = () => {
    setFiles((prev) => {
      const remaining = prev.filter((file) => !selectedIds.has(file.id));
      const grouped = new Map<string, DrawingFile[]>();
      remaining.forEach((file) => {
        const list = grouped.get(file.drawingGroupId) ?? [];
        list.push(file);
        grouped.set(file.drawingGroupId, list);
      });
      const normalized: DrawingFile[] = [];
      grouped.forEach((list) => {
        const current = list.find((item) => item.isCurrent);
        if (current) {
          normalized.push(...list);
          return;
        }
        const latest = list.sort((a, b) => b.versionNumber - a.versionNumber)[0];
        normalized.push(
          ...list.map((item) =>
            item.id === latest.id
              ? { ...item, isCurrent: true, supersededAt: undefined }
              : item
          )
        );
      });
      return normalized;
    });
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
  };

  const currentVersionFor = (file: DrawingFile) =>
    files.find(
      (entry) => entry.drawingGroupId === file.drawingGroupId && entry.isCurrent
    );

  return (
    <main className="p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Drawings</h1>
          <p className="text-sm text-[color:var(--muted)]">
            Upload and manage plan sets for this project.
          </p>
        </div>
        <button
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-black shadow-sm"
          type="button"
          onClick={() => setShowUpload(true)}
        >
          Upload Drawings
        </button>
      </header>

      {files.length === 0 ? (
        <section className="card p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--hover)] text-2xl">
            📐
          </div>
          <h2 className="mt-4 text-lg font-semibold">No drawings uploaded yet</h2>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Upload PDF plan sets to view, organize, and share with your team.
          </p>
          <button
            className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-medium text-black"
            type="button"
            onClick={() => setShowUpload(true)}
          >
            Upload your first drawing
          </button>
        </section>
      ) : (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
            <input
              className="min-w-[200px] flex-1 rounded-full border border-black/10 px-4 py-2 text-sm"
              placeholder="Search drawings..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="rounded-full border border-black/10 px-3 py-2 text-sm"
              value={disciplineFilter}
              onChange={(event) => setDisciplineFilter(event.target.value)}
            >
              {DISCIPLINES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              className="rounded-full border border-black/10 px-3 py-2 text-sm"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="newest">Newest uploaded</option>
              <option value="oldest">Oldest uploaded</option>
              <option value="name-asc">File name A–Z</option>
              <option value="name-desc">File name Z–A</option>
            </select>
            <label className="ml-auto flex items-center gap-2 text-xs text-[color:var(--muted)]">
              <input
                type="checkbox"
                checked={showOldVersions}
                onChange={(event) => setShowOldVersions(event.target.checked)}
              />
              Show old versions
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left p-3">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="text-left p-3">File Name</th>
                  <th className="text-left p-3">Discipline</th>
                  <th className="text-left p-3">Uploaded By</th>
                  <th className="text-left p-3">Uploaded Date</th>
                  <th className="text-left p-3">Version</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => {
                  const isOld = showOldVersions && !file.isCurrent;
                  return (
                  <tr
                    key={file.id}
                    className={`border-b last:border-b-0 cursor-pointer hover:[&>td]:bg-[color:var(--hover)] ${
                      isOld ? "bg-[color:var(--hover)]/40" : ""
                    }`}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(file.id)}
                        onChange={() => toggleSelectOne(file.id)}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </td>
                    <td className="p-3">
                      <button
                        className={`flex items-center gap-2 text-left font-medium text-black/90 hover:underline ${
                          isOld ? "ml-4" : ""
                        }`}
                        type="button"
                        onClick={() => openViewer(file)}
                      >
                        <span className="rounded-full border border-black/10 px-2 py-0.5 text-[10px] text-[color:var(--muted)]">
                          PDF
                        </span>
                        <span className="rounded-full border border-black/10 px-2 py-0.5 text-[10px] text-[color:var(--muted)]">
                          v{file.versionNumber}
                        </span>
                        {!file.isCurrent ? (
                          <span className="text-[10px] uppercase tracking-wide text-[color:var(--warning)]">
                            Superseded
                          </span>
                        ) : null}
                        {file.name}
                      </button>
                      <div className="text-xs text-[color:var(--muted)]">
                        {formatSize(file.size)}
                      </div>
                    </td>
                    <td className="p-3">
                      <select
                        className="rounded-full border border-black/10 px-3 py-1 text-xs"
                        value={file.discipline}
                        onChange={(event) => {
                          const next = event.target.value;
                          setFiles((prev) =>
                            prev.map((entry) =>
                              entry.id === file.id ? { ...entry, discipline: next } : entry
                            )
                          );
                        }}
                      >
                        {DISCIPLINES.filter((option) => option !== "All").map(
                          (option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          )
                        )}
                      </select>
                    </td>
                    <td className="p-3">{file.uploadedBy}</td>
                    <td className="p-3">
                      {new Date(file.uploadedAt).toLocaleDateString()}
                    </td>
                    <td className="p-3">{file.version}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-full border border-black/10 px-3 py-1 text-xs"
                          type="button"
                          onClick={() => openViewer(file)}
                        >
                          View
                        </button>
                        <button
                          className="rounded-full border border-black/10 px-3 py-1 text-xs"
                          type="button"
                          onClick={() => openNewVersionModal(file)}
                        >
                          Upload New Version
                        </button>
                        <button className="rounded-full border border-black/10 px-3 py-1 text-xs">
                          Download
                        </button>
                        <button className="rounded-full border border-black/10 px-3 py-1 text-xs">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selectedIds.size > 0 ? (
        <div className="sticky bottom-4 flex justify-center">
          <div className="flex flex-wrap items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm shadow-lg">
            <div className="text-xs uppercase tracking-wide text-[color:var(--muted)]">
              {selectedIds.size} selected
            </div>
            <button
              className="rounded-full border border-black/10 px-3 py-1 text-xs"
              type="button"
            >
              Download Selected
            </button>
            <button
              className="rounded-full border border-black/10 px-3 py-1 text-xs"
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete Selected
            </button>
            <button
              className="rounded-full border border-black/10 px-3 py-1 text-xs"
              type="button"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear Selection
            </button>
          </div>
        </div>
      ) : null}

      {showUpload ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Upload Drawings</h2>
              <button
                className="rounded-full border border-black/10 px-3 py-1 text-xs"
                type="button"
                onClick={() => setShowUpload(false)}
              >
                Close
              </button>
            </div>

            <div
              className="mt-4 rounded-lg border border-dashed border-black/20 bg-[color:var(--hover)]/60 p-6 text-center"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <div className="text-sm font-medium">Drag and drop PDF plan sets</div>
              <div className="mt-1 text-xs text-[color:var(--muted)]">
                PDF only · Multiple files allowed
              </div>
              <label className="mt-4 inline-flex cursor-pointer rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-medium">
                Choose files
                <input
                  className="hidden"
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={(event) => handleFileSelect(event.target.files)}
                />
              </label>
            </div>

            {error ? (
              <div className="mt-3 rounded-md border border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10 px-3 py-2 text-xs text-[color:var(--warning)]">
                {error}
              </div>
            ) : null}

            {queuedFiles.length ? (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-[color:var(--muted)]">
                  <span>{queuedFiles.length} file(s) ready</span>
                  <span>{formatSize(totalSize)}</span>
                </div>
                <div className="space-y-2">
                  {queuedFiles.map((file) => (
                    <div
                      key={`${file.name}-${file.lastModified}`}
                      className="flex items-center justify-between rounded-md border border-black/10 bg-white px-3 py-2 text-xs"
                    >
                      <span className="truncate">{file.name}</span>
                      <span className="text-[color:var(--muted)]">
                        {formatSize(file.size)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                className="rounded-full border border-black/10 px-4 py-2 text-xs"
                type="button"
                onClick={() => {
                  setQueuedFiles([]);
                  setError(null);
                  setShowUpload(false);
                }}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-black disabled:opacity-50"
                type="button"
                onClick={handleUpload}
                disabled={!queuedFiles.length}
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewerFile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="text-sm font-semibold">
                {viewerFile.name} <span className="text-[color:var(--muted)]">v{viewerFile.versionNumber}</span>
              </div>
              <button
                className="rounded-full border border-black/10 px-3 py-1 text-xs"
                type="button"
                onClick={() => setViewerFile(null)}
              >
                Close
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-xs">
              <button
                className="rounded-full border border-black/10 px-3 py-1 disabled:opacity-50"
                type="button"
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))}
              >
                Previous Page
              </button>
              <button
                className="rounded-full border border-black/10 px-3 py-1 disabled:opacity-50"
                type="button"
                disabled={numPages > 0 && pageNumber >= numPages}
                onClick={() =>
                  setPageNumber((prev) => (numPages ? Math.min(numPages, prev + 1) : prev))
                }
              >
                Next Page
              </button>
              <button
                className="rounded-full border border-black/10 px-3 py-1 disabled:opacity-50"
                type="button"
                disabled={scale <= 0.5}
                onClick={() => setScale((prev) => Math.max(0.5, prev - 0.1))}
              >
                Zoom Out
              </button>
              <button
                className="rounded-full border border-black/10 px-3 py-1 disabled:opacity-50"
                type="button"
                disabled={scale >= 2}
                onClick={() => setScale((prev) => Math.min(2, prev + 0.1))}
              >
                Zoom In
              </button>
              <div className="ml-auto text-[color:var(--muted)]">
                Page {pageNumber} of {numPages || "--"}
              </div>
            </div>
            {viewerFile.isCurrent ? null : (
              <div className="border-b px-4 py-2 text-xs text-[color:var(--warning)]">
                This is an older version.{" "}
                <button
                  className="font-semibold underline"
                  type="button"
                  onClick={() => {
                    const current = currentVersionFor(viewerFile);
                    if (current) openViewer(current);
                  }}
                >
                  View current version
                </button>
              </div>
            )}
            <div className="flex-1 overflow-auto bg-[color:var(--hover)] p-4">
              {viewerFile.objectUrl ? (
                <Document
                  file={viewerFile.objectUrl}
                  onLoadSuccess={({ numPages: loaded }) => {
                    setNumPages(loaded);
                    if (pageNumber > loaded) setPageNumber(loaded);
                  }}
                  loading={
                    <div className="text-center text-sm text-[color:var(--muted)]">
                      Loading PDF…
                    </div>
                  }
                >
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </Document>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[color:var(--muted)]">
                  Preview unavailable for this mock file.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <div className="text-lg font-semibold">Delete selected drawings?</div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              This will remove the selected drawings from this list.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="rounded-full border border-black/10 px-4 py-2 text-xs"
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-black"
                type="button"
                onClick={handleDeleteSelected}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showNewVersionModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="text-lg font-semibold">Upload New Version</div>
            <div className="mt-4 space-y-3">
              <label className="block text-xs uppercase tracking-wide text-[color:var(--muted)]">
                PDF file
                <input
                  className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setVersionFile(file);
                    setVersionError(null);
                  }}
                />
              </label>
              <label className="block text-xs uppercase tracking-wide text-[color:var(--muted)]">
                Revision note
                <textarea
                  className="mt-2 min-h-[120px] w-full resize-none rounded-lg border border-black/10 px-3 py-2 text-sm"
                  placeholder="e.g., Issued for Construction, Rev A, ASI-02…"
                  value={versionNote}
                  onChange={(event) => setVersionNote(event.target.value)}
                />
              </label>
              {versionError ? (
                <div className="rounded-md border border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10 px-3 py-2 text-xs text-[color:var(--warning)]">
                  {versionError}
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="rounded-full border border-black/10 px-4 py-2 text-xs"
                type="button"
                onClick={() => setShowNewVersionModal(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-black disabled:opacity-50"
                type="button"
                disabled={!versionFile}
                onClick={handleVersionUpload}
              >
                Upload Version
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
