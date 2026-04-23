import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Clock, Trophy, Users, X } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type Status = "WAITING" | "ACTIVE" | "SHOWING_RESULTS" | "COMPLETED";

type LeaderboardEntry = {
  rank: number;
  name: string;
  block: number;
  score: number;
  playerId: string;
};

type SessionState = {
  id: string;
  code: string;
  quizTitle: string;
  status: Status;
  currentQuestionIdx: number;
  totalQuestions: number;
  playerCount: number;
  leaderboard: LeaderboardEntry[];
  question?: {
    id: string;
    text: string;
    options: string[];
    timeLimitSecs: number;
    correctIndex?: number;
  };
  questionStartedAt?: string;
  answerCounts?: number[];
  totalAnswers?: number;
  playerScore?: number;
  playerRank?: number;
  hasAnswered?: boolean;
  hasJoined?: boolean;
  playerAnswer?: {
    answerIndex: number;
    isCorrect: boolean;
    points: number;
  };
};

const POLL_INTERVAL_MS = 1500;

const OPTION_THEMES = [
  "bg-red-500 active:bg-red-600",
  "bg-blue-500 active:bg-blue-600",
  "bg-amber-500 active:bg-amber-600",
  "bg-green-500 active:bg-green-600",
];

export default function QuizSession() {
  const { code = "" } = useParams<{ code: string }>();
  const { user } = useAuth();
  const playerId = user?.playerId ?? null;

  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const joinedRef = useRef(false);

  // Join on mount, then start polling.
  useEffect(() => {
    if (!playerId || !code) return;
    let cancelled = false;

    (async () => {
      if (!joinedRef.current) {
        try {
          const res = await apiFetch(`/api/quiz/sessions/${code}/join`, {
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
            `/api/quiz/sessions/${code}?playerId=${playerId}`
          );
          if (!res.ok) return;
          const data = (await res.json()) as SessionState;
          if (!cancelled) setState(data);
        } catch {
          /* transient network error — keep polling */
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

  const submitAnswer = useCallback(
    async (answerIndex: number) => {
      if (!state?.question || submitting || !playerId) return;
      setSubmitting(true);
      try {
        await apiFetch(`/api/quiz/sessions/${code}/answer`, {
          method: "POST",
          body: JSON.stringify({
            playerId,
            questionId: state.question.id,
            answerIndex,
          }),
        });
        // State will update on the next poll.
      } catch {
        /* swallow */
      } finally {
        setSubmitting(false);
      }
    },
    [state?.question, submitting, playerId, code]
  );

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex items-center justify-between py-4">
        <Link
          to="/quiz"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-mono text-lg font-bold tracking-widest text-white">
          {code}
        </h1>
        <div className="h-9 w-9" />
      </header>

      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-sm text-red-400">{error}</p>
          <Link
            to="/quiz"
            className="mt-4 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white active:bg-indigo-600"
          >
            Back to quizzes
          </Link>
        </div>
      ) : joining || !state ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          Joining…
        </div>
      ) : (
        <Body state={state} onAnswer={submitAnswer} submitting={submitting} />
      )}
    </div>
  );
}

function Body({
  state,
  onAnswer,
  submitting,
}: {
  state: SessionState;
  onAnswer: (idx: number) => void;
  submitting: boolean;
}) {
  if (state.status === "WAITING") return <Waiting state={state} />;
  if (state.status === "COMPLETED") return <Completed state={state} />;

  // ACTIVE or SHOWING_RESULTS — both show question-related UI
  if (!state.question) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
        Loading question…
      </div>
    );
  }

  if (state.status === "ACTIVE") {
    return (
      <ActiveQuestion state={state} onAnswer={onAnswer} submitting={submitting} />
    );
  }
  return <QuestionResults state={state} />;
}

function Waiting({ state }: { state: SessionState }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <div className="text-5xl">⏳</div>
      <h2 className="mt-4 text-xl font-bold text-white">
        {state.quizTitle}
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        Waiting for the host to start the quiz…
      </p>
      <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-800 px-4 py-1.5 text-sm text-slate-300">
        <Users size={14} />
        {state.playerCount} player{state.playerCount === 1 ? "" : "s"} joined
      </div>
      {state.leaderboard.length > 0 && (
        <div className="mt-6 w-full max-w-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            In the lobby
          </p>
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-left">
            {state.leaderboard.slice(0, 8).map((p) => (
              <div
                key={p.playerId}
                className="flex items-center justify-between py-1 text-sm text-slate-300"
              >
                <span>{p.name}</span>
                <span className="text-xs text-slate-500">Block {p.block}</span>
              </div>
            ))}
            {state.playerCount > 8 && (
              <p className="pt-1 text-center text-xs text-slate-500">
                + {state.playerCount - 8} more
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveQuestion({
  state,
  onAnswer,
  submitting,
}: {
  state: SessionState;
  onAnswer: (idx: number) => void;
  submitting: boolean;
}) {
  const q = state.question!;
  const hasAnswered = !!state.hasAnswered;
  const timeLeft = useQuestionTimer(
    state.questionStartedAt,
    q.timeLimitSecs
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400">
          Question {state.currentQuestionIdx + 1} of {state.totalQuestions}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1 text-xs font-mono text-indigo-300">
          <Clock size={12} /> {timeLeft}s
        </span>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
        <p className="text-base leading-relaxed text-white">{q.text}</p>
      </div>

      <div className="grid gap-3">
        {q.options.map((opt, i) => (
          <button
            key={i}
            disabled={hasAnswered || submitting || timeLeft <= 0}
            onClick={() => onAnswer(i)}
            className={clsx(
              "flex items-center gap-3 rounded-xl px-4 py-4 text-left text-base font-medium text-white transition-all",
              OPTION_THEMES[i % OPTION_THEMES.length],
              (hasAnswered || timeLeft <= 0) && "opacity-50"
            )}
          >
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/25 text-sm font-bold">
              {String.fromCharCode(65 + i)}
            </span>
            <span className="flex-1">{opt}</span>
          </button>
        ))}
      </div>

      {hasAnswered && (
        <p className="mt-5 text-center text-sm text-slate-400">
          Answer locked in. Waiting for others…
        </p>
      )}
      {timeLeft <= 0 && !hasAnswered && (
        <p className="mt-5 text-center text-sm text-amber-400">
          Time's up!
        </p>
      )}
    </div>
  );
}

function QuestionResults({ state }: { state: SessionState }) {
  const q = state.question!;
  const my = state.playerAnswer;
  const correct = q.correctIndex ?? -1;
  const counts = state.answerCounts ?? [0, 0, 0, 0];
  const total = state.totalAnswers ?? 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4">
        <p className="text-xs font-semibold text-slate-400">
          Question {state.currentQuestionIdx + 1} of {state.totalQuestions}
        </p>
      </div>

      <div className="mb-5 rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
        <p className="text-base leading-relaxed text-white">{q.text}</p>
      </div>

      <div className="mb-5 grid gap-2.5">
        {q.options.map((opt, i) => {
          const isCorrect = i === correct;
          const isMine = my?.answerIndex === i;
          const pct = total === 0 ? 0 : Math.round((counts[i] / total) * 100);
          return (
            <div
              key={i}
              className={clsx(
                "relative overflow-hidden rounded-xl border px-4 py-3 text-sm font-medium",
                isCorrect
                  ? "border-green-500 bg-green-500/20 text-white"
                  : isMine
                    ? "border-red-500 bg-red-500/20 text-white"
                    : "border-slate-700 bg-slate-800/40 text-slate-300"
              )}
            >
              <div
                className={clsx(
                  "absolute inset-y-0 left-0 transition-all",
                  isCorrect ? "bg-green-500/20" : "bg-slate-700/30"
                )}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{opt}</span>
                {isCorrect && <Check size={16} className="text-green-400" />}
                {!isCorrect && isMine && <X size={16} className="text-red-400" />}
                <span className="w-10 text-right text-xs text-slate-400">
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {my ? (
        <div
          className={clsx(
            "rounded-xl p-4 text-center",
            my.isCorrect
              ? "bg-green-500/20 text-green-300"
              : "bg-red-500/20 text-red-300"
          )}
        >
          <p className="text-sm font-semibold">
            {my.isCorrect ? "Correct!" : "Incorrect"}
          </p>
          <p className="mt-1 text-xs">
            {my.isCorrect
              ? `+${my.points} points`
              : "Better luck on the next one"}
          </p>
        </div>
      ) : (
        <p className="rounded-xl bg-slate-800/60 p-3 text-center text-xs text-slate-400">
          You didn't answer in time.
        </p>
      )}

      {state.playerScore !== undefined && (
        <p className="mt-4 text-center text-xs text-slate-500">
          Your total: <span className="font-mono font-bold text-slate-300">{state.playerScore}</span>
          {state.playerRank ? ` · Rank ${state.playerRank}` : ""}
        </p>
      )}
    </div>
  );
}

function Completed({ state }: { state: SessionState }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-6 text-center">
        <div className="text-5xl">🏆</div>
        <h2 className="mt-3 text-xl font-bold text-white">Quiz Complete!</h2>
        {state.playerScore !== undefined && (
          <p className="mt-2 text-sm text-slate-400">
            Your score:{" "}
            <span className="font-mono font-bold text-white">
              {state.playerScore}
            </span>
            {state.playerRank ? ` · Rank ${state.playerRank}` : ""}
          </p>
        )}
      </div>

      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
        <Trophy size={14} /> Top {state.leaderboard.length}
      </h3>
      <div className="rounded-xl border border-slate-700 bg-slate-800/60">
        {state.leaderboard.map((p) => {
          const badge =
            p.rank === 1
              ? "🥇"
              : p.rank === 2
                ? "🥈"
                : p.rank === 3
                  ? "🥉"
                  : String(p.rank);
          return (
            <div
              key={p.playerId}
              className="flex items-center justify-between border-b border-slate-700 px-4 py-3 last:border-0"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-center font-bold">{badge}</span>
                <div>
                  <p className="text-sm text-slate-100">{p.name}</p>
                  <p className="text-[11px] text-slate-500">Block {p.block}</p>
                </div>
              </div>
              <span className="font-mono text-sm font-bold text-green-400">
                {p.score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function useQuestionTimer(
  startedAt: string | undefined,
  timeLimitSecs: number
): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 200);
    return () => clearInterval(t);
  }, []);
  if (!startedAt) return timeLimitSecs;
  const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
  const remaining = Math.max(0, Math.ceil(timeLimitSecs - elapsed));
  void tick;
  return remaining;
}
