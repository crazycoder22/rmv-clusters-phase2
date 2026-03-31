"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import clsx from "clsx";

interface QuestionForm {
  title: string;
  description: string;
  type: "SINGLE" | "MULTIPLE";
  options: string[];
  expanded: boolean;
}

const emptyQuestion = (): QuestionForm => ({
  title: "",
  description: "",
  type: "SINGLE",
  options: ["", ""],
  expanded: true,
});

export default function CreateSurveyPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const { canManagePolls } = useRole();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [questions, setQuestions] = useState<QuestionForm[]>([emptyQuestion()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authStatus !== "loading" && !canManagePolls()) {
      router.replace("/polls");
    }
  }, [authStatus, canManagePolls, router]);

  const addQuestion = () =>
    setQuestions([...questions, emptyQuestion()]);

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: string, value: unknown) => {
    const updated = [...questions];
    (updated[index] as unknown as Record<string, unknown>)[field] = value;
    setQuestions(updated);
  };

  const addOption = (qIndex: number) => {
    const updated = [...questions];
    updated[qIndex].options.push("");
    setQuestions(updated);
  };

  const removeOption = (qIndex: number, oIndex: number) => {
    if (questions[qIndex].options.length <= 2) return;
    const updated = [...questions];
    updated[qIndex].options = updated[qIndex].options.filter(
      (_, i) => i !== oIndex
    );
    setQuestions(updated);
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...questions];
    updated[qIndex].options[oIndex] = value;
    setQuestions(updated);
  };

  const toggleExpanded = (index: number) => {
    const updated = [...questions];
    updated[index].expanded = !updated[index].expanded;
    setQuestions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.title.trim()) {
        setError(`Question ${i + 1} needs a title`);
        return;
      }
      const validOptions = q.options.filter((o) => o.trim());
      if (validOptions.length < 2) {
        setError(`Question ${i + 1} needs at least 2 options`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          isAnonymous,
          deadline,
          questions: questions.map((q) => ({
            title: q.title,
            description: q.description || undefined,
            type: q.type,
            options: q.options.filter((o) => o.trim()),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create survey");
        return;
      }
      router.push(`/surveys/${data.survey.id}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/polls"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-6"
      >
        <ArrowLeft size={16} />
        Back to Polls & Surveys
      </Link>

      <h1 className="text-2xl font-bold text-primary-800 mb-6">
        Create New Survey
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Survey Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Survey Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g., MyGate Adoption Survey"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Briefly describe the purpose of this survey..."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          {/* Deadline */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deadline <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>

          {/* Anonymous */}
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Anonymous</span>
            </label>
          </div>
        </div>

        {/* Questions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">
              Questions <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-gray-400">
              {questions.length} question{questions.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-4">
            {questions.map((q, qIdx) => (
              <div
                key={qIdx}
                className="border border-gray-200 rounded-xl overflow-hidden"
              >
                {/* Question header */}
                <div
                  className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer"
                  onClick={() => toggleExpanded(qIdx)}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold">
                      {qIdx + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-700 truncate max-w-[250px]">
                      {q.title || "Untitled Question"}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({q.type === "MULTIPLE" ? "Multi" : "Single"})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeQuestion(qIdx);
                        }}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <X size={16} />
                      </button>
                    )}
                    {q.expanded ? (
                      <ChevronUp size={16} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={16} className="text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Question body */}
                {q.expanded && (
                  <div className="p-4 space-y-4">
                    <div>
                      <input
                        type="text"
                        value={q.title}
                        onChange={(e) =>
                          updateQuestion(qIdx, "title", e.target.value)
                        }
                        placeholder="Question title"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                      />
                    </div>

                    <div>
                      <input
                        type="text"
                        value={q.description}
                        onChange={(e) =>
                          updateQuestion(qIdx, "description", e.target.value)
                        }
                        placeholder="Description (optional)"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm text-gray-500"
                      />
                    </div>

                    {/* Type */}
                    <div className="flex gap-4">
                      {(["SINGLE", "MULTIPLE"] as const).map((t) => (
                        <label
                          key={t}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="radio"
                            checked={q.type === t}
                            onChange={() =>
                              updateQuestion(qIdx, "type", t)
                            }
                            className="text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-700">
                            {t === "SINGLE" ? "Single Choice" : "Multiple Choice"}
                          </span>
                        </label>
                      ))}
                    </div>

                    {/* Options */}
                    <div className="space-y-2">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <div
                            className={clsx(
                              "w-4 h-4 border-2 border-gray-300 shrink-0",
                              q.type === "SINGLE"
                                ? "rounded-full"
                                : "rounded"
                            )}
                          />
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) =>
                              updateOption(qIdx, oIdx, e.target.value)
                            }
                            placeholder={`Option ${oIdx + 1}`}
                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removeOption(qIdx, oIdx)}
                            disabled={q.options.length <= 2}
                            className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOption(qIdx)}
                        className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                      >
                        <Plus size={14} />
                        Add Option
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addQuestion}
            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:border-primary-400 hover:text-primary-600 transition-colors w-full justify-center"
          >
            <Plus size={16} />
            Add Question
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Creating Survey..." : "Create Survey"}
        </button>
      </form>
    </div>
  );
}
