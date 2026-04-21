"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import EventRegistrationForm from "@/components/events/EventRegistrationForm";
import { Calendar, Clock, MapPin, User, ArrowLeft } from "lucide-react";

// Lives under /events/[id]/ — not [slug] — because the segment already
// has sibling routes (dashboard/, rsvp/, sports/) using [id]. Next.js
// disallows two dynamic param names at the same level, so the new
// public-event page shares the same [id] segment. The `id` param
// carries whatever slug or cuid the URL was visited with; our backend
// lookup uses it as a slug for public-event URLs.
//
// Client component: matches the pattern used by every other detail
// page in the app (/news/[id], /memory, /quiz) — fetch via API rather
// than hitting Prisma from a server component.

interface EventData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  organizer: string | null;
  venue: string | null;
  startAt: string;
  endAt: string | null;
  registrationClosesAt: string | null;
  active: boolean;
  registrationCount: number;
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));

const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));

export default function PublicEventPage() {
  // The URL segment is [id]; for public events this is actually the slug
  // (e.g. "hearing-checkup-apr-2026"). Our /api/public-events endpoint
  // treats it as a slug lookup.
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/public-events/${id}`)
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        if (data?.event) setEvent(data.event);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading event...</div>
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            Event not found
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            The event you're looking for doesn't exist or has been removed.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
          >
            <ArrowLeft size={14} />
            Back to RMV Clusters
          </Link>
        </div>
      </div>
    );
  }

  const now = new Date();
  const closed =
    !event.active ||
    (event.registrationClosesAt !== null &&
      new Date(event.registrationClosesAt) < now);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50/40 via-white to-white dark:from-primary-950/40 dark:via-gray-900 dark:to-gray-900 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-700 dark:hover:text-primary-300 mb-5"
        >
          <ArrowLeft size={14} />
          Back to RMV Clusters
        </Link>

        {/* Hero card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 sm:p-7 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
            {event.title}
          </h1>
          {event.organizer && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Organised by{" "}
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {event.organizer}
              </span>
            </p>
          )}

          {/* Facts block */}
          <dl className="mt-5 space-y-2.5 text-sm sm:text-[15px]">
            <div className="flex items-start gap-3">
              <Calendar size={16} className="shrink-0 mt-0.5 text-primary-600 dark:text-primary-400" />
              <dd className="text-gray-700 dark:text-gray-200">{fmtDate(event.startAt)}</dd>
            </div>
            <div className="flex items-start gap-3">
              <Clock size={16} className="shrink-0 mt-0.5 text-primary-600 dark:text-primary-400" />
              <dd className="text-gray-700 dark:text-gray-200">
                {fmtTime(event.startAt)}
                {event.endAt && ` – ${fmtTime(event.endAt)}`}
              </dd>
            </div>
            {event.venue && (
              <div className="flex items-start gap-3">
                <MapPin size={16} className="shrink-0 mt-0.5 text-primary-600 dark:text-primary-400" />
                <dd className="text-gray-700 dark:text-gray-200">{event.venue}</dd>
              </div>
            )}
            <div className="flex items-start gap-3">
              <User size={16} className="shrink-0 mt-0.5 text-primary-600 dark:text-primary-400" />
              <dd className="text-gray-700 dark:text-gray-200">
                {event.registrationCount}{" "}
                {event.registrationCount === 1 ? "person" : "people"} registered so far
              </dd>
            </div>
          </dl>

          {/* Description */}
          {event.description && (
            <div className="mt-5 space-y-3 text-sm sm:text-[15px] text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              {event.description}
            </div>
          )}
        </div>

        {/* Registration form OR closed message */}
        {closed ? (
          <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 text-center text-sm text-gray-600 dark:text-gray-300">
            Registrations are closed for this event.
          </div>
        ) : (
          <EventRegistrationForm slug={event.slug} />
        )}

        {/* Footer note */}
        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          No login required. Your details are visible only to RMV admins.
        </p>
      </div>
    </div>
  );
}
