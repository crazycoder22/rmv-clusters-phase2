"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRequireSignIn } from "@/hooks/useRequireSignIn";
import { ListChecks, CheckCircle2, Circle, Sun, Moon } from "lucide-react";

interface DutyItem {
  id: string;
  title: string;
  doneToday: boolean;
  doneBy: string | null;
  doneAt: string | null;
}
interface DutyChecklistView {
  id: string;
  title: string;
  description: string | null;
  reminderWave: "MORNING" | "EVENING";
  items: DutyItem[];
  doneCount: number;
  totalCount: number;
}

export default function DutiesPage() {
  const { status } = useSession();
  const [checklists, setChecklists] = useState<DutyChecklistView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useRequireSignIn(status);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/duties");
      if (res.ok) setChecklists((await res.json()).checklists ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function toggle(item: DutyItem) {
    setBusyId(item.id);
    // optimistic
    setChecklists((cls) =>
      cls.map((cl) => ({
        ...cl,
        items: cl.items.map((it) => (it.id === item.id ? { ...it, doneToday: !it.doneToday } : it)),
        doneCount: cl.items.filter((it) => (it.id === item.id ? !item.doneToday : it.doneToday)).length,
      }))
    );
    try {
      const res = await fetch(`/api/duties/items/${item.id}/check`, {
        method: item.doneToday ? "DELETE" : "POST",
      });
      if (!res.ok) await refresh(); // rollback
      else await refresh(); // pull doneBy/doneAt
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ListChecks className="text-blue-600" /> My duties
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Tick off today&apos;s duties as you complete them</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : checklists.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 py-16 text-center text-gray-500 dark:text-gray-400">
            <ListChecks size={32} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">No duties assigned to you.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {checklists.map((cl) => {
              const allDone = cl.totalCount > 0 && cl.doneCount === cl.totalCount;
              return (
                <div key={cl.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <div>
                      <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                        {cl.reminderWave === "MORNING" ? <Sun size={15} className="text-amber-500" /> : <Moon size={15} className="text-indigo-500" />}
                        {cl.title}
                      </h2>
                      {cl.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{cl.description}</p>}
                    </div>
                    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${allDone ? "text-green-700 bg-green-100" : "text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700"}`}>
                      {cl.doneCount}/{cl.totalCount}
                    </span>
                  </div>
                  <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                    {cl.items.map((it) => (
                      <li key={it.id}>
                        <button
                          type="button"
                          onClick={() => toggle(it)}
                          disabled={busyId === it.id}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60"
                        >
                          {it.doneToday ? (
                            <CheckCircle2 size={22} className="text-green-600 shrink-0" />
                          ) : (
                            <Circle size={22} className="text-gray-300 dark:text-gray-600 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${it.doneToday ? "text-gray-400 dark:text-gray-500 line-through" : "text-gray-800 dark:text-gray-200"}`}>{it.title}</p>
                            {it.doneToday && it.doneBy && (
                              <p className="text-[11px] text-green-600 mt-0.5">Done by {it.doneBy}{it.doneAt ? ` · ${fmtTime(it.doneAt)}` : ""}</p>
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}
