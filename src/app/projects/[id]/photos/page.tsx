"use client";

import { useMemo, useState } from "react";

const samplePhotos = [
  {
    id: "photo-001",
    title: "Concrete pour - Level 2",
    takenAt: "2026-01-18",
    uploadedAt: "2026-01-20",
    uploader: "Ava Reynolds",
    fileName: "IMG_2041.jpg",
  },
  {
    id: "photo-002",
    title: "Steel delivery",
    takenAt: "2026-01-21",
    uploadedAt: "2026-01-21",
    uploader: "Miles Carter",
    fileName: "IMG_2077.jpg",
  },
  {
    id: "photo-003",
    title: "MEP rough-in",
    takenAt: "2026-01-25",
    uploadedAt: "2026-01-26",
    uploader: "Jasmine Patel",
    fileName: "IMG_2108.jpg",
  },
  {
    id: "photo-004",
    title: "Facade mockup",
    takenAt: "2026-01-28",
    uploadedAt: "2026-01-29",
    uploader: "Leo Park",
    fileName: "IMG_2139.jpg",
  },
  {
    id: "photo-005",
    title: "Drywall inspection",
    takenAt: "2026-01-30",
    uploadedAt: "2026-01-31",
    uploader: "Sofia Nguyen",
    fileName: "IMG_2194.jpg",
  },
  {
    id: "photo-006",
    title: "Roof membrane",
    takenAt: "2026-02-01",
    uploadedAt: "2026-02-02",
    uploader: "Ethan Brooks",
    fileName: "IMG_2230.jpg",
  },
];

const SORT_OPTIONS = [
  { value: "taken-newest", label: "Newest first" },
  { value: "taken-oldest", label: "Oldest first" },
  { value: "uploaded-newest", label: "Upload date newest" },
  { value: "uploaded-oldest", label: "Upload date oldest" },
];

const PAGE_SIZE = 50;

