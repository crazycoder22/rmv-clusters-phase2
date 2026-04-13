"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/useRole";
import {
  ArrowLeft,
  Gamepad2,
  Plus,
  Trash2,
  Edit,
  Play,
  ChevronRight,
  Users,
  HelpCircle,
  Calendar,
} from "lucide-react";
import clsx from "clsx";

interface Quiz {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  sessionCount: number;
  createdAt: string;
}

export default function AdminQuizPage() {
  const { canManageAnnouncements, isLoading } = useRole();
  const router = useRouter();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !canManageAnnouncements()) router.replace("/");
  }, [isLoading, canManageAnnouncements, router]);

  useEffect(() => {
    fetch("/api/quiz/quizzes")
      .then((r) => r.json())
      .then((d) => setQuizzes(d.quizzes ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    setError("");
    if (!title.trim()) {
      return setError("Quiz title is required.");
    }
    setCreating(true);
    try {
      const res = await fetch("/api/quiz/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create quiz.");
        return;
      }
      setQuizzes((prev) => [
        {
          id: data.id,
          title: data.title,
          description: data.description ?? "",
          questionCount: 0,
          sessionCount: 0,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setTitle("");
      setDescription("");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(quizId: string) {
    if (!confirm("Are you sure you want to delete this quiz?")) return;
    setDeleting(quizId);
    try {
      const res = await fetch(`/api/quiz/quizzes/${quizId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
      }
    } finally {
      setDeleting(null);
    }
  }

  async function handleStartSession(quizId: string) {
    setStarting(quizId);
    try {
      const res = await fetch("/api/quiz/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId }),
      });
      const data = await res.json();
      if (res.ok && data.code) {
        router.push(`/admin/quiz/session/${data.code}`);
      } else {
        setError(data.error || "Failed to start session.");
      }
    } finally {
      setStarting(null);
    }
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
          <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Gamepad2
              size={20}
              className="text-indigo-600 dark:text-indigo-400"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Quiz Manager
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Create and manage Kahoot-style quizzes
            </p>
          </div>
        </div>

        {/* Create Quiz Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Create Quiz
          </h2>
          <div className="space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Quiz title, e.g. Community Trivia Night"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 transition-colors"
            >
              <Plus size={16} />
              {creating ? "Creating..." : "Create Quiz"}
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">
              {error}
            </p>
          )}
        </div>

        {/* Quizzes List */}
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Quizzes
        </h2>
        {quizzes.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <Gamepad2 size={40} className="mx-auto mb-3 opacity-20" />
            <p>No quizzes yet. Create your first one!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {quizzes.map((q) => (
              <div
                key={q.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {q.title}
                    </h3>
                    {q.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                        {q.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <HelpCircle size={13} />
                        {q.questionCount} questions
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={13} />
                        {q.sessionCount} sessions
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={13} />
                        {new Date(q.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/admin/quiz/${q.id}/edit`}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Edit size={14} />
                      Edit
                    </Link>
                    <button
                      onClick={() => handleStartSession(q.id)}
                      disabled={starting === q.id || q.questionCount === 0}
                      className={clsx(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                        q.questionCount === 0
                          ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                          : "bg-green-600 text-white hover:bg-green-700"
                      )}
                      title={
                        q.questionCount === 0
                          ? "Add questions before starting"
                          : undefined
                      }
                    >
                      <Play size={14} />
                      {starting === q.id ? "Starting..." : "Start"}
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      disabled={deleting === q.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
