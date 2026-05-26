import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Dices,
  Loader2,
  Plus,
  Users,
  X,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { canManageAnnouncements } from "../lib/roles";

// ── Types ──────────────────────────────────────────────────────────────────

type Status = "WAITING" | "ACTIVE" | "COMPLETED";

interface Session {
  id: string;
  code: string;
  title: string;
  status: Status;
  playerCount: number;
  createdAt: string;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminTambola() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !canManageAnnouncements(user.roles)) {
      navigate("/more", { replace: true });
    }
  }, [user, navigate]);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/tambola/sessions", { token });
      if (!res.ok) {
        setError("Could not load");
        return;
      }
      const data = await res.json();
      setSessions(data.sessions ?? []);
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
          <h1 className="text-lg font-semibold text-white">Tambola host</h1>
          <p className="truncate text-[11px] text-slate-500">
            {sessions.length} recent session{sessions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className={clsx(
            "flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium",
            showNew
              ? "bg-slate-800 text-slate-300"
              : "bg-indigo-500 text-white active:bg-indigo-600"
          )}
        >
          {showNew ? <X size={14} /> : <Plus size={14} />}
          {showNew ? "Close" : "New"}
        </button>
      </header>

      {showNew && (
        <NewSessionForm
          token={token}
          onCreated={(code) => {
            setShowNew(false);
            navigate(`/admin/tambola/${code}`);
          }}
        />
      )}

      {error && (
        <p className="mb-3 rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-2.5 text-xs text-red-200">
          {error}
        </p>
      )}

      <section className="flex-1 pb-4">
        {loading ? (
          <div className="flex justify-center py-10 text-slate-500">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
            <Dices size={28} className="mx-auto mb-2 text-slate-600" />
            No sessions yet. Tap{" "}
            <span className="text-indigo-300">New</span> to start a game.
          </div>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function NewSessionForm({
  token,
  onCreated,
}: {
  token: string | null;
  onCreated: (code: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!title.trim()) {
      setErr("Title required");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch("/api/tambola/sessions", {
        method: "POST",
        token,
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErr(data?.error ?? "Could not create");
        return;
      }
      const data = await res.json();
      onCreated(data.code);
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-3 space-y-2.5 rounded-2xl border border-indigo-700/50 bg-slate-800/80 p-3">
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Session title
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder='e.g. "Diwali Tambola Night"'
          className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
        />
      </div>
      {err && (
        <p className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-1.5 text-[11px] text-red-200">
          {err}
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white active:bg-indigo-600 disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        Create session
      </button>
    </section>
  );
}

function SessionCard({ session }: { session: Session }) {
  const statusCls =
    session.status === "ACTIVE"
      ? "bg-emerald-500 text-white"
      : session.status === "WAITING"
        ? "bg-amber-500 text-white"
        : "bg-slate-700 text-slate-300";

  return (
    <Link
      to={`/admin/tambola/${session.code}`}
      className="flex items-start gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-3 active:bg-slate-800"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
        <Dices size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-white">
            {session.title}
          </h3>
          <span
            className={clsx(
              "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wider",
              statusCls
            )}
          >
            {session.status}
          </span>
        </div>
        <p className="mt-0.5 font-mono text-[13px] tracking-widest text-indigo-200">
          {session.code}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-0.5">
            <Users size={9} />
            {session.playerCount} player{session.playerCount !== 1 ? "s" : ""}
          </span>
          <span className="text-slate-600">·</span>
          <span>
            {new Date(session.createdAt).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
      <ChevronRight size={16} className="mt-1 flex-shrink-0 text-slate-500" />
    </Link>
  );
}

