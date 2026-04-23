import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Brain, Plus, Users } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type SessionSummary = {
  code: string;
  difficulty: string;
  status: "WAITING" | "ACTIVE" | "COMPLETED";
  hostName: string;
  hostBlock: number;
  playerCount: number;
};

export default function MemoryMulti() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const playerId = user?.playerId ?? null;

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      apiFetch("/api/memory/multi/sessions")
        .then((r) => (r.ok ? r.json() : { sessions: [] }))
        .then((data) => {
          if (!cancelled) setSessions(data.sessions ?? []);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const handleCreate = async () => {
    if (!playerId || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await apiFetch("/api/memory/multi/sessions", {
        method: "POST",
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to create");
        return;
      }
      navigate(`/memory/multi/${data.code}`);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinCode = () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setError("Enter a valid code");
      return;
    }
    navigate(`/memory/multi/${trimmed}`);
  };

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex items-center justify-between py-4">
        <Link
          to="/memory"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">Memory — Multiplayer</h1>
        <div className="h-9 w-9" />
      </header>

      <button
        onClick={handleCreate}
        disabled={creating}
        className="mb-4 flex items-center justify-center gap-2 rounded-2xl border border-indigo-500/50 bg-indigo-500/15 px-5 py-3.5 text-sm font-semibold text-indigo-200 active:bg-indigo-500/25 disabled:opacity-40"
      >
        <Plus size={16} />
        {creating ? "Creating…" : "Host a new session"}
      </button>

      <section className="mb-6 rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
        <h2 className="text-sm font-semibold text-slate-200">
          Join by code
        </h2>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect="off"
            className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-center font-mono text-lg font-bold tracking-[0.3em] text-white placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
          />
          <button
            onClick={handleJoinCode}
            className="rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white active:bg-indigo-600"
          >
            Join
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-200">
          Open sessions
        </h2>
        {loading ? (
          <p className="py-6 text-center text-sm text-slate-500">Loading…</p>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/40 py-10 text-center">
            <Brain size={32} className="mx-auto mb-2 text-slate-600" />
            <p className="text-sm text-slate-400">No open sessions right now.</p>
            <p className="mt-1 text-xs text-slate-500">
              Host one or wait for a neighbour.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <button
                key={s.code}
                onClick={() => navigate(`/memory/multi/${s.code}`)}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-left active:bg-slate-800"
              >
                <div
                  className={clsx(
                    "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-lg",
                    s.status === "ACTIVE"
                      ? "bg-green-500/20 text-green-300"
                      : "bg-amber-500/20 text-amber-300"
                  )}
                >
                  🧠
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">
                    Hosted by {s.hostName}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="font-mono">{s.code}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Users size={11} /> {s.playerCount}
                    </span>
                    <span>·</span>
                    <span
                      className={
                        s.status === "ACTIVE"
                          ? "text-green-400"
                          : "text-amber-400"
                      }
                    >
                      {s.status === "ACTIVE" ? "Live" : "Waiting"}
                    </span>
                  </p>
                </div>
                <span className="text-slate-500">›</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
