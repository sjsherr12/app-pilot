import Link from "next/link";
import { changeQuantity, removeLine } from "@/app/actions/cart";
import { formatMoney } from "@/lib/format";
import type { OrderLine } from "@/lib/store";
import { iconButtonClass, linkClass, secondaryButtonClass } from "./ui";

type Props = {
  lines: OrderLine[];
  caption: string;
  /** Cart variant: quantity buttons and a Remove button per line. */
  editable?: boolean;
};

export function LinesTable({ lines, caption, editable = false }: Props) {
  return (
    <table className="w-full border-collapse text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-slate-200 text-slate-600">
          <th scope="col" className="py-2 pr-4 font-medium">
            Product
          </th>
          <th scope="col" className="py-2 pr-4 font-medium">
            Unit price
          </th>
          <th scope="col" className="py-2 pr-4 font-medium">
            Quantity
          </th>
          <th scope="col" className="py-2 pr-4 font-medium">
            Line total
          </th>
          {editable && (
            <th scope="col" className="py-2 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.slug} className="border-b border-slate-100">
            <th scope="row" className="py-3 pr-4 font-medium">
              <Link href={`/products/${line.slug}`} className={linkClass}>
                {line.name}
              </Link>
            </th>
            <td className="py-3 pr-4">{formatMoney(line.unitPrice)}</td>
            <td className="py-3 pr-4">
              {editable ? (
                <div className="flex items-center gap-2">
                  <form action={changeQuantity}>
                    <input type="hidden" name="slug" value={line.slug} />
                    <input type="hidden" name="delta" value="-1" />
                    <button
                      type="submit"
                      className={iconButtonClass}
                      aria-label={`Decrease quantity for ${line.name}`}
                      disabled={line.quantity <= 1}
                    >
                      −
                    </button>
                  </form>
                  <span
                    className="min-w-6 text-center tabular-nums"
                    data-testid={`quantity-${line.slug}`}
                  >
                    {line.quantity}
                  </span>
                  <form action={changeQuantity}>
                    <input type="hidden" name="slug" value={line.slug} />
                    <input type="hidden" name="delta" value="1" />
                    <button
                      type="submit"
                      className={iconButtonClass}
                      aria-label={`Increase quantity for ${line.name}`}
                      disabled={line.quantity >= 20}
                    >
                      +
                    </button>
                  </form>
                </div>
              ) : (
                <span className="tabular-nums">{line.quantity}</span>
              )}
            </td>
            <td
              className="py-3 pr-4 tabular-nums"
              data-testid={`line-total-${line.slug}`}
            >
              {formatMoney(line.lineTotal)}
            </td>
            {editable && (
              <td className="py-3">
                <form action={removeLine}>
                  <input type="hidden" name="slug" value={line.slug} />
                  <button
                    type="submit"
                    className={secondaryButtonClass}
                    aria-label={`Remove ${line.name}`}
                  >
                    Remove
                  </button>
                </form>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
