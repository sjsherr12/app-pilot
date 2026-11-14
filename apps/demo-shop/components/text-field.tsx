import { inputClass } from "./ui";

type TextFieldProps = {
  id: string;
  label: string;
  name?: string;
  type?: "text" | "email" | "password";
  defaultValue?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
};

/** A labelled text input. Usable from server and client components. */
export function TextField({
  id,
  label,
  name = id,
  type = "text",
  defaultValue,
  autoComplete,
  required = true,
  minLength,
  maxLength,
}: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        className={inputClass}
      />
    </div>
  );
}
