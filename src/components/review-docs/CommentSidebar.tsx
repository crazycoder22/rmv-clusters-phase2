"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  X,
  Quote,
  PenLine,
  Reply,
} from "lucide-react";

interface CommentReply {
  id: string;
  content: string;
  type: string;
  suggestedText: string | null;
  resolved: boolean;
  createdAt: string;
  resident: { id: string; name: string; block: number; flatNumber: string };
}

interface Comment {
  id: string;
  content: string;
  type: string;
  suggestedText: string | null;
  highlightedText: string | null;
  highlightFrom: number | null;
  highlightTo: number | null;
  resolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
  resident: { id: string; name: string; block: number; flatNumber: string };
  resolvedBy: { name: string } | null;
  replies: CommentReply[];
}

interface PendingComment {
  highlightedText: string;
  highlightFrom: number;
  highlightTo: number;
  type: "COMMENT" | "SUGGESTION";
}

interface CommentSidebarProps {
  comments: Comment[];
  docId: string;
  docStatus: string;
  currentResidentId: string;
  isAdmin: boolean;
  onCommentAdded: () => void;
  pendingComment?: PendingComment | null;
  onPendingCommentClear: () => void;
  activeCommentId?: string | null;
  onActiveCommentIdChange?: (id: string | null) => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export default function CommentSidebar({
  comments,
  docId,
  docStatus,
  currentResidentId,
  isAdmin,
  onCommentAdded,
  pendingComment,
  onPendingCommentClear,
  activeCommentId,
  onActiveCommentIdChange,
}: CommentSidebarProps) {
  const [activeTab, setActiveTab] = useState<"all" | "general">("all");
  const [generalText, setGeneralText] = useState("");
  const [pendingText, setPendingText] = useState("");
  const [suggestedReplacement, setSuggestedReplacement] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const pendingInputRef = useRef<HTMLTextAreaElement>(null);
  const generalInputRef = useRef<HTMLTextAreaElement>(null);
  const commentCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isClosed = docStatus === "CLOSED";

  useEffect(() => {
    if (pendingComment) {
      setActiveTab("all");
      if (pendingComment.type === "SUGGESTION") {
        setSuggestedReplacement(pendingComment.highlightedText);
      }
      setTimeout(() => {
        pendingInputRef.current?.focus();
      }, 100);
    }
  }, [pendingComment]);

  // Scroll to and highlight the active comment from inline click
  useEffect(() => {
    if (!activeCommentId) return;
    setActiveTab("all");
    setShowResolved(
      comments.find((c) => c.id === activeCommentId)?.resolved ?? false
    );
    setTimeout(() => {
      const el = commentCardRefs.current[activeCommentId];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  }, [activeCommentId, comments]);

  const activeComments = comments.filter((c) => !c.resolved);
  const resolvedComments = comments.filter((c) => c.resolved);

  const generalComments = activeComments.filter(
    (c) => !c.highlightedText && !c.highlightFrom
  );
  const highlightComments = activeComments.filter(
    (c) => c.highlightedText || c.highlightFrom !== null
  );

  const displayedActive =
    activeTab === "general" ? generalComments : activeComments;

  async function submitComment(
    content: string,
    opts?: {
      type?: string;
      suggestedText?: string;
      highlightFrom?: number;
      highlightTo?: number;
      highlightedText?: string;
      parentId?: string;
    }
  ) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/review-docs/${docId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          type: opts?.type || "COMMENT",
          suggestedText: opts?.suggestedText || null,
          highlightFrom: opts?.highlightFrom ?? null,
          highlightTo: opts?.highlightTo ?? null,
          highlightedText: opts?.highlightedText || null,
          parentId: opts?.parentId || null,
        }),
      });
      if (res.ok) {
        onCommentAdded();
        return true;
      }
    } catch {
      // ignore
    }
    setSubmitting(false);
    return false;
  }

  async function handleGeneralSubmit() {
    if (!generalText.trim()) return;
    const ok = await submitComment(generalText.trim());
    if (ok) {
      setGeneralText("");
      setSubmitting(false);
    }
  }

  async function handlePendingSubmit() {
    if (!pendingComment || !pendingText.trim()) return;
    const ok = await submitComment(pendingText.trim(), {
      type: pendingComment.type,
      suggestedText:
        pendingComment.type === "SUGGESTION"
          ? suggestedReplacement.trim()
          : undefined,
      highlightFrom: pendingComment.highlightFrom,
      highlightTo: pendingComment.highlightTo,
      highlightedText: pendingComment.highlightedText,
    });
    if (ok) {
      setPendingText("");
      setSuggestedReplacement("");
      onPendingCommentClear();
      setSubmitting(false);
    }
  }

  async function handleReplySubmit(parentId: string) {
    if (!replyText.trim()) return;
    const ok = await submitComment(replyText.trim(), { parentId });
    if (ok) {
      setReplyText("");
      setReplyingTo(null);
      setSubmitting(false);
    }
  }

  async function handleResolve(commentId: string) {
    try {
      const res = await fetch(
        `/api/review-docs/${docId}/comments/${commentId}/resolve`,
        { method: "POST" }
      );
      if (res.ok) {
        onCommentAdded();
      }
    } catch {
      // ignore
    }
  }

  function renderComment(comment: Comment, isResolved = false) {
    const canResolve =
      comment.resident.id === currentResidentId || isAdmin;
    const isActive = activeCommentId === comment.id;

    return (
      <div
        key={comment.id}
        ref={(el) => {
          commentCardRefs.current[comment.id] = el;
        }}
        className={`border rounded-lg p-3 transition-colors ${
          isActive
            ? "border-primary-300 bg-primary-50/40 ring-1 ring-primary-200"
            : isResolved
            ? "border-gray-100 bg-gray-50 opacity-70"
            : "border-gray-200 bg-white"
        }`}
        onClick={() => onActiveCommentIdChange?.(comment.id)}
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-medium text-gray-900 truncate">
                {comment.resident.name}
              </span>
              <span className="text-xs text-gray-400">
                B{comment.resident.block}-{comment.resident.flatNumber}
              </span>
              <span className="text-xs text-gray-400">
                {timeAgo(comment.createdAt)}
              </span>
            </div>
          </div>
          {canResolve && !isClosed && (
            <button
              onClick={() => handleResolve(comment.id)}
              className={`shrink-0 p-1 rounded transition-colors ${
                comment.resolved
                  ? "text-green-600 bg-green-50 hover:bg-green-100"
                  : "text-gray-400 hover:text-green-600 hover:bg-green-50"
              }`}
              title={
                comment.resolved ? "Mark as unresolved" : "Mark as resolved"
              }
            >
              {comment.resolved ? (
                <CheckCircle size={14} />
              ) : (
                <Check size={14} />
              )}
            </button>
          )}
        </div>

        {comment.type === "SUGGESTION" && comment.highlightedText && (
          <div className="mb-2 text-xs bg-amber-50 rounded px-2.5 py-1.5 border border-amber-100">
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

        {comment.type === "COMMENT" && comment.highlightedText && (
          <div className="mb-2 text-xs bg-blue-50 rounded px-2.5 py-1.5 border border-blue-100 italic text-blue-700">
            &ldquo;{comment.highlightedText}&rdquo;
          </div>
        )}

        <p className="text-sm text-gray-700 leading-relaxed">
          {comment.content}
        </p>

        {comment.resolvedBy && comment.resolved && (
          <p className="text-xs text-gray-400 mt-1">
            Resolved by {comment.resolvedBy.name}
          </p>
        )}

        {/* Replies */}
        {comment.replies.length > 0 && (
          <div className="mt-2 ml-2 pl-3 border-l-2 border-gray-100 space-y-2">
            {comment.replies.map((reply) => (
              <div key={reply.id}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Reply size={10} className="text-gray-300 rotate-180" />
                  <span className="text-xs font-medium text-gray-800">
                    {reply.resident.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    B{reply.resident.block}-{reply.resident.flatNumber}
                  </span>
                  <span className="text-xs text-gray-400">
                    {timeAgo(reply.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 ml-4">{reply.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* Reply button and input */}
        {!isClosed && !isResolved && (
          <div className="mt-2">
            {replyingTo === comment.id ? (
              <div className="flex gap-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  rows={2}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleReplySubmit(comment.id);
                    }
                    if (e.key === "Escape") {
                      setReplyingTo(null);
                      setReplyText("");
                    }
                  }}
                />
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleReplySubmit(comment.id)}
                    disabled={submitting || !replyText.trim()}
                    className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                  >
                    <Send size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyText("");
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setReplyingTo(comment.id);
                  setReplyText("");
                }}
                className="text-xs text-gray-400 hover:text-primary-600 transition-colors"
              >
                Reply
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header tabs */}
      <div className="flex border-b border-gray-200 shrink-0">
        <button
          onClick={() => setActiveTab("all")}
          className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "all"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          All ({activeComments.length})
        </button>
        <button
          onClick={() => setActiveTab("general")}
          className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "general"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          General ({generalComments.length})
        </button>
      </div>

      {/* Pending comment from text selection */}
      {pendingComment && !isClosed && (
        <div className="p-3 bg-primary-50 border-b border-primary-100 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              {pendingComment.type === "SUGGESTION" ? (
                <PenLine size={14} className="text-amber-600" />
              ) : (
                <Quote size={14} className="text-primary-600" />
              )}
              <span className="text-xs font-medium text-gray-700">
                {pendingComment.type === "SUGGESTION"
                  ? "Suggest Edit"
                  : "Comment on Selection"}
              </span>
            </div>
            <button
              onClick={() => {
                onPendingCommentClear();
                setPendingText("");
                setSuggestedReplacement("");
              }}
              className="p-0.5 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          </div>

          <div className="text-xs bg-white rounded px-2.5 py-1.5 border border-primary-200 italic text-gray-600 mb-2 line-clamp-3">
            &ldquo;{pendingComment.highlightedText}&rdquo;
          </div>

          {pendingComment.type === "SUGGESTION" && (
            <div className="mb-2">
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Suggested replacement:
              </label>
              <textarea
                value={suggestedReplacement}
                onChange={(e) => setSuggestedReplacement(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                rows={2}
              />
            </div>
          )}

          <textarea
            ref={pendingInputRef}
            value={pendingText}
            onChange={(e) => setPendingText(e.target.value)}
            placeholder={
              pendingComment.type === "SUGGESTION"
                ? "Explain why this change is needed..."
                : "Add your comment about this text..."
            }
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 mb-2"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handlePendingSubmit();
              }
            }}
          />

          <button
            onClick={handlePendingSubmit}
            disabled={submitting || !pendingText.trim()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            <Send size={14} />
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      )}

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {displayedActive.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="mx-auto mb-2 text-gray-300" size={32} />
            <p className="text-sm text-gray-400">No comments yet.</p>
            {!isClosed && (
              <p className="text-xs text-gray-400 mt-1">
                Select text in the document or use the input below to add a
                comment.
              </p>
            )}
          </div>
        ) : (
          displayedActive.map((comment) => renderComment(comment))
        )}

        {/* Resolved comments toggle */}
        {resolvedComments.length > 0 && (
          <div className="pt-2">
            <button
              onClick={() => setShowResolved(!showResolved)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors w-full"
            >
              {showResolved ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
              Show resolved ({resolvedComments.length})
            </button>
            {showResolved && (
              <div className="mt-2 space-y-2">
                {resolvedComments.map((comment) =>
                  renderComment(comment, true)
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* General comment input */}
      {!isClosed && (
        <div className="p-3 border-t border-gray-200 bg-white shrink-0">
          <div className="flex gap-2">
            <textarea
              ref={generalInputRef}
              value={generalText}
              onChange={(e) => setGeneralText(e.target.value)}
              placeholder="Add a general comment..."
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleGeneralSubmit();
                }
              }}
            />
            <button
              onClick={handleGeneralSubmit}
              disabled={submitting || !generalText.trim()}
              className="self-end p-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
