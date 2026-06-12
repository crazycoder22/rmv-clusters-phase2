import type { Metadata } from "next";
import guidelinesData from "@/data/guidelines.json";
import { formatDate } from "@/lib/utils";
import GuidelinesAccordion from "./GuidelinesAccordion";

export const metadata: Metadata = {
  title: "Community Guidelines",
  description:
    "Rules and guidelines for residents of RMV Clusters Phase II apartment complex.",
};

export default function GuidelinesPage() {
  return (
    <div className="py-12" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl" style={{ color: "var(--text)" }}>
            Community Guidelines
          </h1>
          <p className="mt-2" style={{ color: "var(--text-3)" }}>
            Community rules — last updated {formatDate(guidelinesData.lastUpdated)}
          </p>
          <div className="mx-auto mt-4 h-1 w-16 rounded" style={{ background: "var(--accent)" }} />
        </div>

        <GuidelinesAccordion />

        <p className="mt-8 text-center text-[13px]" style={{ color: "var(--text-3)" }}>
          Questions? Contact the office from the About page.
        </p>
      </div>
    </div>
  );
}
