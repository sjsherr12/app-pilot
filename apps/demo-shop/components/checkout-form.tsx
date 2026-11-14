"use client";

import { useActionState } from "react";
import { placeOrder } from "@/app/actions/checkout";
import { initialFormState } from "@/app/actions/form-state";
import { TextField } from "./text-field";
import { buttonClass, statusClass } from "./ui";

export function CheckoutForm({ fullName }: { fullName: string }) {
  const [state, formAction] = useActionState(placeOrder, initialFormState);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <TextField
        id="fullName"
        label="Full name"
        defaultValue={fullName}
        autoComplete="name"
      />
      <TextField id="address" label="Address" autoComplete="street-address" />
      <TextField id="city" label="City" autoComplete="address-level2" />
      <TextField id="zip" label="ZIP code" autoComplete="postal-code" />
      {state.message && (
        <p role="status" className={statusClass(state.ok)}>
          {state.message}
        </p>
      )}
      <div>
        <button type="submit" className={buttonClass}>
          Place order
        </button>
      </div>
    </form>
  );
}
