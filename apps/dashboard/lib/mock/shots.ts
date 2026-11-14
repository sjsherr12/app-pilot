// Renders fake "screenshots" of the demo shop as SVG so the mock API can serve
// /artifacts/<run>/shots/sNNNN.png without a real browser.

export type Scene =
  | "home"
  | "catalog"
  | "product"
  | "product_added"
  | "cart"
  | "cart_negative"
  | "cart_coupon_typed"
  | "cart_coupon_once"
  | "cart_coupon_twice"
  | "search_empty"
  | "search_results"
  | "checkout"
  | "checkout_invalid"
  | "checkout_disabled"
  | "blank"
  | "error_502"
  | "unreachable";

const W = 1280;
const H = 800;
const FONT = `font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"`;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function text(x: number, y: number, s: string, size: number, color = "#111827", weight = 400, anchor = "start") {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}" ${FONT}>${esc(s)}</text>`;
}

function rect(x: number, y: number, w: number, h: number, fill: string, r = 0, stroke?: string, sw = 1.5) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ""}/>`;
}

function header(cartCount: number) {
  return [
    rect(0, 0, W, 64, "#ffffff"),
    rect(0, 64, W, 1, "#e5e7eb"),
    rect(40, 20, 24, 24, "#111827", 6),
    text(74, 38, "DEMO SHOP", 16, "#111827", 700),
    text(560, 38, "Shop all", 14, "#4b5563"),
    text(650, 38, "Collections", 14, "#4b5563"),
    text(760, 38, "Sale", 14, "#4b5563"),
    text(1120, 38, "Search", 14, "#4b5563"),
    text(1200, 38, `Cart (${cartCount})`, 14, "#111827", 600),
  ].join("");
}

const PRODUCTS = [
  ["Trail Runner Jacket", "$129.00"],
  ["Summit Backpack 32L", "$149.00"],
  ["Merino Base Layer", "$68.00"],
  ["Ridge Hiking Boots", "$189.00"],
  ["Alpine Wool Beanie", "$32.00"],
  ["Trek Softshell Pants", "$98.00"],
  ["Insulated Flask 750ml", "$36.00"],
  ["Daybreak Sunglasses", "$74.00"],
];

const SWATCH = ["#cbd5e1", "#a7f3d0", "#fde68a", "#c7d2fe", "#fbcfe8", "#bae6fd", "#ddd6fe", "#fecaca"];

function productCard(x: number, y: number, w: number, i: number) {
  const [name, price] = PRODUCTS[i % PRODUCTS.length];
  return [
    rect(x, y, w, w * 0.9, SWATCH[i % SWATCH.length], 10),
    text(x, y + w * 0.9 + 28, name, 15, "#111827", 600),
    text(x, y + w * 0.9 + 50, price, 14, "#4b5563"),
  ].join("");
}

function button(x: number, y: number, w: number, label: string, opts: { disabled?: boolean; outline?: boolean } = {}) {
  const fill = opts.disabled ? "#d1d5db" : opts.outline ? "#ffffff" : "#111827";
  const color = opts.disabled ? "#6b7280" : opts.outline ? "#111827" : "#ffffff";
  return rect(x, y, w, 44, fill, 8, opts.outline ? "#111827" : undefined) + text(x + w / 2, y + 28, label, 15, color, 600, "middle");
}

function input(x: number, y: number, w: number, value: string, opts: { placeholder?: boolean; error?: boolean; focus?: boolean } = {}) {
  const stroke = opts.error ? "#ef4444" : opts.focus ? "#3b82f6" : "#d1d5db";
  const color = opts.placeholder ? "#9ca3af" : opts.error ? "#b91c1c" : "#111827";
  return rect(x, y, w, 44, "#ffffff", 8, stroke, opts.error || opts.focus ? 2 : 1.5) + text(x + 14, y + 28, value, 15, color);
}

function toast(label: string) {
  return rect(900, 84, 340, 56, "#064e3b", 10) + text(924, 118, label, 15, "#d1fae5", 600);
}

function cartScene(variant: Scene) {
  const negative = variant === "cart_negative";
  const couponTyped = variant === "cart_coupon_typed";
  const couponOnce = variant === "cart_coupon_once";
  const couponTwice = variant === "cart_coupon_twice";
  const qty = negative ? "-3" : "1";
  const sub = negative ? "-$387.00" : "$129.00";
  const discounts = couponOnce ? 1 : couponTwice ? 2 : 0;
  const total = negative ? "-$379.00" : couponOnce ? "$124.10" : couponTwice ? "$111.20" : "$137.00";
  const red = negative ? "#dc2626" : "#111827";
  const parts = [
    header(1),
    text(80, 130, "Your cart", 30, "#111827", 700),
    rect(80, 160, 740, 150, "#ffffff", 12, "#e5e7eb"),
    rect(100, 180, 110, 110, "#cbd5e1", 10),
    text(230, 212, "Trail Runner Jacket", 18, "#111827", 600),
    text(230, 238, "Color: Moss  ·  Size: M", 13, "#6b7280"),
    text(760, 212, "$129.00", 17, "#111827", 600, "end"),
    text(230, 288, "Qty", 13, "#6b7280"),
    rect(265, 258, 90, 40, "#ffffff", 8, negative ? "#ef4444" : "#d1d5db", negative ? 2 : 1.5),
    text(280, 285, qty, 16, red, 600),
    text(380, 285, "Remove", 13, "#6b7280"),
    // coupon box
    rect(80, 330, 740, 90, "#ffffff", 12, "#e5e7eb"),
    text(100, 362, "Coupon code", 13, "#6b7280"),
    input(100, 370, 300, couponTyped || couponOnce || couponTwice ? "SAVE10" : "Enter code", {
      placeholder: !(couponTyped || couponOnce || couponTwice),
      focus: couponTyped,
    }),
    button(416, 370, 120, "Apply", { outline: true }),
  ];
  if (couponOnce || couponTwice) {
    parts.push(rect(560, 380, 240, 26, "#ecfdf5", 6), text(575, 398, "Coupon SAVE10 applied", 13, "#047857", 600));
  }
  // summary
  const sx = 860;
  const sh = 230 + discounts * 28;
  parts.push(rect(sx, 160, 340, sh, "#ffffff", 12, "#e5e7eb"), text(sx + 24, 196, "Order summary", 17, "#111827", 600));
  let y = 236;
  parts.push(text(sx + 24, y, "Subtotal", 14, "#4b5563"), text(sx + 316, y, sub, 14, red, 400, "end"));
  for (let i = 0; i < discounts; i++) {
    y += 28;
    parts.push(text(sx + 24, y, "Discount SAVE10 (10%)", 14, "#047857"), text(sx + 316, y, "-$12.90", 14, "#047857", 400, "end"));
  }
  y += 28;
  parts.push(text(sx + 24, y, "Shipping", 14, "#4b5563"), text(sx + 316, y, "$8.00", 14, "#4b5563", 400, "end"));
  y += 20;
  parts.push(rect(sx + 24, y, 292, 1, "#e5e7eb"));
  y += 34;
  parts.push(text(sx + 24, y, "Total", 17, "#111827", 700), text(sx + 316, y, total, 17, red, 700, "end"));
  parts.push(button(sx + 24, y + 22, 292, "Checkout"));
  return parts.join("");
}

function checkoutScene(variant: Scene) {
  const invalid = variant === "checkout_invalid";
  const filled = variant === "checkout_disabled";
  const email = invalid ? "not-an-email" : filled ? "qa@example.com" : "you@example.com";
  const parts = [
    header(1),
    text(80, 130, "Checkout", 30, "#111827", 700),
    rect(80, 160, 740, 560, "#ffffff", 12, "#e5e7eb"),
    text(104, 198, "Contact", 17, "#111827", 600),
    text(104, 228, "Email", 13, "#6b7280"),
    input(104, 238, 690, email, { placeholder: !invalid && !filled, error: invalid }),
  ];
  if (invalid) parts.push(text(104, 304, "Enter a valid email address", 13, "#dc2626"));
  parts.push(
    text(104, 346, "Shipping address", 17, "#111827", 600),
    text(104, 376, "Full name", 13, "#6b7280"),
    input(104, 386, 690, filled || invalid ? "Quinn Avery" : "Full name", { placeholder: !(filled || invalid) }),
    text(104, 456, "Address", 13, "#6b7280"),
    input(104, 466, 690, filled || invalid ? "12 Nassau St" : "Street address", { placeholder: !(filled || invalid) }),
    text(104, 536, "City", 13, "#6b7280"),
    input(104, 546, 330, filled || invalid ? "Princeton" : "City", { placeholder: !(filled || invalid) }),
    text(464, 536, "ZIP", 13, "#6b7280"),
    input(464, 546, 330, filled || invalid ? "08544" : "ZIP", { placeholder: !(filled || invalid) }),
    rect(860, 160, 340, 250, "#ffffff", 12, "#e5e7eb"),
    text(884, 196, "Order summary", 17, "#111827", 600),
    text(884, 236, "Trail Runner Jacket × 1", 14, "#4b5563"),
    text(1176, 236, "$129.00", 14, "#4b5563", 400, "end"),
    text(884, 264, "Shipping", 14, "#4b5563"),
    text(1176, 264, "$8.00", 14, "#4b5563", 400, "end"),
    rect(884, 284, 292, 1, "#e5e7eb"),
    text(884, 318, "Total", 17, "#111827", 700),
    text(1176, 318, "$137.00", 17, "#111827", 700, "end"),
    button(884, 342, 292, "Place order", { disabled: true }),
  );
  if (filled) parts.push(text(884, 440, "Button remained disabled after a valid email was entered", 12, "#b45309"));
  return parts.join("");
}

function searchScene(variant: Scene) {
  const parts = [
    header(1),
    text(80, 130, "Search", 30, "#111827", 700),
    input(80, 160, 620, "jacket ", { focus: true }),
    button(716, 160, 120, "Search"),
  ];
  if (variant === "search_empty") {
    parts.push(
      text(80, 250, "No results for “jacket ”", 20, "#111827", 600),
      text(80, 280, "Try a different search term or browse the catalog.", 14, "#6b7280"),
    );
  } else {
    parts.push(text(80, 244, "3 results for “jacket”", 15, "#6b7280"));
    parts.push(productCard(80, 270, 260, 0), productCard(380, 270, 260, 5), productCard(680, 270, 260, 1));
  }
  return parts.join("");
}

function productScene(added: boolean) {
  return [
    header(added ? 1 : 0),
    text(80, 104, "Shop all  ›  Jackets  ›  Trail Runner Jacket", 13, "#6b7280"),
    rect(80, 130, 540, 540, "#cbd5e1", 14),
    rect(120, 170, 460, 460, "#94a3b8", 120),
    text(680, 180, "Trail Runner Jacket", 30, "#111827", 700),
    text(680, 216, "$129.00", 22, "#111827", 500),
    text(680, 250, "Lightweight, weather-resistant shell with reflective trim.", 14, "#4b5563"),
    text(680, 300, "Color", 13, "#6b7280"),
    rect(680, 312, 36, 36, "#4d7c0f", 18, "#111827", 2),
    rect(728, 312, 36, 36, "#1e3a8a", 18),
    rect(776, 312, 36, 36, "#111827", 18),
    text(680, 388, "Size", 13, "#6b7280"),
    ...["XS", "S", "M", "L", "XL"].map((s, i) =>
      rect(680 + i * 64, 400, 54, 40, s === "M" ? "#111827" : "#ffffff", 8, "#d1d5db") + text(707 + i * 64, 426, s, 14, s === "M" ? "#ffffff" : "#111827", 600, "middle"),
    ),
    text(680, 480, "Quantity", 13, "#6b7280"),
    input(680, 490, 110, "1"),
    button(680, 560, 300, added ? "Added ✓" : "Add to cart"),
    button(996, 560, 200, "Buy now", { outline: true }),
    added ? toast("Added to cart · View cart") : "",
  ].join("");
}

function homeScene() {
  return [
    header(0),
    rect(80, 96, 1120, 300, "url(#hero)", 16),
    text(130, 200, "New season essentials", 44, "#ffffff", 700),
    text(130, 244, "Trail-tested layers for cold mornings and long climbs.", 18, "#e2e8f0"),
    button(130, 290, 180, "Shop all"),
    text(80, 460, "Featured", 22, "#111827", 700),
    ...[0, 1, 2, 3].map((i) => productCard(80 + i * 290, 480, 250, i)),
  ].join("");
}

function catalogScene() {
  return [
    header(0),
    text(80, 120, "All products", 30, "#111827", 700),
    text(80, 148, "8 products", 14, "#6b7280"),
    ...[0, 1, 2, 3].map((i) => productCard(80 + i * 290, 180, 250, i)),
    ...[4, 5, 6, 7].map((i) => productCard(80 + (i - 4) * 290, 500, 250, i)),
  ].join("");
}

function errorScene(kind: "error_502" | "unreachable") {
  if (kind === "unreachable") {
    return [
      rect(0, 0, W, H, "#ffffff"),
      rect(300, 220, 80, 80, "#e5e7eb", 10),
      text(300, 360, "This site can’t be reached", 30, "#202124", 500),
      text(300, 400, "localhost refused to connect.", 16, "#5f6368"),
      text(300, 440, "ERR_CONNECTION_REFUSED", 14, "#5f6368"),
      button(300, 490, 120, "Reload", { outline: true }),
    ].join("");
  }
  return [
    rect(0, 0, W, H, "#fafafa"),
    text(640, 340, "502", 96, "#111827", 700, "middle"),
    text(640, 400, "Bad Gateway", 28, "#374151", 500, "middle"),
    text(640, 440, "The payment service did not respond. Please try again later.", 16, "#6b7280", 400, "middle"),
  ].join("");
}

export function renderShot(scene: Scene, url: string): string {
  let body: string;
  switch (scene) {
    case "home":
      body = homeScene();
      break;
    case "catalog":
      body = catalogScene();
      break;
    case "product":
      body = productScene(false);
      break;
    case "product_added":
      body = productScene(true);
      break;
    case "cart":
    case "cart_negative":
    case "cart_coupon_typed":
    case "cart_coupon_once":
    case "cart_coupon_twice":
      body = cartScene(scene);
      break;
    case "search_empty":
    case "search_results":
      body = searchScene(scene);
      break;
    case "checkout":
    case "checkout_invalid":
    case "checkout_disabled":
      body = checkoutScene(scene);
      break;
    case "error_502":
    case "unreachable":
      body = errorScene(scene);
      break;
    case "blank":
    default:
      body = rect(0, 0, W, H, "#ffffff");
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs><linearGradient id="hero" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f172a"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="#f9fafb"/>
${body}
<title>${esc(url)}</title>
</svg>`;
}
