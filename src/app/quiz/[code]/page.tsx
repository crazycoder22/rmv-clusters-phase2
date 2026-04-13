"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signIn } from "next-auth/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trophy, Medal, Users, CheckCircle2, XCircle, Clock } from "lucide-react";
import clsx from "clsx";

// ── Types ─────────────────────────────────────────────────────────────────

interface QuizPlayer {
  playerId: string;
  name: string;
  block: number;
  score: number;
}

interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  questionStartedAt: string;
  timeLimitSecs: number;
}

interface QuizAnswer {
  questionId: string;
  answerIndex: number;
  correct: boolean;
  pointsEarned: number;
  correctIndex: number;
}

interface QuizSessionData {
  code: string;
  title: string;
  status: "waiting" | "active" | "showing_results" | "completed";
  playerCount: number;
  players: QuizPlayer[];
  currentQuestion: QuizQuestion | null;
  lastAnswer: QuizAnswer | null;
  leaderboard: QuizPlayer[];
  myScore: number;
  updatedAt: string;
  questionIndex: number;
  totalQuestions: number;
}

// ── Answer button colors (Kahoot-style) ───────────────────────────────────

const ANSWER_COLORS = [
  { bg: "bg-red-500 hover:bg-red-600", ring: "ring-red-300", text: "text-white" },
  { bg: "bg-blue-500 hover:bg-blue-600", ring: "ring-blue-300", text: "text-white" },
  { bg: "bg-green-500 hover:bg-green-600", ring: "ring-green-300", text: "text-white" },
  { bg: "bg-yellow-500 hover:bg-yellow-600", ring: "ring-yellow-300", text: "text-white" },
];

const ANSWER_SHAPES = ["\u25B2", "\u25C6", "\u25CF", "\u25A0"]; // triangle, diamond, circle, square

// ── Timer Bar ─────────────────────────────────────────────────────────────

