"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Users, Gamepad2, Plus } from "lucide-react";
import clsx from "clsx";

type Difficulty = "easy" | "medium" | "hard";

interface LobbySession {
  code: string;
  difficulty: string;
  status: string;
  hostName: string;
  hostBlock: number;
  playerCount: number;
  createdAt: string;
}

const DIFF_LABEL: Record<Difficulty, string> = {
  easy: "Easy (4×3)",
  medium: "Medium (4×4)",
  hard: "Hard (5×4)",
};

export default function MemoryMultiLobbyPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState("");
  const [sessions, setSessions] = useState<LobbySession[]>([]);
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [error, setError] = useState("");

  // Redirect unauthenticated
  useEffect(() => {
    if (sessionStatus !== "loading" && !session) {
      signIn("google", { callbackUrl: "/memory/multi" });
    }
  }, [session, sessionStatus]);

  // Auto-register
  useEffect(() => {
    if (sessionStatus === "loading" || !session?.user?.email) return;

    fetch("/api/wordle/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromSession: true }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          localStorage.setItem("memory_player_id", data.playerId);
          localStorage.setItem("memory_player_name", data.name);
          setPlayerId(data.playerId);
          setPlayerName(data.name);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session, sessionStatus]);

  const fetchSessions = useCallback(() => {
    fetch("/api/memory/multi/sessions")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.sessions) setSessions(d.sessions);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!playerId) return;
    fetchSessions();
    const id = setInterval(fetchSessions, 4000);
    return () => clearInterval(id);
  }, [playerId, fetchSessions]);

  const handleCreate = async () => {
    if (!playerId) return;
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/memory/multi/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, difficulty }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to create session");
        return;
      }
      const data = await res.json();
      router.push(`/memory/multi/${data.code}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (inputCode?: string) => {
    const trimmed = (inputCode || code).trim().toUpperCase();
    if (trimmed.length !== 6) {
      setError("Please enter a 6-character code");
      return;
    }
    if (!playerId) return;

    setError("");
    setJoining(true);
    try {
      const res = await fetch(`/api/memory/multi/sessions/${trimmed}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to join session");
        return;
      }
      router.push(`/memory/multi/${trimmed}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  if (sessionStatus === "loading" || !session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/memory" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Gamepad2 size={26} className="text-primary-600 dark:text-primary-400" />
          Memory Multiplayer
        </h1>
        <div className="w-5" />
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
        Playing as <span className="font-medium text-gray-700 dark:text-gray-300">{playerName}</span>
      </p>

      {/* Create session */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-6">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3">
          Create a Session
        </h2>
        <div className="flex gap-2 mb-3">
          {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={clsx(
                "flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors",
                difficulty === d
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-primary-400"
              )}
            >
              {DIFF_LABEL[d]}
            </button>
          ))}
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className={clsx(
            "w-full px-4 py-3 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-colors",
            creating
              ? "bg-gray-300 dark:bg-gray-600 cursor-not-allowed"
              : "bg-primary-600 hover:bg-primary-700"
          )}
        >
          <Plus size={18} />
          {creating ? "Creating..." : "Create New Session"}
        </button>
      </div>

      {/* Join by code */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-6">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3">
          Join with Code
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().slice(0, 6));
              setError("");
            }}
            placeholder="ABC123"
            maxLength={6}
            className={clsx(
              "flex-1 px-4 py-3 rounded-lg border text-center text-lg font-mono tracking-widest uppercase",
              "bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100",
              "focus:outline-none focus:ring-2 focus:ring-primary-500",
              error ? "border-red-400" : "border-gray-300 dark:border-gray-600"
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleJoin();
            }}
          />
          <button
            onClick={() => handleJoin()}
            disabled={joining || code.trim().length !== 6}
            className={clsx(
              "px-5 py-3 rounded-lg font-semibold text-white flex items-center gap-2 transition-colors",
              joining || code.trim().length !== 6
                ? "bg-gray-300 dark:bg-gray-600 cursor-not-allowed"
                : "bg-primary-600 hover:bg-primary-700"
            )}
          >
            {joining ? "..." : <>Join <ArrowRight size={18} /></>}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-500 dark:text-red-400">{error}</p>}
      </div>

      {/* Active sessions */}
      {sessions.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3">
            Active Sessions
          </h2>
          <div className="space-y-2">
            {sessions.map((s) => (
              <button
                key={s.code}
                onClick={() => handleJoin(s.code)}
                className={clsx(
                  "w-full flex items-center justify-between p-4 rounded-xl border text-left transition-colors",
                  "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700",
                  "hover:border-primary-400 dark:hover:border-primary-600"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-primary-600 dark:text-primary-400">
                      {s.code}
                    </span>
                    <span
                      className={clsx(
                        "text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider",
                        s.status === "WAITING"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      )}
                    >
                      {s.status === "WAITING" ? "waiting" : "live"}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      {s.difficulty}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                    Host: {s.hostName} (Block {s.hostBlock})
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 ml-3">
                  <Users size={14} />
                  {s.playerCount}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {sessions.length === 0 && (
        <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
          No active sessions. Create one to invite others!
        </div>
      )}
    </div>
  );
}
