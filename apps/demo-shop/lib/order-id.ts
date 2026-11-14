/** Parses a route param as an order id; null for anything that is not a non-negative integer. */
export function parseOrderId(raw: string): number | null {
  if (!/^\d{1,9}$/.test(raw)) return null;
  return Number(raw);
}
