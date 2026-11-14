import type { Metadata } from "next";
import Link from "next/link";
import { AddToCartForm } from "@/components/add-to-cart-form";
import { ProductImage } from "@/components/product-image";
import { linkClass } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { PRODUCTS } from "@/lib/products";

export const metadata: Metadata = { title: "Shop" };

export default function CatalogPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Shop</h1>
      <p className="mt-1 text-slate-600">
        Everyday goods for home and travel. Prices include tax. Shipping is
        free on subtotals of $50.00 or more.
      </p>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTS.map((product) => (
          <li
            key={product.slug}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <ProductImage product={product} />
            <h2 className="mt-3 text-base font-medium">
              <Link href={`/products/${product.slug}`} className={linkClass}>
                {product.name}
              </Link>
            </h2>
            <p className="mt-1 text-slate-700">{formatMoney(product.price)}</p>
            <AddToCartForm slug={product.slug} name={product.name} />
          </li>
        ))}
      </ul>
    </>
  );
}
