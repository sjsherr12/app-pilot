import { TopNav } from "@/components/top-nav";

/** The product console: runs list and live run pages, under the compact application nav. */
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </>
  );
}
