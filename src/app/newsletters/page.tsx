"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Newspaper, FileText, Loader2, PenLine } from "lucide-react";

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Newspaper className="text-primary-600" size={32} />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Newsletters</h1>
              <p className="text-sm text-gray-500">
                Community news, articles, and updates
              </p>
            </div>
          </div>
          {session?.user?.isApproved && (
            <Link
              href="/newsletters/submit"
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              <PenLine size={16} />
              Submit Article
            </Link>
          )}
        </div>

        {/* List */}
        {newsletters.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <FileText className="mx-auto text-gray-400 mb-3" size={48} />
            <p className="text-gray-500">No newsletters published yet.</p>
            <p className="text-sm text-gray-400 mt-1">
              Check back later for community updates.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {newsletters.map((nl) => (
              <Link
                key={nl.id}
                href={`/newsletters/${nl.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-primary-200 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">
                      {nl.title}
                    </h2>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                      {nl.edition && (
                        <span className="text-primary-600 font-medium">
                          {nl.edition}
                        </span>
                      )}
                      <span>{nl._count.sections} sections</span>
                      {nl.publishedAt && (
                        <span>
                          {new Date(nl.publishedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Newspaper
                    size={24}
                    className="text-gray-300 group-hover:text-primary-400 transition-colors flex-shrink-0 mt-1"
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
