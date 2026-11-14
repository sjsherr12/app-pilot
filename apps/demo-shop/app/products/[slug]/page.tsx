import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartForm } from "@/components/add-to-cart-form";
import { ProductImage } from "@/components/product-image";
import { linkClass } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { getProduct } from "@/lib/products";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  return { title: product ? product.name : "Product not found" };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) {
    notFound();
  }

  return (
    <article className="grid gap-8 md:grid-cols-2">
      <ProductImage product={product} />
      <div>
        <p className="text-sm">
          <Link href="/" className={linkClass}>
            Back to shop
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold">{product.name}</h1>
        <p className="mt-2 text-xl text-slate-800">
          {formatMoney(product.price)}
        </p>
        <p className="mt-4 text-slate-700">{product.description}</p>
        <AddToCartForm slug={product.slug} name={product.name} withQuantity />
      </div>
    </article>
  );
}
