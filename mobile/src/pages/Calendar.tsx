import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
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

// OneRMV Calendar.dc.html category mapping — Event=accent, Announcement=info,
// Meeting=success — with a Material Symbol per source and its soft fill.
const SOURCE_META: Record<Source, { label: string; ms: string; color: string; soft: string }> = {
  calendar: { label: "Event", ms: "event", color: "var(--accent)", soft: "var(--accent-soft)" },
  announcement: { label: "Announcement", ms: "campaign", color: "var(--info)", soft: "var(--info-soft)" },
  meeting: { label: "Meeting", ms: "groups", color: "var(--success)", soft: "var(--success-soft)" },
};

// ── Page ───────────────────────────────────────────────────────────────────

export default function Calendar() {
  const { token } = useAuth();

  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-11
  const [selectedDay, setSelectedDay] = useState<string | null>(isoDate(today));

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

  const selectedEvents = selectedDay ? (eventsByDay.get(selectedDay) ?? []) : [];

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

  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDay(isoDate(today));
  }

  const todayIso = isoDate(today);
  const n = selectedEvents.length;

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      {/* Header */}
      <header className="flex items-start gap-3 py-3">
        <Link
          to="/community"
          className="flex pt-0.5 active:opacity-70"
          aria-label="Back"
        >
          <Icon name="arrow_back" size={22} style={{ color: "var(--text-2)" }} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[21px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Calendar</h1>
          <p className="truncate text-[12px]" style={{ color: "var(--text-3)" }}>
            Community events, announcements &amp; meetings
          </p>
        </div>
        <button
          type="button"
          onClick={goToday}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-bold active:opacity-80"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
        >
          <Icon name="today" size={16} style={{ color: "var(--text)" }} /> Today
        </button>
      </header>

      {/* Month switcher */}
      <div className="flex items-center justify-between px-0.5 pb-3.5 pt-1">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] active:opacity-70"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          aria-label="Previous month"
        >
          <Icon name="chevron_left" size={22} style={{ color: "var(--text-2)" }} />
        </button>
        <span className="text-[18px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] active:opacity-70"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          aria-label="Next month"
        >
          <Icon name="chevron_right" size={22} style={{ color: "var(--text-2)" }} />
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-[12px] px-4 py-2.5 text-[13px]" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {/* Calendar card */}
      <div className="rounded-[20px] p-[14px_12px_16px]" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
        {/* Weekday header */}
        <div className="mb-1.5 grid grid-cols-7">
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="one-mono py-1.5 text-center text-[11px] font-semibold" style={{ color: "var(--text-3)" }}>
              {w}
            </span>
          ))}
        </div>
        {/* Day grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {grid.map((cell, i) => {
            if (!cell) return <div key={`blank-${i}`} style={{ height: 46 }} />;
            const dayEvents = eventsByDay.get(cell.iso) ?? [];
            const isToday = cell.iso === todayIso;
            const isSelected = cell.iso === selectedDay;
            const numColor = isSelected ? "#fff" : isToday ? "var(--text)" : "var(--text-2)";
            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => setSelectedDay(cell.iso)}
                className="relative flex flex-col items-center justify-center gap-0.5 rounded-[13px]"
                style={{
                  height: 46,
                  background: isSelected
                    ? "var(--accent-strong)"
                    : isToday
                      ? "var(--surface-3)"
                      : "transparent",
                  boxShadow: isSelected ? "0 6px 16px var(--accent-soft)" : undefined,
                }}
              >
                <span className="text-[15px] leading-none" style={{ color: numColor, fontWeight: isSelected || isToday ? 800 : 500 }}>
                  {cell.day}
                </span>
                <span className="flex h-1.5 items-center justify-center gap-[3px]">
                  {dayEvents.slice(0, 3).map((e, idx) => (
                    <span
                      key={idx}
                      className="h-[5px] w-[5px] rounded-full"
                      style={{ background: isSelected ? "#fff" : SOURCE_META[e.source].color }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3.5 px-1 pb-0.5 pt-3.5">
        {(["calendar", "announcement", "meeting"] as Source[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: SOURCE_META[s].color }} />
            {SOURCE_META[s].label}
          </span>
        ))}
      </div>

      {/* Selected day header */}
      <div className="mx-0.5 mb-3 mt-[18px] flex items-baseline justify-between gap-2">
        <span className="one-mono text-[11px]" style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}>
          {selectedDay ? fmtLongDate(selectedDay).toUpperCase() : "SELECT A DATE"}
        </span>
        {n > 0 && (
          <span className="flex-shrink-0 rounded-full px-2.5 py-[3px] text-[11px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            {n} {n === 1 ? "event" : "events"}
          </span>
        )}
        {loading && <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-3)" }} />}
      </div>

      {/* Event list */}
      {n === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[18px] px-6 py-9 text-center" style={{ border: "1.5px dashed var(--border-strong)" }}>
          <Icon name="event_busy" size={38} style={{ color: "var(--text-3)" }} />
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-3)" }}>No events scheduled for this day.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-[11px]">
          {selectedEvents.map((e) => {
            const meta = SOURCE_META[e.source];
            const time = fmtTime(e.date);
            return (
              <div
                key={`${e.source}-${e.id}`}
                className="flex overflow-hidden rounded-[16px]"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="w-1 flex-shrink-0" style={{ background: meta.color }} />
                <div className="flex flex-1 items-start gap-3 p-3.5">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[11px]" style={{ background: meta.soft }}>
                    <Icon name={meta.ms} size={21} style={{ color: meta.color }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold leading-snug" style={{ color: "var(--text)" }}>{e.title}</p>
                    {time && (
                      <p className="mt-1.5 flex items-center gap-1.5" style={{ color: "var(--text-3)" }}>
                        <Icon name="schedule" size={14} style={{ color: "var(--text-3)" }} />
                        <span className="text-[12px]">{time}</span>
                      </p>
                    )}
                    <span className="mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: meta.soft, color: meta.color }}>
                      {meta.label}
                    </span>
                  </div>
                  <Icon name="chevron_right" size={20} style={{ color: "var(--text-3)" }} className="flex-shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      )}
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

// Show a time row only when the event carries a real (non-midnight) time.
function fmtTime(isoDateTime: string): string | null {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getHours() === 0 && d.getMinutes() === 0) return null;
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}
