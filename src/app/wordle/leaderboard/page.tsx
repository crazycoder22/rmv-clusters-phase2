"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, Medal, Loader2 } from "lucide-react";

interface LeaderboardEntry {
  id: string;
  name: string;
  block: number;
  flatNumber: string;
  totalWins: number;
  totalPlayed: number;
  totalScore: number;
  avgAttempts: number;
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const currentPlayerId = typeof window !== "undefined" ? localStorage.getItem("wordle_player_id") : null;

  useEffect(() => {
    fetch("/api/wordle/leaderboard")
      .then((res) => (res.ok ? res.json() : { leaderboard: [] }))
      .then((data) => setEntries(data.leaderboard || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getRankIcon = (rank: number) => {
    if (rank === 0) return <Trophy size={18} className="text-yellow-500" />;
    if (rank === 1) return <Medal size={18} className="text-gray-400" />;
    if (rank === 2) return <Medal size={18} className="text-amber-700" />;
    return <span className="text-sm font-medium text-gray-400 w-[18px] text-center">{rank + 1}</span>;
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <Link href="/wordle" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Leaderboard</h1>
        <div className="w-5" />
      </div>

      {/* Scoring info */}
      <div className="mb-4 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Score per win: 1st guess = 6 pts, 2nd = 5, 3rd = 4, 4th = 3, 5th = 2, 6th = 1
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-primary-600" size={28} />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12">
          <Trophy size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No games played yet!</p>
          <Link
            href="/wordle"
            className="inline-block mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Be the first to play
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 sm:gap-3 px-3 sm:px-4 py-3 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <span>#</span>
            <span>Player</span>
            <span className="text-center">Score</span>
            <span className="text-center">Wins</span>
            <span className="text-center hidden sm:block">Played</span>
            <span className="text-center">Avg</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {entries.map((entry, i) => (
              <div
                key={entry.id}
                className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 sm:gap-3 px-3 sm:px-4 py-3 items-center ${
                  entry.id === currentPlayerId
                    ? "bg-primary-50/50 dark:bg-primary-900/20"
                    : ""
                }`}
              >
                <div className="flex items-center justify-center w-6">
                  {getRankIcon(i)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {entry.name}
                    {entry.id === currentPlayerId && (
                      <span className="ml-1.5 text-xs text-primary-600 dark:text-primary-400">(You)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    Block {entry.block}, {entry.flatNumber}
                  </p>
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                    {entry.totalScore}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                    {entry.totalWins}
                  </span>
                </div>
                <div className="text-center hidden sm:block">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {entry.totalPlayed}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {entry.avgAttempts > 0 ? entry.avgAttempts : "-"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
