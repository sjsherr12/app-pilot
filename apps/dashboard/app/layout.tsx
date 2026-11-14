import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TopNav } from "@/components/top-nav";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "AppPilot · Ship with proof, not hope.", template: "%s · AppPilot" },
  description:
    "Autonomous AI quality assurance for modern software. Explore applications, discover and reproduce bugs, and generate reliable regression tests across web and mobile.",
  applicationName: "AppPilot",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ colorScheme: "dark" }}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <TooltipProvider delayDuration={200}>
          <TopNav />
          <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        </TooltipProvider>
      </body>
    </html>
  );
}
