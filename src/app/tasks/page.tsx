"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  AlertTriangle,
  ArrowRight,
  MessageSquare,
} from "lucide-react";

interface TaskComment {
  id: string;
  content: string;
  oldStatus: string | null;
  newStatus: string | null;
  createdAt: string;
  author: { id: string; name: string };
}

interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  deadline: string;
  closedAt: string | null;
  createdAt: string;
  owner: { id: string; name: string; block: number; flatNumber: string };
  createdBy: { id: string; name: string };
  _count: { comments: number };
}

const STATUS_OPTIONS = ["ALL", "OPEN", "IN_PROGRESS", "ON_HOLD", "BLOCKED", "CLOSED"];

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  ON_HOLD: "bg-yellow-100 text-yellow-700",
  BLOCKED: "bg-red-100 text-red-700",
  CLOSED: "bg-green-100 text-green-700",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  NORMAL: "bg-blue-100 text-blue-600",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["IN_PROGRESS"],
  IN_PROGRESS: ["ON_HOLD", "BLOCKED", "CLOSED"],
  ON_HOLD: ["IN_PROGRESS", "CLOSED"],
  BLOCKED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: ["OPEN"],
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  BLOCKED: "Blocked",
  CLOSED: "Closed",
};

const emptyForm = {
  title: "",
  description: "",
  category: "",
  priority: "NORMAL",
  ownerId: "",
  deadline: "",
};

function isOverdue(deadline: string, status: string): boolean {
  if (status === "CLOSED") return false;
  return new Date(deadline) < new Date();
}

