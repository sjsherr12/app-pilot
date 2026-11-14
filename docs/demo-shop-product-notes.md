# Northstar Goods — Product Notes

Northstar Goods is a small online store for everyday home and travel goods. This document
describes how the storefront works from a customer's point of view: the pages, the flows,
and the pricing rules. It is maintained by the storefront team and is the reference for
expected behavior.

The storefront runs at `http://localhost:3001` in development.

## At a glance

- Six products, each with its own product page.
- A shopping cart that works for guests and signed-in customers.
- Coupon codes applied in the cart.
- Checkout for signed-in customers, with an order confirmation page.
- Order history with a detail page for each order.
- An account page where customers manage their display name and email preferences.

## Catalog

The home page (`/`) is the catalog. It lists every product with its name, price, a picture, and an
**Add to cart** button. Each button is labelled for assistive technology as
"Add *product name* to cart" so it can be told apart from the others. Adding a product from the
catalog adds one unit and shows a short confirmation ("Added *product name* to cart") next to
the button. The cart count in the header updates immediately.

| Product | Price |
| --- | --- |
| Aurora Desk Lamp | $39.00 |
| Canvas Tote Bag | $18.50 |
| Ceramic Pour-Over Set | $64.00 |
| Merino Wool Beanie | $24.00 |
| Walnut Phone Stand | $29.00 |
| Stainless Water Bottle | $22.00 |

All prices include tax. The checkout never adds tax on top of the listed prices.

### Product pages

Each product name links to its product page at `/products/<slug>` (for example
`/products/canvas-tote-bag`). The product page shows the picture, name, price, and description,
a **Quantity** field (1 to 20, default 1) and an **Add to cart** button. Adding from the product
page adds the chosen quantity and confirms with "Added *N* × *product name* to cart" (or
"Added *product name* to cart" when the quantity is 1).

Product slugs: `aurora-desk-lamp`, `canvas-tote-bag`, `ceramic-pour-over-set`,
`merino-wool-beanie`, `walnut-phone-stand`, `stainless-water-bottle`.

## Cart

The cart page (`/cart`) lists each line with the product name, unit price, quantity, and line
total, followed by an order summary.

- Each line has **Increase quantity for *product***, **Decrease quantity for *product*** and
  **Remove *product*** controls. Decrease is disabled at a quantity of 1; use Remove to take the
  line out of the cart.
- The **line total** is always the unit price multiplied by the quantity.
- The **Subtotal** is the sum of all line totals.
- **Shipping** is free when the subtotal (before any discount) is $50.00 or more. Below that,
  shipping is a flat $5.99.
- **Total** = Subtotal − Discount + Shipping.
- The cart page says "Prices include tax." and states the free-shipping threshold so customers
  can plan their order.

When the cart is empty, the page says "Your cart is empty." and offers a **Continue shopping**
link.

### Coupon codes

The cart has a **Coupon code** field and an **Apply coupon** button. The result is shown in a
message directly below the field.

- `WELCOME10` takes 10% off the subtotal. It is valid **on a customer's first order only**.
  - If the customer has not placed an order yet (including guests who are not signed in), the
    message reads "Coupon WELCOME10 applied" and a "Discount (WELCOME10)" line appears in the
    summary.
  - If the customer has already placed an order, the message reads
    "WELCOME10 is valid on your first order only" and the totals do not change.
  - If a guest applies `WELCOME10` and then signs in to an account that already has an order,
    the coupon is dropped when the carts are merged, because it no longer applies.
- Any other code shows "Invalid coupon code" and the totals do not change.
- Codes are case-insensitive (`welcome10` works).
- An applied coupon can be taken off with **Remove coupon** ("Coupon removed").
- Only one coupon can be applied at a time, and the discount is always calculated on the
  current subtotal.

The free-shipping threshold is checked against the subtotal **before** the discount, so applying
a coupon never adds a shipping charge.

### Guest carts

Customers can fill a cart before signing in. When they sign in or create an account, the guest
cart is merged into the account's cart (quantities for the same product are added together).
A cart belongs to the account afterwards, so it is still there after signing out and back in.

## Checkout

The **Proceed to checkout** link on the cart page leads to `/checkout`. Checkout requires a
signed-in customer: a guest is sent to the sign-in page first and returned to checkout
afterwards. Checkout with an empty cart returns the customer to the cart.

The checkout page shows the order summary and a shipping form with **Full name** (pre-filled
with the account's display name), **Address**, **City** and **ZIP code**. All four fields are
required. **Place order** creates the order, empties the cart, and opens the confirmation page.

Payment is not collected in this release; orders are recorded as confirmed when they are
placed.

## Orders

### Order numbers

Orders are numbered from **1** and count up by one for every order placed in the store, so the
store's very first order is order #1. Order numbers are shown as "Order #1".

### Confirmation page

After placing an order the customer lands on `/orders/confirmation/<order number>`. The page
thanks the customer, shows the order number, the lines, and the totals (Subtotal, Discount if
any, Shipping, Total), and offers two links:

- **View order** — opens the detail page for that same order (`/orders/<order number>`).
- **Continue shopping** — returns to the catalog.

### Order history

`/orders` lists the signed-in customer's orders (newest first) with the order number, date,
item count and total. Each row links to the order's detail page. A customer with no orders
sees "You have no orders yet."

`/orders/<order number>` shows the full order: status, date, shipping address, lines and totals.
Customers can only open their own orders. An order number that does not exist, or that belongs
to a different customer, shows an "Order not found" page.

## Accounts

### Signing in and registering

- `/login` — **Email**, **Password**, **Sign in**. A wrong email or password shows
  "Invalid email or password".
- `/register` — **Display name**, **Email**, **Password** (at least 6 characters),
  **Create account**. Registering signs the customer in straight away.
- `/logout` — a **Sign out** button. The header shows **Sign in** for guests and **Sign out** for
  signed-in customers.

Both sign-in and registration accept a `next` parameter so a customer sent to sign in from
checkout is returned to checkout afterwards.

### Account page

`/account` is where a signed-in customer manages their profile:

- **Display name** — the name shown on the account and pre-filled as the full name at checkout.
  Customers can change it at any time; the new name is kept and shown on every later visit.
- **Email me about new products** — a checkbox for marketing email. It is off by default.
- **Save changes** — saves both fields and confirms with the message "Saved".

The account email address is shown on the page but cannot be changed in this release.

## Navigation

Every page has the same header: the **Northstar Goods** logo (links to the catalog), then
**Shop**, **Cart (N)** where N is the number of items in the cart, **Orders**, **Account**, and
**Sign in** or **Sign out**. A "Skip to main content" link is available for keyboard users.

Every button and link has a text label, every form field has a visible label, and confirmation
messages are announced to assistive technology.

## Demo account

A demo customer is available for walkthroughs:

- Email: `demo@apppilot.dev`
- Password: `demo1234`
- Display name: Demo User

The demo account starts with no orders and an empty cart.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Catalog |
| `/products/<slug>` | Product page |
| `/cart` | Shopping cart and coupons |
| `/checkout` | Shipping details and Place order (signed-in only) |
| `/orders/confirmation/<id>` | Order confirmation |
| `/orders` | Order history (signed-in only) |
| `/orders/<id>` | Order detail (signed-in only) |
| `/login` | Sign in |
| `/register` | Create account |
| `/logout` | Sign out |
| `/account` | Profile settings (signed-in only) |
