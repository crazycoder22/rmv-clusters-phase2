"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Newspaper,
  Trash2,
  Edit,
  Eye,
  FileText,
  Inbox,
  Loader2,
} from "lucide-react";

interface NewsletterListItem {
  id: string;
  title: string;
  edition: string | null;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  _count: { sections: number };
}

export default function AdminNewslettersPage() {
  const router = useRouter();
  const [newsletters, setNewsletters] = useState<NewsletterListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [edition, setEdition] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchNewsletters = useCallback(async () => {
    const res = await fetch("/api/admin/newsletters");
    if (res.ok) {
      const data = await res.json();
      setNewsletters(data.newsletters);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNewsletters();
  }, [fetchNewsletters]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    const res = await fetch("/api/admin/newsletters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), edition: edition.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/admin/newsletters/${data.newsletter.id}`);
    }
    setCreating(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this newsletter? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/newsletters/${id}`, { method: "DELETE" });
    if (res.ok) {
      setNewsletters((prev) => prev.filter((n) => n.id !== id));
    }
  }

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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Newspaper className="text-primary-600" size={28} />
            <h1 className="text-2xl font-bold text-gray-900">Newsletters</h1>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/newsletters/submissions"
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Inbox size={16} />
              Submissions
            </Link>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              <Plus size={16} />
              New Newsletter
            </button>
          </div>
        </div>

        {/* Create Form */}
        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="mb-6 bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
          >
            <h2 className="text-lg font-semibold mb-4">Create Newsletter</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., RMV Clusters Monthly Newsletter"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Edition
                </label>
                <input
                  type="text"
                  value={edition}
                  onChange={(e) => setEdition(e.target.value)}
                  placeholder="e.g., March 2026 / Q1 2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                disabled={creating || !title.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setTitle("");
                  setEdition("");
                }}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* List */}
        {newsletters.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <FileText className="mx-auto text-gray-400 mb-3" size={48} />
            <p className="text-gray-500">No newsletters yet.</p>
            <p className="text-sm text-gray-400 mt-1">
              Create your first newsletter to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {newsletters.map((nl) => (
              <div
                key={nl.id}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {nl.title}
                      </h3>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          nl.status === "published"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {nl.status === "published" ? "Published" : "Draft"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {nl.edition && <span>{nl.edition}</span>}
                      <span>{nl._count.sections} sections</span>
                      <span>
                        Created{" "}
                        {new Date(nl.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      {nl.publishedAt && (
                        <span>
                          Published{" "}
                          {new Date(nl.publishedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {nl.status === "published" && (
                      <Link
                        href={`/newsletters/${nl.id}`}
                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="View published"
                      >
                        <Eye size={18} />
                      </Link>
                    )}
                    <Link
                      href={`/admin/newsletters/${nl.id}`}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit size={18} />
                    </Link>
                    <button
                      onClick={() => handleDelete(nl.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
