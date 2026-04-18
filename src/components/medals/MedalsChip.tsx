"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Trophy } from "lucide-react";
import clsx from "clsx";

// ── Types ──────────────────────────────────────────────────────────────────

type MedalTier = "GOLD" | "SILVER" | "BRONZE";

interface AwardEntry {
  id: string;
  game: string;
  tier: MedalTier;
  coins: number;
  reason: string | null;
  createdAt: string;
}

interface MeData {
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  totalMedals: number;
  totalCoins: number;
  recent: AwardEntry[];
}

const TIER_EMOJI: Record<MedalTier, string> = {
  GOLD: "🥇",
  SILVER: "🥈",
  BRONZE: "🥉",
};

// ── Component ──────────────────────────────────────────────────────────────

export default function MedalsChip() {
  const { data: session } = useSession();
  const router = useRouter();
  const [data, setData] = useState<MeData | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchTally = useCallback(async () => {
    try {
      const res = await fetch("/api/medals/me");
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch {
      // silently fail — chip just won't render
    }
  }, []);

  // Poll every 60s so a freshly-awarded medal shows up without needing a
  // page reload. Same cadence as NotificationBell.
  useEffect(() => {
    if (!session?.user?.isRegistered) return;
    fetchTally();
    const interval = setInterval(fetchTally, 60000);
    return () => clearInterval(interval);
  }, [session, fetchTally]);

  // Click outside closes the popover
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Hide entirely if the resident has no awards (no clutter for newcomers)
  if (!session?.user?.isRegistered) return null;
  if (!data || data.totalMedals === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-gray-700 dark:text-gray-200 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/40 border border-yellow-200 dark:border-yellow-800 transition-colors"
        aria-label="My medals and coins"
        title="My medals and coins"
      >
        <Trophy size={14} className="text-yellow-600 dark:text-yellow-400" />
        <span>{data.totalMedals}</span>
        <span className="text-gray-300 dark:text-gray-600">·</span>
        <span className="text-amber-600 dark:text-amber-400">
          💰 {data.totalCoins.toLocaleString("en-IN")}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {/* Header with totals */}
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/30 p-4 border-b border-yellow-100 dark:border-yellow-800">
            <div className="flex justify-around mb-2">
              <TallyCol emoji="🥇" count={data.goldCount} />
              <TallyCol emoji="🥈" count={data.silverCount} />
              <TallyCol emoji="🥉" count={data.bronzeCount} />
            </div>
            <div className="flex items-center justify-center gap-1 text-sm">
              <span className="text-amber-600 dark:text-amber-400 font-bold text-base">
                💰 {data.totalCoins.toLocaleString("en-IN")}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">coins</span>
            </div>
          </div>

          {/* Recent awards */}
          <div className="px-3 py-2 max-h-64 overflow-y-auto">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400 mb-2 px-1">
              Recent
            </p>
            {data.recent.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">
                No recent awards
              </p>
            ) : (
              <div className="space-y-1">
                {data.recent.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <span className="text-xl shrink-0">{TIER_EMOJI[a.tier]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {a.game}
                      </p>
                      {a.reason && (
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                          {a.reason}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                      +{a.coins}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer link */}
          <button
            onClick={() => {
              setOpen(false);
              router.push("/me/awards");
            }}
            className={clsx(
              "block w-full text-center text-xs font-medium py-2 border-t border-gray-100 dark:border-gray-700",
              "text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-gray-700"
            )}
          >
            View all awards →
          </button>
        </div>
      )}
    </div>
  );
}

function TallyCol({ emoji, count }: { emoji: string; count: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-2xl">{emoji}</span>
      <span className="text-sm font-bold text-gray-800 dark:text-gray-100 mt-0.5">
        {count}
      </span>
    </div>
  );
}
