# Northstar Goods — AppPilot demo shop

A small, deterministic e-commerce storefront that AppPilot explores, verifies
and writes regression tests against. Next.js 16 (App Router, Server Actions,
Tailwind 4), no database: all state lives in memory, namespaced per tenant.

```bash
npm install
npm run build && APX_TEST_HOOKS=1 npm run start:prod   # http://localhost:3001
# or: make shop (from the repo root)
```

`npm run dev` also serves on port 3001.

## Tenants

Every request is scoped by the `apx_tenant` cookie (default `"default"`,
allowed `[A-Za-z0-9_-]{1,64}`). Each tenant has its own users, sessions, carts
and orders, seeded on first access with the catalog and the demo user
`demo@apppilot.dev` / `demo1234` ("Demo User"). Order ids start at 1 per
tenant. Set the cookie in a browser context before the first navigation and
two agents can share one server without seeing each other's state.

Other cookies: `apx_session` (session token → user id, within the tenant) and
`apx_cart` (guest cart token; merged into the user's cart on login).

## Test hooks (only when `APX_TEST_HOOKS=1`, otherwise 404)

| Method | Path | Effect |
| --- | --- | --- |
| `POST` | `/__test/reset?tenant=X` | Reset tenant X to seed state → `{"ok":true,"tenant":"X"}` |
| `GET` | `/__test/bugs` | Current seeded-bug flags |
| `POST` | `/__test/bugs` | Merge a partial `{flag: boolean}` body, return all flags |

Bug flags are process-global (not per tenant) and default to `true`.

## Seeded bugs (`lib/bugs.ts`)

| Flag | Symptom |
| --- | --- |
| `cart_quantity_total` | Any cart line with quantity ≥ 3 contributes `price × 1` to the line total and subtotal. |
| `profile_name_not_persisted` | Account save shows "Saved" and persists the marketing checkbox, but ignores the display name; the old name is back after reload. |
| `first_order_link_404` | The confirmation page's "View order" link points at `/orders/{id - 1}`, so the first order links to `/orders/0` → "Order not found". |

Decoy (correct behaviour): coupon `WELCOME10` gives 10% off the subtotal on a
customer's first order only. A customer who already has an order sees
"WELCOME10 is valid on your first order only" and totals do not change.

See `docs/demo-shop-product-notes.md` for the customer-facing product notes
(routes, labels, pricing rules) that AppPilot is given as context.

## Layout

- `app/` routes; `app/actions/*` Server Actions; `app/api/test-hooks/*` the
  hook handlers (reached through a rewrite from `/__test/*`, because App Router
  folders starting with `_` are private).
- `lib/store.ts` per-tenant state on `globalThis.__apxStore`; `lib/tenant.ts`
  cookie → tenant; `lib/auth.ts` sessions and cart keys; `lib/pricing.ts`
  totals, shipping and coupon rules; `lib/bugs.ts` flags.
- `components/` server tables/header and small client forms (`useActionState`).
