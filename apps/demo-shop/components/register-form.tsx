"use client";

import { useActionState } from "react";
import { register } from "@/app/actions/auth";
import { initialFormState } from "@/app/actions/form-state";
import { TextField } from "./text-field";
import { buttonClass, statusClass } from "./ui";

export function RegisterForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(register, initialFormState);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <TextField
        id="displayName"
        label="Display name"
        autoComplete="nickname"
        maxLength={60}
      />
      <TextField id="email" label="Email" type="email" autoComplete="email" />
      <TextField
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        minLength={6}
      />
      {state.message && (
        <p role="status" className={statusClass(state.ok)}>
          {state.message}
        </p>
      )}
      <div>
        <button type="submit" className={buttonClass}>
          Create account
        </button>
      </div>
    </form>
  );
}
