import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Trophy } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type Status = "WAITING" | "ACTIVE" | "COMPLETED";
type PrizeType =
  | "EARLY_FIVE"
  | "TOP_LINE"
  | "MIDDLE_LINE"
  | "BOTTOM_LINE"
  | "FULL_HOUSE";

type Prize = {
  prizeType: PrizeType;
  playerName: string;
  claimedAt: string;
};

type SessionState = {
  id: string;
  code: string;
  title: string;
  status: Status;
  drawnNumbers: number[];
  prizes: Prize[];
  playerCount: number;
  ticket?: number[][];
  markedNumbers?: number[];
};

const POLL_INTERVAL_MS = 2000;

const PRIZE_LABELS: Record<PrizeType, string> = {
  EARLY_FIVE: "Early Five",
  TOP_LINE: "Top Line",
  MIDDLE_LINE: "Middle Line",
  BOTTOM_LINE: "Bottom Line",
  FULL_HOUSE: "Full House",
};

const PRIZE_ORDER: PrizeType[] = [
  "EARLY_FIVE",
  "TOP_LINE",
  "MIDDLE_LINE",
  "BOTTOM_LINE",
  "FULL_HOUSE",
];

export default function TambolaSession() {
  const { code = "" } = useParams<{ code: string }>();
  const { user } = useAuth();
  const playerId = user?.playerId ?? null;

  const [state, setState] = useState<SessionState | null>(null);
  const [joining, setJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!playerId || !code) return;
    let cancelled = false;

    (async () => {
      if (!joinedRef.current) {
        try {
          const res = await apiFetch(`/api/tambola/sessions/${code}/join`, {
            method: "POST",
            body: JSON.stringify({ playerId }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            if (!cancelled) setError(body.error ?? "Failed to join");
            return;
          }
          joinedRef.current = true;
        } catch {
          if (!cancelled) setError("Network error");
          return;
        }
      }
      if (!cancelled) setJoining(false);

      const poll = async () => {
        try {
          const res = await apiFetch(
            `/api/tambola/sessions/${code}?playerId=${playerId}`
          );
          if (!res.ok) return;
          const data = (await res.json()) as SessionState;
          if (!cancelled) setState(data);
        } catch {
          /* swallow */
        }
      };
      poll();
      const t = setInterval(poll, POLL_INTERVAL_MS);
      return () => clearInterval(t);
    })();

    return () => {
      cancelled = true;
    };
  }, [playerId, code]);

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2000);
  }, []);

  const markNumber = useCallback(
    async (num: number) => {
      if (!playerId || !state) return;
      if (!state.drawnNumbers.includes(num)) {
        flashToast("That number hasn't been drawn yet");
        return;
      }
      // Optimistic update
      setState((prev) =>
        prev
          ? {
              ...prev,
              markedNumbers: [...(prev.markedNumbers ?? []), num],
            }
          : prev
      );
      try {
        await apiFetch(`/api/tambola/sessions/${code}/mark`, {
          method: "POST",
          body: JSON.stringify({ playerId, number: num }),
        });
      } catch {
        /* next poll will reconcile */
      }
    },
    [playerId, state, code, flashToast]
  );

  const claimPrize = useCallback(
    async (prizeType: PrizeType) => {
      if (!playerId) return;
      try {
        const res = await apiFetch(`/api/tambola/sessions/${code}/claim`, {
          method: "POST",
          body: JSON.stringify({ playerId, prizeType }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          flashToast(data.error ?? "Claim failed");
          return;
        }
        flashToast(`${PRIZE_LABELS[prizeType]} claimed!`);
      } catch {
        flashToast("Network error");
      }
    },
    [playerId, code, flashToast]
  );

  return (
    <div className="flex flex-1 flex-col px-3 pt-[env(safe-area-inset-top,0px)] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex items-center justify-between py-4">
        <Link
          to="/tambola"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-mono text-base font-bold tracking-widest text-white">
          {code}
        </h1>
        <div className="h-9 w-9" />
      </header>

      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-sm text-red-400">{error}</p>
          <Link
            to="/tambola"
            className="mt-4 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white"
          >
            Back
          </Link>
        </div>
      ) : joining || !state ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          Joining…
        </div>
      ) : (
        <Body
          state={state}
          onMark={markNumber}
          onClaim={claimPrize}
          toast={toast}
        />
      )}
    </div>
  );
}

