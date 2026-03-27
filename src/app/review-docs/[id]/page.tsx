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

  const contentRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

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

  // Text selection handler
  useEffect(() => {
    function handleMouseUp() {
      if (!contentRef.current) return;
      if (doc?.status !== "PUBLISHED") return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) {
        // Delay clearing to allow toolbar click to fire
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

      // Check if selection is within our content area
      if (!contentRef.current.contains(range.commonAncestorContainer)) {
        return;
      }

      const rect = range.getBoundingClientRect();
      const containerRect = contentRef.current.getBoundingClientRect();

      // Calculate offsets relative to the content text
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
    <div className="min-h-screen bg-gray-50">
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
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Back to Review Documents
            </Link>

            {/* Closed banner */}
            {isClosed && (
              <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 mb-4">
                <AlertCircle size={16} className="text-gray-500 shrink-0" />
                <p className="text-sm text-gray-600">
                  This document is closed for review. No new comments can be
                  added.
                </p>
              </div>
            )}

            {/* Document header */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
                {doc.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
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
                      ? "bg-gray-100 text-gray-600"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {isClosed ? "Closed" : "Open for Review"}
                </span>
              </div>

              {/* Linked document */}
              {doc.linkedDocument && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <LinkIcon size={14} className="text-gray-400" />
                  <span className="text-gray-500">Linked document:</span>
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
                    <span className="font-medium text-gray-800">
                      {doc.linkedDocument.name}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Document content */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-8 relative">
              <div
                ref={contentRef}
                className="newsletter-content prose prose-gray max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed prose-a:text-primary-600 prose-img:rounded-lg"
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
          className={`hidden lg:flex flex-col fixed right-0 top-16 bottom-0 w-[400px] bg-white border-l border-gray-200 transition-transform ${
            sidebarOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare size={18} />
              Comments
            </h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
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
          />
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-[400px] bg-white shadow-xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <MessageSquare size={18} />
                  Comments
                </h2>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
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
              />
            </div>
          </div>
        )}
      </div>

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
          className="hidden lg:flex fixed top-1/2 right-0 -translate-y-1/2 items-center gap-1 bg-white border border-gray-200 border-r-0 text-gray-600 px-2 py-4 rounded-l-lg shadow-sm hover:bg-gray-50 transition-colors z-30"
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
