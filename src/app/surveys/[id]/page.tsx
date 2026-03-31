"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Users,
  CheckCircle2,
  ClipboardList,
  Trash2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import clsx from "clsx";
import { useRole } from "@/hooks/useRole";

interface PollOption {
  id: string;
  text: string;
  sortOrder: number;
  voteCount: number;
  voters: { name: string; block: number; flatNumber: string }[];
}

interface Question {
  id: string;
  title: string;
  description: string | null;
  type: string;
  sortOrder: number;
  totalVotes: number;
  totalOptionVotes: number;
  options: PollOption[];
  myVotes: string[];
}

interface SurveyInfo {
  id: string;
  title: string;
  description: string | null;
  isAnonymous: boolean;
  deadline: string;
  status: string;
  createdBy: { name: string; block: number; flatNumber: string };
  createdAt: string;
  questionCount: number;
}

export default function SurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const { canManagePolls } = useRole();

  const [survey, setSurvey] = useState<SurveyInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Per-question selections: { pollId: optionId[] }
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // For results view
  const [expandedOption, setExpandedOption] = useState<string | null>(null);

  const [closing, setClosing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (authStatus !== "loading" && !session?.user?.isApproved) {
      router.replace("/");
    }
  }, [authStatus, session, router]);

  const fetchSurvey = () => {
    fetch(`/api/surveys/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data) => {
        setSurvey(data.survey);
        setQuestions(data.questions);
        setHasCompleted(data.hasCompleted);
        setIsClosed(data.isClosed);
      })
      .catch(() => setError("Survey not found"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    fetchSurvey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, id]);

  const showResults = hasCompleted || isClosed || submitted;

  const handleSelect = (pollId: string, optionId: string, type: string) => {
    setSelections((prev) => {
      const current = prev[pollId] || [];
      if (type === "SINGLE") {
        return { ...prev, [pollId]: [optionId] };
      } else {
        return {
          ...prev,
          [pollId]: current.includes(optionId)
            ? current.filter((id) => id !== optionId)
            : [...current, optionId],
        };
      }
    });
  };

  const handleSubmit = async () => {
    // Check all questions answered
    const unanswered = questions.filter(
      (q) => !(selections[q.id]?.length > 0) && !(q.myVotes.length > 0)
    );
    if (unanswered.length > 0) {
      setError(
        `Please answer all questions. Missing: Q${unanswered.map((q) => q.sortOrder + 1).join(", Q")}`
      );
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/surveys/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: selections }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit");
        return;
      }
      setSubmitted(true);
      // Refresh to show results
      setLoading(true);
      fetchSurvey();
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async () => {
    if (!confirm("Close this survey? Residents will no longer be able to respond."))
      return;
    setClosing(true);
    try {
      const res = await fetch(`/api/surveys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      if (res.ok) {
        setIsClosed(true);
        if (survey) setSurvey({ ...survey, status: "CLOSED" });
      }
    } catch {
      // silently fail
    } finally {
      setClosing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this survey and all its questions? This cannot be undone."))
      return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/surveys/${id}`, { method: "DELETE" });
      if (res.ok) router.push("/polls");
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
    }
  };

  if (loading || authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error && !survey) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <p className="text-gray-500">{error}</p>
        <Link
          href="/polls"
          className="text-primary-600 hover:underline text-sm mt-2 inline-block"
        >
          Back to Polls & Surveys
        </Link>
      </div>
    );
  }

  if (!survey) return null;

  const deadlineDate = new Date(survey.deadline);
  const now = new Date();
  const hoursLeft = Math.max(
    0,
    Math.floor((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60))
  );
  const daysLeft = Math.floor(hoursLeft / 24);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/polls"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-6"
      >
        <ArrowLeft size={16} />
        Back to Polls & Surveys
      </Link>

      {/* Survey Header */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={clsx(
              "inline-block px-2 py-0.5 text-xs font-medium rounded-full",
              isClosed
                ? "bg-gray-100 text-gray-500"
                : "bg-green-100 text-green-700"
            )}
          >
            {isClosed ? "Closed" : "Active"}
          </span>
          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">
            {survey.questionCount} question{survey.questionCount !== 1 ? "s" : ""}
          </span>
          {survey.isAnonymous && (
            <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
              Anonymous
            </span>
          )}
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-1">
          {survey.title}
        </h1>
        {survey.description && (
          <p className="text-gray-500 text-sm mb-3">{survey.description}</p>
        )}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Clock size={13} />
            {isClosed
              ? "Ended"
              : daysLeft > 0
              ? `${daysLeft}d ${hoursLeft % 24}h left`
              : hoursLeft > 0
              ? `${hoursLeft}h left`
              : "Ending soon"}
          </span>
          <span>by {survey.createdBy.name}</span>
        </div>

        {hasCompleted && (
          <p className="text-xs text-primary-600 mt-3 flex items-center gap-1">
            <CheckCircle2 size={14} />
            You have completed this survey
          </p>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((question, idx) => {
          const hasVoted = question.myVotes.length > 0;
          const showQuestionResults = showResults || hasVoted;
          const selected = selections[question.id] || [];

          return (
            <div
              key={question.id}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
            >
              <div className="flex items-start gap-3 mb-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-sm font-bold shrink-0">
                  {idx + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-gray-800">
                    {question.title}
                  </h3>
                  {question.description && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {question.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {question.type === "MULTIPLE"
                      ? "Select one or more"
                      : "Select one"}
                  </p>
                </div>
              </div>

              {showQuestionResults ? (
                /* Results view */
                <div className="space-y-2">
                  {question.options.map((option) => {
                    const percentage =
                      question.totalOptionVotes > 0
                        ? Math.round(
                            (option.voteCount / question.totalOptionVotes) * 100
                          )
                        : 0;
                    const isMyVote = question.myVotes.includes(option.id);
                    const isExpanded = expandedOption === option.id;

                    return (
                      <div key={option.id}>
                        <div
                          className={clsx(
                            "relative rounded-lg border p-3 overflow-hidden",
                            isMyVote
                              ? "border-primary-300 bg-primary-50/30"
                              : "border-gray-100"
                          )}
                        >
                          <div
                            className={clsx(
                              "absolute inset-y-0 left-0 transition-all duration-500",
                              isMyVote
                                ? "bg-primary-100/60"
                                : "bg-gray-100/60"
                            )}
                            style={{ width: `${percentage}%` }}
                          />
                          <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isMyVote && (
                                <CheckCircle2
                                  size={16}
                                  className="text-primary-600 shrink-0"
                                />
                              )}
                              <span className="text-sm font-medium text-gray-800">
                                {option.text}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-700">
                                {percentage}%
                              </span>
                              <span className="text-xs text-gray-400">
                                ({option.voteCount})
                              </span>
                            </div>
                          </div>
                        </div>
                        {!survey.isAnonymous && option.voters.length > 0 && (
                          <button
                            onClick={() =>
                              setExpandedOption(isExpanded ? null : option.id)
                            }
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-1 ml-1"
                          >
                            {isExpanded ? (
                              <ChevronUp size={12} />
                            ) : (
                              <ChevronDown size={12} />
                            )}
                            {option.voters.length} voter
                            {option.voters.length !== 1 ? "s" : ""}
                          </button>
                        )}
                        {isExpanded && !survey.isAnonymous && (
                          <div className="mt-1 ml-6 space-y-0.5">
                            {option.voters.map((v, i) => (
                              <p key={i} className="text-xs text-gray-500">
                                {v.name}{" "}
                                <span className="text-gray-400">
                                  (Block {v.block}, {v.flatNumber})
                                </span>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Voting view */
                <div className="space-y-2">
                  {question.options.map((option) => (
                    <button
                      key={option.id}
                      onClick={() =>
                        handleSelect(question.id, option.id, question.type)
                      }
                      className={clsx(
                        "w-full text-left p-3 rounded-lg border transition-all",
                        selected.includes(option.id)
                          ? "border-primary-400 bg-primary-50 ring-1 ring-primary-200"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={clsx(
                            "w-5 h-5 flex items-center justify-center shrink-0 border-2 transition-colors",
                            question.type === "SINGLE"
                              ? "rounded-full"
                              : "rounded",
                            selected.includes(option.id)
                              ? "border-primary-500 bg-primary-500"
                              : "border-gray-300"
                          )}
                        >
                          {selected.includes(option.id) && (
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm text-gray-700">
                          {option.text}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit button */}
      {!showResults && !isClosed && (
        <div className="mt-6">
          {error && (
            <p className="text-sm text-red-600 mb-3">{error}</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Submitting..." : "Submit Survey"}
          </button>
        </div>
      )}

      {/* Admin controls */}
      {canManagePolls() && (
        <div className="mt-6 flex items-center gap-3">
          {!isClosed && (
            <button
              onClick={handleClose}
              disabled={closing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
            >
              <XCircle size={15} />
              {closing ? "Closing..." : "Close Survey"}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            <Trash2 size={15} />
            {deleting ? "Deleting..." : "Delete Survey"}
          </button>
        </div>
      )}
    </div>
  );
}
