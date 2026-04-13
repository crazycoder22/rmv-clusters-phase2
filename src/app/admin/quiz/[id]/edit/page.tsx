"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/useRole";
import {
  ArrowLeft,
  Gamepad2,
  Plus,
  Trash2,
  Save,
  GripVertical,
  Check,
} from "lucide-react";
import clsx from "clsx";

interface Question {
  id?: string;
  text: string;
  options: string[];
  correctOption: number;
  timeLimit: number;
  sortOrder: number;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: Question[];
}

const TIME_OPTIONS = [10, 15, 20, 30, 45, 60];

const OPTION_COLORS = [
  {
    border: "border-red-400 dark:border-red-500",
    bg: "bg-red-50 dark:bg-red-900/10",
    ring: "focus:ring-red-400",
    label: "bg-red-500",
  },
  {
    border: "border-blue-400 dark:border-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/10",
    ring: "focus:ring-blue-400",
    label: "bg-blue-500",
  },
  {
    border: "border-green-400 dark:border-green-500",
    bg: "bg-green-50 dark:bg-green-900/10",
    ring: "focus:ring-green-400",
    label: "bg-green-500",
  },
  {
    border: "border-yellow-400 dark:border-yellow-500",
    bg: "bg-yellow-50 dark:bg-yellow-900/10",
    ring: "focus:ring-yellow-400",
    label: "bg-yellow-500",
  },
];

function emptyQuestion(sortOrder: number): Question {
  return {
    text: "",
    options: ["", "", "", ""],
    correctOption: 0,
    timeLimit: 20,
    sortOrder,
  };
}

export default function AdminQuizEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { canManageAnnouncements, isLoading: roleLoading } = useRole();
  const router = useRouter();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Editable fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    if (!roleLoading && !canManageAnnouncements()) router.replace("/");
  }, [roleLoading, canManageAnnouncements, router]);

  useEffect(() => {
    fetch(`/api/quiz/quizzes/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setQuiz(data);
        setTitle(data.title ?? "");
        setDescription(data.description ?? "");
        setQuestions(
          (data.questions ?? []).length > 0
            ? data.questions.map((q: Question, i: number) => ({
                ...q,
                sortOrder: q.sortOrder ?? i + 1,
              }))
            : [emptyQuestion(1)]
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  function updateQuestion(index: number, field: string, value: unknown) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q))
    );
  }

  function updateOption(qIndex: number, oIndex: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? { ...q, options: q.options.map((o, j) => (j === oIndex ? value : o)) }
          : q
      )
    );
  }

  function addQuestion() {
    setQuestions((prev) => [
      ...prev,
      emptyQuestion(prev.length + 1),
    ]);
  }

  function removeQuestion(index: number) {
    if (questions.length <= 1) return;
    setQuestions((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((q, i) => ({ ...q, sortOrder: i + 1 }))
    );
  }

  async function handleSave() {
    setError("");
    if (!title.trim()) {
      setError("Quiz title is required.");
      return;
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        setError(`Question ${i + 1} text is required.`);
        return;
      }
      if (q.options.some((o) => !o.trim())) {
        setError(`All options for Question ${i + 1} must be filled in.`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/quiz/quizzes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          questions: questions.map((q) => ({
            id: q.id,
            text: q.text.trim(),
            options: q.options.map((o) => o.trim()),
            correctOption: q.correctOption,
            timeLimit: q.timeLimit,
            sortOrder: q.sortOrder,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save quiz.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (roleLoading || loading) {
    return (
      <div className="py-12 text-center text-gray-400 dark:text-gray-500">
        Loading...
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="py-12 text-center text-gray-400 dark:text-gray-500">
        Quiz not found.
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Back link */}
        <Link
          href="/admin/quiz"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-primary-400 mb-5"
        >
          <ArrowLeft size={14} /> Back to quizzes
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Gamepad2
                size={20}
                className="text-indigo-600 dark:text-indigo-400"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Edit Quiz
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {questions.length} question{questions.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={clsx(
              "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors",
              saved
                ? "bg-green-600 text-white"
                : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-600"
            )}
          >
            {saved ? (
              <>
                <Check size={16} /> Saved!
              </>
            ) : (
              <>
                <Save size={16} /> {saving ? "Saving..." : "Save Quiz"}
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Quiz Details */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Quiz Details
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {questions.map((q, qIdx) => (
            <div
              key={qIdx}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
            >
              {/* Question header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <GripVertical
                    size={16}
                    className="text-gray-300 dark:text-gray-600"
                  />
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-bold">
                    {qIdx + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Question {qIdx + 1}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {/* Sort order */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-gray-400 dark:text-gray-500">
                      Order
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={q.sortOrder}
                      onChange={(e) =>
                        updateQuestion(
                          qIdx,
                          "sortOrder",
                          parseInt(e.target.value) || 1
                        )
                      }
                      className="w-14 px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded text-sm text-center"
                    />
                  </div>
                  {/* Time limit */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-gray-400 dark:text-gray-500">
                      Time
                    </label>
                    <select
                      value={q.timeLimit}
                      onChange={(e) =>
                        updateQuestion(
                          qIdx,
                          "timeLimit",
                          parseInt(e.target.value)
                        )
                      }
                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded text-sm"
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}s
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Delete */}
                  <button
                    onClick={() => removeQuestion(qIdx)}
                    disabled={questions.length <= 1}
                    className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Remove question"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Question text */}
              <input
                value={q.text}
                onChange={(e) => updateQuestion(qIdx, "text", e.target.value)}
                placeholder="Enter your question..."
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-4"
              />

              {/* Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {q.options.map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-2">
                    {/* Radio for correct answer */}
                    <input
                      type="radio"
                      name={`correct-${qIdx}`}
                      checked={q.correctOption === oIdx}
                      onChange={() =>
                        updateQuestion(qIdx, "correctOption", oIdx)
                      }
                      className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 focus:ring-indigo-500"
                      title={`Mark option ${oIdx + 1} as correct`}
                    />
                    <div className="flex-1 relative">
                      <span
                        className={clsx(
                          "absolute left-0 top-0 bottom-0 w-1 rounded-l-lg",
                          OPTION_COLORS[oIdx].label
                        )}
                      />
                      <input
                        value={opt}
                        onChange={(e) =>
                          updateOption(qIdx, oIdx, e.target.value)
                        }
                        placeholder={`Option ${oIdx + 1}`}
                        className={clsx(
                          "w-full pl-4 pr-3 py-2 border-2 rounded-lg text-sm dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:border-transparent transition-colors",
                          OPTION_COLORS[oIdx].border,
                          OPTION_COLORS[oIdx].bg,
                          OPTION_COLORS[oIdx].ring,
                          q.correctOption === oIdx &&
                            "ring-2 ring-green-400 dark:ring-green-500 border-green-400 dark:border-green-500"
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {q.correctOption >= 0 && (
                <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                  Correct: Option {q.correctOption + 1}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Add question button */}
        <button
          onClick={addQuestion}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-colors"
        >
          <Plus size={16} />
          Add Question
        </button>

        {/* Bottom save button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className={clsx(
              "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors",
              saved
                ? "bg-green-600 text-white"
                : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-600"
            )}
          >
            {saved ? (
              <>
                <Check size={16} /> Saved!
              </>
            ) : (
              <>
                <Save size={16} /> {saving ? "Saving..." : "Save Quiz"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
