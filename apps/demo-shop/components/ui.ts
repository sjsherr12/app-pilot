/** Shared Tailwind class strings so every control looks the same. */
export const inputClass =
  "rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-2 focus:outline-offset-2 focus:outline-slate-900";

export const buttonClass =
  "rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-2 focus:outline-offset-2 focus:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100 focus:outline-2 focus:outline-offset-2 focus:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-50";

export const iconButtonClass =
  "h-8 w-8 rounded border border-slate-300 bg-white text-base leading-none text-slate-900 hover:bg-slate-100 focus:outline-2 focus:outline-offset-2 focus:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-40";

export const linkClass = "text-slate-900 underline underline-offset-2 hover:text-slate-600";

export function statusClass(ok: boolean): string {
  return ok ? "text-sm text-green-800" : "text-sm text-red-800";
}
