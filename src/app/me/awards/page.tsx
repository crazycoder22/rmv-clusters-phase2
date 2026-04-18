"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { ArrowLeft, Trophy, Coins } from "lucide-react";
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
  all: AwardEntry[];
}

const TIER_CONFIG: Record<MedalTier, { label: string; emoji: string; chipBg: string }> = {
  GOLD: { label: "Gold", emoji: "🥇", chipBg: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  SILVER: { label: "Silver", emoji: "🥈", chipBg: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" },
  BRONZE: { label: "Bronze", emoji: "🥉", chipBg: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
};

// ── Page ───────────────────────────────────────────────────────────────────

export default function MyAwardsPage() {
  const { data: session, status: authStatus } = useSession();
  const [data, setData] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authStatus !== "loading" && !session) {
      signIn("google", { callbackUrl: "/me/awards" });
    }
  }, [session, authStatus]);

  useEffect(() => {
    if (!session?.user?.email) return;
    fetch("/api/medals/me")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [session]);

  if (authStatus === "loading" || !session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">
          Loading...
        </div>
      </div>
    );
  }

  if (!data || data.totalMedals === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-primary-400 mb-5"
        >
          <ArrowLeft size={14} /> Back home
        </Link>
        <div className="text-center py-16">
          <Trophy size={64} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h1 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-2">
            No awards yet
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Play games, win competitions, contribute to the community —
            medals will show up here when you earn them. 🏆
          </p>
        </div>
      </div>
    );
  }

  // Group awards by game for the breakdown
  const byGame = new Map<string, AwardEntry[]>();
  for (const a of data.all) {
    if (!byGame.has(a.game)) byGame.set(a.game, []);
    byGame.get(a.game)!.push(a);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-primary-400 mb-5"
      >
        <ArrowLeft size={14} /> Back home
      </Link>

      {/* Hero */}
      <div className="bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 dark:from-yellow-900/20 dark:via-amber-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Trophy size={28} className="text-yellow-600 dark:text-yellow-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            My Awards
          </h1>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <TierStat tier="GOLD" count={data.goldCount} />
          <TierStat tier="SILVER" count={data.silverCount} />
          <TierStat tier="BRONZE" count={data.bronzeCount} />
        </div>

        <div className="flex items-center justify-center gap-2 p-3 bg-white/80 dark:bg-gray-800/60 rounded-xl">
          <Coins size={20} className="text-amber-500" />
          <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {data.totalCoins.toLocaleString("en-IN")}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">virtual coins</span>
        </div>
      </div>

      {/* By game */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
        By Game / Event
      </h2>
      <div className="space-y-3 mb-6">
        {Array.from(byGame.entries())
          .sort(([, a], [, b]) => b.length - a.length)
          .map(([gameName, list]) => {
            const tot = list.length;
            const g = list.filter((a) => a.tier === "GOLD").length;
            const s = list.filter((a) => a.tier === "SILVER").length;
            const br = list.filter((a) => a.tier === "BRONZE").length;
            const c = list.reduce((sum, a) => sum + a.coins, 0);
            return (
              <div
                key={gameName}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {gameName}
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {tot} {tot === 1 ? "award" : "awards"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  {g > 0 && <span>🥇 {g}</span>}
                  {s > 0 && <span>🥈 {s}</span>}
                  {br > 0 && <span>🥉 {br}</span>}
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    💰 {c}
                  </span>
                </div>
              </div>
            );
          })}
      </div>

      {/* Full history */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
        All Awards
      </h2>
      <div className="space-y-2">
        {data.all.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <span className="text-2xl">{TIER_CONFIG[a.tier].emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {a.game}
                </span>
                <span
                  className={clsx(
                    "text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded",
                    TIER_CONFIG[a.tier].chipBg
                  )}
                >
                  {TIER_CONFIG[a.tier].label}
                </span>
              </div>
              {a.reason && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {a.reason}
                </p>
              )}
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                {new Date(a.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
              +{a.coins} 💰
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TierStat({ tier, count }: { tier: MedalTier; count: number }) {
  const cfg = TIER_CONFIG[tier];
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center p-3 rounded-xl",
        count > 0 ? cfg.chipBg : "bg-gray-50 dark:bg-gray-800/40 text-gray-400 dark:text-gray-600"
      )}
    >
      <span className="text-3xl">{cfg.emoji}</span>
      <span className="text-2xl font-bold mt-1">{count}</span>
      <span className="text-[10px] uppercase tracking-wider">{cfg.label}</span>
    </div>
  );
}
