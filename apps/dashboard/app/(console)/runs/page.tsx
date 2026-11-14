import type { Metadata } from "next";
import { RunsPage } from "@/components/runs/runs-page";

export const metadata: Metadata = {
  title: "Runs",
};

export default function Page() {
  return <RunsPage />;
}
