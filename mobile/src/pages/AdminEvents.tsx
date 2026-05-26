import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  CircleSlash,
  Loader2,
  Sparkles,
  Users,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { canManageAnnouncements } from "../lib/roles";

interface EventRow {
  id: string;
  slug: string;
  title: string;
  organizer: string | null;
  venue: string | null;
  startAt: string;
  endAt: string | null;
  registrationClosesAt: string | null;
  active: boolean;
  registrationCount: number;
  createdByName: string;
  createdAt: string;
}

type StatusFilter = "all" | "upcoming" | "past";

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));

export default function AdminEvents() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // Role gate — bounce non-admins. Server-side enforcement still applies.
  useEffect(() => {
    if (user && !canManageAnnouncements(user.roles)) {
      navigate("/more", { replace: true });
    }
  }, [user, navigate]);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("upcoming");

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/public-events", { token });
      if (!res.ok) {
        setError(res.status === 403 ? "Not authorised" : "Could not load");
        return;
      }
      const data = await res.json();
      setEvents(data.events ?? []);
      setError(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  // Split events into upcoming/past based on startAt vs now.
  const filteredEvents = useMemo(() => {
    const now = Date.now();
    return events.filter((e) => {
      if (filter === "upcoming") return new Date(e.startAt).getTime() >= now;
      if (filter === "past") return new Date(e.startAt).getTime() < now;
      return true;
    });
  }, [events, filter]);

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/more"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-white">Event registrations</h1>
          <p className="truncate text-[11px] text-slate-500">
            {events.length} event{events.length !== 1 ? "s" : ""} total
          </p>
        </div>
      </header>

      {/* Status filter chips */}
      <section className="mb-3 flex gap-1.5">
        {(["upcoming", "past", "all"] as StatusFilter[]).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setFilter(opt)}
            className={clsx(
              "rounded-full px-3 py-1.5 text-xs font-medium capitalize",
              filter === opt
                ? "bg-indigo-500 text-white"
                : "bg-slate-900 text-slate-300 active:bg-slate-800"
            )}
          >
            {opt}
          </button>
        ))}
      </section>

      <section className="flex-1 pb-4">
        {loading ? (
          <div className="flex justify-center py-10 text-slate-500">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : error ? (
          <p className="rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-3 text-xs text-red-200">
            {error}
          </p>
        ) : filteredEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
            {events.length === 0
              ? "No public events yet."
              : filter === "upcoming"
                ? "No upcoming events."
                : "No past events to show."}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEvents.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EventCard({ event }: { event: EventRow }) {
  const isPast = new Date(event.startAt).getTime() < Date.now();
  return (
    <Link
      to={`/admin/events/${event.id}`}
      className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-3 active:bg-slate-800"
    >
      <div
        className={clsx(
          "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full",
          isPast
            ? "bg-slate-700 text-slate-400"
            : "bg-indigo-500/20 text-indigo-300"
        )}
      >
        <CalendarDays size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-white">
            {event.title}
          </h3>
          {!event.active && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">
              <CircleSlash size={9} />
              CLOSED
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[11px] text-slate-400">
          {fmtDate(event.startAt)}
          {event.venue ? ` · ${event.venue}` : ""}
        </p>
        <div className="mt-1 flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 text-emerald-300">
            <Users size={11} />
            {event.registrationCount} registered
          </span>
          {event.organizer && (
            <>
              <span className="text-slate-600">·</span>
              <span className="inline-flex items-center gap-1 text-slate-400">
                <Sparkles size={10} />
                {event.organizer}
              </span>
            </>
          )}
        </div>
      </div>
      <ChevronRight size={16} className="flex-shrink-0 text-slate-500" />
    </Link>
  );
}
