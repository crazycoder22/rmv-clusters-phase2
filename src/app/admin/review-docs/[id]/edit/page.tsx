"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search, X, Paperclip } from "lucide-react";
import { canManageReviewDocs } from "@/lib/roles";
import RichTextEditor from "@/components/editor/RichTextEditor";

interface SearchDocument {
  id: string;
  name: string;
  driveUrl: string | null;
  fileType: string | null;
  folder: { name: string };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  PUBLISHED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  CLOSED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export default function EditReviewDocPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [docStatus, setDocStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Document link
  const [linkedDoc, setLinkedDoc] = useState<SearchDocument | null>(null);
  const [showDocSearch, setShowDocSearch] = useState(false);
  const [docSearch, setDocSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchDocument[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const roles = session?.user?.roles ?? [];
  const hasAccess = canManageReviewDocs(roles);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!hasAccess) {
      setLoading(false);
      return;
    }
    fetchDoc();
  }, [authStatus, hasAccess, id]);

  async function fetchDoc() {
    const res = await fetch(`/api/admin/review-docs/${id}`);
    if (res.ok) {
      const data = await res.json();
      const doc = data.reviewDoc;
      setTitle(doc.title);
      setContent(doc.content);
      setDocStatus(doc.status);
      if (doc.linkedDocument) {
        setLinkedDoc({
          id: doc.linkedDocument.id,
          name: doc.linkedDocument.name,
          driveUrl: doc.linkedDocument.driveUrl || null,
          fileType: doc.linkedDocument.fileType || null,
          folder: doc.linkedDocument.folder || { name: "" },
        });
      }
    } else {
      setError("Failed to load review document.");
    }
    setLoading(false);
  }

  async function searchDocuments(query: string) {
    setSearchLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const res = await fetch(`/api/documents/search?${params}`);
    if (res.ok) {
      const data = await res.json();
      setSearchResults(data.documents);
    }
    setSearchLoading(false);
  }

  function openDocSearch() {
    setShowDocSearch(true);
    setDocSearch("");
    searchDocuments("");
  }

  function selectDocument(doc: SearchDocument) {
    setLinkedDoc(doc);
    setShowDocSearch(false);
  }

  if (authStatus === "loading" || loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">You do not have access to this page.</p>
      </div>
    );
  }

  if (error && !title) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-red-600">{error}</p>
        <Link
          href="/admin/review-docs"
          className="mt-4 inline-block text-sm text-primary-600 hover:text-primary-700"
        >
          Back to Review Documents
        </Link>
      </div>
    );
  }

  if (docStatus === "CLOSED") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          This document is closed and cannot be edited.
        </p>
        <Link
          href={`/admin/review-docs/${id}`}
          className="mt-4 inline-block text-sm text-primary-600 hover:text-primary-700"
        >
          Back to Document
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const res = await fetch(`/api/admin/review-docs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content,
        linkedDocumentId: linkedDoc?.id || null,
      }),
    });

    if (res.ok) {
      router.push(`/admin/review-docs/${id}`);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to update review document");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href={`/admin/review-docs/${id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 mb-6"
      >
        <ArrowLeft size={16} />
        Back to Document
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Edit Review Document
        </h1>
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
            STATUS_COLORS[docStatus] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          }`}
        >
          {docStatus.charAt(0) + docStatus.slice(1).toLowerCase()}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Content <span className="text-red-500">*</span>
          </label>
          <RichTextEditor
            content={content}
            onChange={setContent}
            placeholder="Write the document content here..."
          />
        </div>

        {/* Document link */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Linked Document (optional)
          </label>
          {linkedDoc ? (
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2.5">
              <Paperclip size={16} className="text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">
                {linkedDoc.name}
              </span>
              <button
                type="button"
                onClick={() => setLinkedDoc(null)}
                className="p-1 text-gray-400 hover:text-red-500"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openDocSearch}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              + Link a document
            </button>
          )}

          {showDocSearch && (
            <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-700 px-3 py-2 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
                <Search size={14} className="text-gray-400" />
                <input
                  type="text"
                  value={docSearch}
                  onChange={(e) => {
                    setDocSearch(e.target.value);
                    searchDocuments(e.target.value);
                  }}
                  placeholder="Search documents..."
                  className="flex-1 bg-transparent dark:text-gray-100 text-sm outline-none placeholder-gray-400"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowDocSearch(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {searchLoading ? (
                  <div className="px-3 py-4 text-center text-sm text-gray-400">
                    Searching...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-gray-400">
                    {docSearch
                      ? "No documents found"
                      : "No documents available"}
                  </div>
                ) : (
                  searchResults.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => selectDocument(doc)}
                      className="w-full text-left px-3 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/30 flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
                    >
                      <Paperclip
                        size={14}
                        className="text-gray-400 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-gray-800 dark:text-gray-200 truncate block">
                          {doc.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {doc.folder.name}
                          {doc.fileType &&
                            ` \u00b7 ${doc.fileType.toUpperCase()}`}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/30 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <Link
            href={`/admin/review-docs/${id}`}
            className="px-5 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm font-medium"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
