"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CalendarDays, Users, Lock, ChevronRight, Flame } from "lucide-react";
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

const RCB_LOGO = "https://www.royalchallengers.com/themes/custom/rcbbase/images/rcb-logo-new.png";

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  OPEN:      { label: "Open for Picks", dot: "bg-green-400" },
  LOCKED:    { label: "Locked",         dot: "bg-yellow-400" },
  COMPLETED: { label: "Completed",      dot: "bg-gray-400"   },
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
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #1a0505 0%, #2c0808 40%, #1a0505 100%)" }}>
      {/* Hero */}
      <div className="relative overflow-hidden">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 40px,#ffffff08 40px,#ffffff08 41px),repeating-linear-gradient(90deg,transparent,transparent 40px,#ffffff08 40px,#ffffff08 41px)",
          }}
        />
        {/* Red glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(ellipse, #D80C0B 0%, transparent 70%)" }} />

        <div className="relative max-w-3xl mx-auto px-4 pt-12 pb-8 text-center">
          {/* RCB Logo */}
          <div className="flex justify-center mb-6">
            <div className="relative w-28 h-28 drop-shadow-2xl">
              <Image
                src={RCB_LOGO}
                alt="RCB Logo"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
            RMV Fantasy
            <span className="block text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(90deg, #E7C641, #f5d96b, #E7C641)" }}>
              Cricket League
            </span>
          </h1>
          <p className="mt-3 text-red-200/70 text-base">
            Pick your RCB dream team · Earn points · Rule the leaderboard
          </p>

          {/* Gold divider */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <div className="h-px flex-1 max-w-16" style={{ background: "linear-gradient(90deg, transparent, #E7C641)" }} />
            <Flame size={16} className="text-yellow-400" />
            <div className="h-px flex-1 max-w-16" style={{ background: "linear-gradient(90deg, #E7C641, transparent)" }} />
          </div>
        </div>
      </div>

      {/* Matches */}
      <div className="max-w-3xl mx-auto px-4 pb-16">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-20 text-red-200/40">
            <p className="text-lg font-medium">No matches scheduled yet</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((m) => {
              const st = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.OPEN;
              const date = new Date(m.matchDate);
              const isOpen = m.status === "OPEN";

              return (
                <Link
                  key={m.id}
                  href={`/fantasy/${m.id}`}
                  className="group block rounded-2xl overflow-hidden transition-all hover:scale-[1.01] hover:shadow-2xl"
                  style={{
                    background: "linear-gradient(135deg, rgba(216,12,11,0.15) 0%, rgba(44,8,8,0.6) 100%)",
                    border: "1px solid rgba(216,12,11,0.3)",
                    boxShadow: isOpen ? "0 0 20px rgba(216,12,11,0.15)" : "none",
                  }}
                >
                  <div className="p-5 flex items-center gap-4">
                    {/* VS badge */}
                    <div className="shrink-0 text-center">
                      <div className="text-xs font-bold text-red-300/60 uppercase tracking-widest">RCB</div>
                      <div className="text-white font-black text-sm">vs</div>
                      <div className="text-xs font-bold text-red-300/60 uppercase tracking-widest">{m.opponent}</div>
                    </div>

                    {/* Divider */}
                    <div className="w-px h-12 shrink-0" style={{ background: "linear-gradient(180deg, transparent, #D80C0B, transparent)" }} />

                    <div className="flex-1 min-w-0">
                      <h2 className="font-bold text-white text-base truncate">{m.title}</h2>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-red-200/60">
                        <span className="flex items-center gap-1">
                          <CalendarDays size={11} />
                          {date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                          {" · "}
                          {date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {m.venue && <span>{m.venue}</span>}
                        <span className="flex items-center gap-1">
                          <Users size={11} />
                          {m._count.teams} teams
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className={clsx("w-1.5 h-1.5 rounded-full", st.dot)} />
                        <span className="text-xs font-medium text-red-100/80">{st.label}</span>
                      </div>
                    </div>

                    <ChevronRight
                      size={18}
                      className="shrink-0 text-red-500/40 group-hover:text-yellow-400 transition-colors"
                    />
                  </div>

                  {/* Gold bottom accent on hover */}
                  <div
                    className="h-0.5 w-0 group-hover:w-full transition-all duration-500"
                    style={{ background: "linear-gradient(90deg, #D80C0B, #E7C641, #D80C0B)" }}
                  />
                </Link>
              );
            })}
          </div>
        )}

        {/* Points guide */}
        <div className="mt-10 rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-xs font-bold text-yellow-400/80 uppercase tracking-widest mb-3">Points System</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: "🏃", label: "Run", pts: "1 pt" },
              { icon: "🎯", label: "Wicket", pts: "30 pts" },
              { icon: "🙌", label: "Catch", pts: "20 pts" },
              { icon: "💨", label: "Run-out/Stumping", pts: "20 pts" },
            ].map((item) => (
              <div key={item.label} className="text-center p-3 rounded-xl"
                style={{ background: "rgba(216,12,11,0.1)", border: "1px solid rgba(216,12,11,0.2)" }}>
                <div className="text-lg">{item.icon}</div>
                <div className="text-xs text-red-200/60 mt-0.5">{item.label}</div>
                <div className="text-sm font-bold text-yellow-400 mt-0.5">{item.pts}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-red-200/40 text-center mt-3">
            Captain <span className="text-yellow-400 font-semibold">2×</span> · Vice-captain <span className="text-yellow-400 font-semibold">1.5×</span>
          </p>
        </div>
      </div>
    </div>
  );
}
