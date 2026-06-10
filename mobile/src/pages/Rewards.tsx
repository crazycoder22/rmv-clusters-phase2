import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Coins, Loader2, Trophy } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

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

const TIER: Record<MedalTier, { label: string; emoji: string; chip: string }> = {
  GOLD: { label: "Gold", emoji: "🥇", chip: "bg-yellow-500/20 text-yellow-300" },
  SILVER: { label: "Silver", emoji: "🥈", chip: "bg-slate-500/30 text-slate-200" },
  BRONZE: { label: "Bronze", emoji: "🥉", chip: "bg-amber-600/20 text-amber-300" },
};

// ── Page ───────────────────────────────────────────────────────────────────

export default function Rewards() {
  const { token } = useAuth();
  const [data, setData] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch("/api/medals/me", { token });
      if (r.ok) setData(await r.json());
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const awards = data?.all ?? data?.recent ?? [];

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">Rewards</h1>
      </header>

      {loading ? (
        <div className="flex justify-center py-10 text-slate-500">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : !data || data.totalMedals === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-12 text-center">
          <Trophy size={40} className="mx-auto mb-3 text-slate-600" />
          <p className="text-sm font-semibold text-white">No coins yet</p>
          <p className="mx-auto mt-1 max-w-xs text-[12px] text-slate-500">
            Play games and win community competitions — coins &amp; medals you earn will show up here. 🏆
          </p>
          <Link to="/games" className="mt-4 inline-flex rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white active:bg-indigo-600">
            Play games
          </Link>
        </div>
      ) : (
        <div className="flex-1 space-y-4 pb-6">
          {/* Coins hero */}
          <div className="rounded-2xl border border-yellow-700/40 bg-gradient-to-br from-yellow-500/15 via-amber-500/10 to-orange-500/15 p-5">
            <div className="flex items-center justify-center gap-2">
              <Coins size={26} className="text-amber-400" />
              <span className="text-3xl font-bold tabular-nums text-white">
                {data.totalCoins.toLocaleString("en-IN")}
              </span>
            </div>
            <p className="mt-1 text-center text-[12px] text-amber-200/80">virtual coins</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <TierStat tier="GOLD" count={data.goldCount} />
              <TierStat tier="SILVER" count={data.silverCount} />
              <TierStat tier="BRONZE" count={data.bronzeCount} />
            </div>
          </div>

          {/* Recent wins */}
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Recent wins</h2>
            <ul className="space-y-2">
              {awards.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
                  <span className="text-2xl">{TIER[a.tier].emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-white">{a.game}</span>
                      <span className={clsx("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider", TIER[a.tier].chip)}>{TIER[a.tier].label}</span>
                    </div>
                    {a.reason && <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">{a.reason}</p>}
                    <p className="mt-0.5 text-[10px] text-slate-500">{fmtDate(a.createdAt)}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-amber-300">+{a.coins} 🪙</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function TierStat({ tier, count }: { tier: MedalTier; count: number }) {
  const cfg = TIER[tier];
  return (
    <div className={clsx("flex flex-col items-center rounded-xl py-2.5", count > 0 ? cfg.chip : "bg-slate-800/40 text-slate-600")}>
      <span className="text-2xl">{cfg.emoji}</span>
      <span className="mt-0.5 text-lg font-bold tabular-nums">{count}</span>
      <span className="text-[9px] uppercase tracking-wider">{cfg.label}</span>
    </div>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
