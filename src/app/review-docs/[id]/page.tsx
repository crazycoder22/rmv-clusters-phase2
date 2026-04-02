"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Calendar,
  MessageSquare,
  X,
  Quote,
  PenLine,
  Loader2,
  Link as LinkIcon,
  AlertCircle,
  Reply,
} from "lucide-react";
import CommentSidebar from "@/components/review-docs/CommentSidebar";

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

interface ReviewDoc {
  id: string;
  title: string;
  content: string;
  status: string;
  createdAt: string;
  createdBy: { id: string; name: string };
  linkedDocument: { id: string; name: string; driveUrl: string | null } | null;
  comments: Comment[];
}

interface PendingComment {
  highlightedText: string;
  highlightFrom: number;
  highlightTo: number;
  type: "COMMENT" | "SUGGESTION";
}

interface ActiveHighlight {
  commentId: string;
  rect: DOMRect;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

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
  const [currentResidentId, setCurrentResidentId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingComment, setPendingComment] = useState<PendingComment | null>(
    null
  );
  const [selectionToolbar, setSelectionToolbar] = useState<{
    x: number;
    y: number;
    text: string;
    startOffset: number;
    endOffset: number;
  } | null>(null);
  const [activeHighlight, setActiveHighlight] =
    useState<ActiveHighlight | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Ref for click handler so DOM event listeners always use latest callback
  const onHighlightClickRef = useRef<
    ((commentId: string, el: HTMLElement) => void) | undefined
  >(undefined);
  onHighlightClickRef.current = (commentId: string, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setActiveHighlight({ commentId, rect });
  };

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/");
    } else if (authStatus === "authenticated" && !session?.user?.isApproved) {
      router.push("/");
    }
  }, [authStatus, session, router]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    fetch("/api/residents/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setCurrentResidentId(data.id);
      })
      .catch(() => {});

    const roles = session?.user?.roles ?? [];
    setIsAdmin(
      roles.some((r: string) => ["ADMIN", "SUPERADMIN"].includes(r))
    );
  }, [authStatus, session]);

  const fetchDoc = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/review-docs/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDoc(data.doc);
      } else if (res.status === 404) {
        setError("Document not found.");
      } else {
        setError("Failed to load document.");
      }
    } catch {
      setError("Failed to load document.");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (authStatus !== "authenticated" || !session?.user?.isApproved) return;
    fetchDoc();
  }, [authStatus, session, fetchDoc]);

  // Apply inline highlights whenever comments change
  useEffect(() => {
    const container = contentRef.current;
    if (!container || !doc) return;

    // Remove any existing highlight spans and normalize text nodes
    container.querySelectorAll(".rvw-hl").forEach((el) => {
      const parent = el.parentNode!;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    });
    container.normalize();

    const inlineComments = doc.comments
      .filter(
        (c) =>
          !c.resolved &&
          c.highlightFrom !== null &&
          c.highlightTo !== null
      )
      .sort((a, b) => (a.highlightFrom ?? 0) - (b.highlightFrom ?? 0));

    if (inlineComments.length === 0) return;

    // Collect all text nodes with cumulative character positions
    const textNodes: { node: Text; start: number; end: number }[] = [];
    let pos = 0;
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT
    );
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const len = (n as Text).textContent?.length ?? 0;
      if (len > 0) {
        textNodes.push({ node: n as Text, start: pos, end: pos + len });
        pos += len;
      }
    }

    // Process each text node, injecting highlight spans where comments overlap
    for (let ti = 0; ti < textNodes.length; ti++) {
      const tn = textNodes[ti];
      const applicable = inlineComments.filter(
        (c) => (c.highlightTo ?? 0) > tn.start && (c.highlightFrom ?? 0) < tn.end
      );
      if (applicable.length === 0) continue;

      type Seg = {
        from: number;
        to: number;
        commentId: string | null;
        type: string | null;
      };
      const segs: Seg[] = [];
      let cur = tn.start;

      for (const c of applicable) {
        const segFrom = Math.max(cur, c.highlightFrom!);
        const segTo = Math.min(tn.end, c.highlightTo!);
        if (segFrom > cur)
          segs.push({ from: cur, to: segFrom, commentId: null, type: null });
        if (segFrom < segTo)
          segs.push({
            from: segFrom,
            to: segTo,
            commentId: c.id,
            type: c.type,
          });
        cur = segTo;
      }
      if (cur < tn.end)
        segs.push({ from: cur, to: tn.end, commentId: null, type: null });

      if (segs.every((s) => !s.commentId)) continue;

      const parent = tn.node.parentNode!;
      const text = tn.node.textContent ?? "";

      for (const seg of segs) {
        const segText = text.slice(seg.from - tn.start, seg.to - tn.start);
        if (!segText) continue;

        if (seg.commentId) {
          const span = document.createElement("span");
          span.className = [
            "rvw-hl",
            "rounded-sm",
            "cursor-pointer",
            "transition-colors",
            seg.type === "SUGGESTION"
              ? "bg-amber-100 border-b-2 border-amber-400 hover:bg-amber-200"
              : "bg-yellow-100 border-b-2 border-yellow-400 hover:bg-yellow-200",
          ].join(" ");
          span.dataset.cid = seg.commentId;
          span.textContent = segText;
          const cid = seg.commentId;
          span.addEventListener("click", (e) => {
            e.stopPropagation();
            onHighlightClickRef.current?.(cid, span);
          });
          parent.insertBefore(span, tn.node);
        } else {
          parent.insertBefore(document.createTextNode(segText), tn.node);
        }
      }
      parent.removeChild(tn.node);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.comments, doc?.content]);

  // Close popover on outside click
  useEffect(() => {
    if (!activeHighlight) return;
    function handleMouseDown(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setActiveHighlight(null);
      }
    }
    // Delay to avoid closing immediately on the click that opened it
    const timer = setTimeout(
      () => document.addEventListener("mousedown", handleMouseDown),
      0
    );
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [activeHighlight]);

  // Text selection handler
  useEffect(() => {
    function handleMouseUp() {
      if (!contentRef.current) return;
      if (doc?.status !== "PUBLISHED") return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) {
        setTimeout(() => {
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed) {
            setSelectionToolbar(null);
          }
        }, 200);
        return;
      }

      const range = selection.getRangeAt(0);
      const text = selection.toString().trim();

      if (!text || text.length < 2) {
        setSelectionToolbar(null);
        return;
      }

      if (!contentRef.current.contains(range.commonAncestorContainer)) {
        return;
      }

      const rect = range.getBoundingClientRect();
      const containerRect = contentRef.current.getBoundingClientRect();

      const preCaretRange = document.createRange();
      preCaretRange.selectNodeContents(contentRef.current);
      preCaretRange.setEnd(range.startContainer, range.startOffset);
      const startOffset = preCaretRange.toString().length;
      const endOffset = startOffset + text.length;

      setSelectionToolbar({
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top - containerRect.top - 10,
        text,
        startOffset,
        endOffset,
      });
    }

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [doc?.status]);

  // Close toolbar on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(e.target as Node)
      ) {
        // Don't clear immediately — let the button handlers fire first
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelectionAction(type: "COMMENT" | "SUGGESTION") {
    if (!selectionToolbar) return;
    setPendingComment({
      highlightedText: selectionToolbar.text,
      highlightFrom: selectionToolbar.startOffset,
      highlightTo: selectionToolbar.endOffset,
      type,
    });
    setSelectionToolbar(null);
    setSidebarOpen(true);
    window.getSelection()?.removeAllRanges();
  }

  function handleCommentAdded() {
    fetchDoc();
  }

  const isClosed = doc?.status === "CLOSED";
  const commentCount = doc?.comments?.length ?? 0;

  // Find the active comment for the popover
  const popoverComment = activeHighlight
    ? doc?.comments.find((c) => c.id === activeHighlight.commentId)
    : null;

  if (
    authStatus === "loading" ||
    (authStatus === "authenticated" && loading)
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary-600" />
      </div>
    );
  }

  if (authStatus !== "authenticated" || !session?.user?.isApproved) {
    return null;
  }

  if (error || !doc) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-red-600">{error || "Document not found."}</p>
        <Link
          href="/review-docs"
          className="mt-4 inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
        >
          <ArrowLeft size={14} />
          Back to Review Documents
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Desktop layout: document + sidebar */}
      <div className="flex h-[calc(100vh-64px)]">
        {/* Document viewer */}
        <div
          className={`flex-1 overflow-y-auto transition-all ${
            sidebarOpen ? "lg:mr-[400px]" : ""
          }`}
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Back button */}
            <Link
              href="/review-docs"
              className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-gray-300 transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Back to Review Documents
            </Link>

            {/* Closed banner */}
            {isClosed && (
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 mb-4">
                <AlertCircle size={16} className="text-gray-500 dark:text-gray-400 shrink-0" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This document is closed for review. No new comments can be
                  added.
                </p>
              </div>
            )}

            {/* Document header */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6 mb-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                {doc.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <User size={14} />
                  {doc.createdBy.name}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {new Date(doc.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    isClosed
                      ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                      : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  }`}
                >
                  {isClosed ? "Closed" : "Open for Review"}
                </span>
              </div>

              {/* Linked document */}
              {doc.linkedDocument && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <LinkIcon size={14} className="text-gray-400 dark:text-gray-500" />
                  <span className="text-gray-500 dark:text-gray-400">Linked document:</span>
                  {doc.linkedDocument.driveUrl ? (
                    <a
                      href={doc.linkedDocument.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary-600 hover:text-primary-700"
                    >
                      {doc.linkedDocument.name}
                    </a>
                  ) : (
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {doc.linkedDocument.name}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Legend for highlight colors */}
            {doc.comments.some(
              (c) => !c.resolved && c.highlightFrom !== null
            ) && (
              <div className="flex items-center gap-3 mb-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm bg-yellow-200 border-b-2 border-yellow-400" />
                  Comment
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm bg-amber-200 border-b-2 border-amber-400" />
                  Suggestion
                </span>
                <span className="text-gray-400 dark:text-gray-500">
                  · Click highlighted text to preview
                </span>
              </div>
            )}

            {/* Document content */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 sm:p-8 relative">
              <div
                ref={contentRef}
                className="newsletter-content prose prose-gray dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed prose-a:text-primary-600 prose-img:rounded-lg"
                dangerouslySetInnerHTML={{ __html: doc.content }}
              />

              {/* Floating selection toolbar */}
              {selectionToolbar && !isClosed && (
                <div
                  ref={toolbarRef}
                  className="absolute z-50 flex items-center gap-1 bg-gray-900 text-white rounded-lg shadow-lg px-1.5 py-1 animate-in fade-in duration-150"
                  style={{
                    left: `${selectionToolbar.x}px`,
                    top: `${selectionToolbar.y}px`,
                    transform: "translate(-50%, -100%)",
                  }}
                >
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelectionAction("COMMENT");
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm hover:bg-gray-700 rounded transition-colors"
                  >
                    <Quote size={14} />
                    Comment
                  </button>
                  <div className="w-px h-5 bg-gray-600" />
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelectionAction("SUGGESTION");
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm hover:bg-gray-700 rounded transition-colors"
                  >
                    <PenLine size={14} />
                    Suggest Edit
                  </button>
                  {/* Arrow pointer */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0"
                    style={{
                      borderLeft: "6px solid transparent",
                      borderRight: "6px solid transparent",
                      borderTop: "6px solid rgb(17, 24, 39)",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Desktop sidebar */}
        <div
          className={`hidden lg:flex flex-col fixed right-0 top-16 bottom-0 w-[400px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 transition-transform ${
            sidebarOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <MessageSquare size={18} />
              Comments
            </h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <CommentSidebar
            comments={doc.comments}
            docId={doc.id}
            docStatus={doc.status}
            currentResidentId={currentResidentId}
            isAdmin={isAdmin}
            onCommentAdded={handleCommentAdded}
            pendingComment={pendingComment}
            onPendingCommentClear={() => setPendingComment(null)}
            activeCommentId={activeCommentId}
            onActiveCommentIdChange={setActiveCommentId}
          />
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-[400px] bg-white dark:bg-gray-800 shadow-xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <MessageSquare size={18} />
                  Comments
                </h2>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <CommentSidebar
                comments={doc.comments}
                docId={doc.id}
                docStatus={doc.status}
                currentResidentId={currentResidentId}
                isAdmin={isAdmin}
                onCommentAdded={handleCommentAdded}
                pendingComment={pendingComment}
                onPendingCommentClear={() => setPendingComment(null)}
                activeCommentId={activeCommentId}
                onActiveCommentIdChange={setActiveCommentId}
              />
            </div>
          </div>
        )}
      </div>

      {/* Inline comment popover (fixed, appears over highlighted text) */}
      {activeHighlight && popoverComment && (
        <div
          ref={popoverRef}
          className="fixed z-[100] w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3"
          style={{
            left: Math.max(
              8,
              Math.min(
                activeHighlight.rect.left,
                (typeof window !== "undefined" ? window.innerWidth : 800) - 296
              )
            ),
            top: activeHighlight.rect.bottom + 6,
          }}
        >
          {/* Popover header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${
                  popoverComment.type === "SUGGESTION"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                }`}
              >
                {popoverComment.type === "SUGGESTION"
                  ? "Suggestion"
                  : "Comment"}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-300 truncate font-medium">
                {popoverComment.resident.name}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                · {timeAgo(popoverComment.createdAt)}
              </span>
            </div>
            <button
              onClick={() => setActiveHighlight(null)}
              className="shrink-0 ml-1 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            >
              <X size={14} />
            </button>
          </div>

          {/* Suggestion diff */}
          {popoverComment.type === "SUGGESTION" &&
            popoverComment.highlightedText && (
              <div className="mb-2 text-xs bg-amber-50 dark:bg-amber-900/20 rounded px-2.5 py-1.5 border border-amber-100 dark:border-amber-800">
                <span className="line-through text-red-500 dark:text-red-400">
                  {popoverComment.highlightedText}
                </span>
                {popoverComment.suggestedText && (
                  <>
                    {" "}
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      {popoverComment.suggestedText}
                    </span>
                  </>
                )}
              </div>
            )}

          {/* Comment content */}
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-4">
            {popoverComment.content}
          </p>

          {/* Replies preview */}
          {popoverComment.replies.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 space-y-1.5">
              {popoverComment.replies.slice(0, 2).map((reply) => (
                <div key={reply.id} className="flex items-start gap-1.5">
                  <Reply
                    size={10}
                    className="text-gray-300 rotate-180 mt-1 shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {reply.resident.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 line-clamp-1">
                      {reply.content}
                    </span>
                  </div>
                </div>
              ))}
              {popoverComment.replies.length > 2 && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  +{popoverComment.replies.length - 2} more repl
                  {popoverComment.replies.length - 2 !== 1 ? "ies" : "y"}
                </p>
              )}
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {popoverComment.replies.length > 0
                ? `${popoverComment.replies.length} repl${popoverComment.replies.length !== 1 ? "ies" : "y"}`
                : "No replies yet"}
            </span>
            <button
              onClick={() => {
                setActiveCommentId(popoverComment.id);
                setSidebarOpen(true);
                setActiveHighlight(null);
              }}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              Open in sidebar →
            </button>
          </div>
        </div>
      )}

      {/* Floating comments button (always visible to toggle sidebar) */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed bottom-6 right-6 flex items-center gap-2 bg-primary-600 text-white px-5 py-3 rounded-full shadow-lg hover:bg-primary-700 transition-colors z-40"
        >
          <MessageSquare size={18} />
          <span className="text-sm font-medium">
            Comments ({commentCount})
          </span>
        </button>
      )}

      {/* Desktop: auto-open sidebar button */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="hidden lg:flex fixed top-1/2 right-0 -translate-y-1/2 items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-r-0 text-gray-600 dark:text-gray-300 px-2 py-4 rounded-l-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors z-30"
          style={{ writingMode: "vertical-rl" }}
        >
          <MessageSquare size={14} />
          <span className="text-xs font-medium">
            Comments ({commentCount})
          </span>
        </button>
      )}
    </div>
  );
}
