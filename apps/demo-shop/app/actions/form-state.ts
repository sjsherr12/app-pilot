/** Result of a form submission handled by a Server Action via useActionState. */
export type FormState = {
  ok: boolean;
  /** Human-readable message; empty means "nothing to show". */
  message: string;
};

export const initialFormState: FormState = { ok: false, message: "" };
