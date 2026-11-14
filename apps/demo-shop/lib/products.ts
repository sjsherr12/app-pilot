export type Product = {
  slug: string;
  name: string;
  /** Unit price in cents. Prices include tax. */
  price: number;
  description: string;
  image: string;
};

export const PRODUCTS: readonly Product[] = [
  {
    slug: "aurora-desk-lamp",
    name: "Aurora Desk Lamp",
    price: 3900,
    description:
      "A warm, dimmable LED desk lamp with a weighted base and a touch control.",
    image: "/images/aurora-desk-lamp.svg",
  },
  {
    slug: "canvas-tote-bag",
    name: "Canvas Tote Bag",
    price: 1850,
    description:
      "Heavyweight natural canvas tote with reinforced handles and an interior pocket.",
    image: "/images/canvas-tote-bag.svg",
  },
  {
    slug: "ceramic-pour-over-set",
    name: "Ceramic Pour-Over Set",
    price: 6400,
    description:
      "A hand-glazed ceramic dripper and carafe for slow, even brewing.",
    image: "/images/ceramic-pour-over-set.svg",
  },
  {
    slug: "merino-wool-beanie",
    name: "Merino Wool Beanie",
    price: 2400,
    description: "Soft, breathable merino knit in a classic cuffed fit.",
    image: "/images/merino-wool-beanie.svg",
  },
  {
    slug: "walnut-phone-stand",
    name: "Walnut Phone Stand",
    price: 2900,
    description:
      "Solid walnut stand with a cable channel. Fits phones and small tablets.",
    image: "/images/walnut-phone-stand.svg",
  },
  {
    slug: "stainless-water-bottle",
    name: "Stainless Water Bottle",
    price: 2200,
    description:
      "Double-wall insulated 20 oz bottle that keeps drinks cold for 24 hours.",
    image: "/images/stainless-water-bottle.svg",
  },
];

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}
