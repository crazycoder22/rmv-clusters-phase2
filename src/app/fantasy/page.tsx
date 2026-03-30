"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, CalendarDays, Users, Lock, CheckCircle, ChevronRight, Swords } from "lucide-react";
import clsx from "clsx";

interface FantasyMatch {
  id: string;
  title: string;
  opponent: string;
  venue: string | null;
  matchDate: string;
  status: string;
  _count: { players: number; teams: number };
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  OPEN: { label: "Open for picks", color: "text-green-700 bg-green-50 border-green-200", icon: <CheckCircle size={13} /> },
  LOCKED: { label: "Locked", color: "text-amber-700 bg-amber-50 border-amber-200", icon: <Lock size={13} /> },
  COMPLETED: { label: "Completed", color: "text-gray-600 bg-gray-50 border-gray-200", icon: <Trophy size={13} /> },
};

export default function FantasyPage() {
  const [matches, setMatches] = useState<FantasyMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/fantasy/matches")
      .then((r) => r.json())
      .then((d) => setMatches(d.matches ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-4">
            <Trophy size={30} className="text-yellow-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">RMV Fantasy Cricket</h1>
          <p className="mt-2 text-gray-500">
            Pick your dream RCB XI, predict the stars, climb the leaderboard!
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Swords size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No matches yet</p>
            <p className="text-sm">Check back when the next match is set up.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((m) => {
              const st = STATUS_LABELS[m.status] ?? STATUS_LABELS.OPEN;
              const date = new Date(m.matchDate);
              return (
                <Link
                  key={m.id}
                  href={`/fantasy/${m.id}`}
                  className="block bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-primary-200 transition-all group"
                >
                  <div className="p-5 flex items-center gap-4">
                    {/* RCB badge */}
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-red-600 font-bold text-sm">
                      RCB
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-semibold text-gray-900 text-base truncate">
                          {m.title}
                        </h2>
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border",
                            st.color
                          )}
                        >
                          {st.icon}
                          {st.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <CalendarDays size={13} />
                          {date.toLocaleDateString("en-IN", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        {m.venue && <span>{m.venue}</span>}
                        <span className="flex items-center gap-1">
                          <Users size={13} />
                          {m._count.teams} {m._count.teams === 1 ? "team" : "teams"} entered
                        </span>
                      </div>
                    </div>

                    <ChevronRight
                      size={18}
                      className="text-gray-300 group-hover:text-primary-400 shrink-0 transition-colors"
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
