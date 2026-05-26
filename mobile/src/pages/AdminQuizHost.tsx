import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Play,
  Power,
  SkipForward,
  Trophy,
  Users,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { canManageAnnouncements } from "../lib/roles";

// ── Types ──────────────────────────────────────────────────────────────────

type Status = "WAITING" | "ACTIVE" | "SHOWING_RESULTS" | "COMPLETED";

interface Question {
  id: string;
  text: string;
  options: string[];
  timeLimitSecs: number;
  correctIndex?: number;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  block: number | null;
  score: number;
  playerId: string;
}

interface SessionState {
  id: string;
  code: string;
  quizTitle: string;
  status: Status;
  currentQuestionIdx: number;
  totalQuestions: number;
  playerCount: number;
  leaderboard: LeaderboardEntry[];
  question?: Question;
  questionStartedAt?: string;
  answerCounts?: number[];
  totalAnswers?: number;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminQuizHost() {
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
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Poll every 1.5s while the page is open.
  const fetchState = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/quiz/sessions/${code}`);
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
    const handle = setInterval(fetchState, 1500);
    return () => clearInterval(handle);
  }, [fetchState]);

  async function advance(action: "next" | "show_results") {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/quiz/sessions/${code}/advance`, {
        method: "POST",
        token,
        body: JSON.stringify({ action }),
      });
      if (res.ok) await fetchState();
    } finally {
      setBusy(false);
    }
  }

  async function endSession() {
    if (
      !confirm(
        "End the quiz now? Players will see the final leaderboard."
      )
    )
      return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/quiz/sessions/${code}/end`, {
        method: "POST",
        token,
      });
      if (res.ok) await fetchState();
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    if (!state) return;
    void navigator.clipboard.writeText(state.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Countdown timer for current question (decorative).
  const secondsLeft = useCountdown(state?.questionStartedAt, state?.question?.timeLimitSecs);

  const maxAnswerCount = useMemo(
    () => Math.max(...(state?.answerCounts ?? [0]), 1),
    [state?.answerCounts]
  );

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
            to="/admin/quiz"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-semibold text-white">Quiz host</h1>
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
          to="/admin/quiz"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-lg font-semibold text-white">
            {state.quizTitle}
          </h1>
          <p className="truncate text-[11px] text-slate-500">
            {state.status.replace("_", " ")} ·{" "}
            {state.currentQuestionIdx < 0
              ? "Not started"
              : `Q${state.currentQuestionIdx + 1}/${state.totalQuestions}`}
          </p>
        </div>
      </header>

      {/* Code + share */}
      <section className="mb-3 flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">
            Join code
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

      {/* Current question display */}
      {state.question && (
        <section className="mb-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Q{state.currentQuestionIdx + 1}
            </p>
            {state.status === "ACTIVE" && (
              <p className="text-[11px] font-semibold tabular-nums text-amber-300">
                {secondsLeft}s left
              </p>
            )}
          </div>
          <p className="mb-3 text-sm font-semibold leading-relaxed text-white">
            {state.question.text}
          </p>
          <div className="space-y-1.5">
            {state.question.options.map((opt, idx) => {
              const isCorrect =
                state.status === "SHOWING_RESULTS" &&
                state.question?.correctIndex === idx;
              const count = state.answerCounts?.[idx] ?? 0;
              const pct =
                state.status === "SHOWING_RESULTS"
                  ? Math.round((count / maxAnswerCount) * 100)
                  : 0;
              return (
                <div
                  key={idx}
                  className={clsx(
                    "relative overflow-hidden rounded-xl border px-3 py-2.5",
                    isCorrect
                      ? "border-emerald-500/60 bg-emerald-500/10"
                      : "border-slate-700 bg-slate-900/40"
                  )}
                >
                  {state.status === "SHOWING_RESULTS" && (
                    <div
                      className={clsx(
                        "absolute inset-y-0 left-0 -z-10 transition-all",
                        isCorrect ? "bg-emerald-500/20" : "bg-slate-700/40"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[13px] text-white">
                      <span className="font-mono text-[10px] text-slate-500">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      {opt}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      {state.status === "SHOWING_RESULTS" && (
                        <>
                          {isCorrect && (
                            <Check
                              size={12}
                              className="text-emerald-300"
                            />
                          )}
                          <span className="font-mono text-[10px] text-slate-400">
                            {count}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {state.status === "SHOWING_RESULTS" && (
            <p className="mt-2 text-center text-[10px] text-slate-500">
              {state.totalAnswers ?? 0} of {state.playerCount} answered
            </p>
          )}
        </section>
      )}

      {/* Host controls */}
      {state.status !== "COMPLETED" && (
        <section className="mb-3 grid grid-cols-2 gap-2">
          {state.status === "WAITING" && (
            <button
              type="button"
              onClick={() => advance("next")}
              disabled={busy}
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white active:bg-indigo-600 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Play size={14} className="fill-current" />
              )}
              Start quiz
            </button>
          )}
          {state.status === "ACTIVE" && (
            <button
              type="button"
              onClick={() => advance("show_results")}
              disabled={busy}
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white active:bg-amber-600 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              Show results
            </button>
          )}
          {state.status === "SHOWING_RESULTS" && (
            <button
              type="button"
              onClick={() => advance("next")}
              disabled={busy}
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white active:bg-indigo-600 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <SkipForward size={14} />
              )}
              {state.currentQuestionIdx + 1 >= state.totalQuestions
                ? "Finish quiz"
                : "Next question"}
            </button>
          )}
        </section>
      )}

      {/* Leaderboard */}
      <section className="mb-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
        <h2 className="mb-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <Trophy size={11} /> Leaderboard
        </h2>
        {state.leaderboard.length === 0 ? (
          <p className="py-2 text-center text-[11px] text-slate-500">
            Waiting for players to answer.
          </p>
        ) : (
          <ul className="space-y-1">
            {state.leaderboard.map((p) => (
              <li
                key={p.playerId}
                className={clsx(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5",
                  p.rank === 1
                    ? "bg-amber-500/20 text-amber-100"
                    : "bg-slate-900/40 text-slate-200"
                )}
              >
                <span
                  className={clsx(
                    "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold",
                    p.rank === 1
                      ? "bg-amber-500 text-white"
                      : p.rank === 2
                        ? "bg-slate-500 text-white"
                        : p.rank === 3
                          ? "bg-amber-700 text-white"
                          : "bg-slate-800 text-slate-300"
                  )}
                >
                  {p.rank}
                </span>
                <span className="flex-1 truncate text-sm">{p.name}</span>
                {p.block != null && (
                  <span className="shrink-0 font-mono text-[10px] text-slate-500">
                    B{p.block}
                  </span>
                )}
                <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
                  {p.score}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-center text-[10px] text-slate-500">
          <Users size={9} className="-mt-0.5 mr-0.5 inline" />
          {state.playerCount} player{state.playerCount !== 1 ? "s" : ""}
        </p>
      </section>

      {state.status !== "COMPLETED" ? (
        <button
          type="button"
          onClick={endSession}
          disabled={busy}
          className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-red-700/60 bg-red-900/30 py-2.5 text-xs font-semibold text-red-200 active:bg-red-900/50 disabled:opacity-50"
        >
          <Power size={12} />
          End session early
        </button>
      ) : (
        <p className="mb-4 rounded-xl border border-emerald-700/40 bg-emerald-900/20 px-4 py-3 text-center text-xs text-emerald-200">
          Quiz complete!
        </p>
      )}

      <p className="pb-2 text-center text-[10px] text-slate-500">
        polling every 1.5s
      </p>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function useCountdown(startedAt?: string, totalSecs?: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);
  if (!startedAt || !totalSecs) return 0;
  const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
  void tick;
  return Math.max(0, Math.ceil(totalSecs - elapsed));
}
