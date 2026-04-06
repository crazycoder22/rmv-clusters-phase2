"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Clock,
  Users,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  User,
  UserPlus,
} from "lucide-react";
import clsx from "clsx";
import { useRole } from "@/hooks/useRole";

interface Voter {
  name: string;
  block: number;
  flat: string;
  email: string;
  isGuest: boolean;
  votedAt: string;
}

interface PollOption {
  id: string;
  text: string;
  sortOrder: number;
  voteCount: number;
  voters: Voter[];
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

export default function SurveyResultsPage({
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
  const [totalRespondents, setTotalRespondents] = useState(0);
  const [isClosed, setIsClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session?.user?.isApproved) {
      router.replace("/");
      return;
    }

    fetch(`/api/admin/surveys/${id}/results`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data) => {
        setSurvey(data.survey);
        setQuestions(data.questions);
        setTotalRespondents(data.totalRespondents);
        setIsClosed(data.isClosed);
      })
      .catch(() => setError("Survey not found or access denied"))
      .finally(() => setLoading(false));
  }, [authStatus, session, id, router]);

  const toggleOption = (optionId: string) => {
    setExpandedOptions((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
  };

  if (loading || authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          {error || "Survey not found"}
        </p>
        <Link
          href="/polls"
          className="text-primary-600 hover:underline text-sm mt-2 inline-block"
        >
          Back to Polls &amp; Surveys
        </Link>
      </div>
    );
  }

  const deadlineDate = new Date(survey.deadline);
  const now = new Date();
  const hoursLeft = Math.max(
    0,
    Math.floor((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60))
  );
  const daysLeft = Math.floor(hoursLeft / 24);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/polls"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-6"
      >
        <ArrowLeft size={16} /> Back to Polls &amp; Surveys
      </Link>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                <BarChart3 size={12} />
                Results
              </span>
              <span
                className={clsx(
                  "inline-block px-2 py-0.5 text-xs font-medium rounded-full",
                  isClosed
                    ? "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                    : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                )}
              >
                {isClosed ? "Closed" : "Active"}
              </span>
              {survey.isAnonymous && (
                <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                  Anonymous
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">
              {survey.title}
            </h1>
            {survey.description && (
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
                {survey.description}
              </p>
            )}
            <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
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
          </div>

          {/* Stats */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <Users size={16} className="text-primary-500" />
              {totalRespondents} respondent
              {totalRespondents !== 1 ? "s" : ""}
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {survey.questionCount} question
              {survey.questionCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* View survey link */}
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
          <Link
            href={`/surveys/${survey.id}`}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            View survey page →
          </Link>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-5">
        {questions.map((question, idx) => {
          const maxVotes = Math.max(
            ...question.options.map((o) => o.voteCount),
            1
          );

          return (
            <div
              key={question.id}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700"
            >
              {/* Question header */}
              <div className="flex items-start gap-3 mb-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-sm font-bold shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                    {question.title}
                  </h3>
                  {question.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {question.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {question.type === "MULTIPLE"
                      ? "Multiple choice"
                      : "Single choice"}{" "}
                    · {question.totalOptionVotes} vote
                    {question.totalOptionVotes !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Options with results */}
              <div className="space-y-2.5">
                {question.options.map((option) => {
                  const percentage =
                    question.totalOptionVotes > 0
                      ? Math.round(
                          (option.voteCount / question.totalOptionVotes) * 100
                        )
                      : 0;
                  const isWinner = option.voteCount === maxVotes && maxVotes > 0;
                  const isExpanded = expandedOptions.has(option.id);

                  return (
                    <div key={option.id}>
                      <div
                        className={clsx(
                          "relative rounded-lg border p-3 overflow-hidden",
                          isWinner
                            ? "border-primary-300 dark:border-primary-700 bg-primary-50/20 dark:bg-primary-900/10"
                            : "border-gray-100 dark:border-gray-700"
                        )}
                      >
                        {/* Fill bar */}
                        <div
                          className={clsx(
                            "absolute inset-y-0 left-0 transition-all duration-500",
                            isWinner
                              ? "bg-primary-100/60 dark:bg-primary-900/30"
                              : "bg-gray-100/60 dark:bg-gray-700/40"
                          )}
                          style={{ width: `${percentage}%` }}
                        />

                        <div className="relative flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isWinner && (
                              <CheckCircle2
                                size={16}
                                className="text-primary-600 dark:text-primary-400 shrink-0"
                              />
                            )}
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                              {option.text}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                              {percentage}%
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              ({option.voteCount})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Voter list toggle */}
                      {!survey.isAnonymous && option.voters.length > 0 && (
                        <>
                          <button
                            onClick={() => toggleOption(option.id)}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 mt-1 ml-1"
                          >
                            {isExpanded ? (
                              <ChevronUp size={12} />
                            ) : (
                              <ChevronDown size={12} />
                            )}
                            {option.voters.length} voter
                            {option.voters.length !== 1 ? "s" : ""}
                          </button>

                          {isExpanded && (
                            <div className="mt-1.5 ml-2 border-l-2 border-gray-100 dark:border-gray-700 pl-3 space-y-1">
                              {option.voters.map((v, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-2 text-xs"
                                >
                                  {v.isGuest ? (
                                    <UserPlus
                                      size={12}
                                      className="text-amber-500 dark:text-amber-400 shrink-0"
                                    />
                                  ) : (
                                    <User
                                      size={12}
                                      className="text-gray-400 dark:text-gray-500 shrink-0"
                                    />
                                  )}
                                  <span className="text-gray-700 dark:text-gray-300">
                                    {v.name}
                                  </span>
                                  <span className="text-gray-400 dark:text-gray-500">
                                    Block {v.block}, {v.flat}
                                  </span>
                                  {v.isGuest && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                      Guest
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {survey.isAnonymous && option.voteCount > 0 && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 ml-1 italic">
                          Anonymous — voter names hidden
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
