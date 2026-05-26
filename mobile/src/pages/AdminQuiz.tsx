import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  HelpCircle,
  Info,
  Loader2,
  Play,
  Users,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { canManageAnnouncements } from "../lib/roles";

// ── Types ──────────────────────────────────────────────────────────────────

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  _count: { questions: number; sessions: number };
  createdAt: string;
}

interface RecentSession {
  id: string;
  code: string;
  quizTitle: string;
  status: "WAITING" | "ACTIVE" | "SHOWING_RESULTS" | "COMPLETED";
  playerCount: number;
  createdAt: string;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminQuiz() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !canManageAnnouncements(user.roles)) {
      navigate("/more", { replace: true });
    }
  }, [user, navigate]);

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [sessions, setSessions] = useState<RecentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [qz, ss] = await Promise.all([
        apiFetch("/api/quiz/quizzes", { token }),
        apiFetch("/api/quiz/sessions"),
      ]);
      if (!qz.ok) {
        setError(qz.status === 403 ? "Not authorised" : "Could not load");
        return;
      }
      const qzData = await qz.json();
      setQuizzes(qzData.quizzes ?? []);
      if (ss.ok) {
        const ssData = await ss.json();
        setSessions(ssData.sessions ?? []);
      }
      setError(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function launchQuiz(quiz: Quiz) {
    if (quiz._count.questions === 0) {
      alert("Add questions on the web first.");
      return;
    }
    setLaunching(quiz.id);
    try {
      const res = await apiFetch("/api/quiz/sessions", {
        method: "POST",
        token,
        body: JSON.stringify({ quizId: quiz.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error ?? "Could not create session");
        return;
      }
      const data = await res.json();
      navigate(`/admin/quiz/${data.code}`);
    } catch {
      alert("Network error");
    } finally {
      setLaunching(null);
    }
  }

  const liveSessions = sessions.filter((s) => s.status !== "COMPLETED");

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/more"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-white">Quiz host</h1>
          <p className="truncate text-[11px] text-slate-500">
            {quizzes.length} quiz{quizzes.length !== 1 ? "zes" : ""} ·{" "}
            {liveSessions.length} live
          </p>
        </div>
      </header>

      <div className="mb-3 flex items-start gap-2 rounded-2xl border border-slate-700 bg-slate-800/40 px-3 py-2.5 text-[11px] text-slate-400">
        <Info size={14} className="mt-0.5 flex-shrink-0 text-indigo-300" />
        <p>
          Create or edit quiz questions on the web at{" "}
          <span className="text-indigo-300">/admin/quiz</span>. Use this screen
          to host a live game from any saved quiz.
        </p>
      </div>

      {error && (
        <p className="mb-3 rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-2.5 text-xs text-red-200">
          {error}
        </p>
      )}

      {/* Live / active sessions */}
      {liveSessions.length > 0 && (
        <section className="mb-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Live sessions
          </h2>
          <ul className="space-y-2">
            {liveSessions.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </ul>
        </section>
      )}

      {/* Quiz templates */}
      <section className="flex-1 pb-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Quiz templates
        </h2>
        {loading ? (
          <div className="flex justify-center py-10 text-slate-500">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : quizzes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
            <HelpCircle size={28} className="mx-auto mb-2 text-slate-600" />
            No quiz templates yet. Create one on the web first.
          </div>
        ) : (
          <ul className="space-y-2">
            {quizzes.map((q) => (
              <QuizCard
                key={q.id}
                quiz={q}
                launching={launching === q.id}
                onLaunch={() => launchQuiz(q)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function QuizCard({
  quiz,
  launching,
  onLaunch,
}: {
  quiz: Quiz;
  launching: boolean;
  onLaunch: () => void;
}) {
  const hasQuestions = quiz._count.questions > 0;
  return (
    <li className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
          <BookOpen size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {quiz.title}
          </p>
          {quiz.description && (
            <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">
              {quiz.description}
            </p>
          )}
          <p className="mt-1 text-[10px] text-slate-500">
            {quiz._count.questions} question
            {quiz._count.questions !== 1 ? "s" : ""} ·{" "}
            {quiz._count.sessions} session
            {quiz._count.sessions !== 1 ? "s" : ""} hosted
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onLaunch}
        disabled={launching || !hasQuestions}
        className={clsx(
          "mt-2 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold",
          !hasQuestions
            ? "bg-slate-900 text-slate-500"
            : "bg-indigo-500 text-white active:bg-indigo-600",
          launching && "opacity-50"
        )}
      >
        {launching ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Play size={14} />
        )}
        {!hasQuestions
          ? "No questions yet"
          : launching
            ? "Creating…"
            : "Launch live session"}
      </button>
    </li>
  );
}

function SessionRow({ session }: { session: RecentSession }) {
  const statusCls =
    session.status === "ACTIVE"
      ? "bg-emerald-500 text-white"
      : session.status === "SHOWING_RESULTS"
        ? "bg-amber-500 text-white"
        : session.status === "WAITING"
          ? "bg-slate-700 text-slate-200"
          : "bg-slate-700 text-slate-400";
  return (
    <Link
      to={`/admin/quiz/${session.code}`}
      className="flex items-start gap-3 rounded-2xl border border-emerald-700/40 bg-slate-800/60 p-3 active:bg-slate-800"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
        <Play size={16} className="fill-current" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-white">
            {session.quizTitle}
          </h3>
          <span
            className={clsx(
              "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wider",
              statusCls
            )}
          >
            {session.status.replace("_", " ")}
          </span>
        </div>
        <p className="mt-0.5 font-mono text-[13px] tracking-widest text-indigo-200">
          {session.code}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          <Users size={9} className="-mt-0.5 mr-0.5 inline" />
          {session.playerCount} player{session.playerCount !== 1 ? "s" : ""}
        </p>
      </div>
      <ChevronRight size={16} className="mt-1 flex-shrink-0 text-slate-500" />
    </Link>
  );
}
