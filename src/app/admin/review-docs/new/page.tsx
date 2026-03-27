"use client";

import { useState } from "react";
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

export default function NewReviewDocPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
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

  if (authStatus === "loading") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">You do not have access to this page.</p>
      </div>
    );
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const res = await fetch("/api/admin/review-docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content,
        linkedDocumentId: linkedDoc?.id || null,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/admin/review-docs/${data.reviewDoc.id}`);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create review document");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href="/admin/review-docs"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-6"
      >
        <ArrowLeft size={16} />
        Back to Review Documents
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        New Review Document
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="e.g., Clubhouse Renovation Proposal"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Linked Document (optional)
          </label>
          {linkedDoc ? (
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
              <Paperclip size={16} className="text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-800 flex-1 truncate">
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
            <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 flex items-center gap-2 border-b border-gray-200">
                <Search size={14} className="text-gray-400" />
                <input
                  type="text"
                  value={docSearch}
                  onChange={(e) => {
                    setDocSearch(e.target.value);
                    searchDocuments(e.target.value);
                  }}
                  placeholder="Search documents..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowDocSearch(false)}
                  className="p-1 text-gray-400 hover:text-gray-600"
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
                      className="w-full text-left px-3 py-2 hover:bg-primary-50 flex items-center gap-3 border-b border-gray-100 last:border-0"
                    >
                      <Paperclip
                        size={14}
                        className="text-gray-400 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-gray-800 truncate block">
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
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save as Draft"}
          </button>
          <Link
            href="/admin/review-docs"
            className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
