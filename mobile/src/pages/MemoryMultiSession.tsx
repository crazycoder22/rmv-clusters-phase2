import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Crown, Play, Star, Trophy, Users } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type Status = "WAITING" | "ACTIVE" | "COMPLETED";

type VisibleCard = {
  idx: number;
  emoji: string | null;
  matched: boolean;
  flipped: boolean;
};

type Player = {
  playerId: string;
  name: string;
  block: number;
  flatNumber: string;
  joinOrder: number;
  matches: number;
};

type SessionState = {
  code: string;
  status: Status;
  grid: { cols: number; rows: number; pairs: number };
  cards: VisibleCard[];
  flipA: number | null;
  flipB: number | null;
  matchedPairs: number;
  totalPairs: number;
  currentTurn: number;
  hostId: string;
  players: Player[];
  startedAt: string | null;
  endedAt: string | null;
};

const POLL_INTERVAL_MS = 1200;
const REVEAL_DURATION_MS = 1100;

export default function MemoryMultiSession() {
  const { code = "" } = useParams<{ code: string }>();
  const { user } = useAuth();
  const playerId = user?.playerId ?? null;

  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(true);
  const [starting, setStarting] = useState(false);

  const joinedRef = useRef(false);
  const resolveScheduledRef = useRef<string | null>(null); // revealKey we queued to resolve

  // Join on mount, then poll.
  useEffect(() => {
    if (!playerId || !code) return;
    let cancelled = false;

    (async () => {
      if (!joinedRef.current) {
        try {
          const res = await apiFetch(
            `/api/memory/multi/sessions/${code}/join`,
            {
              method: "POST",
              body: JSON.stringify({ playerId }),
            }
          );
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
            `/api/memory/multi/sessions/${code}`
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

  // Auto-resolve: once the current player has two cards revealed, wait for the
  // reveal animation and then POST /resolve. Only the current player fires
  // this so we don't double-resolve from every client.
  useEffect(() => {
    if (!state || !playerId) return;
    if (state.status !== "ACTIVE") return;
    if (state.flipA === null || state.flipB === null) {
      resolveScheduledRef.current = null;
      return;
    }
    const current = state.players[state.currentTurn];
    if (!current || current.playerId !== playerId) return;

    const revealKey = `${state.flipA}-${state.flipB}`;
    if (resolveScheduledRef.current === revealKey) return;
    resolveScheduledRef.current = revealKey;

    const t = setTimeout(() => {
      apiFetch(`/api/memory/multi/sessions/${code}/resolve`, {
        method: "POST",
        body: JSON.stringify({ playerId }),
      }).catch(() => {
        resolveScheduledRef.current = null;
      });
    }, REVEAL_DURATION_MS);
    return () => clearTimeout(t);
  }, [state, playerId, code]);

  const flipCard = useCallback(
    (idx: number) => {
      if (!state || !playerId) return;
      if (state.status !== "ACTIVE") return;
      const current = state.players[state.currentTurn];
      if (!current || current.playerId !== playerId) return;
      if (state.flipA !== null && state.flipB !== null) return;
      if (state.flipA === idx || state.flipB === idx) return;
      const card = state.cards[idx];
      if (!card || card.matched) return;

      // Optimistic reveal: immediately populate flipA/flipB locally so the card
      // animates fast. Poll will overwrite if server disagrees.
      setState((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          flipA: prev.flipA === null ? idx : prev.flipA,
          flipB:
            prev.flipA !== null && prev.flipB === null ? idx : prev.flipB,
        };
        return next;
      });

      apiFetch(`/api/memory/multi/sessions/${code}/flip`, {
        method: "POST",
        body: JSON.stringify({ playerId, cardIdx: idx }),
      }).catch(() => {
        /* poll will reconcile */
      });
    },
    [state, playerId, code]
  );

  const startGame = useCallback(async () => {
    if (!playerId || starting) return;
    setStarting(true);
    try {
      await apiFetch(`/api/memory/multi/sessions/${code}/start`, {
        method: "POST",
        body: JSON.stringify({ playerId }),
      });
    } finally {
      setStarting(false);
    }
  }, [playerId, code, starting]);

  return (
    <div className="flex flex-1 flex-col px-3 pt-[env(safe-area-inset-top,0px)] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex items-center justify-between py-4">
        <Link
          to="/memory/multi"
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
            to="/memory/multi"
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
          playerId={playerId}
          onFlip={flipCard}
          onStart={startGame}
          starting={starting}
        />
      )}
    </div>
  );
}

function Body({
  state,
  playerId,
  onFlip,
  onStart,
  starting,
}: {
  state: SessionState;
  playerId: string | null;
  onFlip: (idx: number) => void;
  onStart: () => void;
  starting: boolean;
}) {
  const isHost = state.hostId === playerId;
  const current = state.players[state.currentTurn];
  const myTurn = state.status === "ACTIVE" && current?.playerId === playerId;

  return (
    <>
      <div className="mb-3 text-center text-xs text-slate-500">
        {state.matchedPairs}/{state.totalPairs} pairs found
      </div>

      <PlayersStrip
        players={state.players}
        currentTurn={state.currentTurn}
        playerId={playerId}
        status={state.status}
      />

      {state.status === "WAITING" && (
        <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-center">
          <p className="text-sm font-semibold text-amber-200">
            Waiting for players
          </p>
          <p className="mt-1 text-xs text-amber-200/70">
            {state.players.length < 2
              ? "Need at least 2 players to start."
              : "Ready to go when the host starts."}
          </p>
          {isHost ? (
            <button
              onClick={onStart}
              disabled={state.players.length < 2 || starting}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-2 text-sm font-semibold text-white active:bg-indigo-600 disabled:opacity-40"
            >
              <Play size={14} />
              {starting ? "Starting…" : "Start game"}
            </button>
          ) : (
            <p className="mt-3 text-[11px] text-slate-400">
              Host will start when everyone is ready
            </p>
          )}
        </div>
      )}

      {(state.status === "ACTIVE" || state.status === "COMPLETED") && (
        <div className="mt-3">
          <Grid
            cards={state.cards}
            flipA={state.flipA}
            flipB={state.flipB}
            cols={state.grid.cols}
            onFlip={onFlip}
            canFlip={myTurn && state.flipA === null && state.flipB === null}
            completed={state.status === "COMPLETED"}
          />
        </div>
      )}

      {state.status === "ACTIVE" && (
        <p className="mt-4 text-center text-xs text-slate-400">
          {myTurn
            ? state.flipA === null
              ? "Your turn — pick a card"
              : state.flipB === null
                ? "Pick a second card"
                : "Revealing…"
            : `${current?.name ?? "Someone"}'s turn`}
        </p>
      )}

      {state.status === "COMPLETED" && (
        <CompletedCard players={state.players} playerId={playerId} />
      )}
    </>
  );
}

function PlayersStrip({
  players,
  currentTurn,
  playerId,
  status,
}: {
  players: Player[];
  currentTurn: number;
  playerId: string | null;
  status: Status;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto">
      {players.map((p, i) => {
        const isMe = p.playerId === playerId;
        const isTurn = status === "ACTIVE" && i === currentTurn;
        return (
          <div
            key={p.playerId}
            className={clsx(
              "flex min-w-[100px] flex-1 flex-col items-center rounded-xl border px-2 py-2 text-center",
              isTurn
                ? "border-indigo-400 bg-indigo-500/15"
                : "border-slate-700 bg-slate-800/60"
            )}
          >
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-200">
              {i === 0 && <Crown size={10} className="text-amber-400" />}
              <span className="truncate">{p.name}</span>
            </div>
            <div className="mt-0.5 text-[10px] text-slate-500">
              Block {p.block}
              {isMe && " · You"}
            </div>
            <div className="mt-1 flex items-center gap-1">
              <Star size={11} className="text-yellow-400" />
              <span className="font-mono text-xs font-bold text-white">
                {p.matches}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Grid({
  cards,
  flipA,
  flipB,
  cols,
  onFlip,
  canFlip,
  completed,
}: {
  cards: VisibleCard[];
  flipA: number | null;
  flipB: number | null;
  cols: number;
  onFlip: (idx: number) => void;
  canFlip: boolean;
  completed: boolean;
}) {
  return (
    <div
      className="mx-auto grid w-full max-w-sm gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {cards.map((card) => {
        const revealed =
          card.matched || card.flipped || card.idx === flipA || card.idx === flipB;
        const disabled = !canFlip || card.matched || revealed;
        return (
          <button
            key={card.idx}
            type="button"
            disabled={disabled}
            onClick={() => onFlip(card.idx)}
            className="aspect-square w-full [perspective:500px]"
          >
            <div
              className="relative h-full w-full transition-transform duration-300 [transform-style:preserve-3d]"
              style={{
                transform: revealed ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center rounded-xl border-2 border-indigo-400/60 bg-gradient-to-br from-indigo-500 to-indigo-700 [backface-visibility:hidden]">
                <Star className="text-white/50" size={20} />
              </div>
              <div
                className={clsx(
                  "absolute inset-0 flex items-center justify-center rounded-xl border-2 [backface-visibility:hidden]",
                  card.matched
                    ? "scale-[1.03] border-green-400 bg-green-500/20 shadow-md shadow-green-500/20"
                    : completed
                      ? "border-slate-600 bg-slate-100"
                      : "border-slate-600 bg-slate-100"
                )}
                style={{ transform: "rotateY(180deg)" }}
              >
                <span className="select-none text-2xl">
                  {card.emoji ?? ""}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CompletedCard({
  players,
  playerId,
}: {
  players: Player[];
  playerId: string | null;
}) {
  const sorted = [...players].sort((a, b) => b.matches - a.matches);
  const top = sorted[0];
  const myMatches = players.find((p) => p.playerId === playerId)?.matches ?? 0;
  const won = top && top.playerId === playerId;
  return (
    <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-800/80 p-5 text-center">
      <div className="text-4xl">{won ? "🏆" : "🎉"}</div>
      <h2 className="mt-2 text-lg font-bold text-white">
        {won ? "You won!" : `${top?.name ?? "Someone"} wins`}
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        You found <span className="font-mono font-bold">{myMatches}</span> pair
        {myMatches === 1 ? "" : "s"}.
      </p>
      <div className="mt-4 rounded-lg bg-slate-900/60 p-3 text-left">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <Trophy size={11} /> Final standings
        </p>
        {sorted.map((p, i) => (
          <div
            key={p.playerId}
            className="flex items-center justify-between py-1 text-sm"
          >
            <span className="flex items-center gap-2">
              <span className="w-5 text-center font-bold">
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
              </span>
              <span className="text-slate-200">{p.name}</span>
              {p.playerId === playerId && (
                <span className="text-xs text-indigo-400">(You)</span>
              )}
            </span>
            <span className="font-mono font-bold text-white">{p.matches}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

void Users;
