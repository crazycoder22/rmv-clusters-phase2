"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Save,
  Eye,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  CalendarRange,
  Globe,
  Loader2,
  Newspaper,
} from "lucide-react";
import RichTextEditor from "@/components/editor/RichTextEditor";
import type { NewsletterSectionData, NewsletterSectionType } from "@/types";

interface NewsletterFull {
  id: string;
  title: string;
  edition: string | null;
  coverHtml: string | null;
  status: string;
  publishedAt: string | null;
  sections: NewsletterSectionData[];
  createdAt: string;
}

const SECTION_TYPES: { value: NewsletterSectionType; label: string; emoji: string }[] = [
  { value: "news", label: "News", emoji: "📰" },
  { value: "article", label: "Article", emoji: "✍️" },
  { value: "ad", label: "Advertisement", emoji: "📢" },
  { value: "events", label: "Events", emoji: "📅" },
];

export default function NewsletterEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [newsletter, setNewsletter] = useState<NewsletterFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Newsletter fields
  const [title, setTitle] = useState("");
  const [edition, setEdition] = useState("");
  const [coverHtml, setCoverHtml] = useState("");

  // Add section form
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionType, setNewSectionType] = useState<NewsletterSectionType>("news");
  const [newSectionTitle, setNewSectionTitle] = useState("");

  // Edit section
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editSectionContent, setEditSectionContent] = useState("");
  const [editSectionTitle, setEditSectionTitle] = useState("");
  const [editSectionType, setEditSectionType] = useState<NewsletterSectionType>("news");
  const [editAuthorName, setEditAuthorName] = useState("");
  const [editAuthorBlock, setEditAuthorBlock] = useState("");
  const [editAuthorFlat, setEditAuthorFlat] = useState("");

  // Pull events
  const [showPullEvents, setShowPullEvents] = useState(false);
  const [eventStartDate, setEventStartDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [pullingEvents, setPullingEvents] = useState(false);

  const fetchNewsletter = useCallback(async () => {
    const res = await fetch(`/api/admin/newsletters/${id}`);
    if (res.ok) {
      const data = await res.json();
      setNewsletter(data.newsletter);
      setTitle(data.newsletter.title);
      setEdition(data.newsletter.edition || "");
      setCoverHtml(data.newsletter.coverHtml || "");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchNewsletter();
  }, [fetchNewsletter]);

  async function handleSaveDetails() {
    setSaving(true);
    const res = await fetch(`/api/admin/newsletters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, edition, coverHtml }),
    });
    if (res.ok) {
      const data = await res.json();
      setNewsletter(data.newsletter);
    }
    setSaving(false);
  }

  async function handlePublish() {
    const action = newsletter?.status === "published" ? "draft" : "published";
    const confirmMsg =
      action === "published"
        ? "Publish this newsletter? It will be visible to all residents."
        : "Unpublish this newsletter? It will be hidden from public view.";
    if (!confirm(confirmMsg)) return;

    setSaving(true);
    const res = await fetch(`/api/admin/newsletters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: action }),
    });
    if (res.ok) {
      const data = await res.json();
      setNewsletter(data.newsletter);
    }
    setSaving(false);
  }

  async function handleAddSection(e: React.FormEvent) {
    e.preventDefault();
    if (!newSectionTitle.trim()) return;

    const res = await fetch(`/api/admin/newsletters/${id}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: newSectionType,
        title: newSectionTitle.trim(),
        contentHtml: "",
      }),
    });
    if (res.ok) {
      setShowAddSection(false);
      setNewSectionTitle("");
      fetchNewsletter();
    }
  }

  function startEditSection(section: NewsletterSectionData) {
    setEditingSectionId(section.id);
    setEditSectionContent(section.contentHtml);
    setEditSectionTitle(section.title);
    setEditSectionType(section.type as NewsletterSectionType);
    setEditAuthorName(section.authorName || "");
    setEditAuthorBlock(section.authorBlock?.toString() || "");
    setEditAuthorFlat(section.authorFlat || "");
  }

  async function handleSaveSection() {
    if (!editingSectionId) return;
    setSaving(true);

    const res = await fetch(
      `/api/admin/newsletters/${id}/sections/${editingSectionId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editSectionTitle,
          type: editSectionType,
          contentHtml: editSectionContent,
          authorName: editAuthorName,
          authorBlock: editAuthorBlock ? parseInt(editAuthorBlock) : null,
          authorFlat: editAuthorFlat,
        }),
      }
    );
    if (res.ok) {
      setEditingSectionId(null);
      fetchNewsletter();
    }
    setSaving(false);
  }

  async function handleDeleteSection(sectionId: string) {
    if (!confirm("Delete this section?")) return;
    const res = await fetch(
      `/api/admin/newsletters/${id}/sections/${sectionId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      fetchNewsletter();
    }
  }

  async function handleMoveSection(sectionId: string, direction: "up" | "down") {
    if (!newsletter) return;
    const sections = [...newsletter.sections];
    const idx = sections.findIndex((s) => s.id === sectionId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sections.length) return;

    [sections[idx], sections[swapIdx]] = [sections[swapIdx], sections[idx]];
    const sectionIds = sections.map((s) => s.id);

    await fetch(`/api/admin/newsletters/${id}/sections/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionIds }),
    });
    fetchNewsletter();
  }

  async function handlePullEvents(e: React.FormEvent) {
    e.preventDefault();
    if (!eventStartDate || !eventEndDate) return;
    setPullingEvents(true);

    const res = await fetch(`/api/admin/newsletters/${id}/pull-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: eventStartDate, endDate: eventEndDate }),
    });
    if (res.ok) {
      setShowPullEvents(false);
      setEventStartDate("");
      setEventEndDate("");
      fetchNewsletter();
    }
    setPullingEvents(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }

  if (!newsletter) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Newsletter not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/newsletters"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <Newspaper className="text-primary-600" size={24} />
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {newsletter.title}
            </h1>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                newsletter.status === "published"
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {newsletter.status === "published" ? "Published" : "Draft"}
            </span>
          </div>
          <div className="flex gap-2">
            {newsletter.status === "published" && (
              <Link
                href={`/newsletters/${newsletter.id}`}
                className="flex items-center gap-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Eye size={16} />
                View
              </Link>
            )}
            <button
              onClick={handlePublish}
              disabled={saving}
              className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                newsletter.status === "published"
                  ? "bg-yellow-500 text-white hover:bg-yellow-600"
                  : "bg-green-600 text-white hover:bg-green-700"
              } disabled:opacity-50`}
            >
              <Globe size={16} />
              {newsletter.status === "published" ? "Unpublish" : "Publish"}
            </button>
          </div>
        </div>

        {/* Newsletter Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold mb-4">Newsletter Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
                placeholder="e.g., March 2026"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Editor&apos;s Note / Introduction
            </label>
            <RichTextEditor content={coverHtml} onChange={setCoverHtml} />
          </div>
          <button
            onClick={handleSaveDetails}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Details"}
          </button>
        </div>

        {/* Sections */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Sections ({newsletter.sections.length})
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPullEvents(!showPullEvents)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <CalendarRange size={16} />
                Pull Events
              </button>
              <button
                onClick={() => setShowAddSection(!showAddSection)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
              >
                <Plus size={16} />
                Add Section
              </button>
            </div>
          </div>

          {/* Pull Events Form */}
          {showPullEvents && (
            <form
              onSubmit={handlePullEvents}
              className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg"
            >
              <p className="text-sm font-medium text-blue-800 mb-3">
                Pull events from calendar into a new Events section
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={eventStartDate}
                    onChange={(e) => setEventStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={eventEndDate}
                    onChange={(e) => setEventEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  type="submit"
                  disabled={pullingEvents}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {pullingEvents ? "Pulling..." : "Pull Events"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPullEvents(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Add Section Form */}
          {showAddSection && (
            <form
              onSubmit={handleAddSection}
              className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Type
                  </label>
                  <select
                    value={newSectionType}
                    onChange={(e) =>
                      setNewSectionType(e.target.value as NewsletterSectionType)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {SECTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.emoji} {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                    placeholder="Section title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddSection(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Section List */}
          {newsletter.sections.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">
              No sections yet. Add a section or pull events to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {newsletter.sections.map((section, idx) => {
                const typeInfo = SECTION_TYPES.find(
                  (t) => t.value === section.type
                );
                const isEditing = editingSectionId === section.id;

                return (
                  <div
                    key={section.id}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    {/* Section Header */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <GripVertical
                        size={16}
                        className="text-gray-400 flex-shrink-0"
                      />
                      <span className="text-sm">{typeInfo?.emoji}</span>
                      <span className="text-xs font-medium text-gray-500 uppercase">
                        {typeInfo?.label}
                      </span>
                      <span className="mx-1 text-gray-300">|</span>
                      <span className="text-sm font-medium text-gray-900 flex-1 truncate">
                        {section.title}
                      </span>
                      {section.authorName && (
                        <span className="text-xs text-gray-500">
                          by {section.authorName}
                        </span>
                      )}
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => handleMoveSection(section.id, "up")}
                          disabled={idx === 0}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          title="Move up"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          onClick={() => handleMoveSection(section.id, "down")}
                          disabled={idx === newsletter.sections.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          title="Move down"
                        >
                          <ChevronDown size={16} />
                        </button>
                        <button
                          onClick={() =>
                            isEditing
                              ? setEditingSectionId(null)
                              : startEditSection(section)
                          }
                          className="p-1 text-gray-400 hover:text-primary-600"
                          title={isEditing ? "Close" : "Edit"}
                        >
                          {isEditing ? (
                            <ChevronUp size={16} />
                          ) : (
                            <Save size={16} />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteSection(section.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Section Editor (when expanded) */}
                    {isEditing && (
                      <div className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Type
                            </label>
                            <select
                              value={editSectionType}
                              onChange={(e) =>
                                setEditSectionType(
                                  e.target.value as NewsletterSectionType
                                )
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            >
                              {SECTION_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.emoji} {t.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Title
                            </label>
                            <input
                              type="text"
                              value={editSectionTitle}
                              onChange={(e) =>
                                setEditSectionTitle(e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                        </div>

                        {(editSectionType === "article" ||
                          editSectionType === "ad") && (
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Author Name
                              </label>
                              <input
                                type="text"
                                value={editAuthorName}
                                onChange={(e) =>
                                  setEditAuthorName(e.target.value)
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Block
                              </label>
                              <select
                                value={editAuthorBlock}
                                onChange={(e) =>
                                  setEditAuthorBlock(e.target.value)
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              >
                                <option value="">—</option>
                                <option value="1">Block 1</option>
                                <option value="2">Block 2</option>
                                <option value="3">Block 3</option>
                                <option value="4">Block 4</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Flat
                              </label>
                              <input
                                type="text"
                                value={editAuthorFlat}
                                onChange={(e) =>
                                  setEditAuthorFlat(e.target.value)
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              />
                            </div>
                          </div>
                        )}

                        <div className="mb-3">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Content
                          </label>
                          <RichTextEditor
                            content={editSectionContent}
                            onChange={setEditSectionContent}
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveSection}
                            disabled={saving}
                            className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                          >
                            <Save size={14} />
                            {saving ? "Saving..." : "Save Section"}
                          </button>
                          <button
                            onClick={() => setEditingSectionId(null)}
                            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
