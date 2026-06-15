import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Icon from "../components/Icon";
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

// Fixed per-position answer colours (A red, B blue, C amber, D green).
const ANSWER_COLORS = ["#ee4d4d", "#2f6fed", "#f59e0b", "#21b257"];

export default function QuizSession() {
  const { code = "" } = useParams<{ code: string }>();
  const { user } = useAuth();
  const playerId = user?.playerId ?? null;

  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const joinedRef = useRef(false);

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
      } catch {
        /* swallow */
      } finally {
        setSubmitting(false);
      }
    },
    [state?.question, submitting, playerId, code]
  );

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="flex items-center justify-between py-4">
        <Link to="/quiz" className="flex h-9 w-9 items-center justify-center rounded-full" style={{ color: "var(--text-2)" }}>
          <Icon name="arrow_back" size={22} />
        </Link>
        <h1 className="one-mono text-[20px] font-bold tracking-[0.16em]" style={{ color: "var(--text)" }}>{code}</h1>
        <div className="h-9 w-9" />
      </header>

      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-[14px]" style={{ color: "var(--danger)" }}>{error}</p>
          <Link to="/quiz" className="mt-4 rounded-[10px] px-4 py-2 text-[14px] font-semibold text-white" style={{ background: "var(--accent-strong)" }}>
            Back to quizzes
          </Link>
        </div>
      ) : joining || !state ? (
        <div className="flex flex-1 items-center justify-center text-[14px]" style={{ color: "var(--text-3)" }}>
          Joining…
        </div>
      ) : (
        <Body state={state} onAnswer={submitAnswer} submitting={submitting} />
      )}
    </div>
  );
}

function Body({ state, onAnswer, submitting }: { state: SessionState; onAnswer: (idx: number) => void; submitting: boolean }) {
  if (state.status === "WAITING") return <Waiting state={state} />;
  if (state.status === "COMPLETED") return <Completed state={state} />;
  if (!state.question) {
    return <div className="flex flex-1 items-center justify-center text-[14px]" style={{ color: "var(--text-3)" }}>Loading question…</div>;
  }
  if (state.status === "ACTIVE") {
    return <ActiveQuestion state={state} onAnswer={onAnswer} submitting={submitting} />;
  }
  return <QuestionResults state={state} />;
}