export default function ProjectPhotosPage() {
  const [sort, setSort] = useState("taken-newest");
  const [datePreset, setDatePreset] = useState("last-30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [uploaderFilter, setUploaderFilter] = useState("all");
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [notesByPhoto, setNotesByPhoto] = useState<Record<string, string>>({});
  const [draftNote, setDraftNote] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"all" | "albums">("all");
  const [albums, setAlbums] = useState<
    Array<{
      id: string;
      name: string;
      description: string;
      coverPhotoId: string | null;
      photoIds: string[];
    }>
  >([]);
  const [showCreateAlbumModal, setShowCreateAlbumModal] = useState(false);
  const [albumName, setAlbumName] = useState("");
  const [albumDescription, setAlbumDescription] = useState("");
  const [selectedAlbumId, setSelectedAlbumId] = useState("");

  const uploaderOptions = useMemo(
    () => Array.from(new Set(samplePhotos.map((photo) => photo.uploader))),
    []
  );

  const filteredPhotos = useMemo(() => {
    const photos = [...samplePhotos];
    const compareDates = (a: string, b: string) =>
      new Date(a).getTime() - new Date(b).getTime();

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const presetStart = new Date(startOfToday);
    let presetEnd = new Date(startOfToday);

    if (datePreset === "today") {
      presetEnd = new Date(startOfToday);
    } else if (datePreset === "last-7") {
      presetStart.setDate(presetStart.getDate() - 6);
    } else if (datePreset === "last-30") {
      presetStart.setDate(presetStart.getDate() - 29);
    }

    const resolveCustomDate = (value: string, fallback: Date | null) => {
      if (!value) return fallback;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? fallback : parsed;
    };

    const customStartDate = resolveCustomDate(customStart, null);
    const customEndDate = resolveCustomDate(customEnd, null);

    const activeStart =
      datePreset === "custom" ? customStartDate : new Date(presetStart);
    const activeEnd =
      datePreset === "custom" ? customEndDate : new Date(presetEnd);

    const matchesDateRange = (photoDate: string) => {
      const target = new Date(photoDate);
      if (Number.isNaN(target.getTime())) return false;
      if (activeStart && target < activeStart) return false;
      if (activeEnd && target > activeEnd) return false;
      return true;
    };

    const filtered = photos.filter((photo) => {
      if (uploaderFilter !== "all" && photo.uploader !== uploaderFilter) {
        return false;
      }
      return matchesDateRange(photo.takenAt ?? photo.uploadedAt);
    });

    filtered.sort((a, b) => {
      if (sort === "taken-newest")
        return compareDates(b.takenAt ?? b.uploadedAt, a.takenAt ?? a.uploadedAt);
      if (sort === "taken-oldest")
        return compareDates(a.takenAt ?? a.uploadedAt, b.takenAt ?? b.uploadedAt);
      if (sort === "uploaded-newest") return compareDates(b.uploadedAt, a.uploadedAt);
      return compareDates(a.uploadedAt, b.uploadedAt);
    });

    return filtered;
  }, [sort, datePreset, customStart, customEnd, uploaderFilter]);

  const selectedPhoto = useMemo(
    () => samplePhotos.find((photo) => photo.id === selectedPhotoId) ?? null,
    [selectedPhotoId]
  );

  const selectedPhotoAlbums = useMemo(() => {
    if (!selectedPhoto) return [];
    return albums.filter((album) => album.photoIds.includes(selectedPhoto.id));
  }, [albums, selectedPhoto]);

  const totalPages = Math.max(1, Math.ceil(filteredPhotos.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagePhotos = useMemo(
    () => filteredPhotos.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredPhotos, pageStart]
  );

  const groupedByMonth = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    });
    const groups = new Map<
      string,
      { label: string; monthKey: string; photos: typeof samplePhotos }
    >();

    pagePhotos.forEach((photo) => {
      const dateValue = photo.takenAt ?? photo.uploadedAt;
      const date = new Date(dateValue);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!groups.has(monthKey)) {
        groups.set(monthKey, {
          label: formatter.format(date),
          monthKey,
          photos: [],
        });
      }
      groups.get(monthKey)?.photos.push(photo);
    });

    return Array.from(groups.values());
  }, [pagePhotos]);

  const allVisibleIds = useMemo(
    () => pagePhotos.map((photo) => photo.id),
    [pagePhotos]
  );

  const allSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds(() => {
      if (allSelected) return new Set();
      return new Set(allVisibleIds);
    });
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const closeDrawer = () => {
    setSelectedPhotoId(null);
    setDraftNote("");
  };

  return (
    <main className="p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Photos</h1>
          <label className="flex items-center gap-2 text-xs uppercase tracking-wide text-black/50">
            <input
              className="h-4 w-4 rounded border border-black/20"
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
            />
            Select all
          </label>
        </div>
        <button
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm"
          type="button"
        >
          Upload Photos
        </button>
      </header>

      <section className="rounded-lg border border-dashed border-black/20 bg-black/[0.02] px-4 py-3 text-sm text-black/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm text-black/70">
            <label className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-black/50">Date range</span>
              <select
                className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-sm text-black/80"
                value={datePreset}
                onChange={(event) => setDatePreset(event.target.value)}
              >
                <option value="today">Today</option>
                <option value="last-7">Last 7 Days</option>
                <option value="last-30">Last 30 Days</option>
                <option value="custom">Custom</option>
              </select>
            </label>

            {datePreset === "custom" ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-xs text-black/80"
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                />
                <span className="text-xs text-black/40">to</span>
                <input
                  className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-xs text-black/80"
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                />
              </div>
            ) : null}

            <label className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-black/50">Uploaded by</span>
              <select
                className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-sm text-black/80"
                value={uploaderFilter}
                onChange={(event) => setUploaderFilter(event.target.value)}
              >
                <option value="all">All</option>
                {uploaderOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-xs text-black/70"
              type="button"
              onClick={() => {
                setDatePreset("last-30");
                setCustomStart("");
                setCustomEnd("");
                setUploaderFilter("all");
                setCurrentPage(1);
              }}
            >
              Clear filters
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-black/70">
            <span className="text-xs uppercase tracking-wide text-black/50">Sort</span>
            <select
              className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-sm text-black/80"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <div className="flex items-center gap-2 border-b border-black/10 pb-3">
          <button
            className={
              activeTab === "all"
                ? "rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white"
                : "rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium text-black/70"
            }
            type="button"
            onClick={() => setActiveTab("all")}
          >
            All Photos
          </button>
          <button
            className={
              activeTab === "albums"
                ? "rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white"
                : "rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium text-black/70"
            }
            type="button"
            onClick={() => setActiveTab("albums")}
          >
            Albums
          </button>
        </div>

        {activeTab === "all" ? (
          <>
            <div className="mt-4 space-y-6">
              {groupedByMonth.map((group) => {
                const monthIds = group.photos.map((photo) => photo.id);
                const monthSelectedCount = monthIds.filter((id) => selectedIds.has(id))
                  .length;
                const monthAllSelected =
                  monthIds.length > 0 && monthSelectedCount === monthIds.length;
                const monthIndeterminate =
                  monthSelectedCount > 0 && monthSelectedCount < monthIds.length;

                return (
                  <div key={group.monthKey} className="space-y-3">
                    <div className="sticky top-20 z-10 flex items-center justify-between rounded-md border border-black/10 bg-white/95 px-3 py-2 text-sm backdrop-blur">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{group.label}</span>
                        <span className="text-xs text-black/50">
                          ({group.photos.length})
                        </span>
                      </div>
                      <label className="flex items-center gap-2 text-xs uppercase tracking-wide text-black/50">
                        <input
                          className="h-4 w-4 rounded border border-black/20"
                          type="checkbox"
                          checked={monthAllSelected}
                          ref={(input) => {
                            if (!input) return;
                            input.indeterminate = monthIndeterminate;
                          }}
                          onChange={() => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (monthAllSelected) {
                                monthIds.forEach((id) => next.delete(id));
                              } else {
                                monthIds.forEach((id) => next.add(id));
                              }
                              return next;
                            });
                          }}
                        />
                        Select month
                      </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {group.photos.map((photo) => (
                        <div
                          key={photo.id}
                          className="cursor-pointer rounded-lg border border-black/10 bg-white p-3 shadow-sm transition hover:border-black/20"
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setSelectedPhotoId(photo.id);
                            setDraftNote(notesByPhoto[photo.id] ?? "");
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            setSelectedPhotoId(photo.id);
                            setDraftNote(notesByPhoto[photo.id] ?? "");
                          }}
                        >
                          <div className="relative">
                            <div className="aspect-[4/3] w-full rounded-md bg-gradient-to-br from-slate-100 to-slate-200" />
                            <div className="absolute left-2 top-2">
                              <input
                                className="h-4 w-4 rounded border border-black/20 bg-white"
                                type="checkbox"
                                checked={selectedIds.has(photo.id)}
                                onChange={(event) => {
                                  event.stopPropagation();
                                  toggleSelectOne(photo.id);
                                }}
                                onClick={(event) => event.stopPropagation()}
                              />
                            </div>
                          </div>
                          <div className="mt-3 space-y-1">
                            <div className="text-sm font-semibold text-black/90">
                              {photo.title}
                            </div>
                            <div className="text-xs text-black/60">
                              Taken{" "}
                              {new Date(
                                photo.takenAt ?? photo.uploadedAt
                              ).toLocaleDateString()}{" "}
                              · {photo.uploader}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between text-sm text-black/60">
              <div>
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-full border border-black/10 px-3 py-1 text-xs text-black/70 disabled:opacity-40"
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <button
                  className="rounded-full border border-black/10 px-3 py-1 text-xs text-black/70 disabled:opacity-40"
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-black/60">
                {albums.length ? `${albums.length} album(s)` : "No albums yet."}
              </div>
              <button
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm"
                type="button"
                onClick={() => setShowCreateAlbumModal(true)}
              >
                Create Album
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {albums.map((album) => (
                <div
                  key={album.id}
                  className="rounded-lg border border-black/10 bg-white p-3 shadow-sm"
                >
                  <div className="aspect-[4/3] w-full rounded-md bg-gradient-to-br from-slate-100 to-slate-200" />
                  <div className="mt-3 space-y-1">
                    <div className="text-sm font-semibold text-black/90">
                      {album.name}
                    </div>
                    <div className="text-xs text-black/60">
                      {album.photoIds.length} photo
                      {album.photoIds.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              ))}
              {!albums.length ? (
                <div className="rounded-lg border border-dashed border-black/20 p-6 text-sm text-black/60">
                  Create an album to start organizing photos.
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {selectedIds.size > 0 ? (
        <div className="sticky bottom-4 flex justify-center">
          <div className="flex flex-wrap items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm shadow-lg">
            <div className="text-xs uppercase tracking-wide text-black/50">
              {selectedIds.size} selected
            </div>
            <button
              className="rounded-full border border-black/10 px-3 py-1 text-xs text-black/70"
              type="button"
              onClick={() => {
                if (selectedIds.size === 0) return;
                setShowAlbumModal(true);
                setSelectedAlbumId(albums[0]?.id ?? "");
              }}
            >
              Add to Album
            </button>
            <button
              className="rounded-full border border-black/10 px-3 py-1 text-xs text-black/70"
              type="button"
            >
              Export Selected
            </button>
            <button
              className="rounded-full border border-black/10 px-3 py-1 text-xs text-black/70"
              type="button"
            >
              Download
            </button>
            <button
              className="rounded-full border border-black/10 px-3 py-1 text-xs text-black/70"
              type="button"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </button>
          </div>
        </div>
      ) : null}

      {selectedPhoto ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="flex h-full w-full max-w-md flex-col bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Photo Details</h2>
              <button
                className="rounded-full border border-black/10 px-3 py-1 text-xs text-black/70"
                type="button"
                onClick={closeDrawer}
              >
                Close
              </button>
            </div>

            <div className="mt-4 aspect-[4/3] w-full rounded-lg bg-gradient-to-br from-slate-100 to-slate-200" />

            <div className="mt-4 space-y-2 text-sm text-black/70">
              <div>
                <span className="text-xs uppercase tracking-wide text-black/40">
                  Taken
                </span>
                <div className="text-sm text-black/80">
                  {new Date(selectedPhoto.takenAt).toLocaleDateString()}
                </div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-black/40">
                  Uploaded
                </span>
                <div className="text-sm text-black/80">
                  {new Date(selectedPhoto.uploadedAt).toLocaleDateString()}
                </div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-black/40">
                  Uploader
                </span>
                <div className="text-sm text-black/80">{selectedPhoto.uploader}</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-black/40">
                  File name
                </span>
                <div className="text-sm text-black/80">{selectedPhoto.fileName}</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-black/40">
                  Albums
                </span>
                <div className="text-sm text-black/80">
                  {selectedPhotoAlbums.length
                    ? selectedPhotoAlbums.map((album) => album.name).join(", ")
                    : "Not in any albums"}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-1 flex-col">
              <label className="text-xs uppercase tracking-wide text-black/40">
                Notes / Caption
              </label>
              <textarea
                className="mt-2 min-h-[140px] flex-1 resize-none rounded-lg border border-black/10 p-3 text-sm text-black/80"
                placeholder="Add notes for this photo..."
                value={draftNote}
                onChange={(event) => setDraftNote(event.target.value)}
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="rounded-full border border-black/10 px-4 py-2 text-sm text-black/70"
                type="button"
                onClick={closeDrawer}
              >
                Close
              </button>
              <button
                className="rounded-full bg-primary px-4 py-2 text-sm text-white"
                type="button"
                onClick={() => {
                  if (!selectedPhoto) return;
                  setNotesByPhoto((prev) => ({
                    ...prev,
                    [selectedPhoto.id]: draftNote.trim(),
                  }));
                }}
              >
                Save Notes
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showAlbumModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <div className="text-lg font-semibold">Add to Album</div>
            <div className="mt-4 space-y-3 text-sm text-black/70">
              <label className="block text-xs uppercase tracking-wide text-black/50">
                Select Album
                <select
                  className="mt-2 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-black/80"
                  value={selectedAlbumId}
                  onChange={(event) => setSelectedAlbumId(event.target.value)}
                >
                  {albums.length ? null : (
                    <option value="">No albums yet</option>
                  )}
                  {albums.map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="rounded-full border border-black/10 px-4 py-2 text-sm text-black/70"
                type="button"
                onClick={() => setShowAlbumModal(false)}
              >
                Close
              </button>
              <button
                className="rounded-full bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
                type="button"
                disabled={!selectedAlbumId || selectedIds.size === 0}
                onClick={() => {
                  if (!selectedAlbumId || selectedIds.size === 0) return;
                  setAlbums((prev) =>
                    prev.map((album) => {
                      if (album.id !== selectedAlbumId) return album;
                      const merged = new Set([...album.photoIds, ...selectedIds]);
                      return { ...album, photoIds: Array.from(merged) };
                    })
                  );
                  setShowAlbumModal(false);
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateAlbumModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="text-lg font-semibold">Create Album</div>
            <div className="mt-4 space-y-3">
              <label className="block text-xs uppercase tracking-wide text-black/50">
                Album Name
                <input
                  className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-black/80"
                  value={albumName}
                  onChange={(event) => setAlbumName(event.target.value)}
                />
              </label>
              <label className="block text-xs uppercase tracking-wide text-black/50">
                Description
                <textarea
                  className="mt-2 min-h-[120px] w-full resize-none rounded-lg border border-black/10 px-3 py-2 text-sm text-black/80"
                  value={albumDescription}
                  onChange={(event) => setAlbumDescription(event.target.value)}
                />
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="rounded-full border border-black/10 px-4 py-2 text-sm text-black/70"
                type="button"
                onClick={() => {
                  setShowCreateAlbumModal(false);
                  setAlbumName("");
                  setAlbumDescription("");
                }}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
                type="button"
                disabled={!albumName.trim()}
                onClick={() => {
                  const name = albumName.trim();
                  if (!name) return;
                  setAlbums((prev) => [
                    ...prev,
                    {
                      id: `album-${Date.now()}`,
                      name,
                      description: albumDescription.trim(),
                      coverPhotoId: null,
                      photoIds: [],
                    },
                  ]);
                  setShowCreateAlbumModal(false);
                  setAlbumName("");
                  setAlbumDescription("");
                }}
              >
                Create Album
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
