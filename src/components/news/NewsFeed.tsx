"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import clsx from "clsx";
import Badge from "@/components/ui/Badge";
import { formatDate, getPriorityBorder } from "@/lib/utils";
import type { Announcement } from "@/types";

const categories = ["all", "maintenance", "event", "general", "urgent"];

export default function NewsFeed() {
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

  const filtered =
    activeCategory === "all"
      ? announcements
      : announcements.filter((a) => a.category === activeCategory);

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
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Announcements */}
      {sorted.length === 0 ? (
        <p className="text-center text-gray-500 py-12">
          No announcements in this category.
        </p>
      ) : (
        <div className="space-y-4">
          {sorted.map((announcement) => {
            const ec = announcement.eventConfig;
            const deadlinePassed = ec
              ? new Date() > new Date(ec.rsvpDeadline)
              : false;

            return (
              <article
                key={announcement.id}
                className={clsx(
                  "bg-white rounded-lg p-6 shadow-sm border border-gray-100",
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
                  <span className="text-xs text-gray-500">
                    {formatDate(announcement.date)}
                  </span>
                  <span className="text-xs text-gray-400">
                    &middot; {announcement.author}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {announcement.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {announcement.summary}
                </p>
                <details className="mt-3">
                  <summary className="text-sm text-primary-600 hover:text-primary-700 cursor-pointer font-medium">
                    Read more
                  </summary>
                  <p className="mt-2 text-gray-600 text-sm leading-relaxed">
                    {announcement.body}
                  </p>

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