export default function TasksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [facilityManagers, setFacilityManagers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Expanded task detail
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [taskDetail, setTaskDetail] = useState<(Task & { comments: TaskComment[] }) | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Status update
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusComment, setStatusComment] = useState("");
  const [statusError, setStatusError] = useState("");

  // Add comment
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/tasks${params}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
        setIsAdmin(data.isAdmin);
        setFacilityManagers(data.facilityManagers || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchTaskDetail = useCallback(async (taskId: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setTaskDetail(data.task);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.isRegistered) {
      fetchTasks();
    } else if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, session, fetchTasks, router]);

  // Fetch detail when expanding
  useEffect(() => {
    if (expandedId) {
      fetchTaskDetail(expandedId);
      setStatusComment("");
      setStatusError("");
      setNewComment("");
    } else {
      setTaskDetail(null);
    }
  }, [expandedId, fetchTaskDetail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      setTasks((prev) => [data.task, ...prev]);
      setForm(emptyForm);
      setSuccess("Task created successfully!");
      setTimeout(() => setSuccess(""), 4000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    setUpdatingStatus(true);
    setStatusError("");

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          comment: statusComment || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusError(data.error || "Something went wrong");
        return;
      }
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? data.task : t))
      );
      setStatusComment("");
      // Refresh detail
      fetchTaskDetail(taskId);
    } catch {
      setStatusError("Network error. Please try again.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddComment = async (taskId: string) => {
    if (!newComment.trim()) return;
    setAddingComment(true);

    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });
      if (res.ok) {
        setNewComment("");
        fetchTaskDetail(taskId);
      }
    } catch {
      // silently fail
    } finally {
      setAddingComment(false);
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
        {isAdmin ? "Task Management" : "My Tasks"}
      </h1>
      <p className="text-gray-500 mb-8">
        {isAdmin
          ? "Create and manage tasks for facility managers."
          : "View and update your assigned tasks."}
      </p>

      {/* Create Task Form - Admin only */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Create New Task
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
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Brief description of the task"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  required
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select category</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="ELECTRICAL">Electrical</option>
                  <option value="PLUMBING">Plumbing</option>
                  <option value="SECURITY">Security</option>
                  <option value="GENERAL">General</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deadline
                </label>
                <input
                  type="date"
                  required
                  value={form.deadline}
                  onChange={(e) => setForm((prev) => ({ ...prev, deadline: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign To
              </label>
              <select
                required
                value={form.ownerId}
                onChange={(e) => setForm((prev) => ({ ...prev, ownerId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select facility manager</option>
                {facilityManagers.map((fm) => (
                  <option key={fm.id} value={fm.id}>
                    {fm.name}
                  </option>
                ))}
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
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Detailed description of the task"
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
              {submitting ? "Creating..." : "Create Task"}
            </button>
          </form>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={clsx(
              "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
              statusFilter === s
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {STATUS_LABELS[s] || "All"}
          </button>
        ))}
        <button
          onClick={fetchTasks}
          disabled={loading}
          className="ml-auto text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Task List */}
      {tasks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No tasks found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const overdue = isOverdue(task.deadline, task.status);
            return (
              <div
                key={task.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Task header */}
                <button
                  onClick={() =>
                    setExpandedId(expandedId === task.id ? null : task.id)
                  }
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span
                          className={clsx(
                            "inline-block px-2 py-0.5 text-xs font-medium rounded-full",
                            STATUS_COLORS[task.status] || "bg-gray-100 text-gray-700"
                          )}
                        >
                          {STATUS_LABELS[task.status] || task.status}
                        </span>
                        <span
                          className={clsx(
                            "inline-block px-2 py-0.5 text-xs font-medium rounded-full",
                            PRIORITY_COLORS[task.priority] || "bg-gray-100 text-gray-600"
                          )}
                        >
                          {task.priority}
                        </span>
                        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                          {task.category}
                        </span>
                        {isAdmin && (
                          <span className="text-xs text-gray-500">
                            → {task.owner.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div
                        className={clsx(
                          "flex items-center gap-1 text-xs",
                          overdue ? "text-red-600 font-medium" : "text-gray-500"
                        )}
                      >
                        {overdue && <AlertTriangle size={12} />}
                        <Clock size={12} />
                        {new Date(task.deadline).toLocaleDateString()}
                      </div>
                      {task._count.comments > 0 && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5 justify-end">
                          <MessageSquare size={11} />
                          {task._count.comments}
                        </div>
                      )}
                    </div>
                    {expandedId === task.id ? (
                      <ChevronUp size={16} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={16} className="text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded detail */}
                {expandedId === task.id && (
                  <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
                    {loadingDetail ? (
                      <p className="text-sm text-gray-400">Loading details...</p>
                    ) : (
                      <>
                        {/* Task info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs font-medium text-gray-500">Description</p>
                            <p className="text-gray-700 whitespace-pre-wrap mt-0.5">
                              {task.description}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs font-medium text-gray-500">Created By</p>
                              <p className="text-gray-700">{task.createdBy.name}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500">Assigned To</p>
                              <p className="text-gray-700">{task.owner.name}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500">Created</p>
                              <p className="text-gray-700">
                                {new Date(task.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500">Deadline</p>
                              <p
                                className={clsx(
                                  overdue ? "text-red-600 font-medium" : "text-gray-700"
                                )}
                              >
                                {new Date(task.deadline).toLocaleDateString()}
                                {overdue && " (Overdue)"}
                              </p>
                            </div>
                            {task.closedAt && (
                              <div>
                                <p className="text-xs font-medium text-gray-500">Closed</p>
                                <p className="text-gray-700">
                                  {new Date(task.closedAt).toLocaleString()}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Status update controls */}
                        {task.status !== "CLOSED" || (isAdmin && task.status === "CLOSED") ? (
                          <div className="border-t border-gray-100 pt-3">
                            <p className="text-xs font-medium text-gray-500 mb-2">
                              Update Status
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              {(VALID_TRANSITIONS[task.status] || []).map((nextStatus) => {
                                // Only admin can reopen
                                if (nextStatus === "OPEN" && !isAdmin) return null;
                                return (
                                  <button
                                    key={nextStatus}
                                    onClick={() => handleStatusChange(task.id, nextStatus)}
                                    disabled={updatingStatus}
                                    className={clsx(
                                      "px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50",
                                      nextStatus === "CLOSED"
                                        ? "bg-green-600 text-white hover:bg-green-700"
                                        : nextStatus === "BLOCKED"
                                        ? "bg-red-100 text-red-700 hover:bg-red-200"
                                        : nextStatus === "ON_HOLD"
                                        ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                        : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                    )}
                                  >
                                    {STATUS_LABELS[nextStatus]}
                                  </button>
                                );
                              })}
                            </div>
                            <textarea
                              rows={2}
                              value={statusComment}
                              onChange={(e) => setStatusComment(e.target.value)}
                              placeholder="Optional comment for status change..."
                              className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                            />
                            {statusError && (
                              <p className="text-xs text-red-600 mt-1">{statusError}</p>
                            )}
                          </div>
                        ) : null}

                        {/* Comment timeline */}
                        {taskDetail && taskDetail.comments.length > 0 && (
                          <div className="border-t border-gray-100 pt-3">
                            <p className="text-xs font-medium text-gray-500 mb-3">
                              Activity ({taskDetail.comments.length})
                            </p>
                            <div className="space-y-3">
                              {taskDetail.comments.map((c) => (
                                <div
                                  key={c.id}
                                  className={clsx(
                                    "rounded-md p-3 text-sm",
                                    c.oldStatus
                                      ? "bg-gray-50 border border-gray-200"
                                      : "bg-blue-50/50 border border-blue-100"
                                  )}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-gray-800 text-xs">
                                      {c.author.name}
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                      {new Date(c.createdAt).toLocaleString()}
                                    </span>
                                  </div>
                                  {c.oldStatus && c.newStatus && (
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span
                                        className={clsx(
                                          "px-1.5 py-0.5 text-[10px] font-medium rounded",
                                          STATUS_COLORS[c.oldStatus]
                                        )}
                                      >
                                        {STATUS_LABELS[c.oldStatus]}
                                      </span>
                                      <ArrowRight size={12} className="text-gray-400" />
                                      <span
                                        className={clsx(
                                          "px-1.5 py-0.5 text-[10px] font-medium rounded",
                                          STATUS_COLORS[c.newStatus]
                                        )}
                                      >
                                        {STATUS_LABELS[c.newStatus]}
                                      </span>
                                    </div>
                                  )}
                                  <p className="text-gray-700 text-xs">{c.content}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Add comment */}
                        <div className="border-t border-gray-100 pt-3">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              placeholder="Add a comment..."
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleAddComment(task.id);
                                }
                              }}
                            />
                            <button
                              onClick={() => handleAddComment(task.id)}
                              disabled={addingComment || !newComment.trim()}
                              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors"
                            >
                              {addingComment ? "..." : "Send"}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
