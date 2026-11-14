import { Hero } from "./hero";
import { Marquee } from "./marquee";
import { StatsBand } from "./stats-band";
import { HowItWorks } from "./how-it-works";
import { Evidence } from "./evidence";
import { TestProof } from "./test-proof";
import { Closing } from "./closing";

export function Landing() {
  return (
    <div className="flex flex-col">
      <Hero />
      <Marquee />
      <StatsBand />
      <HowItWorks />
      <Evidence />
      <TestProof />
      <Closing />
    </div>
  );
}
