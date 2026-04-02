"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRole } from "@/hooks/useRole";
import { ChevronLeft, ChevronRight, Check, X, Loader2 } from "lucide-react";
import clsx from "clsx";

interface ChecklistItem {
  id: string;
  name: string;
  sortOrder: number;
}

interface ChecklistEntry {
  id: string;
  date: string;
  done: boolean;
  itemId: string;
  filledBy: { name: string };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function ChecklistPage() {
  const { data: session } = useSession();
  const { canFillChecklist, isLoading: roleLoading } = useRole();

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [entries, setEntries] = useState<ChecklistEntry[]>([]);
  const [daysInMonth, setDaysInMonth] = useState(31);
  const [loading, setLoading] = useState(true);
  const [togglingCell, setTogglingCell] = useState<string | null>(null);

  const canFill = canFillChecklist();
  const monthKey = getMonthKey(currentMonth);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/checklist?month=${monthKey}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setEntries(data.entries);
        setDaysInMonth(data.daysInMonth);
      }
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    if (session?.user?.isApproved) fetchData();
  }, [session?.user?.isApproved, fetchData]);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const getEntry = (itemId: string, day: number): ChecklistEntry | undefined => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return entries.find((e) => e.itemId === itemId && e.date.startsWith(dateStr));
  };

  const toggleEntry = async (itemId: string, day: number) => {
    if (!canFill) return;

    const cellKey = `${itemId}-${day}`;
    setTogglingCell(cellKey);

    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const existing = getEntry(itemId, day);
    const newDone = existing ? !existing.done : true;

    try {
      const res = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr, itemId, done: newDone }),
      });
      if (res.ok) {
        await fetchData();
      }
    } finally {
      setTogglingCell(null);
    }
  };

  if (!session) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-gray-500 dark:text-gray-400">
        Please sign in to view the facility checklist.
      </div>
    );
  }

  if (!session.user?.isApproved) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-gray-500 dark:text-gray-400">
        Your account is pending approval.
      </div>
    );
  }

  // Determine today's date for highlighting
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === currentMonth.getFullYear() &&
    today.getMonth() === currentMonth.getMonth();
  const todayDay = today.getDate();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Facility Checklist</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            aria-label="Previous month"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-lg font-semibold text-gray-800 dark:text-gray-100 min-w-[180px] text-center">
            {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            aria-label="Next month"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {canFill && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Click on a cell to mark it as done or not done.
        </p>
      )}

      {loading || roleLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary-600" size={32} />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-gray-500 dark:text-gray-400">
          No checklist items configured yet. An admin can add items from the Admin panel.
        </div>
      ) : (
        <div className="overflow-x-auto border dark:border-gray-700 rounded-xl shadow-sm">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-gray-700 border-r dark:border-r-gray-700 min-w-[160px]">
                  Task
                </th>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                  <th
                    key={day}
                    className={clsx(
                      "px-1 py-3 text-center text-xs font-medium border-b dark:border-gray-700 min-w-[36px]",
                      isCurrentMonth && day === todayDay
                        ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-bold"
                        : "text-gray-500 dark:text-gray-400"
                    )}
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr
                  key={item.id}
                  className={clsx(
                    idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/50 dark:bg-gray-800/50"
                  )}
                >
                  <td className={clsx(
                    "sticky left-0 z-10 px-4 py-2 text-sm font-medium text-gray-800 dark:text-gray-200 border-r dark:border-r-gray-700 whitespace-nowrap",
                    idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800"
                  )}>
                    {item.name}
                  </td>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const entry = getEntry(item.id, day);
                    const cellKey = `${item.id}-${day}`;
                    const isToggling = togglingCell === cellKey;
                    const isToday = isCurrentMonth && day === todayDay;

                    return (
                      <td
                        key={day}
                        className={clsx(
                          "px-1 py-2 text-center border-l border-gray-100 dark:border-gray-700",
                          isToday && "bg-primary-50/50 dark:bg-primary-900/20",
                          canFill && "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                        )}
                        onClick={() => toggleEntry(item.id, day)}
                        title={
                          entry
                            ? `${entry.done ? "Done" : "Not done"} — filled by ${entry.filledBy.name}`
                            : "Not filled"
                        }
                      >
                        {isToggling ? (
                          <Loader2 className="inline animate-spin text-gray-400" size={16} />
                        ) : entry ? (
                          entry.done ? (
                            <Check className="inline text-emerald-600" size={18} strokeWidth={3} />
                          ) : (
                            <X className="inline text-red-500" size={18} strokeWidth={3} />
                          )
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {items.length > 0 && !loading && (
        <div className="flex items-center gap-6 mt-4 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Check className="text-emerald-600" size={16} strokeWidth={3} /> Done
          </span>
          <span className="flex items-center gap-1">
            <X className="text-red-500" size={16} strokeWidth={3} /> Not done
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-4 border border-gray-200 dark:border-gray-600 rounded" /> Not filled
          </span>
        </div>
      )}
    </div>
  );
}
