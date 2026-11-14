"use client";

import { useActionState } from "react";
import { saveProfile } from "@/app/actions/account";
import { initialFormState } from "@/app/actions/form-state";
import { TextField } from "./text-field";
import { buttonClass, statusClass } from "./ui";

export function AccountForm({
  displayName,
  marketingOptIn,
}: {
  displayName: string;
  marketingOptIn: boolean;
}) {
  const [state, formAction] = useActionState(saveProfile, initialFormState);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <TextField
        id="displayName"
        label="Display name"
        defaultValue={displayName}
        autoComplete="nickname"
        maxLength={60}
      />
      <div className="flex items-center gap-2">
        <input
          id="marketingOptIn"
          name="marketingOptIn"
          type="checkbox"
          defaultChecked={marketingOptIn}
          className="h-4 w-4"
        />
        <label htmlFor="marketingOptIn" className="text-sm">
          Email me about new products
        </label>
      </div>
      {state.message && (
        <p role="status" className={statusClass(state.ok)}>
          {state.message}
        </p>
      )}
      <div>
        <button type="submit" className={buttonClass}>
          Save changes
        </button>
      </div>
    </form>
  );
}
