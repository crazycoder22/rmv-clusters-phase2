import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import EventRegistrationForm from "@/components/events/EventRegistrationForm";
import { Calendar, Clock, MapPin, User, ArrowLeft } from "lucide-react";

// Server-rendered event page. Fetches directly from Prisma rather than going
// through /api/public-events/[slug] to save a network hop on first load.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await prisma.publicEvent.findUnique({
    where: { slug },
    select: { title: true, description: true },
  });
  if (!event) return { title: "Event not found" };
  return {
    title: `${event.title} — RMV Clusters`,
    description: event.description ?? undefined,
  };
}

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await prisma.publicEvent.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      organizer: true,
      venue: true,
      startAt: true,
      endAt: true,
      registrationClosesAt: true,
      active: true,
      _count: { select: { registrations: true } },
    },
  });
  if (!event) notFound();

  const now = new Date();
  const closed =
    !event.active ||
    (event.registrationClosesAt !== null && event.registrationClosesAt < now);

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
              Organised by <span className="font-medium text-gray-700 dark:text-gray-300">{event.organizer}</span>
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
                {event._count.registrations}{" "}
                {event._count.registrations === 1 ? "person" : "people"} registered so far
              </dd>
            </div>
          </dl>

          {/* Description (simple paragraph rendering) */}
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
