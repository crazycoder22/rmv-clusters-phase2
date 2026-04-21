"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Calendar, MapPin } from "lucide-react";

// Client component — matches every other detail page in the app. Server
// components that hit Prisma directly were hanging on Vercel cold starts.

interface EventMeta {
  title: string;
  startAt: string;
  endAt: string | null;
  venue: string | null;
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));

const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));

function ThanksInner() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const n = searchParams.get("n");
  const name = searchParams.get("name");

  const [event, setEvent] = useState<EventMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public-events/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.event) {
          setEvent({
            title: d.event.title,
            startAt: d.event.startAt,
            endAt: d.event.endAt,
            venue: d.event.venue,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  const positionNum = n ? parseInt(n, 10) : null;
  const firstName = name?.trim();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-emerald-50/50 via-white to-white dark:from-emerald-950/30 dark:via-gray-900 dark:to-gray-900 px-4 py-10">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 sm:p-8 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-4">
            <CheckCircle2 size={30} className="text-emerald-600 dark:text-emerald-400" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {firstName ? `Thanks, ${firstName}!` : "You're registered!"}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            We've saved your spot
            {event?.title && (
              <>
                {" "}for{" "}
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {event.title}
                </span>
              </>
            )}
            .
          </p>

          {positionNum && !Number.isNaN(positionNum) && (
            <p className="mt-2 text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-300 font-semibold">
              You're registration #{positionNum}
            </p>
          )}

          {event && (
            <div className="mt-6 space-y-2 text-left bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-sm">
              <div className="flex items-start gap-2">
                <Calendar size={15} className="shrink-0 mt-0.5 text-primary-600 dark:text-primary-400" />
                <span className="text-gray-700 dark:text-gray-200">
                  {fmtDate(event.startAt)}
                  {" · "}
                  {fmtTime(event.startAt)}
                  {event.endAt && ` – ${fmtTime(event.endAt)}`}
                </span>
              </div>
              {event.venue && (
                <div className="flex items-start gap-2">
                  <MapPin size={15} className="shrink-0 mt-0.5 text-primary-600 dark:text-primary-400" />
                  <span className="text-gray-700 dark:text-gray-200">{event.venue}</span>
                </div>
              )}
            </div>
          )}

          <p className="mt-5 text-xs text-gray-500 dark:text-gray-400">
            Please arrive 10 minutes early. No printout needed — walk in and tell the organisers your name.
          </p>

          <Link
            href="/"
            className="mt-6 inline-block text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
          >
            ← Back to RMV Clusters
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ThanksPage() {
  // Suspense boundary is required around useSearchParams in Next.js
  // client pages so the route can still be statically prepared.
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      }
    >
      <ThanksInner />
    </Suspense>
  );
}
