"use client";

import { useActionState } from "react";
import { addToCart } from "@/app/actions/cart";
import { initialFormState } from "@/app/actions/form-state";
import { buttonClass, inputClass, statusClass } from "./ui";

type Props = {
  slug: string;
  name: string;
  /** Product page variant: shows a Quantity field and a plain "Add to cart" name. */
  withQuantity?: boolean;
};

export function AddToCartForm({ slug, name, withQuantity = false }: Props) {
  const [state, formAction] = useActionState(addToCart, initialFormState);

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      {withQuantity && (
        <div className="flex items-center gap-2">
          <label htmlFor="quantity" className="text-sm font-medium">
            Quantity
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            defaultValue={1}
            required
            className={`${inputClass} w-24`}
          />
        </div>
      )}
      <div>
        <button
          type="submit"
          className={buttonClass}
          aria-label={withQuantity ? undefined : `Add ${name} to cart`}
        >
          Add to cart
        </button>
      </div>
      {state.message && (
        <p role="status" className={statusClass(state.ok)}>
          {state.message}
        </p>
      )}
    </form>
  );
}
