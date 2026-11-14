/**
 * In-memory, per-tenant application state.
 *
 * Every tenant (selected by the `apx_tenant` cookie, see ./tenant.ts) gets an
 * isolated copy of the seed data, so several browser contexts can exercise one
 * server concurrently. State lives on globalThis so it survives module reloads.
 */

export type User = {
  id: string;
  email: string;
  /** Plain text: this is a demo store with throwaway accounts. */
  password: string;
  displayName: string;
  marketingOptIn: boolean;
  createdAt: string;
};

export type CartLine = { slug: string; quantity: number };

export type Cart = {
  lines: CartLine[];
  /** Applied coupon code (upper case) or null. */
  coupon: string | null;
};

export type OrderLine = {
  slug: string;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type ShippingAddress = {
  fullName: string;
  address: string;
  city: string;
  zip: string;
};

export type Order = {
  id: number;
  userId: string;
  createdAt: string;
  status: "confirmed";
  lines: OrderLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  coupon: string | null;
  shippingAddress: ShippingAddress;
};

export type TenantState = {
  /** userId -> user */
  users: Map<string, User>;
  /** session token -> userId */
  sessions: Map<string, string>;
  /** cart key ("user:<id>" or "guest:<token>") -> cart */
  carts: Map<string, Cart>;
  /** order id -> order */
  orders: Map<number, Order>;
  nextOrderId: number;
};

declare global {
  var __apxStore: Map<string, TenantState> | undefined;
}

export const DEMO_USER = {
  id: "u_demo",
  email: "demo@apppilot.dev",
  password: "demo1234",
  displayName: "Demo User",
} as const;

export const MAX_QUANTITY = 20;

function seedTenant(): TenantState {
  const users = new Map<string, User>();
  users.set(DEMO_USER.id, {
    id: DEMO_USER.id,
    email: DEMO_USER.email,
    password: DEMO_USER.password,
    displayName: DEMO_USER.displayName,
    marketingOptIn: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  return {
    users,
    sessions: new Map(),
    carts: new Map(),
    orders: new Map(),
    nextOrderId: 1,
  };
}

export function getStore(): Map<string, TenantState> {
  if (!globalThis.__apxStore) {
    globalThis.__apxStore = new Map();
  }
  return globalThis.__apxStore;
}

/** Returns the tenant's state, seeding it on first access. */
export function getTenantState(tenant: string): TenantState {
  const store = getStore();
  let state = store.get(tenant);
  if (!state) {
    state = seedTenant();
    store.set(tenant, state);
  }
  return state;
}

/** Replaces the tenant's state with fresh seed data. */
export function resetTenant(tenant: string): TenantState {
  const state = seedTenant();
  getStore().set(tenant, state);
  return state;
}

// ---------------------------------------------------------------------------
// Users & sessions

export function findUserByEmail(
  state: TenantState,
  email: string,
): User | undefined {
  const needle = email.trim().toLowerCase();
  for (const user of state.users.values()) {
    if (user.email.toLowerCase() === needle) return user;
  }
  return undefined;
}

export function createUser(
  state: TenantState,
  input: { email: string; password: string; displayName: string },
): User {
  const user: User = {
    id: `u_${crypto.randomUUID().slice(0, 8)}`,
    email: input.email.trim().toLowerCase(),
    password: input.password,
    displayName: input.displayName.trim(),
    marketingOptIn: false,
    createdAt: new Date().toISOString(),
  };
  state.users.set(user.id, user);
  return user;
}

export function createSession(state: TenantState, userId: string): string {
  const token = crypto.randomUUID();
  state.sessions.set(token, userId);
  return token;
}

export function getSessionUser(
  state: TenantState,
  token: string | undefined,
): User | undefined {
  if (!token) return undefined;
  const userId = state.sessions.get(token);
  return userId ? state.users.get(userId) : undefined;
}

export function deleteSession(state: TenantState, token: string | undefined) {
  if (token) state.sessions.delete(token);
}

// ---------------------------------------------------------------------------
// Carts

export const userCartKey = (userId: string) => `user:${userId}`;
export const guestCartKey = (token: string) => `guest:${token}`;

export function emptyCart(): Cart {
  return { lines: [], coupon: null };
}

/** Read-only view of a cart; returns an empty cart (not stored) when missing. */
export function peekCart(state: TenantState, key: string | null): Cart {
  if (!key) return emptyCart();
  return state.carts.get(key) ?? emptyCart();
}

export function getOrCreateCart(state: TenantState, key: string): Cart {
  let cart = state.carts.get(key);
  if (!cart) {
    cart = emptyCart();
    state.carts.set(key, cart);
  }
  return cart;
}

export function addToCart(cart: Cart, slug: string, quantity: number) {
  const line = cart.lines.find((l) => l.slug === slug);
  if (line) {
    line.quantity = Math.min(MAX_QUANTITY, line.quantity + quantity);
  } else {
    cart.lines.push({ slug, quantity: Math.min(MAX_QUANTITY, quantity) });
  }
}

export function changeQuantity(cart: Cart, slug: string, delta: number) {
  const line = cart.lines.find((l) => l.slug === slug);
  if (!line) return;
  const next = line.quantity + delta;
  if (next < 1) {
    // Decrease is disabled at quantity 1 in the UI; keep the line at 1.
    line.quantity = 1;
    return;
  }
  line.quantity = Math.min(MAX_QUANTITY, next);
}

export function removeLine(cart: Cart, slug: string) {
  cart.lines = cart.lines.filter((l) => l.slug !== slug);
}

export function cartItemCount(cart: Cart): number {
  return cart.lines.reduce((sum, l) => sum + l.quantity, 0);
}

/**
 * Merges a guest cart into a user's cart (quantities for the same product are
 * added together) and removes the guest cart. A WELCOME10 coupon carried over
 * from the guest cart is kept only while the user is still on their first order.
 */
export function mergeGuestCartIntoUser(
  state: TenantState,
  guestKey: string | null,
  userId: string,
) {
  if (!guestKey) return;
  const guest = state.carts.get(guestKey);
  if (!guest) return;
  const target = getOrCreateCart(state, userCartKey(userId));
  for (const line of guest.lines) {
    addToCart(target, line.slug, line.quantity);
  }
  if (guest.coupon && !target.coupon && countUserOrders(state, userId) === 0) {
    target.coupon = guest.coupon;
  }
  state.carts.delete(guestKey);
}

// ---------------------------------------------------------------------------
// Orders

export function countUserOrders(state: TenantState, userId: string): number {
  let n = 0;
  for (const order of state.orders.values()) {
    if (order.userId === userId) n++;
  }
  return n;
}

/** The user's orders, newest first. */
export function listUserOrders(state: TenantState, userId: string): Order[] {
  return [...state.orders.values()]
    .filter((o) => o.userId === userId)
    .sort((a, b) => b.id - a.id);
}

export function getUserOrder(
  state: TenantState,
  userId: string,
  id: number,
): Order | undefined {
  const order = state.orders.get(id);
  return order && order.userId === userId ? order : undefined;
}

export function createOrder(
  state: TenantState,
  input: Omit<Order, "id" | "createdAt" | "status">,
): Order {
  const order: Order = {
    ...input,
    id: state.nextOrderId,
    createdAt: new Date().toISOString(),
    status: "confirmed",
  };
  state.nextOrderId += 1;
  state.orders.set(order.id, order);
  return order;
}
