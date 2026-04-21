import { notFound } from "next/navigation";
import { FAQ_TOPICS, getTopicBySlug } from "@/data/faqTopics";
import FAQAccordion from "@/components/faq/FAQAccordion";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";

// Pre-generate a static page per topic at build time.
export function generateStaticParams() {
  return FAQ_TOPICS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const topic = getTopicBySlug(slug);
  if (!topic) return { title: "FAQ — RMV Clusters" };
  return {
    title: `${topic.title} — FAQ`,
    description: topic.description,
  };
}

export default async function FAQTopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const topic = getTopicBySlug(slug);
  if (!topic) notFound();

  return (
    <div className="py-8 sm:py-10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          href="/faq"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-700 dark:hover:text-primary-300 mb-5"
        >
          <ArrowLeft size={14} />
          All FAQs
        </Link>

        {/* Topic header — emoji + title + description */}
        <header className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl sm:text-5xl leading-none">{topic.emoji}</span>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                {topic.title}
              </h1>
              {topic.publishedAt && (
                <p className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 mt-1">
                  Published {topic.publishedAt}
                </p>
              )}
            </div>
          </div>

          {topic.intro && (
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed mt-3">
              {topic.intro}
            </p>
          )}

          {/* Optional PDF download — useful for printing / sharing offline */}
          {topic.pdfUrl && (
            <a
              href={topic.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-200 hover:border-primary-400 dark:hover:border-primary-500"
            >
              <Download size={13} />
              Download PDF
            </a>
          )}
        </header>

        {/* Accordion of questions */}
        <FAQAccordion items={topic.items} />

        {/* Footer back-to-topics link for long pages */}
        <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
          <Link
            href="/faq"
            className="inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
          >
            <ArrowLeft size={14} />
            Browse other FAQ topics
          </Link>
        </div>
      </div>
    </div>
  );
}
