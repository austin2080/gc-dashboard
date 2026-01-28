"use client";

import { useActionState } from "react";

type FormState = { error?: string };

type ContractOption = { id: string; title: string | null };

type Props = {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  contracts: ContractOption[];
};

export default function PayAppForm({ action, contracts }: Props) {
  const [state, formAction] = useActionState(action, { error: "" });

  return (
    <form action={formAction} className="grid grid-cols-1 md:grid-cols-6 gap-4 text-sm">
      <label className="space-y-1 md:col-span-2">
        <div className="opacity-70">Prime Contract</div>
        <select name="contract_id" className="w-full rounded border border-black/20 px-3 py-2">
          <option value="">Select contract (optional)</option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title ?? "Untitled"}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <div className="opacity-70">Pay App #</div>
        <input
          name="app_number"
          className="w-full rounded border border-black/20 px-3 py-2"
          placeholder="1"
        />
      </label>
      <label className="space-y-1">
        <div className="opacity-70">Application Date</div>
        <input type="date" name="submitted_date" className="w-full rounded border border-black/20 px-3 py-2" />
      </label>
      <label className="space-y-1">
        <div className="opacity-70">Due Date</div>
        <input type="date" name="due_date" className="w-full rounded border border-black/20 px-3 py-2" />
      </label>
      <label className="space-y-1">
        <div className="opacity-70">Amount This Period</div>
        <input
          type="number"
          name="amount"
          step="0.01"
          className="w-full rounded border border-black/20 px-3 py-2"
          placeholder="0.00"
        />
      </label>
      <label className="space-y-1">
        <div className="opacity-70">Status</div>
        <select name="status" className="w-full rounded border border-black/20 px-3 py-2" defaultValue="submitted">
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="paid">Paid</option>
        </select>
      </label>
      {state.error ? <div className="md:col-span-6 text-sm text-red-600">{state.error}</div> : null}
      <div className="md:col-span-6 flex items-center justify-end gap-2">
        <button className="rounded border border-black bg-black px-4 py-2 text-sm text-white">Save Pay App</button>
      </div>
    </form>
  );
}
