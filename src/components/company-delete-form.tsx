"use client";

import { useActionState } from "react";

type FormState = { error?: string };

type Props = {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
};

export default function CompanyDeleteForm({ action }: Props) {
  const [state, formAction] = useActionState(action, { error: "" });

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm("Delete this company? This cannot be undone.")) {
          event.preventDefault();
        }
      }}
      className="space-y-2"
    >
      {state.error ? (
        <div className="text-sm text-red-600">{state.error}</div>
      ) : null}
      <button className="rounded border border-red-600 px-4 py-2 text-sm text-red-700">
        Delete Company
      </button>
    </form>
  );
}
