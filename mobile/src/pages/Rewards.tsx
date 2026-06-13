import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
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

const TIER_EMOJI: Record<MedalTier, string> = { GOLD: "🥇", SILVER: "🥈", BRONZE: "🥉" };

const TIER_BADGE: Record<MedalTier, { bg: string; color: string }> = {
  GOLD: { bg: "rgba(231,181,61,0.18)", color: "var(--gold)" },
  SILVER: { bg: "var(--surface-3)", color: "var(--text-2)" },
  BRONZE: { bg: "rgba(180,120,80,0.18)", color: "#c98a5a" },
};

const EMPTY_TEXT: Record<MedalTier, string> = {
  GOLD: "No gold wins yet — finish 1st in a weekly challenge to earn one.",
  SILVER: "No silver wins yet.",
  BRONZE: "No bronze wins yet — place 3rd in a challenge to earn one.",
};

// ── Page ───────────────────────────────────────────────────────────────────

export default function Rewards() {
  const { token } = useAuth();
  const [data, setData] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<MedalTier>("GOLD");

  const load = useCallback(async () => {
    try {
      const r = await apiFetch("/api/medals/me", { token });
      if (r.ok) {
        const d: MeData = await r.json();
        setData(d);
        // Default the tier tab to whichever the resident actually has wins in.
        if (d.goldCount > 0) setTier("GOLD");
        else if (d.silverCount > 0) setTier("SILVER");
        else if (d.bronzeCount > 0) setTier("BRONZE");
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const awards = data?.all ?? data?.recent ?? [];
  const tierWins = useMemo(() => awards.filter((a) => a.tier === tier), [awards, tier]);
  const counts: Record<MedalTier, number> = {
    GOLD: data?.goldCount ?? 0,
    SILVER: data?.silverCount ?? 0,
    BRONZE: data?.bronzeCount ?? 0,
  };

  return (
    <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <header className="flex items-center gap-3.5 py-3">
        <Link to="/community" className="flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={24} style={{ color: "var(--text-2)" }} />
        </Link>
        <h1 className="text-[25px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Rewards</h1>
      </header>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin" style={{ color: "var(--text-3)" }} /></div>
      ) : !data || data.totalMedals === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[18px] px-6 py-12 text-center" style={{ border: "1.5px dashed var(--border-strong)" }}>
          <span className="text-[40px]">🏆</span>
          <p className="text-[15px] font-bold" style={{ color: "var(--text)" }}>No coins yet</p>
          <p className="mx-auto max-w-xs text-[12.5px] leading-relaxed" style={{ color: "var(--text-3)" }}>
            Play games and win community competitions — coins &amp; medals you earn will show up here. 🏆
          </p>
          <Link to="/games" className="mt-3 inline-flex rounded-full px-5 py-2.5 text-[14px] font-bold text-white active:opacity-90" style={{ background: "var(--accent-strong)" }}>
            Play games
          </Link>
        </div>
      ) : (
        <>
          {/* Coins / medals hero */}
          <div
            className="rounded-[22px] p-[22px_16px_16px]"
            style={{ background: "linear-gradient(158deg, var(--gold-soft) 0%, var(--surface) 58%)", border: "1px solid rgba(231,181,61,0.42)", boxShadow: "0 10px 30px rgba(176,132,38,0.12)" }}
          >
            <div className="flex items-center justify-center gap-3">
              <span className="text-[30px] leading-none" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}>🪙</span>
              <span className="text-[42px] font-extrabold leading-none tabular-nums tracking-tight" style={{ color: "var(--text)" }}>{data.totalCoins.toLocaleString("en-IN")}</span>
            </div>
            <p className="mt-1.5 text-center text-[15px] font-semibold" style={{ color: "var(--gold)" }}>virtual coins</p>

            <div className="mt-5 flex gap-2.5">
              {(["GOLD", "SILVER", "BRONZE"] as MedalTier[]).map((t) => {
                const on = tier === t;
                return (
                  <button
                    key={t}
                    onClick={() => setTier(t)}
                    className="flex flex-1 flex-col items-center gap-1.5 rounded-[14px] px-1.5 pb-3 pt-3.5"
                    style={{ background: on ? "var(--surface-3)" : "transparent", border: `1px solid ${on ? "var(--border-strong)" : "var(--border)"}` }}
                  >
                    <span className="text-[30px] leading-none">{TIER_EMOJI[t]}</span>
                    <span className="font-extrabold leading-none" style={{ fontSize: on ? 22 : 19, color: on ? "var(--text)" : "var(--text-3)" }}>{counts[t]}</span>
                    <span className="text-[11px] font-bold" style={{ letterSpacing: "0.08em", color: on ? "var(--text-2)" : "var(--text-3)" }}>{t}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent wins · TIER */}
          <p className="one-mono mb-3.5 mt-6 px-1 text-[12px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.14em" }}>RECENT WINS · {tier}</p>

          {tierWins.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-9 text-center">
              <span className="text-[34px] opacity-50">{TIER_EMOJI[tier]}</span>
              <span className="text-[14px]" style={{ color: "var(--text-3)" }}>{EMPTY_TEXT[tier]}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {tierWins.map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-[18px] p-[15px_14px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <span className="mt-px flex-shrink-0 text-[28px] leading-none">{TIER_EMOJI[a.tier]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[16px] font-bold tracking-tight" style={{ color: "var(--text)" }}>{a.game}</span>
                      <span className="inline-flex items-center rounded-[6px] px-2 py-[3px] text-[10.5px] font-extrabold uppercase" style={{ letterSpacing: "0.07em", background: TIER_BADGE[a.tier].bg, color: TIER_BADGE[a.tier].color }}>{a.tier}</span>
                    </div>
                    {a.reason && <p className="mt-1.5 text-[13px] leading-snug" style={{ color: "var(--text-2)" }}>{a.reason}</p>}
                    <p className="mt-2 text-[12px]" style={{ color: "var(--text-3)" }}>{fmtDate(a.createdAt)}</p>
                  </div>
                  <span className="mt-px flex flex-shrink-0 items-center gap-1 self-start text-[16px] font-extrabold" style={{ color: "var(--coin)" }}>
                    +{a.coins} <span className="text-[17px] leading-none">🪙</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
