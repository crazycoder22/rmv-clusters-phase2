"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/useRole";
import { ArrowLeft, Download, Users, Phone } from "lucide-react";

interface Registration {
  position: number;
  id: string;
  name: string;
  phone: string;
  block: number | null;
  flatNumber: string | null;
  createdAt: string;
}

interface EventMeta {
  id: string;
  slug: string;
  title: string;
}

const fmtWhen = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

export default function AdminEventRegistrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { canManageAnnouncements, isLoading: roleLoading } = useRole();
  const router = useRouter();

  const [event, setEvent] = useState<EventMeta | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleLoading && !canManageAnnouncements()) router.replace("/");
  }, [roleLoading, canManageAnnouncements, router]);

  useEffect(() => {
    fetch(`/api/admin/public-events/${id}/registrations`)
      .then((r) => r.json())
      .then((d) => {
        setEvent(d.event);
        setRegistrations(d.registrations ?? []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (roleLoading || loading) {
    return (
      <div className="py-12 text-center text-gray-400 dark:text-gray-500">Loading...</div>
    );
  }
  if (!event) {
    return (
      <div className="py-12 text-center text-gray-400 dark:text-gray-500">Event not found.</div>
    );
  }

  const csvUrl = `/api/admin/public-events/${id}/registrations?format=csv`;

  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <Link
          href="/admin/public-events"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-primary-400 mb-5"
        >
          <ArrowLeft size={14} /> All events
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {event.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Slug: <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{event.slug}</code>
            </p>
          </div>
          <a
            href={csvUrl}
            download
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-primary-400 dark:hover:border-primary-500 shrink-0"
          >
            <Download size={14} />
            Export CSV
          </a>
        </div>

        {/* Summary */}
        <div className="bg-gradient-to-r from-primary-50 to-sky-50 dark:from-primary-900/30 dark:to-sky-900/30 border border-primary-200 dark:border-primary-800 rounded-xl p-4 mb-6 flex items-center gap-3">
          <Users size={22} className="text-primary-600 dark:text-primary-400" />
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none">
              {registrations.length}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {registrations.length === 1 ? "person registered" : "people registered"}
            </p>
          </div>
        </div>

        {/* Registrations table */}
        {registrations.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-sm text-gray-400 dark:text-gray-500">
            No registrations yet. Share the event URL to get started:
            <div className="mt-2 font-mono text-xs text-gray-500 dark:text-gray-400">
              /events/{event.slug}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header row on desktop */}
            <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <span>#</span>
              <span>Name</span>
              <span>Block/Flat</span>
              <span>Phone</span>
              <span className="text-right">Registered</span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {registrations.map((r) => (
                <div
                  key={r.id}
                  className="sm:grid sm:grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-4 py-3 items-center"
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-50 dark:bg-primary-900/40 text-[11px] font-bold text-primary-700 dark:text-primary-300 mr-2 sm:mr-0">
                    {r.position}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {r.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {r.block ? `B${r.block}` : "—"}
                    {r.flatNumber ? ` · ${r.flatNumber}` : ""}
                  </span>
                  <a
                    href={`tel:${r.phone}`}
                    className="inline-flex items-center gap-1 text-sm font-mono text-primary-700 dark:text-primary-300 hover:underline"
                  >
                    <Phone size={11} className="opacity-60" />
                    {r.phone}
                  </a>
                  <span className="text-xs text-gray-400 dark:text-gray-500 text-right sm:whitespace-nowrap">
                    {fmtWhen(r.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
