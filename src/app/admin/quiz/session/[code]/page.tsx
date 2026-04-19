"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/useRole";
import clsx from "clsx";
import {
  ArrowLeft,
  Gamepad2,
  Copy,
  Check,
  Share2,
  Users,
  Trophy,
  Clock,
  Play,
  BarChart3,
  ChevronRight,
  Crown,
  Timer,
} from "lucide-react";

interface Player {
  id: string;
  name: string;
  score: number;
}

interface AnswerDistribution {
  option: string;
  count: number;
  isCorrect: boolean;
}

interface QuestionData {
  text: string;
  options: string[];
  correctOption: number;
  timeLimit: number;
}

interface SessionState {
  id: string;
  code: string;
  status: "WAITING" | "ACTIVE" | "SHOWING_RESULTS" | "COMPLETED";
  quizTitle: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentQuestion: QuestionData | null;
  answerCount: number;
  playerCount: number;
  players: Player[];
  leaderboard: Player[];
  answerDistribution: AnswerDistribution[] | null;
  timeRemaining: number | null;
}

const OPTION_COLORS = [
  { bg: "bg-red-500", light: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300" },
  { bg: "bg-blue-500", light: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300" },
  { bg: "bg-green-500", light: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300" },
  { bg: "bg-yellow-500", light: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300" },
];

const MEDAL_COLORS = ["text-yellow-500", "text-gray-400", "text-amber-600"];

// ── API → page shape normalizer ─────────────────────────────────────────
// /api/quiz/sessions/[code] returns a different shape than this page expects.
// Map field names + compute derived fields here so render logic stays simple.

interface ApiAdminResponse {
  id?: string;
  code?: string;
  status?: SessionState["status"];
  quizTitle?: string;
  currentQuestionIdx?: number;
  totalQuestions?: number;
  question?: { id: string; text: string; options: string[]; timeLimitSecs: number; correctIndex?: number };
  questionStartedAt?: string;
  totalAnswers?: number;
  answerCounts?: number[];
  playerCount?: number;
  leaderboard?: Array<{ playerId: string; name: string; score?: number }>;
}

function normalizeAdminSession(api: ApiAdminResponse): SessionState {
  const players: Player[] = (api.leaderboard ?? []).map((p) => ({
    id: p.playerId,
    name: p.name,
    score: p.score ?? 0,
  }));

  const q = api.question ?? null;
  const currentQuestion = q
    ? {
        text: q.text,
        options: q.options,
        correctOption: q.correctIndex ?? -1,
        timeLimit: q.timeLimitSecs,
      }
    : null;

  // Build answer distribution if we have answer counts + question options
  let answerDistribution: AnswerDistribution[] | null = null;
  if (api.answerCounts && q) {
    answerDistribution = q.options.map((opt, i) => ({
      option: opt,
      count: api.answerCounts?.[i] ?? 0,
      isCorrect: i === (q.correctIndex ?? -1),
    }));
  }

  // Compute time remaining from question start + limit
  let timeRemaining: number | null = null;
  if (api.questionStartedAt && q && api.status === "ACTIVE") {
    const elapsed = (Date.now() - new Date(api.questionStartedAt).getTime()) / 1000;
    timeRemaining = Math.max(0, Math.ceil(q.timeLimitSecs - elapsed));
  }

  return {
    id: api.id ?? "",
    code: api.code ?? "",
    status: api.status ?? "WAITING",
    quizTitle: api.quizTitle ?? "Quiz",
    currentQuestionIndex: api.currentQuestionIdx ?? 0,
    totalQuestions: api.totalQuestions ?? 0,
    currentQuestion,
    answerCount: api.totalAnswers ?? 0,
    playerCount: api.playerCount ?? players.length,
    players,
    leaderboard: players,
    answerDistribution,
    timeRemaining,
  };
}

export default function AdminQuizSessionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const { canManageAnnouncements, isLoading: roleLoading } = useRole();
  const router = useRouter();

  const [session, setSession] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [localTimer, setLocalTimer] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auth guard
  useEffect(() => {
    if (!roleLoading && !canManageAnnouncements()) router.replace("/");
  }, [roleLoading, canManageAnnouncements, router]);

  // Fetch session state
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/quiz/sessions/${code}`);
      if (!res.ok) return;
      const raw = await res.json();
      const data = normalizeAdminSession(raw);
      setSession(data);
      if (data.timeRemaining !== null && data.status === "ACTIVE") {
        setLocalTimer(data.timeRemaining);
      }
    } catch {
      // silently ignore polling errors
    }
  }, [code]);

  // Initial load
  useEffect(() => {
    fetchSession().then(() => setLoading(false));
  }, [fetchSession]);

  // Poll every 2 seconds
  useEffect(() => {
    pollRef.current = setInterval(fetchSession, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchSession]);

  // Local countdown timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (localTimer !== null && localTimer > 0 && session?.status === "ACTIVE") {
      timerRef.current = setInterval(() => {
        setLocalTimer((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [localTimer !== null && session?.status === "ACTIVE"]);

  async function handleAdvance(action: "next" | "show_results") {
    setError("");
    setAdvancing(true);
    try {
      const res = await fetch(`/api/quiz/sessions/${code}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to advance.");
        return;
      }
      await fetchSession();
    } finally {
      setAdvancing(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp() {
    const msg = `Join the quiz! Go to https://www.rmvclustersphase2.in/quiz and enter code: ${code}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  }

  if (roleLoading || loading) {
    return (
      <div className="py-12 text-center text-gray-400 dark:text-gray-500">
        Loading...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="py-12 text-center text-gray-400 dark:text-gray-500">
        Session not found.
      </div>
    );
  }

  const maxDistribution = Math.max(
    1,
    ...(session.answerDistribution?.map((d) => d.count) ?? [1])
  );

  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Back link */}
        <Link
          href="/admin/quiz"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-primary-400 mb-5"
        >
          <ArrowLeft size={14} /> Back to quizzes
        </Link>

        {/* Join Code Banner - always visible */}
        <div className="bg-indigo-600 dark:bg-indigo-700 rounded-xl p-5 mb-6 text-center text-white">
          <p className="text-sm font-medium text-indigo-200 mb-1">
            Join Code
          </p>
          <p className="text-5xl font-mono font-bold tracking-[0.3em] mb-3">
            {session.code}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={shareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-medium transition-colors"
            >
              <Share2 size={14} />
              WhatsApp
            </button>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-lg text-sm">
              <Users size={14} />
              {session.playerCount} players
            </span>
          </div>
          {session.status !== "WAITING" && session.totalQuestions > 0 && (
            <p className="mt-3 text-sm text-indigo-200">
              Question {session.currentQuestionIndex + 1} of{" "}
              {session.totalQuestions}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* WAITING state */}
        {session.status === "WAITING" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
                <Gamepad2
                  size={28}
                  className="text-indigo-600 dark:text-indigo-400"
                />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                {session.quizTitle}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Waiting for players to join...
              </p>
              <button
                onClick={() => handleAdvance("next")}
                disabled={advancing || session.playerCount === 0}
                className={clsx(
                  "px-10 py-4 rounded-xl text-lg font-bold transition-all shadow-md",
                  session.playerCount === 0
                    ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700 active:scale-95 text-white hover:shadow-lg"
                )}
              >
                <Play size={20} className="inline -mt-0.5 mr-2" />
                {advancing ? "Starting..." : "Start Quiz"}
              </button>
            </div>

            {/* Players list */}
            {session.players.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Users size={16} className="text-indigo-500" />
                  Players ({session.players.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {session.players.map((p) => (
                    <span
                      key={p.id}
                      className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-sm font-medium rounded-full"
                    >
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ACTIVE state */}
        {session.status === "ACTIVE" && session.currentQuestion && (
          <div className="space-y-4">
            {/* Timer + answer count */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <Timer
                  size={18}
                  className={clsx(
                    localTimer !== null && localTimer <= 5
                      ? "text-red-500 animate-pulse"
                      : "text-indigo-500"
                  )}
                />
                <span
                  className={clsx(
                    "text-2xl font-bold font-mono",
                    localTimer !== null && localTimer <= 5
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-900 dark:text-gray-100"
                  )}
                >
                  {localTimer ?? "..."}s
                </span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <BarChart3 size={18} className="text-green-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {session.answerCount} of {session.playerCount} answered
                </span>
              </div>
            </div>

            {/* Question */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-5 text-center">
                {session.currentQuestion.text}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {session.currentQuestion.options.map((opt, i) => (
                  <div
                    key={i}
                    className={clsx(
                      "flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors",
                      OPTION_COLORS[i]?.light ?? "bg-gray-100 dark:bg-gray-700",
                      OPTION_COLORS[i]
                        ? `border-${OPTION_COLORS[i].bg.replace("bg-", "")}`
                        : "border-gray-300 dark:border-gray-600"
                    )}
                    style={{
                      borderColor:
                        i === 0
                          ? "#ef4444"
                          : i === 1
                            ? "#3b82f6"
                            : i === 2
                              ? "#22c55e"
                              : "#eab308",
                    }}
                  >
                    <span
                      className={clsx(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0",
                        OPTION_COLORS[i]?.bg ?? "bg-gray-500"
                      )}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {opt}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Show results button */}
            <div className="text-center">
              <button
                onClick={() => handleAdvance("show_results")}
                disabled={advancing}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-600 shadow-md"
              >
                <BarChart3 size={16} className="inline -mt-0.5 mr-2" />
                {advancing ? "Loading..." : "Show Results"}
              </button>
            </div>
          </div>
        )}

        {/* SHOWING_RESULTS state */}
        {session.status === "SHOWING_RESULTS" && session.currentQuestion && (
          <div className="space-y-4">
            {/* Question with correct answer */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 text-center">
                {session.currentQuestion.text}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {session.currentQuestion.options.map((opt, i) => {
                  const isCorrect =
                    i === session.currentQuestion!.correctOption;
                  return (
                    <div
                      key={i}
                      className={clsx(
                        "flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all",
                        isCorrect
                          ? "border-green-500 bg-green-50 dark:bg-green-900/20 ring-2 ring-green-400"
                          : "border-gray-200 dark:border-gray-600 opacity-60"
                      )}
                    >
                      <span
                        className={clsx(
                          "w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0",
                          isCorrect ? "bg-green-500" : "bg-gray-400 dark:bg-gray-600"
                        )}
                      >
                        {isCorrect ? (
                          <Check size={16} />
                        ) : (
                          String.fromCharCode(65 + i)
                        )}
                      </span>
                      <span
                        className={clsx(
                          "font-medium",
                          isCorrect
                            ? "text-green-700 dark:text-green-300"
                            : "text-gray-500 dark:text-gray-400"
                        )}
                      >
                        {opt}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Answer distribution */}
            {session.answerDistribution && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <BarChart3 size={16} className="text-indigo-500" />
                  Answer Distribution
                </h3>
                <div className="space-y-3">
                  {session.answerDistribution.map((d, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span
                          className={clsx(
                            "font-medium",
                            d.isCorrect
                              ? "text-green-600 dark:text-green-400"
                              : "text-gray-700 dark:text-gray-300"
                          )}
                        >
                          {d.option}
                          {d.isCorrect && " (correct)"}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {d.count}
                        </span>
                      </div>
                      <div className="h-6 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                        <div
                          className={clsx(
                            "h-full rounded-lg transition-all duration-500",
                            d.isCorrect
                              ? "bg-green-500"
                              : OPTION_COLORS[i]?.bg ?? "bg-gray-400"
                          )}
                          style={{
                            width: `${(d.count / maxDistribution) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Leaderboard top 5 */}
            {session.leaderboard.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Trophy size={16} className="text-yellow-500" />
                  Top 5
                </h3>
                <div className="space-y-2">
                  {session.leaderboard.slice(0, 5).map((p, i) => (
                    <div
                      key={p.id}
                      className={clsx(
                        "flex items-center gap-3 px-4 py-3 rounded-lg",
                        i === 0
                          ? "bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800"
                          : "bg-gray-50 dark:bg-gray-700/50"
                      )}
                    >
                      <span className="w-8 text-center">
                        {i < 3 ? (
                          <Crown
                            size={18}
                            className={MEDAL_COLORS[i]}
                          />
                        ) : (
                          <span className="text-sm font-bold text-gray-400 dark:text-gray-500">
                            {i + 1}
                          </span>
                        )}
                      </span>
                      <span className="flex-1 font-medium text-gray-900 dark:text-gray-100">
                        {p.name}
                      </span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {p.score.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next question button */}
            <div className="text-center">
              <button
                onClick={() => handleAdvance("next")}
                disabled={advancing}
                className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-600 shadow-md"
              >
                <ChevronRight size={16} className="inline -mt-0.5 mr-1" />
                {advancing
                  ? "Loading..."
                  : session.currentQuestionIndex + 1 >=
                      session.totalQuestions
                    ? "Finish Quiz"
                    : "Next Question"}
              </button>
            </div>
          </div>
        )}

        {/* COMPLETED state */}
        {session.status === "COMPLETED" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mx-auto mb-4">
                <Trophy
                  size={28}
                  className="text-yellow-500"
                />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                Quiz Complete!
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {session.quizTitle} - {session.playerCount} players
              </p>
            </div>

            {/* Full leaderboard */}
            {session.leaderboard.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Trophy size={16} className="text-yellow-500" />
                  Final Leaderboard
                </h3>
                <div className="space-y-2">
                  {session.leaderboard.map((p, i) => (
                    <div
                      key={p.id}
                      className={clsx(
                        "flex items-center gap-3 px-4 py-3 rounded-lg",
                        i === 0
                          ? "bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800"
                          : i === 1
                            ? "bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
                            : i === 2
                              ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800"
                              : "bg-gray-50 dark:bg-gray-700/50"
                      )}
                    >
                      <span className="w-8 text-center">
                        {i < 3 ? (
                          <Crown
                            size={18}
                            className={MEDAL_COLORS[i]}
                          />
                        ) : (
                          <span className="text-sm font-bold text-gray-400 dark:text-gray-500">
                            {i + 1}
                          </span>
                        )}
                      </span>
                      <span className="flex-1 font-medium text-gray-900 dark:text-gray-100">
                        {p.name}
                      </span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {p.score.toLocaleString()} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* End session */}
            <div className="text-center">
              <Link
                href="/admin/quiz"
                className="inline-flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors shadow-md"
              >
                End Session
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
