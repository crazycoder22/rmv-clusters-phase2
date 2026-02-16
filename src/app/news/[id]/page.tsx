"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { formatDate, getPriorityBorder } from "@/lib/utils";
import type { Announcement } from "@/types";

export default function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchAnnouncement() {
      try {
        const res = await fetch(`/api/announcements/${id}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setAnnouncement(data.announcement);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchAnnouncement();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <p className="text-center text-gray-500">Loading announcement...</p>
      </div>
    );
  }

  if (notFound || !announcement) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Announcement Not Found
        </h1>
        <p className="text-gray-600 mb-6">
          This announcement may have been removed or is no longer available.
        </p>
        <Link
          href="/news"
          className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
        >
          <ArrowLeft size={16} />
          Back to News
        </Link>
      </div>
    );
  }

  const ec = announcement.eventConfig;
  const sc = announcement.sportsConfig;
  const deadlinePassed = ec
    ? new Date() > new Date(ec.rsvpDeadline)
    : false;
  const sportsDeadlinePassed = sc
    ? new Date() > new Date(sc.registrationDeadline)
    : false;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-gray-500 hover:text-primary-700 font-medium mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      {/* Article */}
      <article
        className={`bg-white rounded-lg p-6 sm:p-8 shadow-sm border border-gray-100 ${getPriorityBorder(announcement.priority)}`}
      >
        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge variant={announcement.category}>{announcement.category}</Badge>
          {ec && (
            <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 capitalize">
              {ec.mealType}
            </span>
          )}
          <span className="text-sm text-gray-500">
            {formatDate(announcement.date)}
          </span>
          <span className="text-sm text-gray-400">
            &middot; {announcement.author}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
          {announcement.title}
        </h1>

        {/* Summary */}
        <p className="text-gray-700 text-base leading-relaxed mb-4">
          {announcement.summary}
        </p>

        {/* Full body */}
        <div className="text-gray-600 text-base leading-relaxed whitespace-pre-line">
          {announcement.body}
        </div>

        {/* RSVP section for events */}
        {ec && (
          <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-100">
            <h2 className="text-sm font-semibold text-green-800 mb-2">
              Event RSVP
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              {deadlinePassed ? (
                <span className="text-sm text-gray-500 italic">
                  RSVP deadline has passed
                </span>
              ) : (
                <>
                  <Link
                    href={`/events/${announcement.id}/rsvp`}
                    className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    RSVP for this Event
                  </Link>
                  <span className="text-xs text-gray-500">
                    Deadline:{" "}
                    {new Date(ec.rsvpDeadline).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </>
              )}
            </div>
            {ec.menuItems.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-green-700 mb-1">Menu:</p>
                <div className="flex flex-wrap gap-2">
                  {ec.menuItems.map((item) => (
                    <span
                      key={item.id}
                      className="inline-block px-2 py-1 text-xs bg-white rounded border border-green-200 text-green-800"
                    >
                      {item.name} — ₹{item.pricePerPlate}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sports registration section */}
        {sc && (
          <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-100">
            <h2 className="text-sm font-semibold text-orange-800 mb-2">
              Sports Registration
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              {sportsDeadlinePassed ? (
                <span className="text-sm text-gray-500 italic">
                  Registration deadline has passed
                </span>
              ) : (
                <>
                  <Link
                    href={`/events/${announcement.id}/sports`}
                    className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    Register for Sports
                  </Link>
                  <span className="text-xs text-gray-500">
                    Deadline:{" "}
                    {new Date(sc.registrationDeadline).toLocaleDateString(
                      "en-IN",
                      { day: "numeric", month: "short", year: "numeric" }
                    )}
                  </span>
                </>
              )}
            </div>
            {sc.sportItems.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-orange-700 mb-1">
                  Sports:
                </p>
                <div className="flex flex-wrap gap-2">
                  {sc.sportItems.map((item) => (
                    <span
                      key={item.id}
                      className="inline-block px-2 py-1 text-xs bg-white rounded border border-orange-200 text-orange-800"
                    >
                      {item.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* External link */}
        {announcement.link && (
          <div className="mt-6">
            <a
              href={announcement.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {announcement.linkText || "View Link"}
            </a>
          </div>
        )}
      </article>
    </div>
  );
}
