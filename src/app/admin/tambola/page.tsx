"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/useRole";
import {
  ArrowLeft,
  Dices,
  Plus,
  Copy,
  Check,
  Users,
  ChevronRight,
  Share2,
} from "lucide-react";
import clsx from "clsx";

interface TambolaSession {
  id: string;
  code: string;
  title: string;
  status: string;
  playerCount: number;
  createdAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  WAITING:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  ACTIVE:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  COMPLETED:
    "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

export default function AdminTambolaPage() {
  const { canManageAnnouncements, isLoading } = useRole();
  const router = useRouter();

  const [sessions, setSessions] = useState<TambolaSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isLoading && !canManageAnnouncements()) router.replace("/");
  }, [isLoading, canManageAnnouncements, router]);

  useEffect(() => {
    fetch("/api/tambola/sessions")
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    setError("");
    if (!title.trim()) {
      return setError("Game title is required.");
    }
    setCreating(true);
    try {
      const res = await fetch("/api/tambola/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create game.");
        return;
      }
      setCreatedCode(data.code);
      setSessions((prev) => [
        {
          id: data.id,
          code: data.code,
          title: data.title,
          status: "WAITING",
          playerCount: 0,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setTitle("");
    } finally {
      setCreating(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(createdCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp(code: string) {
    const msg = `Join Tambola! Go to https://www.rmvclustersphase2.in/tambola and enter code: ${code}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  }

  if (isLoading || loading) {
    return (
      <div className="py-12 text-center text-gray-400 dark:text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Back link */}
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-primary-400 mb-5"
        >
          <ArrowLeft size={14} /> Back to admin
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Dices size={20} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Tambola
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Create and manage Housie games
            </p>
          </div>
        </div>

        {/* Create Game Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Create Game
          </h2>
          <div className="flex gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Game title, e.g. Sunday Tambola"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 transition-colors"
            >
              <Plus size={16} />
              {creating ? "Creating..." : "Create Game"}
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">
              {error}
            </p>
          )}

          {/* Created code success box */}
          {createdCode && (
            <div className="mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5">
              <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                Game created! Share this code with players:
              </p>
              <p className="text-4xl font-mono font-bold text-green-800 dark:text-green-200 tracking-widest text-center my-3">
                {createdCode}
              </p>
              <div className="flex items-center justify-center gap-3 mt-3">
                <button
                  onClick={copyCode}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-green-300 dark:border-green-700 rounded-lg text-sm font-medium text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-gray-600 transition-colors"
                >
                  {copied ? (
                    <Check size={16} />
                  ) : (
                    <Copy size={16} />
                  )}
                  {copied ? "Copied!" : "Copy Code"}
                </button>
                <button
                  onClick={() => shareWhatsApp(createdCode)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  <Share2 size={16} />
                  Share on WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Games List */}
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Games
        </h2>
        {sessions.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <Dices size={40} className="mx-auto mb-3 opacity-20" />
            <p>No games yet. Create your first one!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/admin/tambola/${s.code}`}
                className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded">
                      {s.code}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {s.title}
                    </span>
                    <span
                      className={clsx(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        STATUS_STYLE[s.status] ?? STATUS_STYLE.WAITING
                      )}
                    >
                      {s.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {s.playerCount} players
                    </span>
                    <span>
                      {new Date(s.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
                <ChevronRight
                  size={16}
                  className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 shrink-0"
                />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
