"use client";

import { useActionState } from "react";

type FormState = { error?: string };

type Props = {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  initialName?: string;
};

export default function NewCompanyForm({ action, initialName = "" }: Props) {
  const [state, formAction] = useActionState(action, { error: "" });

  return (
    <form action={formAction} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <label className="space-y-1 md:col-span-2">
        <div className="opacity-70">Company Name</div>
        <input
          name="name"
          defaultValue={initialName}
          className="w-full rounded border border-black/20 px-3 py-2"
          placeholder="Company name"
        />
      </label>
      <label className="space-y-1">
        <div className="opacity-70">Mode</div>
        <select name="mode" className="w-full rounded border border-black/20 px-3 py-2">
          <option value="company">Company</option>
          <option value="solo">Solo</option>
        </select>
      </label>
      <label className="space-y-1">
        <div className="opacity-70">Trade</div>
        <input
          name="trade"
          className="w-full rounded border border-black/20 px-3 py-2"
          placeholder="Electrical, Plumbing, etc."
        />
      </label>
      <label className="space-y-1 md:col-span-2">
        <div className="opacity-70">Address</div>
        <input
          name="address"
          className="w-full rounded border border-black/20 px-3 py-2"
          placeholder="Street address"
        />
      </label>
      <label className="space-y-1">
        <div className="opacity-70">City</div>
        <input name="city" className="w-full rounded border border-black/20 px-3 py-2" />
      </label>
      <label className="space-y-1">
        <div className="opacity-70">State</div>
        <input name="state" className="w-full rounded border border-black/20 px-3 py-2" />
      </label>
      <label className="space-y-1">
        <div className="opacity-70">Zip</div>
        <input name="zip" className="w-full rounded border border-black/20 px-3 py-2" />
      </label>
      {state.error ? (
        <div className="md:col-span-2 text-sm text-red-600">{state.error}</div>
      ) : null}
      <div className="md:col-span-2 flex justify-end">
        <button className="rounded border border-black bg-black px-4 py-2 text-sm text-white">
          Save Company
        </button>
      </div>
    </form>
  );
}
