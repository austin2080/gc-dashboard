"use client";

import { useState } from "react";
import BudgetTransferForm from "@/components/budget-transfer-form";

type FormState = { error?: string };
type CostCode = { code: string; description: string };

type Props = {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  costCodes: CostCode[];
};

export default function BudgetModificationModal({ action, costCodes }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="rounded border border-black bg-black px-4 py-2 text-sm text-white"
        onClick={() => setOpen(true)}
        type="button"
      >
        Budget Modifications
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="font-semibold">Budget Modifications</div>
              <button
                type="button"
                className="text-sm opacity-70 hover:opacity-100"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="p-4">
              <BudgetTransferForm action={action} costCodes={costCodes} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
