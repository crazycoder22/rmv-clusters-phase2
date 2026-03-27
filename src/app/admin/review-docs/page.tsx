"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Plus, FileText, MessageSquare, User } from "lucide-react";
import { canManageReviewDocs } from "@/lib/roles";

interface ReviewDoc {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  createdBy: { id: string; name: string; email: string; flatNumber: string };
  _count: { comments: number };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PUBLISHED: "bg-green-100 text-green-700",
  CLOSED: "bg-red-100 text-red-700",
};

export default function AdminReviewDocsPage() {
  const { data: session, status: authStatus } = useSession();
  const [docs, setDocs] = useState<ReviewDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("ALL");

  const roles = session?.user?.roles ?? [];
  const hasAccess = canManageReviewDocs(roles);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!hasAccess) {
      setLoading(false);
      return;
    }
    fetchDocs();
  }, [authStatus, hasAccess]);

  async function fetchDocs() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/review-docs");
      if (res.ok) {
        const data = await res.json();
        setDocs(data.reviewDocs);
      } else {
        setError("Failed to load review documents.");
      }
    } catch {
      setError("Failed to load review documents.");
    }
    setLoading(false);
  }

  if (authStatus === "loading" || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-32 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">You do not have access to this page.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchDocs}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  const filtered =
    filter === "ALL" ? docs : docs.filter((d) => d.status === filter);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Review Documents</h1>
        <Link
          href="/admin/review-docs/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          New Review Doc
        </Link>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-6">
        {["ALL", "DRAFT", "PUBLISHED", "CLOSED"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === s
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <FileText className="mx-auto mb-3 text-gray-300" size={48} />
          <p className="text-gray-500">No review documents found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((doc) => (
            <Link
              key={doc.id}
              href={`/admin/review-docs/${doc.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {doc.title}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_COLORS[doc.status] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {doc.status.charAt(0) + doc.status.slice(1).toLowerCase()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <User size={14} />
                      {doc.createdBy.name}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare size={14} />
                      {doc._count.comments} comment
                      {doc._count.comments !== 1 ? "s" : ""}
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
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
