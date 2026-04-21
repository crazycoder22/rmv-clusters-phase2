import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Calendar, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";

// Server-rendered thank-you page shown after a successful registration.
// Reads ?n= (position) and ?name= from the query string to personalise the
// confirmation. Falls back gracefully if either is missing.

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);

export default async function ThanksPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ n?: string; name?: string }>;
}) {
  const { slug } = await params;
  const { n, name } = await searchParams;

  const event = await prisma.publicEvent.findUnique({
    where: { slug },
    select: {
      title: true,
      startAt: true,
      endAt: true,
      venue: true,
    },
  });
  if (!event) notFound();

  const positionNum = n ? parseInt(n, 10) : null;
  const firstName = name?.trim();

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
            We've saved your spot for{" "}
            <span className="font-medium text-gray-800 dark:text-gray-100">{event.title}</span>.
          </p>

          {positionNum && !Number.isNaN(positionNum) && (
            <p className="mt-2 text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-300 font-semibold">
              You're registration #{positionNum}
            </p>
          )}

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
