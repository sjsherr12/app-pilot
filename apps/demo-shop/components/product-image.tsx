import type { Product } from "@/lib/products";

/**
 * Decorative product picture: the product name is always rendered as text
 * next to it, so the image carries an empty alt.
 */
export function ProductImage({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={product.image}
      alt=""
      width={400}
      height={300}
      className={`block w-full rounded-md ${className}`}
    />
  );
}
