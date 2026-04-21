import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import SectionHeading from "@/components/ui/SectionHeading";
import { FAQ_TOPICS } from "@/data/faqTopics";

export const metadata = {
  title: "FAQs — RMV Clusters",
  description:
    "Frequently asked questions for RMV Clusters residents, organised by topic.",
};

export default function FAQLandingPage() {
  return (
    <div className="py-10 sm:py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Frequently Asked Questions"
          subtitle="Pick a topic to see answers to common questions."
        />

        {/* Topic cards. Single column on mobile, 2 columns on sm+ for
            denser scanning. Each card is a full-width tap target so it
            stays comfortable on phones. */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {FAQ_TOPICS.map((topic) => (
            <Link
              key={topic.slug}
              href={`/faq/${topic.slug}`}
              className="group relative flex flex-col p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md transition-all"
            >
              {topic.isNew && (
                <span className="absolute top-3 right-3 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  New
                </span>
              )}

              <div className="flex items-start gap-3 mb-2">
                <span className="text-3xl leading-none shrink-0">{topic.emoji}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">
                    {topic.title}
                  </h3>
                  {topic.publishedAt && (
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mt-0.5">
                      Published {topic.publishedAt}
                    </p>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 leading-snug mb-3">
                {topic.description}
              </p>

              <div className="mt-auto flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{topic.items.length} question{topic.items.length === 1 ? "" : "s"}</span>
                <span className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 font-medium group-hover:gap-2 transition-all">
                  Read
                  <ChevronRight size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Helper note at the bottom */}
        <div className="mt-10 text-center text-sm text-gray-500 dark:text-gray-400">
          <p className="inline-flex items-center gap-1.5">
            <FileText size={14} />
            More topics will be added over time. Suggestions? Reach out to the committee.
          </p>
        </div>
      </div>
    </div>
  );
}
