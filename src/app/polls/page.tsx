"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BarChart3, Plus, Clock, Users, CheckCircle2 } from "lucide-react";
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
  createdBy: { name: string; block: number; flatNumber: string };
  createdAt: string;
  _count: { votes: number };
  options: { id: string; text: string }[];
}

export default function PollsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const { canManagePolls } = useRole();
  const [polls, setPolls] = useState<PollListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ACTIVE" | "CLOSED" | "ALL">("ACTIVE");

  useEffect(() => {
    if (authStatus !== "loading" && !session?.user?.isApproved) {
      router.replace("/");
    }
  }, [authStatus, session, router]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    setLoading(true);
    const params = filter !== "ALL" ? `?status=${filter}` : "";
    fetch(`/api/polls${params}`)
      .then((res) => (res.ok ? res.json() : { polls: [] }))
      .then((data) => setPolls(data.polls || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authStatus, filter]);

  if (authStatus === "loading" || !session?.user?.isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const isExpired = (deadline: string) => new Date(deadline) < new Date();

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
          <Link
            href="/admin/polls/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} />
            Create Poll
          </Link>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {(["ACTIVE", "CLOSED", "ALL"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={clsx(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              filter === tab
                ? "bg-white text-primary-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab === "ALL" ? "All" : tab === "ACTIVE" ? "Active" : "Closed"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading polls...</p>
      ) : polls.length === 0 ? (
        <div className="text-center py-16">
          <BarChart3 size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400">No polls found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {polls.map((poll) => {
            const expired = isExpired(poll.deadline);
            const isClosed = poll.status === "CLOSED" || expired;
            return (
              <Link
                key={poll.id}
                href={`/polls/${poll.id}`}
                className="block bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
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
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-violet-100 text-violet-700">
                        {poll.type === "MULTIPLE"
                          ? "Multiple Choice"
                          : "Single Choice"}
                      </span>
                      {poll.isAnonymous && (
                        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                          Anonymous
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">
                      {poll.title}
                    </h3>
                    {poll.description && (
                      <p className="text-sm text-gray-500 mb-2 line-clamp-2">
                        {poll.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users size={13} />
                        {poll._count.votes} vote{poll._count.votes !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={13} />
                        {isClosed
                          ? "Ended"
                          : `Ends ${new Date(poll.deadline).toLocaleDateString()}`}
                      </span>
                      <span>
                        by {poll.createdBy.name}
                      </span>
                    </div>
                  </div>
                  {!isClosed && (
                    <CheckCircle2 size={20} className="text-primary-400 shrink-0 mt-1" />
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