function Body({
  state,
  onMark,
  onClaim,
  toast,
}: {
  state: SessionState;
  onMark: (n: number) => void;
  onClaim: (p: PrizeType) => void;
  toast: string | null;
}) {
  const drawn = new Set(state.drawnNumbers);
  const marked = new Set(state.markedNumbers ?? []);
  const claimedPrizes = new Set(state.prizes.map((p) => p.prizeType));
  const lastDrawn = state.drawnNumbers[state.drawnNumbers.length - 1];

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-3 text-center">
        <p className="text-xs text-slate-500">{state.title}</p>
        {state.status === "WAITING" && (
          <p className="mt-1 text-sm text-amber-300">
            Waiting for host to start drawing numbers…
          </p>
        )}
        {state.status === "COMPLETED" && (
          <p className="mt-1 text-sm text-slate-300">Game complete.</p>
        )}
      </div>

      {lastDrawn !== undefined && (
        <div className="mb-3 flex items-center justify-center gap-3">
          <span className="text-xs text-slate-500">Last called:</span>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500 text-2xl font-bold text-white shadow-lg shadow-indigo-500/50">
            {lastDrawn}
          </span>
          <span className="text-xs text-slate-500">
            {state.drawnNumbers.length}/90
          </span>
        </div>
      )}

      {state.ticket ? (
        <>
          <div className="mx-auto mb-3 grid w-full max-w-sm grid-cols-9 overflow-hidden rounded-xl border-2 border-slate-500">
            {state.ticket.flat().map((n, i) => {
              if (n === 0) {
                return (
                  <div
                    key={i}
                    className="aspect-square border border-slate-700 bg-slate-800"
                  />
                );
              }
              const isDrawn = drawn.has(n);
              const isMarked = marked.has(n);
              return (
                <button
                  key={i}
                  onClick={() => !isMarked && onMark(n)}
                  className={clsx(
                    "relative flex aspect-square items-center justify-center border border-slate-700 text-sm font-bold transition-colors",
                    isMarked
                      ? "bg-green-500 text-white"
                      : isDrawn
                        ? "bg-amber-400 text-slate-900 animate-pulse"
                        : "bg-white text-slate-900"
                  )}
                >
                  {n}
                  {isMarked && (
                    <Check
                      size={10}
                      className="absolute right-0.5 top-0.5 text-white"
                    />
                  )}
                </button>
              );
            })}
          </div>
          <p className="mb-4 text-center text-[11px] text-slate-500">
            Tap a highlighted number to mark it
          </p>

          <div className="mb-4 grid grid-cols-2 gap-2">
            {PRIZE_ORDER.map((p) => {
              const claimed = claimedPrizes.has(p);
              const prize = state.prizes.find((x) => x.prizeType === p);
              return (
                <button
                  key={p}
                  disabled={claimed || state.status !== "ACTIVE"}
                  onClick={() => onClaim(p)}
                  className={clsx(
                    "rounded-lg border px-3 py-2.5 text-left text-xs transition-colors",
                    claimed
                      ? "border-slate-700 bg-slate-800/40 text-slate-500"
                      : "border-indigo-500/50 bg-indigo-500/15 text-indigo-200 active:bg-indigo-500/25"
                  )}
                >
                  <div className="flex items-center gap-1 font-semibold">
                    <Trophy size={11} />
                    {PRIZE_LABELS[p]}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-400">
                    {claimed ? `Won by ${prize?.playerName}` : "Claim"}
                  </div>
                </button>
              );
            })}
          </div>

          {state.drawnNumbers.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Drawn ({state.drawnNumbers.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {state.drawnNumbers.map((n) => (
                  <span
                    key={n}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-xs font-mono font-bold text-slate-200"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="py-8 text-center text-sm text-slate-500">
          Waiting for your ticket…
        </p>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
