import { createClient } from "@/lib/supabase/client";
import { ProcurementItem, ProcurementItemInput, ProcurementNoteEntry } from "./types";

type ProcurementItemRow = Omit<ProcurementItem, "notes_history">;

type NoteRow = {
  id: string;
  procurement_item_id: string;
  note: string;
  created_at: string;
};

const noteKey = (note: ProcurementNoteEntry) => `${note.created_at}::${note.note}`;

const mapItem = (item: ProcurementItemRow, notes: ProcurementNoteEntry[]): ProcurementItem => ({
  ...item,
  notes_history: notes,
});

export async function listItems(projectId: string): Promise<ProcurementItem[]> {
  if (!projectId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("procurement_items")
    .select("*")
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Failed to load procurement items", error);
    return [];
  }

  const items = data as ProcurementItemRow[];
  const itemIds = items.map((item) => item.id);
  const notesByItem = new Map<string, ProcurementNoteEntry[]>();

  if (itemIds.length) {
    const { data: noteRows, error: noteError } = await supabase
      .from("procurement_notes")
      .select("id, procurement_item_id, note, created_at")
      .in("procurement_item_id", itemIds)
      .order("created_at", { ascending: false });

    if (noteError) {
      console.error("Failed to load procurement notes", noteError);
    } else if (noteRows) {
      (noteRows as NoteRow[]).forEach((row) => {
        const entry: ProcurementNoteEntry = {
          note: row.note,
          created_at: row.created_at,
        };
        const list = notesByItem.get(row.procurement_item_id) ?? [];
        list.push(entry);
        notesByItem.set(row.procurement_item_id, list);
      });
    }
  }

  return items.map((item) => mapItem(item, notesByItem.get(item.id) ?? []));
}

export async function createItem(projectId: string, payload: ProcurementItemInput): Promise<ProcurementItem> {
  if (!projectId) {
    throw new Error("Project ID is required to create a procurement item.");
  }
  const supabase = createClient();
  const { notes_history, ...itemPayload } = payload;
  const { data, error } = await supabase
    .from("procurement_items")
    .insert({ ...itemPayload, project_id: projectId })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create procurement item.");
  }

  const item = data as ProcurementItemRow;
  let notesHistory: ProcurementNoteEntry[] = [];
  const notesToInsert =
    notes_history && notes_history.length
      ? notes_history
      : payload.notes
        ? [{ note: payload.notes, created_at: new Date().toISOString() }]
        : [];

  if (notesToInsert.length) {
    const { data: noteRows } = await supabase
      .from("procurement_notes")
      .insert(
        notesToInsert.map((note) => ({
          procurement_item_id: item.id,
          note: note.note,
          created_at: note.created_at,
        }))
      )
      .select("note, created_at");
    if (noteRows && noteRows.length > 0) {
      notesHistory = noteRows.map((note) => ({
        note: (note as { note: string }).note,
        created_at: (note as { created_at: string }).created_at,
      }));
    }
  }

  if (payload.qc_notes) {
    await supabase
      .from("procurement_qc_notes")
      .insert({ procurement_item_id: item.id, note: payload.qc_notes });
  }

  return mapItem(item, notesHistory);
}

export async function updateItem(
  id: string,
  patch: Partial<ProcurementItemInput>
): Promise<ProcurementItem | null> {
  const { notes_history, ...updatePatch } = patch;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("procurement_items")
    .update({ ...updatePatch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to update procurement item", error);
    return null;
  }

  if (notes_history) {
    const { data: existingRows, error: existingError } = await supabase
      .from("procurement_notes")
      .select("id, note, created_at")
      .eq("procurement_item_id", id);

    if (!existingError && existingRows) {
      const existing = (existingRows as { id: string; note: string; created_at: string }[]).map((row) => ({
        id: row.id,
        note: row.note,
        created_at: row.created_at,
      }));
      const existingKeys = new Map(existing.map((row) => [noteKey(row), row.id]));
      const nextKeys = new Set(notes_history.map((note) => noteKey(note)));

      const inserts = notes_history.filter((note) => !existingKeys.has(noteKey(note)));
      if (inserts.length) {
        await supabase.from("procurement_notes").insert(
          inserts.map((note) => ({
            procurement_item_id: id,
            note: note.note,
            created_at: note.created_at,
          }))
        );
      }

      const deletes = existing.filter((row) => !nextKeys.has(noteKey(row)));
      if (deletes.length) {
        await supabase
          .from("procurement_notes")
          .delete()
          .in(
            "id",
            deletes.map((row) => row.id)
          );
      }
    }
  }

  if (patch.qc_notes) {
    const { data: latestRows } = await supabase
      .from("procurement_qc_notes")
      .select("note")
      .eq("procurement_item_id", id)
      .order("created_at", { ascending: false })
      .limit(1);
    const latest = latestRows && latestRows.length ? (latestRows[0] as { note: string }).note : null;
    if (latest !== patch.qc_notes) {
      await supabase
        .from("procurement_qc_notes")
        .insert({ procurement_item_id: id, note: patch.qc_notes });
    }
  }

  const notesHistory = notes_history ?? [];
  return mapItem(data as ProcurementItemRow, notesHistory);
}

export async function deleteItem(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("procurement_items")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("Failed to archive procurement item", error);
  }
}
