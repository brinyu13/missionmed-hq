import type { Metadata } from "next";
import LearningStudio from "./LearningStudio";

export const metadata: Metadata = {
  title: "MissionMed Learning Studio · P4 Prototype",
  description:
    "A local synthetic flagship prototype for MissionMed learning sessions, analytics, and Founder review.",
  openGraph: {
    title: "MissionMed Learning Studio",
    description: "From fast recall to clinical reasoning — local synthetic P4 prototype.",
    images: ["/og.png"],
  },
};

export default function Home() {
  return <LearningStudio />;
}
