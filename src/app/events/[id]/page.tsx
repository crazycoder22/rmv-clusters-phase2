"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import EventRegistrationForm from "@/components/events/EventRegistrationForm";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  ArrowLeft,
  Copy,
  Check,
} from "lucide-react";

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
  contributionEnabled: boolean;
  maxContribution: number | null;
  targetAmount: number | null;
  paymentInstructions: string | null;
  paymentQrImageUrl: string | null;
  upiId: string | null;
  requireEmail: boolean;
  totals: {
    totalPledged: number;
    totalPaid: number;
    contributorCount: number;
  } | null;
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

const fmtMoney = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function PublicEventPage() {
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
        <div className="animate-pulse text-gray-500 dark:text-gray-400">
          Loading event...
        </div>
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

          <dl className="mt-5 space-y-2.5 text-sm sm:text-[15px]">
            <div className="flex items-start gap-3">
              <Calendar
                size={16}
                className="shrink-0 mt-0.5 text-primary-600 dark:text-primary-400"
              />
              <dd className="text-gray-700 dark:text-gray-200">
                {fmtDate(event.startAt)}
                {event.endAt && ` – ${fmtDate(event.endAt)}`}
              </dd>
            </div>
            <div className="flex items-start gap-3">
              <Clock
                size={16}
                className="shrink-0 mt-0.5 text-primary-600 dark:text-primary-400"
              />
              <dd className="text-gray-700 dark:text-gray-200">
                {fmtTime(event.startAt)}
                {event.endAt && ` – ${fmtTime(event.endAt)}`}
              </dd>
            </div>
            {event.venue && (
              <div className="flex items-start gap-3">
                <MapPin
                  size={16}
                  className="shrink-0 mt-0.5 text-primary-600 dark:text-primary-400"
                />
                <dd className="text-gray-700 dark:text-gray-200">{event.venue}</dd>
              </div>
            )}
            <div className="flex items-start gap-3">
              <User
                size={16}
                className="shrink-0 mt-0.5 text-primary-600 dark:text-primary-400"
              />
              <dd className="text-gray-700 dark:text-gray-200">
                {event.contributionEnabled && event.totals
                  ? `${event.totals.contributorCount} ${
                      event.totals.contributorCount === 1
                        ? "person has"
                        : "people have"
                    } pledged so far`
                  : `${event.registrationCount} ${
                      event.registrationCount === 1 ? "person" : "people"
                    } registered so far`}
              </dd>
            </div>
          </dl>

          {event.description && (
            <div className="mt-5 space-y-3 text-sm sm:text-[15px] text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              {event.description}
            </div>
          )}
        </div>

        {/* Contribution progress + payment details */}
        {event.contributionEnabled && (
          <ContributionPanel event={event} />
        )}

        {/* Registration form OR closed message */}
        {closed ? (
          <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 text-center text-sm text-gray-600 dark:text-gray-300">
            Registrations are closed for this event.
          </div>
        ) : (
          <EventRegistrationForm
            slug={event.slug}
            contributionEnabled={event.contributionEnabled}
            maxContribution={event.maxContribution}
            requireEmail={event.requireEmail}
            emailHelp={
              event.requireEmail
                ? "Use the email address tied to your Apple ID — TestFlight invites land there."
                : undefined
            }
          />
        )}

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          No login required. Your details are visible only to RMV admins.
        </p>
      </div>
    </div>
  );
}

function ContributionPanel({ event }: { event: EventData }) {
  const target = event.targetAmount ?? 0;
  const pledged = event.totals?.totalPledged ?? 0;
  const paid = event.totals?.totalPaid ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((pledged / target) * 100)) : 0;
  const [copied, setCopied] = useState(false);

  const copyUpi = async () => {
    if (!event.upiId) return;
    try {
      await navigator.clipboard.writeText(event.upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* no-op */
    }
  };

  return (
    <div className="mb-6 space-y-4">
      {/* Thermometer */}
      {target > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Pledged so far
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Target ₹{target.toLocaleString("en-IN")}
            </p>
          </div>
          <p className="mt-1 text-2xl font-bold text-primary-700 dark:text-primary-300">
            ₹{pledged.toLocaleString("en-IN")}
          </p>
          <div className="mt-3 h-3 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-green-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            ₹{paid.toLocaleString("en-IN")} received · {pct}% of target
          </p>
        </div>
      )}

      {/* Payment details */}
      {(event.upiId || event.paymentQrImageUrl || event.paymentInstructions) && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
            How to pay
          </h2>
          <div className="flex flex-col sm:flex-row gap-5">
            {event.paymentQrImageUrl && (
              <div className="flex-shrink-0 self-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={event.paymentQrImageUrl}
                  alt="UPI QR"
                  className="w-44 h-44 object-contain rounded-lg border border-gray-200 dark:border-gray-700 bg-white"
                />
              </div>
            )}
            <div className="flex-1 space-y-3">
              {event.upiId && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                    UPI ID
                  </p>
                  <button
                    type="button"
                    onClick={copyUpi}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 px-3 py-2 font-mono text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-900/60"
                  >
                    {event.upiId}
                    {copied ? (
                      <Check size={14} className="text-green-600" />
                    ) : (
                      <Copy size={14} className="text-gray-400" />
                    )}
                  </button>
                </div>
              )}
              {event.paymentInstructions && (
                <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {event.paymentInstructions}
                </div>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                After paying, no action needed — admin will mark your pledge
                as paid once the money lands.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
