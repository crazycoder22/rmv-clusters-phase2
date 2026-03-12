"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, PenLine, Send, CheckCircle } from "lucide-react";
import RichTextEditor from "@/components/editor/RichTextEditor";

export default function SubmitArticlePage() {
  const { data: session } = useSession();
  const [title, setTitle] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !contentHtml.trim()) return;
    setSubmitting(true);

    const res = await fetch("/api/newsletters/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), contentHtml }),
    });

    if (res.ok) {
      setSubmitted(true);
    } else {
      const data = await res.json();
      alert(data.error || "Failed to submit article");
    }
    setSubmitting(false);
  }

  if (!session?.user?.isApproved) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <PenLine className="text-gray-400" size={48} />
        <p className="text-gray-500 text-center">
          Only approved residents can submit articles.
        </p>
        <Link
          href="/newsletters"
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          Back to Newsletters
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <CheckCircle className="text-green-500" size={48} />
        <h2 className="text-xl font-semibold text-gray-900">
          Article Submitted!
        </h2>
        <p className="text-gray-500 text-center max-w-md">
          Your article has been submitted for review. The admin team will review
          it and may include it in an upcoming newsletter.
        </p>
        <div className="flex gap-3 mt-2">
          <Link
            href="/newsletters"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            Back to Newsletters
          </Link>
          <button
            onClick={() => {
              setSubmitted(false);
              setTitle("");
              setContentHtml("");
            }}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/newsletters"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <PenLine className="text-primary-600" size={24} />
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Submit an Article
            </h1>
            <p className="text-sm text-gray-500">
              Share your story with the RMV Clusters community
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Article Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your article a catchy title..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content *
              </label>
              <RichTextEditor content={contentHtml} onChange={setContentHtml} />
              <p className="text-xs text-gray-400 mt-1">
                Use the toolbar to format your article. You can add headings,
                lists, links, and images (via URL).
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-400">
                Submitting as {session.user?.name}
              </p>
              <button
                type="submit"
                disabled={submitting || !title.trim() || !contentHtml.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                <Send size={16} />
                {submitting ? "Submitting..." : "Submit for Review"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
