"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Plus, Calendar, MapPin, Users, Globe, Lock, Paperclip } from "lucide-react";
import { canManageMeetings } from "@/lib/roles";

interface Meeting {
  id: string;
  title: string;
  agenda: string;
  date: string;
  location: string;
  status: string;
  isPublic: boolean;
  momUrl: string | null;
  creator: { name: string; email: string };
  _count: { rsvps: number; documents: number };
}

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export default function AdminMeetingsPage() {
  const { data: session, status: authStatus } = useSession();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");

  const roles = session?.user?.roles ?? [];
  const hasAccess = canManageMeetings(roles);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!hasAccess) {
      setLoading(false);
      return;
    }
    fetchMeetings();
  }, [authStatus, hasAccess]);

  async function fetchMeetings() {
    setLoading(true);
    const res = await fetch("/api/meetings");
    if (res.ok) {
      const data = await res.json();
      setMeetings(data.meetings);
    }
    setLoading(false);
  }

  if (authStatus === "loading" || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">You do not have access to this page.</p>
      </div>
    );
  }

  const filtered = filter === "ALL" ? meetings : meetings.filter((m) => m.status === filter);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Meetings</h1>
        <Link
          href="/admin/meetings/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          New Meeting
        </Link>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-6">
        {["ALL", "SCHEDULED", "COMPLETED", "CANCELLED"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === s
                ? "bg-primary-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <Calendar className="mx-auto mb-3 text-gray-300" size={48} />
          <p className="text-gray-500 dark:text-gray-400">No meetings found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((meeting) => (
            <Link
              key={meeting.id}
              href={`/admin/meetings/${meeting.id}`}
              className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {meeting.title}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_COLORS[meeting.status] || "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {meeting.status.charAt(0) + meeting.status.slice(1).toLowerCase()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {new Date(meeting.date).toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin size={14} />
                      {meeting.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={14} />
                      {meeting._count.rsvps} RSVP{meeting._count.rsvps !== 1 ? "s" : ""}
                    </span>
                    {meeting._count.documents > 0 && (
                      <span className="flex items-center gap-1">
                        <Paperclip size={14} />
                        {meeting._count.documents} doc{meeting._count.documents !== 1 ? "s" : ""}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      {meeting.isPublic ? (
                        <>
                          <Globe size={14} />
                          Public
                        </>
                      ) : (
                        <>
                          <Lock size={14} />
                          Private
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
