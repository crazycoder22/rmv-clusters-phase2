"use client";

import { useState, useEffect, useRef } from "react";
import { toPng } from "html-to-image";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";

interface CalendarEntry {
  id: string;
  title: string;
  date: string;
  color: string;
  source: "calendar" | "announcement";
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function MiniMonth({
  year,
  month,
  events,
  onDayClick,
}: {
  year: number;
  month: number;
  events: CalendarEntry[];
  onDayClick: (day: number, events: CalendarEntry[]) => void;
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  // Group events by day
  const eventsByDay: Record<number, CalendarEntry[]> = {};
  for (const ev of events) {
    const d = new Date(ev.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(ev);
    }
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <h3 className="text-sm font-semibold text-gray-800 text-center mb-2">
        {MONTH_NAMES[month]}
      </h3>
      <div className="grid grid-cols-7 gap-0">
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="text-[10px] font-medium text-gray-400 text-center py-0.5"
          >
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          const dayEvents = day ? eventsByDay[day] : undefined;
          const hasEvents = dayEvents && dayEvents.length > 0;
          return (
            <div
              key={i}
              className={`relative text-center py-1 ${
                hasEvents ? "cursor-pointer" : ""
              }`}
              onClick={() => {
                if (day && hasEvents) onDayClick(day, dayEvents);
              }}
            >
              {day && (
                <>
                  <span
                    className={`text-xs ${
                      hasEvents
                        ? "font-bold text-gray-900"
                        : "text-gray-600"
                    }`}
                  >
                    {day}
                  </span>
                  {hasEvents && (
                    <div className="flex justify-center gap-0.5 mt-0.5">
                      {dayEvents.slice(0, 3).map((ev, idx) => (
                        <span
                          key={idx}
                          className="block w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: ev.color }}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [events, setEvents] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [popover, setPopover] = useState<{
    month: number;
    day: number;
    events: CalendarEntry[];
  } | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/calendar?year=${year}`)
      .then((res) => res.json())
      .then((data) => setEvents(data.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [year]);

  const handleDownload = async () => {
    if (!calendarRef.current) return;
    setDownloading(true);
    setPopover(null);
    try {
      const dataUrl = await toPng(calendarRef.current, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `rmv-calendar-${year}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to generate image. Please try taking a screenshot instead.");
    } finally {
      setDownloading(false);
    }
  };

  const handleDayClick = (
    month: number,
    day: number,
    dayEvents: CalendarEntry[]
  ) => {
    setPopover({ month, day, events: dayEvents });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Controls (not included in export) */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            aria-label="Previous year"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-lg font-semibold text-gray-800 min-w-[60px] text-center">
            {year}
          </span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            aria-label="Next year"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading || loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors text-sm"
        >
          <Download size={16} />
          {downloading ? "Generating..." : "Download as Image"}
        </button>
      </div>

      {/* Calendar Grid (this is what gets exported) */}
      <div ref={calendarRef} className="p-4 bg-white rounded-xl">
        <h1 className="text-xl font-bold text-gray-900 text-center mb-1">
          RMV Clusters Phase II
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Event Calendar {year}
        </p>

        {loading ? (
          <p className="text-center text-gray-400 py-12">Loading...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }, (_, month) => (
              <MiniMonth
                key={month}
                year={year}
                month={month}
                events={events}
                onDayClick={(day, dayEvents) =>
                  handleDayClick(month, day, dayEvents)
                }
              />
            ))}
          </div>
        )}

        {/* Legend */}
        {!loading && events.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
              Events
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
              Maintenance
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
              Urgent
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
              General / Custom
            </span>
          </div>
        )}
      </div>

      {/* Popover for day events */}
      {popover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 text-sm">
                {MONTH_NAMES[popover.month]} {popover.day}, {year}
              </h3>
              <button
                onClick={() => setPopover(null)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-60 overflow-y-auto">
              {popover.events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start gap-2.5 text-sm"
                >
                  <span
                    className="mt-1.5 block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: ev.color }}
                  />
                  <div>
                    <p className="font-medium text-gray-800">{ev.title}</p>
                    <p className="text-xs text-gray-400 capitalize">
                      {ev.source === "announcement" ? "Announcement" : "Calendar Event"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
