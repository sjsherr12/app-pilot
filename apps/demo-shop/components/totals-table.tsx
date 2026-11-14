import { formatMoney } from "@/lib/format";

export type TotalsLike = {
  subtotal: number;
  coupon: string | null;
  discount: number;
  shipping: number;
  total: number;
};

export function TotalsTable({ totals }: { totals: TotalsLike }) {
  return (
    <table className="w-full max-w-sm border-collapse text-sm">
      <caption className="sr-only">Order summary</caption>
      <tbody>
        <tr className="border-b border-slate-100">
          <th scope="row" className="py-2 text-left font-medium">
            Subtotal
          </th>
          <td className="py-2 text-right tabular-nums" data-testid="subtotal">
            {formatMoney(totals.subtotal)}
          </td>
        </tr>
        {totals.coupon && (
          <tr className="border-b border-slate-100">
            <th scope="row" className="py-2 text-left font-medium">
              Discount ({totals.coupon})
            </th>
            <td
              className="py-2 text-right tabular-nums"
              data-testid="discount"
            >
              −{formatMoney(totals.discount)}
            </td>
          </tr>
        )}
        <tr className="border-b border-slate-100">
          <th scope="row" className="py-2 text-left font-medium">
            Shipping
          </th>
          <td className="py-2 text-right tabular-nums" data-testid="shipping">
            {totals.shipping === 0 ? "Free" : formatMoney(totals.shipping)}
          </td>
        </tr>
        <tr>
          <th scope="row" className="py-2 text-left text-base font-semibold">
            Total
          </th>
          <td
            className="py-2 text-right text-base font-semibold tabular-nums"
            data-testid="total"
          >
            {formatMoney(totals.total)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
