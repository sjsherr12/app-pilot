import type { Metadata } from "next";
import { RunPage } from "@/components/run/run-page";

export const metadata: Metadata = {
  title: "Run",
};

export default function Page() {
  return <RunPage />;
}