function Waiting({ state }: { state: SessionState }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <div className="text-5xl">⏳</div>
      <h2 className="mt-4 text-[21px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>{state.quizTitle}</h2>
      <p className="mt-2 text-[14px]" style={{ color: "var(--text-3)" }}>Waiting for the host to start the quiz…</p>
      <div className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px]" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-2)" }}>
        <Icon name="group" size={15} />
        {state.playerCount} player{state.playerCount === 1 ? "" : "s"} joined
      </div>
      {state.leaderboard.length > 0 && (
        <div className="mt-6 w-full max-w-sm">
          <p className="one-mono mb-2 text-[11px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}>IN THE LOBBY</p>
          <div className="rounded-[16px] p-3 text-left" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {state.leaderboard.slice(0, 8).map((p) => (
              <div key={p.playerId} className="flex items-center justify-between py-1 text-[14px]" style={{ color: "var(--text-2)" }}>
                <span>{p.name}</span>
                <span className="text-[12px]" style={{ color: "var(--text-3)" }}>Block {p.block}</span>
              </div>
            ))}
            {state.playerCount > 8 && (
              <p className="pt-1 text-center text-[12px]" style={{ color: "var(--text-3)" }}>+ {state.playerCount - 8} more</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveQuestion({ state, onAnswer, submitting }: { state: SessionState; onAnswer: (idx: number) => void; submitting: boolean }) {
  const q = state.question!;
  const hasAnswered = !!state.hasAnswered;
  const timeLeft = useQuestionTimer(state.questionStartedAt, q.timeLimitSecs);
  const dimmed = hasAnswered || timeLeft <= 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-3.5 flex items-center justify-between">
        <span className="text-[14px]" style={{ color: "var(--text-2)" }}>
          Question {state.currentQuestionIdx + 1} of {state.totalQuestions}
        </span>
        <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <Icon name="schedule" size={16} style={{ color: "var(--text-2)" }} />
          <span className="one-mono text-[14px] font-semibold" style={{ color: "var(--text)" }}>{timeLeft}s</span>
        </span>
      </div>

      <div className="flex min-h-[96px] items-center rounded-[16px] p-[22px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <span className="text-[20px] font-semibold leading-snug" style={{ color: "var(--text)" }}>{q.text}</span>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {q.options.map((opt, i) => (
          <button
            key={i}
            disabled={dimmed || submitting}
            onClick={() => onAnswer(i)}
            className="flex w-full items-center gap-3.5 rounded-[14px] p-4 text-left"
            style={{ background: ANSWER_COLORS[i % 4], opacity: dimmed ? 0.42 : 1 }}
          >
            <span className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full text-[16px] font-extrabold text-white" style={{ background: "rgba(255,255,255,0.28)" }}>
              {String.fromCharCode(65 + i)}
            </span>
            <span className="flex-1 text-[18px] font-bold text-white">{opt}</span>
          </button>
        ))}
      </div>

      {hasAnswered && (
        <p className="mt-5 text-center text-[15px]" style={{ color: "var(--text-2)" }}>Answer locked in. Waiting for others…</p>
      )}
      {timeLeft <= 0 && !hasAnswered && (
        <p className="mt-5 text-center text-[16px] font-bold" style={{ color: "var(--warning)" }}>Time's up!</p>
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
      <div className="mb-3.5">
        <span className="text-[14px]" style={{ color: "var(--text-2)" }}>
          Question {state.currentQuestionIdx + 1} of {state.totalQuestions}
        </span>
      </div>

      <div className="flex min-h-[90px] items-center rounded-[16px] p-[22px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <span className="text-[20px] font-semibold leading-snug" style={{ color: "var(--text)" }}>{q.text}</span>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {q.options.map((opt, i) => {
          const isCorrect = i === correct;
          const isMine = my?.answerIndex === i;
          const isWrong = isMine && !isCorrect;
          const pct = total === 0 ? 0 : Math.round((counts[i] / total) * 100);
          const rowStyle = isCorrect
            ? { background: "rgba(33,178,87,0.12)", border: "1.5px solid #21b257" }
            : isWrong
              ? { background: "rgba(238,77,77,0.12)", border: "1.5px solid #ee4d4d" }
              : { background: "var(--surface)", border: "1px solid var(--border)" };
          const fill = isCorrect ? "rgba(33,178,87,0.24)" : isWrong ? "rgba(238,77,77,0.24)" : "transparent";
          return (
            <div key={i} className="relative flex items-center gap-3 overflow-hidden rounded-[14px] p-[15px]" style={rowStyle}>
              <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, background: fill }} />
              <span className="relative z-[1] flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[14px] font-bold" style={{ background: "rgba(255,255,255,0.10)", color: "var(--text-2)" }}>
                {String.fromCharCode(65 + i)}
              </span>
              <span className="relative z-[1] flex-1 text-[16px] font-bold" style={{ color: "var(--text)" }}>{opt}</span>
              {isCorrect && <Icon name="check" size={20} style={{ color: "var(--success)", position: "relative", zIndex: 1 }} />}
              {isWrong && <Icon name="close" size={20} style={{ color: "var(--danger)", position: "relative", zIndex: 1 }} />}
              <span className="relative z-[1] min-w-[38px] text-right text-[14px] font-bold" style={{ color: isCorrect ? "var(--text)" : "var(--text-3)" }}>{pct}%</span>
            </div>
          );
        })}
      </div>

      {my ? (
        <div
          className="mt-4 rounded-[16px] p-[18px] text-center"
          style={my.isCorrect
            ? { background: "rgba(33,178,87,0.10)", border: "1px solid rgba(33,178,87,0.35)" }
            : { background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.35)" }}
        >
          <p className="text-[19px] font-extrabold" style={{ color: my.isCorrect ? "var(--success)" : "var(--danger)" }}>
            {my.isCorrect ? "Correct!" : "Incorrect"}
          </p>
          <p className="mt-1 text-[15px]" style={{ color: my.isCorrect ? "var(--success)" : "var(--danger)", opacity: 0.9 }}>
            {my.isCorrect ? `+${my.points} points` : "Better luck on the next one"}
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded-[16px] p-3 text-center text-[13px]" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-3)" }}>
          You didn't answer in time.
        </p>
      )}

      {state.playerScore !== undefined && (
        <p className="mt-4 text-center text-[14px]" style={{ color: "var(--text-3)" }}>
          Your total: <span className="font-extrabold" style={{ color: "var(--text)" }}>{state.playerScore}</span>
          {state.playerRank ? ` · Rank ${state.playerRank}` : ""}
        </p>
      )}
    </div>
  );
}

function Completed({ state }: { state: SessionState }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-2 pt-2 text-center">
        <div className="text-[60px] leading-none">🏆</div>
        <h2 className="mt-2.5 text-[26px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Quiz Complete!</h2>
        {state.playerScore !== undefined && (
          <p className="mt-2 text-[14px]" style={{ color: "var(--text-3)" }}>
            Your score: <span className="font-extrabold" style={{ color: "var(--text)" }}>{state.playerScore}</span>
            {state.playerRank ? ` · Rank ${state.playerRank}` : ""}
          </p>
        )}
      </div>

      <div className="mb-3 mt-6 flex items-center gap-2" style={{ color: "var(--text-3)" }}>
        <Icon name="emoji_events" size={18} style={{ color: "var(--text-3)" }} />
        <span className="one-mono text-[11px] font-semibold" style={{ letterSpacing: "0.14em" }}>TOP {state.leaderboard.length}</span>
      </div>
      <div className="overflow-hidden rounded-[18px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {state.leaderboard.map((p, i, arr) => {
          const medal = p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : null;
          return (
            <div key={p.playerId} className="flex items-center gap-3.5 p-[15px]" style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
              {medal ? (
                <span className="flex-shrink-0 text-[30px] leading-none">{medal}</span>
              ) : (
                <span className="one-mono flex w-[30px] flex-shrink-0 justify-center text-[16px] font-bold" style={{ color: "var(--text-2)" }}>{p.rank}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-bold tracking-tight" style={{ color: "var(--text)" }}>{p.name}</p>
                <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-3)" }}>Block {p.block}</p>
              </div>
              <span className="flex-shrink-0 text-[18px] font-extrabold" style={{ color: "var(--success)" }}>{p.score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function useQuestionTimer(startedAt: string | undefined, timeLimitSecs: number): number {
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
