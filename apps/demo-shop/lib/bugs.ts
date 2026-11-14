/**
 * Seeded-bug flags for the AppPilot demo.
 *
 * Flags are process-global (not per tenant) and default to ON, so a freshly
 * started server exhibits every bug. When APX_TEST_HOOKS=1 they can be read
 * with GET /__test/bugs and toggled live with POST /__test/bugs.
 */
export type BugFlags = {
  /** Cart lines with quantity >= 3 contribute price * 1 instead of price * quantity. */
  cart_quantity_total: boolean;
  /** Saving the account shows "Saved" but the display name is never persisted. */
  profile_name_not_persisted: boolean;
  /** The confirmation page's "View order" link points at order.id - 1. */
  first_order_link_404: boolean;
};

export const DEFAULT_BUG_FLAGS: Readonly<BugFlags> = {
  cart_quantity_total: true,
  profile_name_not_persisted: true,
  first_order_link_404: true,
};

export const BUG_FLAG_NAMES = Object.keys(DEFAULT_BUG_FLAGS) as Array<
  keyof BugFlags
>;

declare global {
  // eslint-disable-next-line no-var
  var __apxBugs: BugFlags | undefined;
}

export function getBugFlags(): BugFlags {
  if (!globalThis.__apxBugs) {
    globalThis.__apxBugs = { ...DEFAULT_BUG_FLAGS };
  }
  return globalThis.__apxBugs;
}

/** Merges boolean values for known flags; unknown keys and non-booleans are ignored. */
export function setBugFlags(patch: Record<string, unknown>): BugFlags {
  const flags = getBugFlags();
  for (const name of BUG_FLAG_NAMES) {
    const value = patch[name];
    if (typeof value === "boolean") {
      flags[name] = value;
    }
  }
  return flags;
}
