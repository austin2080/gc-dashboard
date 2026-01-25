"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

type FormState = { error?: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded border border-black bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
      disabled={pending}
    >
      {pending ? "Creating..." : "Create Project"}
    </button>
  );
}

export default function NewProjectForm({
  action,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">New Project</h1>
          <p className="text-sm opacity-80">Create a project and start tracking it.</p>
        </div>
        <Link className="border rounded px-3 py-2 text-sm" href="/projects">
          Back to Projects
        </Link>
      </header>

      <form action={formAction} className="max-w-3xl space-y-6">
        <section className="border rounded-lg p-4 space-y-4">
          <h2 className="font-semibold">Basics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <label className="space-y-1">
              <div className="opacity-70">Project Name</div>
              <input
                name="name"
                required
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="Casa Grande Spec Suite"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Project Number</div>
              <input
                name="project_number"
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="P-1027"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">City</div>
              <input
                name="city"
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="Phoenix, AZ"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Health</div>
              <select
                name="health"
                className="w-full rounded border border-black/20 px-3 py-2"
                defaultValue="on_track"
              >
                <option value="on_track">Active</option>
                <option value="at_risk">At Risk</option>
                <option value="on_hold">On Hold</option>
                <option value="complete">Inactive</option>
              </select>
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Start Date</div>
              <input
                type="date"
                name="start_date"
                className="w-full rounded border border-black/20 px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">End Date</div>
              <input
                type="date"
                name="end_date"
                className="w-full rounded border border-black/20 px-3 py-2"
              />
            </label>
          </div>
        </section>

        <section className="border rounded-lg p-4 space-y-4">
          <h2 className="font-semibold">Key Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <label className="space-y-1">
              <div className="opacity-70">Contracted Value</div>
              <input
                type="number"
                name="contracted_value"
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="0"
                step="0.01"
                min="0"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Est. OH&P</div>
              <input
                type="number"
                name="estimated_profit"
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="0"
                step="0.01"
                min="0"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Estimated Buyout</div>
              <input
                type="number"
                name="estimated_buyout"
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="0"
                step="0.01"
                min="0"
              />
            </label>
          </div>
        </section>

        {state.error ? (
          <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <SubmitButton />
          <div className="text-xs opacity-60">
            After creation, you’ll be taken to the project detail page.
          </div>
        </div>
      </form>
    </main>
  );
}
