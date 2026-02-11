"use client";

import { useState } from "react";
import clsx from "clsx";
import Badge from "@/components/ui/Badge";
import { formatDate, getPriorityBorder } from "@/lib/utils";
import newsData from "@/data/news.json";
import type { Announcement } from "@/types";

const categories = ["all", "maintenance", "event", "general", "urgent"];

export default function NewsFeed() {
  const [activeCategory, setActiveCategory] = useState("all");

  const announcements = newsData.announcements as Announcement[];
  const filtered =
    activeCategory === "all"
      ? announcements
      : announcements.filter((a) => a.category === activeCategory);

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

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
          {sorted.map((announcement) => (
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
              </details>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
