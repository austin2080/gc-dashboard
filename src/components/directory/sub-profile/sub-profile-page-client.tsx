"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EditSubModal, { type EditDraft } from "@/components/directory/sub-profile/EditSubModal";
import OverviewTab from "@/components/directory/sub-profile/OverviewTab";
import SubHeader from "@/components/directory/sub-profile/SubHeader";
import SubTabs, { type SubTab } from "@/components/directory/sub-profile/SubTabs";
import type { SubProfilePayload } from "@/components/directory/sub-profile/types";

type Props = {
  companyId: string;
};

function normalizeErrorMessage(raw: unknown) {
  if (typeof raw === "string" && raw.trim()) return raw;
  return "Something went wrong.";
}

export default function SubProfilePageClient({ companyId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<SubProfilePayload | null>(null);

  const [activeTab, setActiveTab] = useState<SubTab>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [noteInput, setNoteInput] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const fetchCompany = useCallback(async (targetCompanyId: string) => {
    setLoading(true);
    setNotFound(false);
    setError("");
    try {
      const response = await fetch(`/api/directory/companies/${targetCompanyId}`, { cache: "no-store" });
      if (response.status === 404) {
        setNotFound(true);
        setData(null);
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(normalizeErrorMessage(payload?.error));
      }
      const payload = (await response.json()) as SubProfilePayload;
      setData(payload);
      setNotesDraft(payload.company.notes ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load subcontractor profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompany(companyId);
  }, [companyId, fetchCompany]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const pageTitle = useMemo(() => data?.company.company_name ?? "Subcontractor Profile", [data]);

  async function patchCompany(payload: Record<string, unknown>) {
    const response = await fetch(`/api/directory/companies/${companyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(normalizeErrorMessage(body?.error));
    }
  }

  async function handleEditSave(draft: EditDraft) {
    setSaving(true);
    setEditError("");
    try {
      await patchCompany({ updates: draft });
      setEditOpen(false);
      await fetchCompany(companyId);
      setToast({ type: "success", message: "Subcontractor updated." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update subcontractor.";
      setEditError(message);
      setToast({ type: "error", message });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    if (!data) return;
    const nextStatus = data.company.status === "Active" ? "Inactive" : "Active";
    setSaving(true);
    try {
      await patchCompany({ updates: { status: nextStatus } });
      await fetchCompany(companyId);
      setToast({ type: "success", message: `Set ${nextStatus}.` });
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update status.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!data) return;
    if (!window.confirm(`Delete ${data.company.company_name}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/directory/companies/${companyId}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(normalizeErrorMessage(body?.error));
      }
      router.push("/directory");
      router.refresh();
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete subcontractor.",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveCompanyNotes() {
    setSavingNotes(true);
    try {
      await patchCompany({ updates: { notes: notesDraft } });
      await fetchCompany(companyId);
      setToast({ type: "success", message: "Company notes updated." });
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save company notes.",
      });
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleAddNote() {
    const note = noteInput.trim();
    if (!note) return;
    setAddingNote(true);
    try {
      await patchCompany({ addNote: note });
      setNoteInput("");
      await fetchCompany(companyId);
      setToast({ type: "success", message: "Note added." });
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to add note.",
      });
    } finally {
      setAddingNote(false);
    }
  }

  if (loading) {
    return (
      <main className="space-y-4 p-6">
        <div className="rounded-xl border border-black/10 bg-white p-5 text-sm text-black/60">Loading subcontractor profile...</div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="space-y-4 p-6">
        <div className="rounded-xl border border-black/10 bg-white p-5">
          <h1 className="text-xl font-semibold">Subcontractor not found</h1>
          <p className="mt-1 text-sm text-black/60">The profile may have been deleted or you may not have access.</p>
          <Link href="/directory" className="mt-3 inline-block text-sm underline">
            Back to Directory
          </Link>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="space-y-4 p-6">
        <div className="rounded-xl border border-black/10 bg-white p-5">
          <h1 className="text-xl font-semibold">Could not load subcontractor profile</h1>
          <p className="mt-1 text-sm text-red-600">{error || "Unknown error."}</p>
          <button
            type="button"
            onClick={() => fetchCompany(companyId)}
            className="mt-3 rounded-lg border border-black/15 px-3 py-2 text-sm"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-4 p-6">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-black/50">Subcontractor Profile</p>
        <h1 className="text-2xl font-semibold">{pageTitle}</h1>
      </div>

      {toast ? (
        <div className={`rounded-xl border p-3 text-sm ${toast.type === "error" ? "border-red-200 text-red-700" : "border-emerald-200 text-emerald-700"}`}>
          {toast.message}
        </div>
      ) : null}

      <SubHeader
        company={data.company}
        saving={saving}
        deleting={deleting}
        onEdit={() => setEditOpen(true)}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDelete}
      />

      <SubTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" ? (
        <OverviewTab
          company={data.company}
          assignments={data.assignments}
          assignmentsSource={data.assignmentsSource}
          notes={data.notes}
          notesSource={data.notesSource}
          noteInput={noteInput}
          notesDraft={notesDraft}
          addingNote={addingNote}
          savingNotes={savingNotes}
          onNoteInputChange={setNoteInput}
          onNotesDraftChange={setNotesDraft}
          onAddNote={handleAddNote}
          onSaveCompanyNotes={handleSaveCompanyNotes}
        />
      ) : (
        <section className="rounded-xl border border-black/10 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold capitalize">{activeTab}</h2>
          <p className="mt-2 text-sm text-black/60">Coming soon.</p>
        </section>
      )}

      <EditSubModal
        key={`${data.company.id}-${editOpen ? "open" : "closed"}`}
        open={editOpen}
        company={data.company}
        error={editError}
        saving={saving}
        onClose={() => setEditOpen(false)}
        onSave={handleEditSave}
      />
    </main>
  );
}
