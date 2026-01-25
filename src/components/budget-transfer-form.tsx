"use client";

import { useActionState } from "react";

type FormState = { error?: string };
type CostCode = { code: string; description: string };

type Props = {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  costCodes: CostCode[];
};

export default function BudgetTransferForm({ action, costCodes }: Props) {
  const [state, formAction] = useActionState(action, { error: "" });

  return (
    <form action={formAction} className="grid grid-cols-1 md:grid-cols-6 gap-3 text-sm">
      <label className="space-y-1 md:col-span-2">
        <div className="opacity-70">From Cost Code</div>
        <select name="from_code" className="w-full rounded border border-black/20 px-3 py-2">
          <option value="">Select cost code</option>
          {costCodes.map((code) => (
            <option key={`from-${code.code}`} value={code.code}>
              {code.code} — {code.description || "-"}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 md:col-span-2">
        <div className="opacity-70">To Cost Code</div>
        <select name="to_code" className="w-full rounded border border-black/20 px-3 py-2">
          <option value="">Select cost code</option>
          {costCodes.map((code) => (
            <option key={`to-${code.code}`} value={code.code}>
              {code.code} — {code.description || "-"}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <div className="opacity-70">Amount</div>
        <input
          name="amount"
          className="w-full rounded border border-black/20 px-3 py-2"
          placeholder="0.00"
        />
      </label>
      <label className="space-y-1 md:col-span-6">
        <div className="opacity-70">Note</div>
        <input
          name="note"
          className="w-full rounded border border-black/20 px-3 py-2"
          placeholder="Reason for transfer (optional)"
        />
      </label>
      {state.error ? (
        <div className="md:col-span-6 text-sm text-red-600">{state.error}</div>
      ) : null}
      <div className="md:col-span-6 flex justify-end">
        <button className="rounded border border-black bg-black px-3 py-2 text-sm text-white">
          Save Transfer
        </button>
      </div>
    </form>
  );
}
