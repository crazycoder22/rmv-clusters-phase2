"use client";

import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gamepad2, Users, ArrowRight, ArrowLeft } from "lucide-react";
import clsx from "clsx";

interface QuizSession {
  code: string;
  title: string;
  status: "waiting" | "active" | "completed";
  playerCount: number;
  createdAt: string;
}

export default function QuizJoinPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [code, setCode] = useState("");
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  // Redirect unauthenticated users to sign-in
  useEffect(() => {
    if (sessionStatus !== "loading" && !session) {
      signIn("google", { callbackUrl: "/quiz" });
    }
  }, [session, sessionStatus]);

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

  // Fetch active/recent sessions
  useEffect(() => {
    if (!playerId) return;

    fetch("/api/quiz/sessions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.sessions) {
          setSessions(data.sessions);
        }
      })
      .catch(() => {});
  }, [playerId]);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setError("Please enter a 6-character code");
      return;
    }
    if (!playerId) {
      setError("Player not registered yet");
      return;
    }

    setJoining(true);
    setError("");

    try {
      const res = await fetch(`/api/quiz/sessions/${trimmed}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to join session");
        return;
      }

      router.push(`/quiz/${trimmed}`);
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
      <div className="flex items-center justify-between mb-8">
        <Link href="/" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Gamepad2 size={28} className="text-primary-600 dark:text-primary-400" />
          Quiz
        </h1>
        <div className="w-5" />
      </div>

      {/* Player info */}
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
        Playing as{" "}
        <span className="font-medium text-gray-700 dark:text-gray-300">{playerName}</span>
      </p>

      {/* Join form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm mb-8">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Join a Quiz
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().slice(0, 6));
              setError("");
            }}
            placeholder="Enter 6-digit code"
            maxLength={6}
            className={clsx(
              "flex-1 px-4 py-3 rounded-lg border text-center text-lg font-mono tracking-widest uppercase",
              "bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100",
              "placeholder:text-gray-400 dark:placeholder:text-gray-500",
              "focus:outline-none focus:ring-2 focus:ring-primary-500",
              error
                ? "border-red-400 dark:border-red-500"
                : "border-gray-300 dark:border-gray-600"
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleJoin();
            }}
          />
          <button
            onClick={handleJoin}
            disabled={joining || code.trim().length !== 6}
            className={clsx(
              "px-5 py-3 rounded-lg font-semibold text-white flex items-center gap-2 transition-colors",
              joining || code.trim().length !== 6
                ? "bg-gray-300 dark:bg-gray-600 cursor-not-allowed"
                : "bg-primary-600 hover:bg-primary-700"
            )}
          >
            {joining ? (
              <span className="animate-pulse">Joining...</span>
            ) : (
              <>
                Join
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-500 dark:text-red-400">{error}</p>
        )}
      </div>

      {/* Active/Recent Sessions */}
      {sessions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Active Sessions
          </h2>
          <div className="space-y-3">
            {sessions.map((s) => (
              <button
                key={s.code}
                onClick={() => {
                  setCode(s.code);
                  handleJoin();
                }}
                className={clsx(
                  "w-full flex items-center justify-between p-4 rounded-xl border transition-colors text-left",
                  "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700",
                  "hover:bg-gray-50 dark:hover:bg-gray-750 hover:border-primary-300 dark:hover:border-primary-600"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 truncate">
                      {s.title}
                    </h3>
                    <span
                      className={clsx(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        s.status === "waiting" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                        s.status === "active" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                        s.status === "completed" && "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                      )}
                    >
                      {s.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users size={14} />
                      {s.playerCount} players
                    </span>
                    <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                      {s.code}
                    </span>
                  </div>
                </div>
                <ArrowRight size={18} className="text-gray-400 dark:text-gray-500 ml-3 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {sessions.length === 0 && (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">
          <Gamepad2 size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">No active quiz sessions right now.</p>
          <p className="text-xs mt-1">Enter a code above to join when one starts!</p>
        </div>
      )}
    </div>
  );
}
