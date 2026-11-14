"use client";

import { useActionState } from "react";
import { couponAction } from "@/app/actions/cart";
import { initialFormState } from "@/app/actions/form-state";
import {
  buttonClass,
  inputClass,
  secondaryButtonClass,
  statusClass,
} from "./ui";

export function CouponForm({ appliedCoupon }: { appliedCoupon: string | null }) {
  const [state, formAction] = useActionState(couponAction, initialFormState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="coupon-code" className="text-sm font-medium">
          Coupon code
        </label>
        <input
          id="coupon-code"
          name="code"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          className={`${inputClass} w-44`}
        />
      </div>
      <button
        type="submit"
        name="intent"
        value="apply"
        className={buttonClass}
      >
        Apply coupon
      </button>
      {appliedCoupon && (
        <button
          type="submit"
          name="intent"
          value="remove"
          className={secondaryButtonClass}
        >
          Remove coupon
        </button>
      )}
      {appliedCoupon && (
        <p className="basis-full text-sm text-slate-700">
          Applied: <strong>{appliedCoupon}</strong>
        </p>
      )}
      {state.message && (
        <p role="status" className={`basis-full ${statusClass(state.ok)}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
