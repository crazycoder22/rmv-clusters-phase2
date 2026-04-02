"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  MessageSquare,
  User,
  Calendar,
  Loader2,
  Link as LinkIcon,
} from "lucide-react";

interface ReviewDocItem {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  createdBy: { id: string; name: string };
  linkedDocument: { id: string; name: string } | null;
  _count: { comments: number };
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PUBLISHED: {
    label: "Open for Review",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  CLOSED: {
    label: "Closed",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  },
};

export default function ReviewDocsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [docs, setDocs] = useState<ReviewDocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/");
    } else if (authStatus === "authenticated" && !session?.user?.isApproved) {
      router.push("/");
    }
  }, [authStatus, session, router]);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/review-docs");
      if (res.ok) {
        const data = await res.json();
        setDocs(data.docs);
      } else {
        setError("Failed to load review documents.");
      }
    } catch {
      setError("Failed to load review documents.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated" || !session?.user?.isApproved) return;
    fetchDocs();
  }, [authStatus, session, fetchDocs]);

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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <FileText className="text-primary-600" size={28} />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Review Documents
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 ml-10">
          Review community documents and share your feedback
        </p>
      </div>

      {docs.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <FileText className="mx-auto mb-3 text-gray-300 dark:text-gray-600" size={48} />
          <p className="text-gray-500 dark:text-gray-400">
            No documents are available for review right now.
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Check back later for new documents.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => {
            const statusCfg = STATUS_CONFIG[doc.status] || {
              label: doc.status,
              className: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
            };

            return (
              <Link
                key={doc.id}
                href={`/review-docs/${doc.id}`}
                className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {doc.title}
                      </h3>
                      <span
                        className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.className}`}
                      >
                        {statusCfg.label}
                      </span>
                    </div>

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
                      <span className="flex items-center gap-1">
                        <MessageSquare size={14} />
                        {doc._count.comments} comment
                        {doc._count.comments !== 1 ? "s" : ""}
                      </span>
                      {doc.linkedDocument && (
                        <span className="flex items-center gap-1 text-primary-600">
                          <LinkIcon size={14} />
                          {doc.linkedDocument.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
