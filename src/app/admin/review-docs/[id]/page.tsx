"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  User,
  Clock,
  MessageSquare,
  Reply,
  Check,
} from "lucide-react";
import { canManageReviewDocs } from "@/lib/roles";
import RichTextViewer from "@/components/editor/RichTextViewer";

interface Comment {
  id: string;
  type: string;
  content: string;
  highlightedText: string | null;
  suggestedText: string | null;
  resolved: boolean;
  createdAt: string;
  resident: { id: string; name: string; email: string; flatNumber: string };
  replies: CommentReply[];
}

interface CommentReply {
  id: string;
  content: string;
  createdAt: string;
  resident: { id: string; name: string; email: string; flatNumber: string };
}

interface ReviewDoc {
  id: string;
  title: string;
  content: string;
  status: string;
  createdAt: string;
  createdBy: { id: string; name: string; email: string; flatNumber: string };
  linkedDocument: {
    id: string;
    name: string;
    driveUrl: string | null;
  } | null;
  comments: Comment[];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  PUBLISHED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  CLOSED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const COMMENT_TYPE_COLORS: Record<string, string> = {
  COMMENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  SUGGESTION: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  OBJECTION: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export default function ReviewDocDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [doc, setDoc] = useState<ReviewDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const roles = session?.user?.roles ?? [];
  const hasAccess = canManageReviewDocs(roles);

  const fetchDoc = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/review-docs/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDoc(data.reviewDoc);
      } else {
        setError("Failed to load review document.");
      }
    } catch {
      setError("Failed to load review document.");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!hasAccess) {
      setLoading(false);
      return;
    }
    fetchDoc();
  }, [authStatus, hasAccess, fetchDoc]);

  async function handleStatusChange(newStatus: string) {
    setStatusLoading(true);
    const res = await fetch(`/api/admin/review-docs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setPublishConfirm(false);
      setCloseConfirm(false);
      await fetchDoc();
    }
    setStatusLoading(false);
  }

  async function handleDelete() {
    const res = await fetch(`/api/admin/review-docs/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      router.push("/admin/review-docs");
    }
  }

  async function handleToggleResolve(commentId: string, resolved: boolean) {
    const res = await fetch(
      `/api/admin/review-docs/${id}/comments/${commentId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: !resolved }),
      }
    );
    if (res.ok) {
      await fetchDoc();
    }
  }

  if (authStatus === "loading" || loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">You do not have access to this page.</p>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-red-600">{error || "Document not found."}</p>
        <Link
          href="/admin/review-docs"
          className="mt-4 inline-block text-sm text-primary-600 hover:text-primary-700"
        >
          Back to Review Documents
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href="/admin/review-docs"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 mb-6"
      >
        <ArrowLeft size={16} />
        Back to Review Documents
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{doc.title}</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                STATUS_COLORS[doc.status] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {doc.status.charAt(0) + doc.status.slice(1).toLowerCase()}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <User size={14} />
              {doc.createdBy.name}
            </span>
            <span>
              {new Date(doc.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {doc.status !== "CLOSED" && (
            <Link
              href={`/admin/review-docs/${id}/edit`}
              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
            >
              <Pencil size={18} />
            </Link>
          )}
          {doc.status === "DRAFT" && (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">
          <p className="text-sm text-red-700 dark:text-red-300 mb-3">
            Are you sure you want to delete this review document? This cannot be
            undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            >
              Delete
            </button>
            <button
              onClick={() => setDeleteConfirm(false)}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Publish confirmation */}
      {publishConfirm && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300">
          <p className="text-sm text-green-700 dark:text-green-300 mb-3">
            Publishing will make this document visible for review. Continue?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleStatusChange("PUBLISHED")}
              disabled={statusLoading}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {statusLoading ? "Publishing..." : "Publish"}
            </button>
            <button
              onClick={() => setPublishConfirm(false)}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Close confirmation */}
      {closeConfirm && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-300">
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
            Closing will prevent further comments. This cannot be undone.
            Continue?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleStatusChange("CLOSED")}
              disabled={statusLoading}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
            >
              {statusLoading ? "Closing..." : "Close Document"}
            </button>
            <button
              onClick={() => setCloseConfirm(false)}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Status action buttons */}
      {!publishConfirm && !closeConfirm && (
        <div className="flex gap-2 mb-6">
          {doc.status === "DRAFT" && (
            <button
              onClick={() => setPublishConfirm(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Publish
            </button>
          )}
          {doc.status === "PUBLISHED" && (
            <button
              onClick={() => setCloseConfirm(true)}
              className="px-4 py-2 bg-white border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 dark:bg-gray-800 dark:border-red-700 dark:hover:bg-red-900/30 transition-colors"
            >
              Close Document
            </button>
          )}
        </div>
      )}

      {/* Linked document */}
      {doc.linkedDocument && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-6 flex items-center gap-3 dark:bg-gray-700 dark:border-gray-600">
          <span className="text-sm text-gray-500 dark:text-gray-400">Linked document:</span>
          {doc.linkedDocument.driveUrl ? (
            <a
              href={doc.linkedDocument.driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              {doc.linkedDocument.name}
            </a>
          ) : (
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {doc.linkedDocument.name}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 dark:bg-gray-800 dark:border-gray-700">
        <RichTextViewer html={doc.content} />
      </div>

      {/* Comments section */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 dark:bg-gray-800 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
          <MessageSquare size={20} />
          Comments ({doc.comments.length})
        </h2>

        {doc.comments.length === 0 ? (
          <p className="text-sm text-gray-400">No comments yet.</p>
        ) : (
          <div className="space-y-4">
            {doc.comments.map((comment) => (
              <div
                key={comment.id}
                className={`border rounded-lg p-4 ${
                  comment.resolved
                    ? "border-gray-100 bg-gray-50 opacity-60 dark:border-gray-700 dark:bg-gray-700"
                    : "border-gray-200 dark:border-gray-600"
                }`}
              >
                {/* Comment header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {comment.resident.name}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        COMMENT_TYPE_COLORS[comment.type] ||
                        "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {comment.type.charAt(0) +
                        comment.type.slice(1).toLowerCase()}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={12} />
                      {new Date(comment.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      handleToggleResolve(comment.id, comment.resolved)
                    }
                    className={`p-1.5 rounded-lg transition-colors ${
                      comment.resolved
                        ? "text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50"
                        : "text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30"
                    }`}
                    title={
                      comment.resolved
                        ? "Mark as unresolved"
                        : "Mark as resolved"
                    }
                  >
                    {comment.resolved ? (
                      <CheckCircle size={16} />
                    ) : (
                      <Check size={16} />
                    )}
                  </button>
                </div>

                {/* Suggestion display */}
                {comment.type === "SUGGESTION" && comment.highlightedText && (
                  <div className="mb-2 text-sm bg-amber-50 rounded-lg px-3 py-2 border border-amber-100 dark:bg-amber-900/20 dark:border-amber-800">
                    <span className="line-through text-red-500">
                      {comment.highlightedText}
                    </span>
                    {comment.suggestedText && (
                      <>
                        {" "}
                        <span className="text-green-600 font-medium">
                          {comment.suggestedText}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* Comment text */}
                <p className="text-sm text-gray-700 dark:text-gray-300">{comment.content}</p>

                {/* Replies */}
                {comment.replies.length > 0 && (
                  <div className="mt-3 ml-4 pl-4 border-l-2 border-gray-100 dark:border-gray-600 space-y-3">
                    {comment.replies.map((reply) => (
                      <div key={reply.id}>
                        <div className="flex items-center gap-2 mb-1">
                          <Reply
                            size={12}
                            className="text-gray-300 rotate-180"
                          />
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {reply.resident.name}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(reply.createdAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 ml-5">
                          {reply.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
