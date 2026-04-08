"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, Loader2 } from "lucide-react";
import clsx from "clsx";

interface TambolaSession {
  id: string;
  code: string;
  title: string;
  status: "WAITING" | "ACTIVE" | "COMPLETED";
  playerCount: number;
}

export default function TambolaPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [sessions, setSessions] = useState<TambolaSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    fetch("/api/tambola/sessions")
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then((d) => setSessions(d.sessions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setJoinError("Please enter a valid game code");
      return;
    }
    router.push(`/tambola/${trimmed}`);
  };

  const activeSessions = sessions.filter(
    (s) => s.status === "WAITING" || s.status === "ACTIVE"
  );

  const statusBadge = (status: TambolaSession["status"]) => {
    if (status === "WAITING")
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
          Waiting
        </span>
      );
    if (status === "ACTIVE")
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          Live
        </span>
      );
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
        Ended
      </span>
    );
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Tambola
        </h1>
        <div className="w-5" />
      </div>

      {/* Join Game Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">
          Join Game
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Enter the game code shared by your host
        </p>
        <form onSubmit={handleJoin} className="space-y-3">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setJoinError("");
            }}
            placeholder="Enter code"
            maxLength={10}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-center text-xl font-mono font-bold tracking-[0.3em] uppercase bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 placeholder:tracking-normal placeholder:text-base placeholder:font-normal"
          />
          {joinError && (
            <p className="text-sm text-red-500 text-center">{joinError}</p>
          )}
          <button
            type="submit"
            disabled={!code.trim()}
            className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Join Game
          </button>
        </form>
      </div>

      {/* Active Games */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Active Games
        </h3>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : activeSessions.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              No active games right now
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
              Ask your host to start a game
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => router.push(`/tambola/${s.code}`)}
                className="w-full bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500 transition-colors text-left"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                    {s.title}
                  </span>
                  {statusBadge(s.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400 tracking-wider">
                    {s.code}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                    <Users size={12} />
                    {s.playerCount} players
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
