import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Brain, Coins } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

export default function Games() {
  const { token } = useAuth();
  const [coins, setCoins] = useState<number | null>(null);

  // Coins are won in games → show the running balance with a tap to Rewards.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiFetch("/api/medals/me", { token })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) setCoins(d.totalCoins ?? 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="flex flex-1 flex-col px-4 pt-[max(2rem,env(safe-area-inset-top,0px))]">
      <header className="mb-5 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Games
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Community games — play solo or together.
          </p>
        </div>
        {coins !== null && (
          <Link
            to="/rewards"
            className="flex shrink-0 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-sm font-semibold text-amber-300 active:bg-amber-500/25"
          >
            <Coins size={15} />
            <span className="tabular-nums">{coins.toLocaleString("en-IN")}</span>
          </Link>
        )}
      </header>

      <div className="grid gap-3">
        <GameTile
          to="/memory"
          icon="🧠"
          title="Memory Match"
          subtitle="Daily 5×4 card challenge · multiplayer inside"
        />
        <GameTile
          to="/wordle"
          icon="🔤"
          title="Wordle"
          subtitle="Guess the 5-letter word"
        />
        <GameTile
          to="/anagram"
          icon="🐝"
          title="Anagram"
          subtitle="Find words from 7 letters · daily"
        />
        <GameTile
          to="/sudoku"
          icon="🔢"
          title="Sudoku"
          subtitle="Daily 9×9 number puzzle"
        />
        <GameTile
          to="/2048"
          icon="🎯"
          title="2048"
          subtitle="Swipe to merge tiles"
        />
        <GameTile
          to="/quiz"
          icon="🎮"
          title="Quiz Night"
          subtitle="Join a live community quiz"
        />
        <GameTile
          to="/tambola"
          icon="🎫"
          title="Tambola"
          subtitle="Live bingo with prizes"
        />
        <GameTile
          to="/fantasy"
          icon="🏏"
          title="Fantasy Cricket"
          subtitle="Build your team, climb the leaderboard"
        />
      </div>
    </div>
  );
}

function GameTile({
  to,
  icon,
  title,
  subtitle,
}: {
  to: string;
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 active:scale-[0.98] active:bg-slate-800"
    >
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-2xl">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-indigo-400" />
          <h2 className="text-base font-semibold text-white">{title}</h2>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
      </div>
      <span className="text-slate-500">›</span>
    </Link>
  );
}
