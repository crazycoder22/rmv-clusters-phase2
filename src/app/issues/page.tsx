"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

interface Issue {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  closureComment: string | null;
  closedAt: string | null;
  createdAt: string;
  resident: { name: string; block: number; flatNumber: string };
  closedByResident: { name: string } | null;
}

const emptyForm = {
  title: "",
  description: "",
  category: "",
};

export default function IssuesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isManager, setIsManager] = useState(false);
  const [canRaise, setCanRaise] = useState(true);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closureComment, setClosureComment] = useState("");
  const [closingError, setClosingError] = useState("");

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/issues");
      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues);
        setIsManager(data.isManager);
        setCanRaise(data.canRaise ?? true);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.isRegistered) {
      fetchIssues();
    } else if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, session, fetchIssues, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      setIssues((prev) => [data.issue, ...prev]);
      setForm(emptyForm);
      setSuccess("Issue raised successfully!");
      setTimeout(() => setSuccess(""), 4000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async (issueId: string) => {
    if (!closureComment.trim()) {
      setClosingError("Please add a comment before closing.");
      return;
    }

    setClosingError("");

    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closureComment }),
      });

      const data = await res.json();

      if (!res.ok) {
        setClosingError(data.error || "Something went wrong");
        return;
      }

      setIssues((prev) =>
        prev.map((issue) => (issue.id === issueId ? data.issue : issue))
      );
      setClosingId(null);
      setClosureComment("");
    } catch {
      setClosingError("Network error. Please try again.");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-primary-800 mb-1">
        {isManager ? "Issue Management" : "My Issues"}
      </h1>
      <p className="text-gray-500 mb-8">
        {isManager
          ? "View and resolve issues raised by residents."
          : "Raise and track maintenance issues."}
      </p>

      {/* Raise Issue Form - for residents and admins (not facility managers) */}
      {canRaise && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Raise New Issue
          </h2>

          {success && (
            <div className="rounded-md bg-green-50 border border-green-200 p-3 mb-4">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Brief description of the issue"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                required
                value={form.category}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, category: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select category</option>
                <option value="ELECTRICAL">Electrical</option>
                <option value="PLUMBING">Plumbing</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                required
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Detailed description of the issue"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 px-4 bg-primary-600 text-white font-medium rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Submitting..." : "Submit Issue"}
            </button>
          </form>
        </div>
      )}

      {/* Issues List */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          {isManager ? "All Issues" : "My Issues"}
        </h2>
        <button
          onClick={fetchIssues}
          disabled={loading}
          className="text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {issues.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No issues found.</p>
          {canRaise && (
            <p className="text-gray-400 text-sm mt-1">
              Use the form above to raise a new issue.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <div
              key={issue.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              {/* Issue header row */}
              <button
                onClick={() =>
                  setExpandedId(expandedId === issue.id ? null : issue.id)
                }
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {issue.status === "OPEN" ? (
                    <AlertCircle
                      size={18}
                      className="text-amber-500 shrink-0"
                    />
                  ) : (
                    <CheckCircle2
                      size={18}
                      className="text-green-500 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {issue.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={clsx(
                          "inline-block px-2 py-0.5 text-xs font-medium rounded-full",
                          issue.category === "ELECTRICAL" &&
                            "bg-yellow-100 text-yellow-700",
                          issue.category === "PLUMBING" &&
                            "bg-blue-100 text-blue-700",
                          issue.category === "OTHER" &&
                            "bg-gray-100 text-gray-700"
                        )}
                      >
                        {issue.category}
                      </span>
                      <span
                        className={clsx(
                          "inline-block px-2 py-0.5 text-xs font-medium rounded-full",
                          issue.status === "OPEN"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-green-100 text-green-700"
                        )}
                      >
                        {issue.status}
                      </span>
                      {isManager && (
                        <span className="text-xs text-gray-500">
                          B{issue.resident.block} - {issue.resident.flatNumber}{" "}
                          ({issue.resident.name})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-gray-500">
                    {new Date(issue.createdAt).toLocaleDateString()}
                  </span>
                  {expandedId === issue.id ? (
                    <ChevronUp size={16} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={16} className="text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expanded details */}
              {expandedId === issue.id && (
                <div className="px-5 pb-4 border-t border-gray-100 pt-3 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      Description
                    </p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {issue.description}
                    </p>
                  </div>

                  <div className="text-xs text-gray-500">
                    Raised on{" "}
                    {new Date(issue.createdAt).toLocaleString()}
                  </div>

                  {/* Closure info */}
                  {issue.status === "CLOSED" && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-3">
                      <p className="text-xs font-medium text-green-800 mb-1">
                        Closed by {issue.closedByResident?.name ?? "Unknown"} on{" "}
                        {issue.closedAt
                          ? new Date(issue.closedAt).toLocaleString()
                          : "—"}
                      </p>
                      <p className="text-sm text-green-700">
                        {issue.closureComment}
                      </p>
                    </div>
                  )}

                  {/* Close button for managers */}
                  {isManager && issue.status === "OPEN" && (
                    <div>
                      {closingId === issue.id ? (
                        <div className="space-y-2">
                          <textarea
                            rows={2}
                            value={closureComment}
                            onChange={(e) => setClosureComment(e.target.value)}
                            placeholder="Add closure comment..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                          />
                          {closingError && (
                            <p className="text-xs text-red-600">
                              {closingError}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleClose(issue.id)}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
                            >
                              Confirm Close
                            </button>
                            <button
                              onClick={() => {
                                setClosingId(null);
                                setClosureComment("");
                                setClosingError("");
                              }}
                              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setClosingId(issue.id)}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
                        >
                          Close Issue
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
