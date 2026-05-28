import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Megaphone,
  CalendarDays,
  Users,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

// ── Types ──────────────────────────────────────────────────────────────────

type Source = "calendar" | "announcement" | "meeting";

interface CalEvent {
  id: string;
  title: string;
  date: string; // ISO
  color: string;
  source: Source;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SOURCE_META: Record<Source, { label: string; icon: typeof CalendarDays }> = {
  calendar: { label: "Calendar", icon: CalendarDays },
  announcement: { label: "Announcement", icon: Megaphone },
  meeting: { label: "Meeting", icon: Users },
};

// ── Page ───────────────────────────────────────────────────────────────────

export default function Calendar() {
  const { token } = useAuth();

  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-11
  const [selectedDay, setSelectedDay] = useState<string | null>(
    isoDate(today)
  );

  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loadedYear, setLoadedYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch a full year's events at a time (matches the web API shape) and
  // cache by year — flipping months within the same year is instant.
  const fetchYear = useCallback(
    async (year: number) => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/calendar?year=${year}`, { token });
        if (!res.ok) {
          setError("Could not load calendar");
          return;
        }
        const data = await res.json();
        setEvents(data.events ?? []);
        setLoadedYear(year);
        setError(null);
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (loadedYear !== viewYear) void fetchYear(viewYear);
  }, [viewYear, loadedYear, fetchYear]);

  // Group events by ISO day for quick lookup.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      const key = isoDate(new Date(e.date));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  // Build the month grid: leading blanks + day cells.
  const grid = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstOfMonth.getDay(); // 0 = Sunday
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: ({ day: number; iso: string } | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, iso: isoDate(new Date(viewYear, viewMonth, d)) });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const selectedEvents = selectedDay
    ? (eventsByDay.get(selectedDay) ?? [])
    : [];

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  const todayIso = isoDate(today);

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
          <h1 className="text-lg font-semibold text-white">Calendar</h1>
          <p className="truncate text-[11px] text-slate-500">
            Community events, announcements & meetings
          </p>
        </div>
        {loading && (
          <Loader2 size={16} className="animate-spin text-slate-500" />
        )}
      </header>

      {/* Month navigation */}
      <section className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-sm font-semibold text-white">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </h2>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </section>

      {error && (
        <p className="mb-3 rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-2.5 text-xs text-red-200">
          {error}
        </p>
      )}

      {/* Month grid */}
      <section className="mb-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-2">
        <div className="mb-1 grid grid-cols-7">
          {WEEKDAYS.map((w, i) => (
            <div
              key={i}
              className="py-1 text-center text-[10px] font-semibold uppercase text-slate-500"
            >
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {grid.map((cell, i) => {
            if (!cell) return <div key={`blank-${i}`} />;
            const dayEvents = eventsByDay.get(cell.iso) ?? [];
            const isToday = cell.iso === todayIso;
            const isSelected = cell.iso === selectedDay;
            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => setSelectedDay(cell.iso)}
                className={clsx(
                  "flex aspect-square flex-col items-center justify-center rounded-lg text-[13px]",
                  isSelected
                    ? "bg-indigo-500 text-white"
                    : isToday
                      ? "bg-slate-700 text-white"
                      : "text-slate-300 active:bg-slate-700/50"
                )}
              >
                <span className={clsx(isToday && !isSelected && "font-bold")}>
                  {cell.day}
                </span>
                {/* Event dots — up to 3 colored dots */}
                {dayEvents.length > 0 && (
                  <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
                    {dayEvents.slice(0, 3).map((e, idx) => (
                      <span
                        key={idx}
                        className="h-1 w-1 rounded-full"
                        style={{
                          backgroundColor: isSelected ? "#fff" : e.color,
                        }}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Selected day events */}
      <section className="flex-1 pb-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {selectedDay ? fmtLongDate(selectedDay) : "Select a day"}
        </h2>
        {selectedEvents.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-center text-[11px] text-slate-500">
            No events on this day.
          </p>
        ) : (
          <ul className="space-y-2">
            {selectedEvents.map((e) => {
              const meta = SOURCE_META[e.source];
              const Icon = meta.icon;
              return (
                <li
                  key={`${e.source}-${e.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-3"
                >
                  <span
                    className="h-9 w-1.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: e.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {e.title}
                    </p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                      <Icon size={9} />
                      {meta.label}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtLongDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
