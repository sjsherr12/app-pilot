const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** Formats an amount in cents as US dollars, e.g. 1850 -> "$18.50". */
export function formatMoney(cents: number): string {
  return usd.format(cents / 100);
}

const shortDate = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Formats an ISO timestamp as e.g. "Nov 13, 2026" (UTC, so it is stable). */
export function formatDate(iso: string): string {
  return shortDate.format(new Date(iso));
}
