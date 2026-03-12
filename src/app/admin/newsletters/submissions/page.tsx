"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Inbox,
  Check,
  X,
  Eye,
  Loader2,
  FileText,
} from "lucide-react";
import RichTextViewer from "@/components/editor/RichTextViewer";
import type { NewsletterSubmissionData } from "@/types";

interface NewsletterOption {
  id: string;
  title: string;
  status: string;
}

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<NewsletterSubmissionData[]>([]);
  const [newsletters, setNewsletters] = useState<NewsletterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<"approved" | "rejected">("approved");
  const [adminNotes, setAdminNotes] = useState("");
  const [targetNewsletterId, setTargetNewsletterId] = useState("");
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const fetchData = useCallback(async () => {
    const [subRes, nlRes] = await Promise.all([
      fetch("/api/admin/newsletters/submissions"),
      fetch("/api/admin/newsletters"),
    ]);
    if (subRes.ok) {
      const data = await subRes.json();
      setSubmissions(data.submissions);
    }
    if (nlRes.ok) {
      const data = await nlRes.json();
      setNewsletters(data.newsletters);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleAction() {
    if (!actionId) return;
    setProcessing(true);

    const res = await fetch(
      `/api/admin/newsletters/submissions/${actionId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: actionStatus,
          adminNotes,
          newsletterId: actionStatus === "approved" ? targetNewsletterId : undefined,
        }),
      }
    );
    if (res.ok) {
      setActionId(null);
      setAdminNotes("");
      setTargetNewsletterId("");
      fetchData();
    }
    setProcessing(false);
  }

  const filteredSubmissions = submissions.filter(
    (s) => filter === "all" || s.status === filter
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/admin/newsletters"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <Inbox className="text-primary-600" size={24} />
          <h1 className="text-xl font-bold text-gray-900">
            Resident Submissions
          </h1>
          <span className="text-sm text-gray-500">
            ({submissions.filter((s) => s.status === "pending").length} pending)
          </span>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-4">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-primary-100 text-primary-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* List */}
        {filteredSubmissions.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <FileText className="mx-auto text-gray-400 mb-3" size={48} />
            <p className="text-gray-500">No {filter !== "all" ? filter : ""} submissions.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSubmissions.map((sub) => (
              <div
                key={sub.id}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {sub.title}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          sub.status === "approved"
                            ? "bg-green-100 text-green-700"
                            : sub.status === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {sub.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      by {sub.resident.name} — Block {sub.resident.block},{" "}
                      {sub.resident.flatNumber} &middot;{" "}
                      {new Date(sub.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    {sub.adminNotes && (
                      <p className="text-xs text-gray-400 mt-1 italic">
                        Admin notes: {sub.adminNotes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setPreviewId(previewId === sub.id ? null : sub.id)
                      }
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Preview"
                    >
                      <Eye size={18} />
                    </button>
                    {sub.status === "pending" && (
                      <>
                        <button
                          onClick={() => {
                            setActionId(sub.id);
                            setActionStatus("approved");
                          }}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Approve"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setActionId(sub.id);
                            setActionStatus("rejected");
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Reject"
                        >
                          <X size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Preview */}
                {previewId === sub.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <RichTextViewer html={sub.contentHtml} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Action Modal */}
        {actionId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
              <h3 className="text-lg font-semibold mb-4">
                {actionStatus === "approved" ? "Approve" : "Reject"} Submission
              </h3>

              {actionStatus === "approved" && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Add to Newsletter (optional)
                  </label>
                  <select
                    value={targetNewsletterId}
                    onChange={(e) => setTargetNewsletterId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Don&apos;t add to any newsletter</option>
                    {newsletters
                      .filter((n) => n.status === "draft")
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.title}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Selecting a newsletter will create an article section
                    automatically.
                  </p>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Notes (optional)
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={2}
                  placeholder={
                    actionStatus === "rejected"
                      ? "Reason for rejection..."
                      : "Any notes..."
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setActionId(null);
                    setAdminNotes("");
                    setTargetNewsletterId("");
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAction}
                  disabled={processing}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
                    actionStatus === "approved"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {processing
                    ? "Processing..."
                    : actionStatus === "approved"
                    ? "Approve"
                    : "Reject"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
