import { SiteNav } from "@/components/landing/site-nav";
import { SiteFooter } from "@/components/landing/site-footer";

/** The public site: full marketing nav, long-form landing page, and footer. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      <SiteFooter />
    </>
  );
}
