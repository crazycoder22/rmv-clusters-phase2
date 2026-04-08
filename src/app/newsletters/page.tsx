"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FileText, Loader2, PenLine } from "lucide-react";

interface PublishedNewsletter {
  id: string;
  title: string;
  edition: string | null;
  publishedAt: string | null;
  _count: { sections: number };
}

export default function NewslettersPage() {
  const { data: session } = useSession();
  const [newsletters, setNewsletters] = useState<PublishedNewsletter[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNewsletters = useCallback(async () => {
    const res = await fetch("/api/newsletters");
    if (res.ok) {
      const data = await res.json();
      setNewsletters(data.newsletters);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNewsletters();
  }, [fetchNewsletters]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Newspaper-style masthead header */}
        <div className="text-center mb-8">
          <div className="border-t-4 border-b-2 border-double border-stone-800 dark:border-stone-300 py-4 mb-3">
            <h1
              className="text-3xl sm:text-4xl font-black uppercase tracking-wider text-stone-900 dark:text-stone-100"
              style={{ fontFamily: "var(--font-newspaper-display), 'Playfair Display', Georgia, serif" }}
            >
              OneRMV Newsletter
            </h1>
            <p
              className="text-xs uppercase tracking-[0.25em] text-stone-500 dark:text-stone-400 mt-1"
              style={{ fontFamily: "var(--font-newspaper-body), Georgia, serif" }}
            >
              Archives &middot; Community News &amp; Stories
            </p>
          </div>
          <div className="flex items-center justify-center gap-4">
            <p
              className="text-sm text-stone-500 dark:text-stone-400"
              style={{ fontFamily: "var(--font-newspaper-body), Georgia, serif" }}
            >
              {newsletters.length} {newsletters.length === 1 ? "issue" : "issues"} published
            </p>
            {session?.user?.isApproved && (
              <Link
                href="/newsletters/submit"
                className="flex items-center gap-2 px-4 py-2 bg-stone-800 dark:bg-stone-700 text-white rounded-lg text-sm font-medium hover:bg-stone-900 dark:hover:bg-stone-600 transition-colors"
              >
                <PenLine size={16} />
                Submit Article
              </Link>
            )}
          </div>
        </div>

        {/* Newsletter archive cards */}
        {newsletters.length === 0 ? (
          <div className="newspaper-archive-card rounded-xl p-12 text-center">
            <FileText className="mx-auto text-stone-400 mb-3" size={48} />
            <p
              className="text-stone-500 dark:text-stone-400"
              style={{ fontFamily: "var(--font-newspaper-body), Georgia, serif" }}
            >
              No issues published yet.
            </p>
            <p
              className="text-sm text-stone-400 dark:text-stone-500 mt-1"
              style={{ fontFamily: "var(--font-newspaper-body), Georgia, serif" }}
            >
              Check back later for community updates.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {newsletters.map((nl) => (
              <Link
                key={nl.id}
                href={`/newsletters/${nl.id}`}
                className="newspaper-archive-card rounded-xl p-5 group block"
              >
                {/* Mini masthead */}
                <div className="border-t-2 border-b border-stone-800 dark:border-stone-400 py-2 mb-3">
                  <h2
                    className="text-lg font-black uppercase tracking-wider text-stone-900 dark:text-stone-100 group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors text-center"
                    style={{ fontFamily: "var(--font-newspaper-display), 'Playfair Display', Georgia, serif" }}
                  >
                    OneRMV
                  </h2>
                </div>

                {/* Edition info */}
                <div className="text-center">
                  <h3
                    className="text-base font-bold text-stone-800 dark:text-stone-200 mb-1"
                    style={{ fontFamily: "var(--font-newspaper-display), 'Playfair Display', Georgia, serif" }}
                  >
                    {nl.title}
                  </h3>
                  <div
                    className="flex items-center justify-center gap-2 text-xs text-stone-500 dark:text-stone-400"
                    style={{ fontFamily: "var(--font-newspaper-body), Georgia, serif" }}
                  >
                    {nl.edition && (
                      <span className="font-medium text-stone-700 dark:text-stone-300">
                        {nl.edition}
                      </span>
                    )}
                    <span>&middot;</span>
                    <span>{nl._count.sections} sections</span>
                    {nl.publishedAt && (
                      <>
                        <span>&middot;</span>
                        <span>
                          {new Date(nl.publishedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Decorative columns hint */}
                <div className="mt-3 flex gap-2">
                  <div className="flex-1 space-y-1">
                    <div className="h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full" />
                    <div className="h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full" />
                    <div className="h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full w-3/4" />
                  </div>
                  <div className="w-px bg-stone-300 dark:bg-stone-600" />
                  <div className="flex-1 space-y-1">
                    <div className="h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full" />
                    <div className="h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full" />
                    <div className="h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full w-2/3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
