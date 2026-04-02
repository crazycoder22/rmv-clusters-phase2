"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Plus,
  Clock,
  Users,
  CheckCircle2,
  ClipboardList,
  ChevronDown,
} from "lucide-react";
import clsx from "clsx";
import { useRole } from "@/hooks/useRole";

interface PollListItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  isAnonymous: boolean;
  deadline: string;
  status: string;
  surveyId: string | null;
  createdBy: { name: string; block: number; flatNumber: string };
  createdAt: string;
  _count: { votes: number };
  options: { id: string; text: string }[];
}

interface SurveyListItem {
  id: string;
  title: string;
  description: string | null;
  isAnonymous: boolean;
  deadline: string;
  status: string;
  createdBy: { name: string; block: number; flatNumber: string };
  createdAt: string;
  _count: { polls: number };
  polls: { id: string; title: string }[];
}

export default function PollsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const { canManagePolls } = useRole();
  const [polls, setPolls] = useState<PollListItem[]>([]);
  const [surveys, setSurveys] = useState<SurveyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ACTIVE" | "CLOSED" | "ALL">("ACTIVE");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (authStatus !== "loading" && !session?.user?.isApproved) {
      router.replace("/");
    }
  }, [authStatus, session, router]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    setLoading(true);
    const params = filter !== "ALL" ? `?status=${filter}` : "";

    Promise.all([
      fetch(`/api/polls${params}`).then((res) =>
        res.ok ? res.json() : { polls: [] }
      ),
      fetch(`/api/surveys${params}`).then((res) =>
        res.ok ? res.json() : { surveys: [] }
      ),
    ])
      .then(([pollsData, surveysData]) => {
        // Filter out polls that belong to a survey
        setPolls(
          (pollsData.polls || []).filter(
            (p: PollListItem) => !p.surveyId
          )
        );
        setSurveys(surveysData.surveys || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authStatus, filter]);

  if (authStatus === "loading" || !session?.user?.isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  const isExpired = (deadline: string) => new Date(deadline) < new Date();
  const hasContent = polls.length > 0 || surveys.length > 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 size={24} className="text-primary-600" />
          <h1 className="text-2xl font-bold text-primary-800">
            Polls & Surveys
          </h1>
        </div>
        {canManagePolls() && (
          <div className="relative">
            <button
              onClick={() => setCreateOpen(!createOpen)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              <Plus size={16} />
              Create
              <ChevronDown size={14} />
            </button>
            {createOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                <Link
                  href="/admin/polls/new"
                  onClick={() => setCreateOpen(false)}
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Single Poll
                </Link>
                <Link
                  href="/admin/surveys/new"
                  onClick={() => setCreateOpen(false)}
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Multi-Question Survey
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {(["ACTIVE", "CLOSED", "ALL"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={clsx(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              filter === tab
                ? "bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            {tab === "ALL" ? "All" : tab === "ACTIVE" ? "Active" : "Closed"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 dark:text-gray-500 text-sm">Loading...</p>
      ) : !hasContent ? (
        <div className="text-center py-16">
          <BarChart3 size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-400 dark:text-gray-500">No polls or surveys found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Surveys first */}
          {surveys.map((survey) => {
            const expired = isExpired(survey.deadline);
            const isClosed = survey.status === "CLOSED" || expired;
            return (
              <Link
                key={`survey-${survey.id}`}
                href={`/surveys/${survey.id}`}
                className="block bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-indigo-100 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={clsx(
                          "inline-block px-2 py-0.5 text-xs font-medium rounded-full",
                          isClosed
                            ? "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                        )}
                      >
                        {isClosed ? "Closed" : "Active"}
                      </span>
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
                        Survey &middot; {survey._count.polls} questions
                      </span>
                      {survey.isAnonymous && (
                        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                          Anonymous
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">
                      {survey.title}
                    </h3>
                    {survey.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
                        {survey.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock size={13} />
                        {isClosed
                          ? "Ended"
                          : `Ends ${new Date(survey.deadline).toLocaleDateString()}`}
                      </span>
                      <span>by {survey.createdBy.name}</span>
                    </div>
                  </div>
                  <ClipboardList
                    size={20}
                    className={clsx(
                      "shrink-0 mt-1",
                      isClosed ? "text-gray-300 dark:text-gray-600" : "text-indigo-400"
                    )}
                  />
                </div>
              </Link>
            );
          })}

          {/* Standalone polls */}
          {polls.map((poll) => {
            const expired = isExpired(poll.deadline);
            const isClosed = poll.status === "CLOSED" || expired;
            return (
              <Link
                key={`poll-${poll.id}`}
                href={`/polls/${poll.id}`}
                className="block bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-500 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={clsx(
                          "inline-block px-2 py-0.5 text-xs font-medium rounded-full",
                          isClosed
                            ? "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                        )}
                      >
                        {isClosed ? "Closed" : "Active"}
                      </span>
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">
                        {poll.type === "MULTIPLE"
                          ? "Multiple Choice"
                          : "Single Choice"}
                      </span>
                      {poll.isAnonymous && (
                        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                          Anonymous
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">
                      {poll.title}
                    </h3>
                    {poll.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
                        {poll.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users size={13} />
                        {poll._count.votes} vote
                        {poll._count.votes !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={13} />
                        {isClosed
                          ? "Ended"
                          : `Ends ${new Date(poll.deadline).toLocaleDateString()}`}
                      </span>
                      <span>by {poll.createdBy.name}</span>
                    </div>
                  </div>
                  {!isClosed && (
                    <CheckCircle2
                      size={20}
                      className="text-primary-400 shrink-0 mt-1"
                    />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
