"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { initialFormState } from "@/app/actions/form-state";
import { TextField } from "./text-field";
import { buttonClass, statusClass } from "./ui";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(login, initialFormState);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <TextField id="email" label="Email" type="email" autoComplete="email" />
      <TextField
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
      />
      {state.message && (
        <p role="status" className={statusClass(state.ok)}>
          {state.message}
        </p>
      )}
      <div>
        <button type="submit" className={buttonClass}>
          Sign in
        </button>
      </div>
    </form>
  );
}
