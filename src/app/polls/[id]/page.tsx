"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Clock,
  Users,
  ArrowLeft,
  CheckCircle2,
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

interface PollDetail {
  id: string;
  title: string;
  description: string | null;
  type: string;
  isAnonymous: boolean;
  deadline: string;
  status: string;
  createdBy: { name: string; block: number; flatNumber: string };
  createdAt: string;
  totalVotes: number;
  options: PollOption[];
}

export default function PollDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const { canManagePolls } = useRole();

  const [poll, setPoll] = useState<PollDetail | null>(null);
  const [myVotes, setMyVotes] = useState<string[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState("");
  const [expandedOption, setExpandedOption] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (authStatus !== "loading" && !session?.user?.isApproved) {
      router.replace("/");
    }
  }, [authStatus, session, router]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    fetch(`/api/polls/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data) => {
        setPoll(data.poll);
        setMyVotes(data.myVotes || []);
      })
      .catch(() => setError("Poll not found"))
      .finally(() => setLoading(false));
  }, [authStatus, id]);

  const hasVoted = myVotes.length > 0;
  const isExpired = poll ? new Date(poll.deadline) < new Date() : false;
  const isClosed = poll ? poll.status === "CLOSED" || isExpired : false;
  const showResults = hasVoted || isClosed;
  const totalVoters = poll
    ? new Set(poll.options.flatMap((o) => o.voters.map((v) => v.name))).size
    : 0;
  // For vote counts, we count total individual option votes
  const totalOptionVotes = poll
    ? poll.options.reduce((sum, o) => sum + o.voteCount, 0)
    : 0;

  const handleSelect = (optionId: string) => {
    if (poll?.type === "SINGLE") {
      setSelectedOptions([optionId]);
    } else {
      setSelectedOptions((prev) =>
        prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId]
      );
    }
  };

  const handleVote = async () => {
    if (selectedOptions.length === 0) return;
    setVoting(true);
    setError("");
    try {
      const res = await fetch(`/api/polls/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIds: selectedOptions }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to vote");
        return;
      }
      // Refresh poll data
      const refreshRes = await fetch(`/api/polls/${id}`);
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setPoll(refreshData.poll);
        setMyVotes(refreshData.myVotes || []);
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setVoting(false);
    }
  };

  const handleClose = async () => {
    if (!confirm("Close this poll? Residents will no longer be able to vote."))
      return;
    setClosing(true);
    try {
      const res = await fetch(`/api/polls/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      if (res.ok && poll) {
        setPoll({ ...poll, status: "CLOSED" });
      }
    } catch {
      // silently fail
    } finally {
      setClosing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this poll? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/polls/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/polls");
      }
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
    }
  };

  if (loading || authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (error && !poll) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <p className="text-gray-500 dark:text-gray-400">{error}</p>
        <Link
          href="/polls"
          className="text-primary-600 hover:underline text-sm mt-2 inline-block"
        >
          Back to Polls
        </Link>
      </div>
    );
  }

  if (!poll) return null;

  const deadlineDate = new Date(poll.deadline);
  const now = new Date();
  const hoursLeft = Math.max(
    0,
    Math.floor((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60))
  );
  const daysLeft = Math.floor(hoursLeft / 24);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/polls"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-gray-300 mb-6"
      >
        <ArrowLeft size={16} />
        Back to Polls
      </Link>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
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
              {poll.type === "MULTIPLE" ? "Multiple Choice" : "Single Choice"}
            </span>
            {poll.isAnonymous && (
              <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                Anonymous
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">
            {poll.title}
          </h1>
          {poll.description && (
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">{poll.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-1">
              <Users size={13} />
              {poll.isAnonymous
                ? `${poll.totalVotes} vote${poll.totalVotes !== 1 ? "s" : ""}`
                : `${totalVoters} voter${totalVoters !== 1 ? "s" : ""}`}
            </span>
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
            <span>by {poll.createdBy.name}</span>
          </div>
        </div>

        {/* Voting or Results */}
        {showResults ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Results
            </h3>
            {poll.options.map((option) => {
              const percentage =
                totalOptionVotes > 0
                  ? Math.round((option.voteCount / totalOptionVotes) * 100)
                  : 0;
              const isMyVote = myVotes.includes(option.id);
              const isExpanded = expandedOption === option.id;

              return (
                <div key={option.id}>
                  <div
                    className={clsx(
                      "relative rounded-lg border p-3 overflow-hidden",
                      isMyVote
                        ? "border-primary-300 bg-primary-50/30 dark:border-primary-500 dark:bg-primary-900/20"
                        : "border-gray-100 dark:border-gray-700"
                    )}
                  >
                    {/* Background bar */}
                    <div
                      className={clsx(
                        "absolute inset-y-0 left-0 transition-all duration-500",
                        isMyVote
                          ? "bg-primary-100/60 dark:bg-primary-800/30"
                          : "bg-gray-100/60 dark:bg-gray-700/60"
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
                  {/* Voter list (non-anonymous) */}
                  {!poll.isAnonymous && option.voters.length > 0 && (
                    <button
                      onClick={() =>
                        setExpandedOption(isExpanded ? null : option.id)
                      }
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
                  )}
                  {isExpanded && !poll.isAnonymous && (
                    <div className="mt-1 ml-6 space-y-0.5">
                      {option.voters.map((v, i) => (
                        <p key={i} className="text-xs text-gray-500 dark:text-gray-400">
                          {v.name}{" "}
                          <span className="text-gray-400 dark:text-gray-500">
                            (Block {v.block}, {v.flatNumber})
                          </span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {hasVoted && (
              <p className="text-xs text-primary-600 mt-3 flex items-center gap-1">
                <CheckCircle2 size={14} />
                You have voted on this poll
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {poll.type === "SINGLE"
                ? "Select one option"
                : "Select one or more options"}
            </h3>
            {poll.options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className={clsx(
                  "w-full text-left p-3 rounded-lg border transition-all",
                  selectedOptions.includes(option.id)
                    ? "border-primary-400 bg-primary-50 ring-1 ring-primary-200 dark:border-primary-500 dark:bg-primary-900/20 dark:ring-primary-700"
                    : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={clsx(
                      "w-5 h-5 flex items-center justify-center shrink-0 border-2 transition-colors",
                      poll.type === "SINGLE" ? "rounded-full" : "rounded",
                      selectedOptions.includes(option.id)
                        ? "border-primary-500 bg-primary-500"
                        : "border-gray-300 dark:border-gray-500"
                    )}
                  >
                    {selectedOptions.includes(option.id) && (
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
                  <span className="text-sm text-gray-700 dark:text-gray-300">{option.text}</span>
                </div>
              </button>
            ))}

            {error && (
              <p className="text-sm text-red-600 mt-2">{error}</p>
            )}

            <button
              onClick={handleVote}
              disabled={voting || selectedOptions.length === 0}
              className="mt-4 w-full py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {voting ? "Submitting..." : "Submit Vote"}
            </button>
          </div>
        )}

        {/* Admin controls */}
        {canManagePolls() && (
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center gap-3">
            {!isClosed && (
              <button
                onClick={handleClose}
                disabled={closing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 transition-colors"
              >
                <XCircle size={15} />
                {closing ? "Closing..." : "Close Poll"}
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 dark:text-red-400 dark:bg-red-900/30 dark:hover:bg-red-900/50 transition-colors"
            >
              <Trash2 size={15} />
              {deleting ? "Deleting..." : "Delete Poll"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
