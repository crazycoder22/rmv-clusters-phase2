"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import clsx from "clsx";
import Badge from "@/components/ui/Badge";
import RichText from "@/components/ui/RichText";
import { formatDate, getPriorityBorder } from "@/lib/utils";
import type { Announcement } from "@/types";

const categories = ["all", "maintenance", "event", "sports", "general", "urgent"];

export default function NewsFeed({ sinceWeeks }: { sinceWeeks?: number } = {}) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnnouncements() {
      try {
        const res = await fetch("/api/announcements");
        if (res.ok) {
          const data = await res.json();
          setAnnouncements(data.announcements);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchAnnouncements();
  }, []);

  // Optional recency window (e.g. dashboard shows only the last `sinceWeeks`).
  const cutoff =
    sinceWeeks && sinceWeeks > 0
      ? Date.now() - sinceWeeks * 7 * 24 * 60 * 60 * 1000
      : null;

  const filtered = announcements
    .filter((a) => activeCategory === "all" || a.category === activeCategory)
    .filter((a) => cutoff === null || new Date(a.date).getTime() >= cutoff);

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading announcements...</p>
      </div>
    );
  }

  return (
    <>
      {/* Category filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={clsx(
              "px-4 py-2 rounded-full text-sm font-medium transition-colors capitalize",
              activeCategory === cat
                ? "bg-primary-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Announcements */}
      {sorted.length === 0 ? (
        <p className="text-center text-gray-500 py-12">
          {cutoff !== null
            ? "No news in the last few weeks."
            : "No announcements in this category."}
        </p>
      ) : (
        <div className="space-y-4">
          {sorted.map((announcement) => {
            const ec = announcement.eventConfig;
            const sc = announcement.sportsConfig;
            const deadlinePassed = ec
              ? new Date() > new Date(ec.rsvpDeadline)
              : false;
            const sportsDeadlinePassed = sc
              ? new Date() > new Date(sc.registrationDeadline)
              : false;

            return (
              <article
                key={announcement.id}
                className={clsx(
                  "bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-100 dark:border-gray-700",
                  getPriorityBorder(announcement.priority)
                )}
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge variant={announcement.category}>
                    {announcement.category}
                  </Badge>
                  {ec && (
                    <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 capitalize">
                      {ec.mealType}
                    </span>
                  )}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(announcement.date)}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    &middot; {announcement.author}
                  </span>
                </div>
                <Link
                  href={`/news/${announcement.id}`}
                  className="block group"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-primary-700 transition-colors">
                    {announcement.title}
                  </h3>
                  <RichText text={announcement.summary} className="text-gray-600 dark:text-gray-400 text-sm" />
                </Link>
                {announcement.imageUrl && (
                  <div className="mt-3 rounded-lg overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={announcement.imageUrl}
                      alt={announcement.title}
                      className="w-full max-h-64 object-cover rounded-lg"
                    />
                  </div>
                )}
                <details className="mt-3">
                  <summary className="text-sm text-primary-600 hover:text-primary-700 cursor-pointer font-medium">
                    Read more
                  </summary>
                  <RichText text={announcement.body} className="mt-2 text-gray-600 dark:text-gray-400 text-sm" />

                  {/* RSVP button for events */}
                  {ec && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {deadlinePassed ? (
                        <span className="text-sm text-gray-400 italic">
                          RSVP closed
                        </span>
                      ) : (
                        <>
                          <Link
                            href={`/events/${announcement.id}/rsvp`}
                            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                          >
                            RSVP for this Event
                          </Link>
                          <span className="text-xs text-gray-400">
                            Deadline:{" "}
                            {new Date(ec.rsvpDeadline).toLocaleDateString(
                              "en-IN",
                              { day: "numeric", month: "short", year: "numeric" }
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Sports registration button */}
                  {sc && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {sportsDeadlinePassed ? (
                        <span className="text-sm text-gray-400 italic">
                          Registration closed
                        </span>
                      ) : (
                        <>
                          <Link
                            href={`/events/${announcement.id}/sports`}
                            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                          >
                            Register for Sports
                          </Link>
                          <span className="text-xs text-gray-400">
                            Deadline:{" "}
                            {new Date(sc.registrationDeadline).toLocaleDateString(
                              "en-IN",
                              { day: "numeric", month: "short", year: "numeric" }
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {announcement.link && (
                    <a
                      href={announcement.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-3 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      {announcement.linkText || "View Link"}
                    </a>
                  )}
                </details>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