function TimerBar({
  questionStartedAt,
  timeLimitSecs,
  onExpire,
}: {
  questionStartedAt: string;
  timeLimitSecs: number;
  onExpire: () => void;
}) {
  const [percent, setPercent] = useState(100);
  const [secondsLeft, setSecondsLeft] = useState(timeLimitSecs);
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;

    const tick = () => {
      const elapsed = (Date.now() - new Date(questionStartedAt).getTime()) / 1000;
      const remaining = Math.max(0, timeLimitSecs - elapsed);
      const pct = Math.max(0, (remaining / timeLimitSecs) * 100);
      setPercent(pct);
      setSecondsLeft(Math.ceil(remaining));

      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    };

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [questionStartedAt, timeLimitSecs, onExpire]);

  return (
    <div className="w-full space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <Clock size={14} />
          Time
        </span>
        <span
          className={clsx(
            "font-mono font-bold tabular-nums",
            secondsLeft <= 5 ? "text-red-500 dark:text-red-400" : "text-gray-700 dark:text-gray-300"
          )}
        >
          {secondsLeft}s
        </span>
      </div>
      <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={clsx(
            "h-full rounded-full transition-all duration-100 ease-linear",
            percent > 50 ? "bg-green-500" : percent > 20 ? "bg-yellow-500" : "bg-red-500"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// ── Leaderboard ───────────────────────────────────────────────────────────

function Leaderboard({
  players,
  currentPlayerId,
  maxShow = 5,
}: {
  players: QuizPlayer[];
  currentPlayerId: string;
  maxShow?: number;
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const shown = sorted.slice(0, maxShow);
  const currentInTop = shown.some((p) => p.playerId === currentPlayerId);
  const currentPlayer = !currentInTop ? sorted.find((p) => p.playerId === currentPlayerId) : null;
  const currentRank = currentPlayer ? sorted.findIndex((p) => p.playerId === currentPlayerId) + 1 : -1;

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Trophy size={18} className="text-yellow-500" />;
    if (rank === 2) return <Medal size={18} className="text-gray-400" />;
    if (rank === 3) return <Medal size={18} className="text-amber-600" />;
    return <span className="w-[18px] text-center text-sm font-bold text-gray-400 dark:text-gray-500">{rank}</span>;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Trophy size={16} className="text-yellow-500" />
          Leaderboard
        </h3>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {shown.map((player, i) => {
          const rank = i + 1;
          const isMe = player.playerId === currentPlayerId;
          return (
            <li
              key={player.playerId}
              className={clsx(
                "flex items-center gap-3 px-4 py-3 transition-colors",
                isMe && "bg-primary-50 dark:bg-primary-900/20"
              )}
            >
              <div className="flex-shrink-0">{rankIcon(rank)}</div>
              <div className="flex-1 min-w-0">
                <p
                  className={clsx(
                    "font-medium truncate",
                    isMe ? "text-primary-700 dark:text-primary-300" : "text-gray-800 dark:text-gray-100"
                  )}
                >
                  {player.name}
                  {isMe && " (You)"}
                </p>
                {player.block > 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">Block {player.block}</p>
                )}
              </div>
              <span className="font-bold text-gray-700 dark:text-gray-200 tabular-nums">
                {player.score.toLocaleString()}
              </span>
            </li>
          );
        })}
        {currentPlayer && (
          <>
            <li className="px-4 py-1 text-center text-xs text-gray-400 dark:text-gray-500">
              ...
            </li>
            <li className="flex items-center gap-3 px-4 py-3 bg-primary-50 dark:bg-primary-900/20">
              <div className="flex-shrink-0">{rankIcon(currentRank)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-primary-700 dark:text-primary-300 truncate">
                  {currentPlayer.name} (You)
                </p>
                {currentPlayer.block > 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">Block {currentPlayer.block}</p>
                )}
              </div>
              <span className="font-bold text-gray-700 dark:text-gray-200 tabular-nums">
                {currentPlayer.score.toLocaleString()}
              </span>
            </li>
          </>
        )}
      </ul>
    </div>
  );
}

// ── Confetti ──────────────────────────────────────────────────────────────

function Confetti() {
  const pieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 3,
    color: ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#ec4899"][
      Math.floor(Math.random() * 6)
    ],
    size: 6 + Math.random() * 8,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti"
          style={{
            left: `${p.left}%`,
            top: "-20px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti-fall linear forwards;
        }
      `}</style>
    </div>
  );
}

// ── Animated Dots ─────────────────────────────────────────────────────────

function AnimatedDots() {
  return (
    <span className="inline-flex">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="animate-bounce mx-0.5 text-gray-400 dark:text-gray-500"
          style={{ animationDelay: `${i * 0.15}s` }}
        >
          .
        </span>
      ))}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function QuizGamePage() {
  const { data: session, status: sessionStatus } = useSession();
  const params = useParams();
  const code = (params.code as string)?.toUpperCase();

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [quizData, setQuizData] = useState<QuizSessionData | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [answerResult, setAnswerResult] = useState<QuizAnswer | null>(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const lastUpdatedRef = useRef<string>("");
  const currentQuestionIdRef = useRef<string>("");

  // Redirect unauthenticated users to sign-in
  useEffect(() => {
    if (sessionStatus !== "loading" && !session) {
      signIn("google", { callbackUrl: `/quiz/${code}` });
    }
  }, [session, sessionStatus, code]);

  // Auto-register signed-in users
  useEffect(() => {
    if (sessionStatus === "loading" || !session?.user?.email) return;

    const storedId = localStorage.getItem("quiz_player_id");
    const storedName = localStorage.getItem("quiz_player_name");

    fetch("/api/wordle/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromSession: true }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          localStorage.setItem("quiz_player_id", data.playerId);
          localStorage.setItem("quiz_player_name", data.name);
          setPlayerId(data.playerId);
          setPlayerName(data.name);
        } else if (storedId) {
          setPlayerId(storedId);
          setPlayerName(storedName || "");
        }
      })
      .catch(() => {
        if (storedId) {
          setPlayerId(storedId);
          setPlayerName(storedName || "");
        }
      })
      .finally(() => setLoading(false));
  }, [session, sessionStatus]);

  // Poll for quiz state
  useEffect(() => {
    if (!playerId || !code) return;

    const fetchState = async () => {
      try {
        const res = await fetch(`/api/quiz/sessions/${code}?playerId=${playerId}`);
        if (!res.ok) return;
        const data: QuizSessionData = await res.json();

        // Skip if nothing changed
        if (data.updatedAt === lastUpdatedRef.current) return;
        lastUpdatedRef.current = data.updatedAt;

        // Reset answer state when question changes
        if (data.currentQuestion && data.currentQuestion.id !== currentQuestionIdRef.current) {
          currentQuestionIdRef.current = data.currentQuestion.id;
          setSelectedAnswer(null);
          setAnswerSubmitted(false);
          setAnswerResult(null);
          setTimeExpired(false);
        }

        // If we're showing results, populate the answer result from server data
        if (data.status === "showing_results" && data.lastAnswer) {
          setAnswerResult(data.lastAnswer);
        }

        // Confetti on completion for top 3
        if (data.status === "completed" && quizData?.status !== "completed") {
          const sorted = [...(data.leaderboard || data.players || [])].sort(
            (a, b) => b.score - a.score
          );
          const myRank = sorted.findIndex((p) => p.playerId === playerId) + 1;
          if (myRank >= 1 && myRank <= 3) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 5000);
          }
        }

        setQuizData(data);
      } catch {
        // Silently retry on next interval
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, [playerId, code, quizData?.status]);

  // Submit answer
  const submitAnswer = useCallback(
    async (answerIndex: number) => {
      if (!playerId || !quizData?.currentQuestion || answerSubmitted) return;

      setSelectedAnswer(answerIndex);
      setAnswerSubmitted(true);

      try {
        const res = await fetch(`/api/quiz/sessions/${code}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId,
            questionId: quizData.currentQuestion.id,
            answerIndex,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setAnswerResult(data);
        }
      } catch {
        // Will reconcile on next poll
      }
    },
    [playerId, code, quizData?.currentQuestion, answerSubmitted]
  );

  const handleTimeExpired = useCallback(() => {
    if (!answerSubmitted) {
      setTimeExpired(true);
    }
  }, [answerSubmitted]);

  // ── Loading / Auth states ─────────────────────────────────────────────

  if (sessionStatus === "loading" || !session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!quizData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-gray-500 dark:text-gray-400">Connecting to quiz {code}...</p>
        </div>
      </div>
    );
  }

  // ── WAITING state ─────────────────────────────────────────────────────

  if (quizData.status === "waiting") {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <Header code={code} title={quizData.title} />
        <div className="flex flex-col items-center justify-center py-16 space-y-6">
          <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <Users size={36} className="text-primary-600 dark:text-primary-400 animate-pulse" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              Waiting for host to start
              <AnimatedDots />
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-primary-600 dark:text-primary-400">
                {quizData.playerCount}
              </span>{" "}
              {quizData.playerCount === 1 ? "player" : "players"} connected
            </p>
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-xl px-6 py-4 text-center border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Game Code</p>
            <p className="text-2xl font-mono font-bold tracking-widest text-gray-800 dark:text-gray-100">
              {code}
            </p>
          </div>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Playing as <span className="font-medium text-gray-600 dark:text-gray-300">{playerName}</span>
          </p>
        </div>
      </div>
    );
  }

  // ── ACTIVE state ──────────────────────────────────────────────────────

  if (quizData.status === "active" && quizData.currentQuestion) {
    const q = quizData.currentQuestion;

    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <Header code={code} title={quizData.title} />

        {/* Progress */}
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
          <span>
            Question {quizData.questionIndex + 1} of {quizData.totalQuestions}
          </span>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            Score: {quizData.myScore}
          </span>
        </div>

        {/* Timer */}
        {!answerSubmitted && !timeExpired && (
          <div className="mb-6">
            <TimerBar
              questionStartedAt={q.questionStartedAt}
              timeLimitSecs={q.timeLimitSecs}
              onExpire={handleTimeExpired}
            />
          </div>
        )}

        {/* Question */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 text-center leading-relaxed">
            {q.text}
          </h2>
        </div>

        {/* Answer Buttons or Submitted State */}
        {answerSubmitted ? (
          <div className="text-center space-y-4 py-8">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} className="text-green-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              Answer submitted!
            </h3>
            {answerResult && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {answerResult.correct ? (
                  <span className="text-green-600 dark:text-green-400 font-semibold">
                    +{answerResult.pointsEarned} points
                  </span>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">Waiting for results...</span>
                )}
              </p>
            )}
          </div>
        ) : timeExpired ? (
          <div className="text-center space-y-4 py-8">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
              <Clock size={32} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Time's up!</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You didn't answer in time.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {q.options.map((option, i) => {
              const colors = ANSWER_COLORS[i] || ANSWER_COLORS[0];
              return (
                <button
                  key={i}
                  onClick={() => submitAnswer(i)}
                  className={clsx(
                    "relative p-4 rounded-xl font-semibold text-base transition-all",
                    "min-h-[80px] flex flex-col items-center justify-center gap-2",
                    "active:scale-95 focus:outline-none focus:ring-4",
                    colors.bg,
                    colors.text,
                    colors.ring
                  )}
                >
                  <span className="text-lg opacity-60">{ANSWER_SHAPES[i]}</span>
                  <span className="leading-snug">{option}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── SHOWING_RESULTS state ─────────────────────────────────────────────

  if (quizData.status === "showing_results") {
    const lastAnswer = answerResult || quizData.lastAnswer;
    const isCorrect = lastAnswer?.correct ?? false;
    const answeredQuestion = lastAnswer != null;

    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <Header code={code} title={quizData.title} />

        {/* Result banner */}
        <div
          className={clsx(
            "rounded-xl p-6 mb-6 text-center border",
            isCorrect
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
          )}
        >
          {answeredQuestion ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-2">
                {isCorrect ? (
                  <CheckCircle2 size={28} className="text-green-500" />
                ) : (
                  <XCircle size={28} className="text-red-500" />
                )}
                <h3
                  className={clsx(
                    "text-xl font-bold",
                    isCorrect
                      ? "text-green-700 dark:text-green-300"
                      : "text-red-700 dark:text-red-300"
                  )}
                >
                  {isCorrect ? "Correct!" : "Incorrect"}
                </h3>
              </div>
              {lastAnswer && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isCorrect
                    ? `+${lastAnswer.pointsEarned} points`
                    : `The correct answer was option ${lastAnswer.correctIndex + 1}`}
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Clock size={28} className="text-gray-400" />
              <h3 className="text-xl font-bold text-gray-600 dark:text-gray-400">
                No answer submitted
              </h3>
            </div>
          )}
        </div>

        {/* Question progress */}
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
          <span>
            After question {quizData.questionIndex + 1} of {quizData.totalQuestions}
          </span>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            Score: {quizData.myScore}
          </span>
        </div>

        {/* Leaderboard */}
        <Leaderboard
          players={quizData.leaderboard || quizData.players || []}
          currentPlayerId={playerId!}
        />
      </div>
    );
  }

  // ── COMPLETED state ───────────────────────────────────────────────────

  if (quizData.status === "completed") {
    const sorted = [...(quizData.leaderboard || quizData.players || [])].sort(
      (a, b) => b.score - a.score
    );
    const myRank = sorted.findIndex((p) => p.playerId === playerId) + 1;

    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        {showConfetti && <Confetti />}
        <Header code={code} title={quizData.title} />

        {/* Final result */}
        <div className="text-center space-y-4 py-8">
          {myRank >= 1 && myRank <= 3 ? (
            <>
              <div className="text-5xl">
                {myRank === 1 ? "\uD83C\uDFC6" : myRank === 2 ? "\uD83E\uDD48" : "\uD83E\uDD49"}
              </div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                {myRank === 1 ? "You won!" : `${myRank}nd Place!`}
              </h2>
            </>
          ) : (
            <>
              <div className="text-5xl">{"\uD83C\uDF1F"}</div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Quiz Complete!</h2>
            </>
          )}
          <p className="text-gray-500 dark:text-gray-400">
            You finished in <span className="font-bold text-gray-700 dark:text-gray-200">#{myRank}</span>{" "}
            with <span className="font-bold text-primary-600 dark:text-primary-400">{quizData.myScore}</span>{" "}
            points
          </p>
        </div>

        {/* Full leaderboard */}
        <Leaderboard
          players={sorted}
          currentPlayerId={playerId!}
          maxShow={sorted.length}
        />

        {/* Play again */}
        <div className="mt-6 text-center">
          <Link
            href="/quiz"
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Quiz Lobby
          </Link>
        </div>
      </div>
    );
  }

  // ── Fallback ──────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <Header code={code} title={quizData.title} />
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p>Waiting for game data...</p>
      </div>
    </div>
  );
}

// ── Header Component ────────────────────────────────────────────────────

function Header({ code, title }: { code: string; title: string }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <Link
        href="/quiz"
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <ArrowLeft size={20} />
      </Link>
      <div className="text-center">
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">{title || "Quiz"}</h1>
        <p className="text-xs font-mono text-gray-400 dark:text-gray-500 tracking-wider">{code}</p>
      </div>
      <div className="w-5" />
    </div>
  );
}
