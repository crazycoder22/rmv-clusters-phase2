import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Dices,
  Loader2,
  Power,
  Trophy,
  Users,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { canManageAnnouncements } from "../lib/roles";

// ── Types ──────────────────────────────────────────────────────────────────

type Status = "WAITING" | "ACTIVE" | "COMPLETED";

type PrizeType =
  | "EARLY_FIVE"
  | "TOP_LINE"
  | "MIDDLE_LINE"
  | "BOTTOM_LINE"
  | "FULL_HOUSE";

interface SessionState {
  id: string;
  code: string;
  title: string;
  status: Status;
  drawnNumbers: number[];
  prizes: { prizeType: PrizeType; playerName: string; claimedAt: string }[];
  playerCount: number;
}

const PRIZE_LABELS: Record<PrizeType, string> = {
  EARLY_FIVE: "Early Five",
  TOP_LINE: "Top Line",
  MIDDLE_LINE: "Middle Line",
  BOTTOM_LINE: "Bottom Line",
  FULL_HOUSE: "Full House",
};

// All five prize categories, in claim order.
const PRIZE_TYPES: PrizeType[] = [
  "EARLY_FIVE",
  "TOP_LINE",
  "MIDDLE_LINE",
  "BOTTOM_LINE",
  "FULL_HOUSE",
];

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminTambolaHost() {
  const { code = "" } = useParams<{ code: string }>();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !canManageAnnouncements(user.roles)) {
      navigate("/more", { replace: true });
    }
  }, [user, navigate]);

  const [state, setState] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [ending, setEnding] = useState(false);
  const [lastDrawn, setLastDrawn] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Initial fetch + poll every 2.5s while page is open.
  const fetchState = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/tambola/sessions/${code}`);
      if (!res.ok) {
        setError(res.status === 404 ? "Session not found" : "Could not load");
        return;
      }
      const data: SessionState = await res.json();
      setState(data);
      setError(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    void fetchState();
    const handle = setInterval(fetchState, 2500);
    return () => clearInterval(handle);
  }, [fetchState]);

  async function drawNext() {
    if (!state || state.status === "COMPLETED") return;
    setDrawing(true);
    try {
      const res = await apiFetch(`/api/tambola/sessions/${code}/draw`, {
        method: "POST",
        token,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Could not draw");
        return;
      }
      const data = await res.json();
      setLastDrawn(data.drawnNumber);
      setState((prev) =>
        prev
          ? {
              ...prev,
              drawnNumbers: data.drawnNumbers,
              status: prev.status === "WAITING" ? "ACTIVE" : prev.status,
            }
          : prev
      );
    } catch {
      setError("Network error");
    } finally {
      setDrawing(false);
    }
  }

  async function endSession() {
    if (
      !confirm(
        "End this session? Players won't be able to make any more claims."
      )
    )
      return;
    setEnding(true);
    try {
      const res = await apiFetch(`/api/tambola/sessions/${code}/end`, {
        method: "POST",
        token,
      });
      if (res.ok) {
        await fetchState();
      }
    } finally {
      setEnding(false);
    }
  }

  function copyCode() {
    if (!state) return;
    void navigator.clipboard.writeText(state.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const remaining = state ? 90 - state.drawnNumbers.length : 0;
  const reverseDraws = useMemo(
    () => (state ? [...state.drawnNumbers].reverse() : []),
    [state]
  );
  const wonPrizes = state
    ? new Set(state.prizes.map((p) => p.prizeType))
    : new Set<PrizeType>();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-500">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
        <header className="flex items-center gap-2 py-4">
          <Link
            to="/admin/tambola"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-semibold text-white">Host</h1>
        </header>
        <p className="rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-3 text-xs text-red-200">
          {error ?? "Session not found"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/admin/tambola"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-lg font-semibold text-white">
            {state.title}
          </h1>
          <p className="truncate text-[11px] text-slate-500">
            {state.status} · {state.playerCount} player
            {state.playerCount !== 1 ? "s" : ""}
          </p>
        </div>
      </header>

      {/* Code + share */}
      <section className="mb-3 flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">
            Game code
          </p>
          <p className="font-mono text-2xl font-bold tracking-widest text-indigo-200">
            {state.code}
          </p>
        </div>
        <button
          type="button"
          onClick={copyCode}
          className={clsx(
            "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium",
            copied
              ? "bg-emerald-500 text-white"
              : "bg-slate-900 text-slate-300 active:bg-slate-800"
          )}
        >
          {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </section>

      {/* Draw button + last number */}
      <section className="mb-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Last drawn
            </p>
            <p className="text-4xl font-bold tabular-nums text-white">
              {lastDrawn ??
                state.drawnNumbers[state.drawnNumbers.length - 1] ??
                "—"}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {state.drawnNumbers.length} drawn · {remaining} left
            </p>
          </div>
          <button
            type="button"
            onClick={drawNext}
            disabled={drawing || state.status === "COMPLETED" || remaining === 0}
            className={clsx(
              "flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-full text-white shadow-lg transition-transform active:scale-95",
              state.status === "COMPLETED" || remaining === 0
                ? "bg-slate-700"
                : "bg-indigo-500 active:bg-indigo-600",
              drawing && "opacity-50"
            )}
          >
            {drawing ? (
              <Loader2 size={22} className="animate-spin" />
            ) : (
              <Dices size={22} />
            )}
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Draw
            </span>
          </button>
        </div>
      </section>

      {/* Number board */}
      <section className="mb-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
        <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Board
        </h2>
        <NumberBoard
          drawn={new Set(state.drawnNumbers)}
          last={lastDrawn ?? state.drawnNumbers[state.drawnNumbers.length - 1]}
        />
      </section>

      {/* Prize tracker */}
      <section className="mb-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
        <h2 className="mb-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <Trophy size={11} /> Prizes claimed
        </h2>
        <ul className="space-y-1">
          {PRIZE_TYPES.map((pt) => {
            const won = state.prizes.find((p) => p.prizeType === pt);
            return (
              <li
                key={pt}
                className={clsx(
                  "flex items-center justify-between rounded-lg px-2.5 py-1.5",
                  won
                    ? "bg-amber-500/15 text-amber-200"
                    : "bg-slate-900/40 text-slate-400"
                )}
              >
                <span className="text-[12px] font-medium">
                  {PRIZE_LABELS[pt]}
                </span>
                <span className="truncate text-[11px]">
                  {won ? won.playerName : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Recent draws */}
      {reverseDraws.length > 0 && (
        <section className="mb-3">
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Recent draws
          </h2>
          <div className="flex flex-wrap gap-1">
            {reverseDraws.slice(0, 20).map((n, i) => (
              <span
                key={`${n}-${i}`}
                className={clsx(
                  "inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs font-bold",
                  i === 0
                    ? "bg-indigo-500 text-white"
                    : "bg-slate-800 text-slate-200"
                )}
              >
                {n}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* End session */}
      {state.status !== "COMPLETED" && (
        <button
          type="button"
          onClick={endSession}
          disabled={ending}
          className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-red-700/60 bg-red-900/30 py-3 text-sm font-semibold text-red-200 active:bg-red-900/50 disabled:opacity-50"
        >
          {ending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Power size={14} />
          )}
          End session
        </button>
      )}

      {state.status === "COMPLETED" && wonPrizes.size > 0 && (
        <p className="mb-4 rounded-xl border border-emerald-700/40 bg-emerald-900/20 px-4 py-3 text-center text-xs text-emerald-200">
          Session ended · {wonPrizes.size} prize
          {wonPrizes.size !== 1 ? "s" : ""} claimed
        </p>
      )}

      <p className="pb-2 text-center text-[10px] text-slate-500">
        <Users size={9} className="-mt-0.5 mr-1 inline" />
        {state.playerCount} player{state.playerCount !== 1 ? "s" : ""} ·
        polling every 2.5s
      </p>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function NumberBoard({
  drawn,
  last,
}: {
  drawn: Set<number>;
  last?: number;
}) {
  // 9 columns × 10 rows = 90 numbers. Column n covers 10(n-1)+1 .. 10n,
  // matching how tickets are laid out.
  const rows: number[][] = [];
  for (let r = 0; r < 10; r++) {
    const row: number[] = [];
    for (let c = 0; c < 9; c++) {
      row.push(c * 10 + r + 1);
    }
    rows.push(row);
  }
  return (
    <div className="space-y-0.5">
      {rows.map((row, ri) => (
        <div key={ri} className="grid grid-cols-9 gap-0.5">
          {row.map((n) => {
            const isDrawn = drawn.has(n);
            const isLast = n === last;
            return (
              <div
                key={n}
                className={clsx(
                  "flex h-7 items-center justify-center rounded text-[10px] font-bold tabular-nums",
                  isLast
                    ? "bg-indigo-500 text-white"
                    : isDrawn
                      ? "bg-emerald-500/30 text-emerald-100"
                      : "bg-slate-900 text-slate-500"
                )}
              >
                {n}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

