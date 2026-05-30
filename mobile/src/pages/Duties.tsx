import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ListChecks, CheckCircle2, Circle, Sun, Moon, Loader2 } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import clsx from "clsx";

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

export default function Duties() {
  const { token } = useAuth();
  const [checklists, setChecklists] = useState<DutyChecklistView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/duties", { token });
      if (res.ok) setChecklists((await res.json()).checklists ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function toggle(item: DutyItem) {
    setBusyId(item.id);
    // optimistic
    setChecklists((cls) =>
      cls.map((cl) => ({
        ...cl,
        items: cl.items.map((it) =>
          it.id === item.id ? { ...it, doneToday: !it.doneToday } : it
        ),
        doneCount: cl.items.filter((it) =>
          it.id === item.id ? !item.doneToday : it.doneToday
        ).length,
      }))
    );
    try {
      await apiFetch(`/api/duties/items/${item.id}/check`, {
        method: item.doneToday ? "DELETE" : "POST",
        token,
      });
      await refresh(); // pull fresh doneBy/doneAt
    } finally {
      setBusyId(null);
    }
  }

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
          <h1 className="text-lg font-semibold text-white">My duties</h1>
          <p className="truncate text-[11px] text-slate-500">Tick off today&apos;s duties as you complete them</p>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-12 text-slate-500">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : checklists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-12 text-center text-sm text-slate-500">
          <ListChecks size={28} className="mx-auto mb-2 text-slate-600" />
          No duties assigned to you.
        </div>
      ) : (
        <div className="space-y-5 pb-4">
          {checklists.map((cl) => {
            const allDone = cl.totalCount > 0 && cl.doneCount === cl.totalCount;
            return (
              <div
                key={cl.id}
                className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60"
              >
                <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="flex items-center gap-1.5 text-sm font-semibold text-white">
                      {cl.reminderWave === "MORNING" ? (
                        <Sun size={14} className="text-amber-400 shrink-0" />
                      ) : (
                        <Moon size={14} className="text-indigo-400 shrink-0" />
                      )}
                      {cl.title}
                    </h2>
                    {cl.description && (
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">{cl.description}</p>
                    )}
                  </div>
                  <span
                    className={clsx(
                      "ml-3 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                      allDone
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-slate-700 text-slate-300"
                    )}
                  >
                    {cl.doneCount}/{cl.totalCount}
                  </span>
                </div>
                <ul className="divide-y divide-slate-700/60">
                  {cl.items.map((it) => (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => toggle(it)}
                        disabled={busyId === it.id}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-800 disabled:opacity-60"
                      >
                        {it.doneToday ? (
                          <CheckCircle2 size={22} className="shrink-0 text-emerald-400" />
                        ) : (
                          <Circle size={22} className="shrink-0 text-slate-600" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p
                            className={clsx(
                              "text-sm",
                              it.doneToday
                                ? "line-through text-slate-500"
                                : "text-slate-100"
                            )}
                          >
                            {it.title}
                          </p>
                          {it.doneToday && it.doneBy && (
                            <p className="mt-0.5 text-[11px] text-emerald-400">
                              Done by {it.doneBy}
                              {it.doneAt ? ` · ${fmtTime(it.doneAt)}` : ""}
                            </p>
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
  );
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}
