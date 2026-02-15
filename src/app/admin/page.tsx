"use client";

import { useState, useEffect, useCallback } from "react";
import { useRole } from "@/hooks/useRole";
import clsx from "clsx";
import type { Announcement } from "@/types";

interface ResidentWithRole {
  id: string;
  email: string;
  name: string;
  phone: string;
  block: number;
  flatNumber: string;
  residentType: string;
  role: { name: string };
}

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  block: "",
  flatNumber: "",
  residentType: "",
  roleName: "RESIDENT",
};

const emptyNewsForm = {
  title: "",
  date: "",
  category: "general",
  priority: "normal",
  summary: "",
  body: "",
  author: "",
  link: "",
  linkText: "",
  published: true,
};

type TabId = "add" | "manage" | "news";

export default function AdminPage() {
  const { role, isAdmin, isSuperAdmin, isLoading } = useRole();
  const [activeTab, setActiveTab] = useState<TabId>("news");
  const [residents, setResidents] = useState<ResidentWithRole[]>([]);
  const [loadingResidents, setLoadingResidents] = useState(false);

  // Add resident form state
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Role update state
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // News state
  const [newsForm, setNewsForm] = useState(emptyNewsForm);
  const [newsSubmitting, setNewsSubmitting] = useState(false);
  const [newsError, setNewsError] = useState("");
  const [newsSuccess, setNewsSuccess] = useState("");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchResidents = useCallback(async () => {
    setLoadingResidents(true);
    try {
      const res = await fetch("/api/admin/residents");
      if (res.ok) {
        const data = await res.json();
        setResidents(data.residents);
      }
    } catch {
      // silently fail, user can retry
    } finally {
      setLoadingResidents(false);
    }
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    setLoadingNews(true);
    try {
      const res = await fetch("/api/admin/announcements");
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data.announcements);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingNews(false);
    }
  }, []);

  useEffect(() => {
    if (role === "SUPERADMIN") {
      fetchResidents();
    }
  }, [role, fetchResidents]);

  useEffect(() => {
    if (role === "ADMIN" || role === "SUPERADMIN") {
      fetchAnnouncements();
    }
  }, [role, fetchAnnouncements]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!isAdmin() && !isSuperAdmin()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-500">
            You do not have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddResident = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/residents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      setResidents((prev) => [...prev, data.resident]);
      setForm(emptyForm);
      setSuccess("Resident added successfully!");
      setTimeout(() => setSuccess(""), 4000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (residentId: string, newRoleName: string) => {
    setUpdatingId(residentId);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ residentId, newRoleName }),
      });

      if (res.ok) {
        const data = await res.json();
        setResidents((prev) =>
          prev.map((r) =>
            r.id === residentId ? { ...r, role: data.resident.role } : r
          )
        );
      }
    } catch {
      // silently fail
    } finally {
      setUpdatingId(null);
    }
  };

  // News handlers
  const handleNewsChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;
    setNewsForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleNewsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewsError("");
    setNewsSuccess("");
    setNewsSubmitting(true);

    try {
      const url = editingId
        ? `/api/admin/announcements/${editingId}`
        : "/api/admin/announcements";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newsForm),
      });

      const data = await res.json();

      if (!res.ok) {
        setNewsError(data.error || "Something went wrong");
        return;
      }

      if (editingId) {
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === editingId ? data.announcement : a))
        );
        setNewsSuccess("Announcement updated successfully!");
      } else {
        setAnnouncements((prev) => [data.announcement, ...prev]);
        setNewsSuccess("Announcement created successfully!");
      }

      setNewsForm(emptyNewsForm);
      setEditingId(null);
      setTimeout(() => setNewsSuccess(""), 4000);
    } catch {
      setNewsError("Network error. Please try again.");
    } finally {
      setNewsSubmitting(false);
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setNewsForm({
      title: announcement.title,
      date: announcement.date
        ? new Date(announcement.date).toISOString().split("T")[0]
        : "",
      category: announcement.category,
      priority: announcement.priority,
      summary: announcement.summary,
      body: announcement.body,
      author: announcement.author,
      link: announcement.link || "",
      linkText: announcement.linkText || "",
      published: announcement.published ?? true,
    });
    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNewsForm(emptyNewsForm);
    setNewsError("");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      // silently fail
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePublished = async (id: string, currentlyPublished: boolean) => {
    setTogglingId(id);
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !currentlyPublished }),
      });
      if (res.ok) {
        setAnnouncements((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, published: !currentlyPublished } : a
          )
        );
      }
    } catch {
      // silently fail
    } finally {
      setTogglingId(null);
    }
  };

  const tabs: { id: TabId; label: string; superOnly?: boolean }[] = [
    { id: "news", label: `Manage News (${announcements.length})` },
    { id: "add", label: "Add Resident", superOnly: true },
    { id: "manage", label: `Manage Roles (${residents.length})`, superOnly: true },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-primary-800 mb-1">
        Admin Dashboard
      </h1>
      <p className="text-gray-500 mb-8">
        Manage news, residents and roles for RMV Clusters Phase II.
      </p>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="flex space-x-8">
          {tabs
            .filter((tab) => !tab.superOnly || isSuperAdmin())
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "pb-3 px-1 border-b-2 font-medium text-sm transition-colors",
                  activeTab === tab.id
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                {tab.label}
              </button>
            ))}
        </nav>
      </div>

      {/* Tab: Manage News */}
      {activeTab === "news" && (
        <div>
          {/* Create / Edit Form */}
          <div className="max-w-2xl mb-10">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {editingId ? "Edit Announcement" : "Create Announcement"}
            </h2>

            {newsSuccess && (
              <div className="rounded-md bg-green-50 border border-green-200 p-3 mb-4">
                <p className="text-sm text-green-800">{newsSuccess}</p>
              </div>
            )}

            <form onSubmit={handleNewsSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  value={newsForm.title}
                  onChange={handleNewsChange}
                  placeholder="Announcement title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={newsForm.date}
                    onChange={handleNewsChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    name="category"
                    value={newsForm.category}
                    onChange={handleNewsChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="general">General</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="event">Event</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    name="priority"
                    value={newsForm.priority}
                    onChange={handleNewsChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Author
                </label>
                <input
                  type="text"
                  name="author"
                  required
                  value={newsForm.author}
                  onChange={handleNewsChange}
                  placeholder="e.g., RMV Committee"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Summary
                </label>
                <textarea
                  name="summary"
                  required
                  rows={2}
                  value={newsForm.summary}
                  onChange={handleNewsChange}
                  placeholder="Brief summary shown in the news feed"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Detailed Description
                </label>
                <textarea
                  name="body"
                  required
                  rows={4}
                  value={newsForm.body}
                  onChange={handleNewsChange}
                  placeholder="Full details shown when &quot;Read more&quot; is expanded"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Link (optional)
                  </label>
                  <input
                    type="url"
                    name="link"
                    value={newsForm.link}
                    onChange={handleNewsChange}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Link Text (optional)
                  </label>
                  <input
                    type="text"
                    name="linkText"
                    value={newsForm.linkText}
                    onChange={handleNewsChange}
                    placeholder="e.g., View Details"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="published"
                  name="published"
                  checked={newsForm.published}
                  onChange={handleNewsChange}
                  className="h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                />
                <label
                  htmlFor="published"
                  className="text-sm font-medium text-gray-700"
                >
                  Published (visible on News page)
                </label>
              </div>

              {newsError && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-800">{newsError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={newsSubmitting}
                  className="flex-1 py-2 px-4 bg-primary-600 text-white font-medium rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {newsSubmitting
                    ? editingId
                      ? "Updating..."
                      : "Creating..."
                    : editingId
                      ? "Update Announcement"
                      : "Create Announcement"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="py-2 px-4 bg-gray-100 text-gray-700 font-medium rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Announcements List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">
                All Announcements
              </h2>
              <button
                onClick={fetchAnnouncements}
                disabled={loadingNews}
                className="text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50"
              >
                {loadingNews ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {loadingNews && announcements.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Loading announcements...
              </p>
            ) : announcements.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No announcements yet. Create one above.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-600">
                      <th className="pb-3 pr-4 font-medium">Title</th>
                      <th className="pb-3 pr-4 font-medium">Date</th>
                      <th className="pb-3 pr-4 font-medium">Category</th>
                      <th className="pb-3 pr-4 font-medium">Priority</th>
                      <th className="pb-3 pr-4 font-medium">Status</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {announcements.map((a) => (
                      <tr
                        key={a.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-3 pr-4 font-medium text-gray-900 max-w-[200px] truncate">
                          {a.title}
                        </td>
                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">
                          {new Date(a.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={clsx(
                              "inline-block px-2 py-0.5 text-xs font-medium rounded-full capitalize",
                              a.category === "urgent" &&
                                "bg-red-100 text-red-700",
                              a.category === "maintenance" &&
                                "bg-yellow-100 text-yellow-700",
                              a.category === "event" &&
                                "bg-blue-100 text-blue-700",
                              a.category === "general" &&
                                "bg-gray-100 text-gray-700"
                            )}
                          >
                            {a.category}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={clsx(
                              "inline-block px-2 py-0.5 text-xs font-medium rounded-full capitalize",
                              a.priority === "high" &&
                                "bg-red-100 text-red-700",
                              a.priority === "normal" &&
                                "bg-gray-100 text-gray-700",
                              a.priority === "low" &&
                                "bg-green-100 text-green-700"
                            )}
                          >
                            {a.priority}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <button
                            onClick={() =>
                              handleTogglePublished(a.id, a.published ?? true)
                            }
                            disabled={togglingId === a.id}
                            className={clsx(
                              "inline-block px-2 py-0.5 text-xs font-medium rounded-full cursor-pointer transition-colors disabled:opacity-50",
                              a.published !== false
                                ? "bg-green-100 text-green-700 hover:bg-green-200"
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            )}
                          >
                            {a.published !== false ? "Published" : "Draft"}
                          </button>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(a)}
                              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(a.id)}
                              disabled={deletingId === a.id}
                              className="text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                            >
                              {deletingId === a.id ? "..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Add Resident (SuperAdmin only) */}
      {activeTab === "add" && isSuperAdmin() && (
        <div className="max-w-lg">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Add Resident on Behalf
          </h2>

          {success && (
            <div className="rounded-md bg-green-50 border border-green-200 p-3 mb-4">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          <form onSubmit={handleAddResident} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                name="name"
                required
                value={form.name}
                onChange={handleChange}
                placeholder="Full name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="email@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                required
                value={form.phone}
                onChange={handleChange}
                placeholder="e.g., 9876543210"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Block
                </label>
                <select
                  name="block"
                  required
                  value={form.block}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select</option>
                  <option value="1">Block 1</option>
                  <option value="2">Block 2</option>
                  <option value="3">Block 3</option>
                  <option value="4">Block 4</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Flat / Door No.
                </label>
                <input
                  type="text"
                  name="flatNumber"
                  required
                  value={form.flatNumber}
                  onChange={handleChange}
                  placeholder="e.g., 101"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resident Type
                </label>
                <select
                  name="residentType"
                  required
                  value={form.residentType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select</option>
                  <option value="OWNER">Owner</option>
                  <option value="TENANT">Tenant</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  name="roleName"
                  value={form.roleName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="RESIDENT">Resident</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 px-4 bg-primary-600 text-white font-medium rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Adding..." : "Add Resident"}
            </button>
          </form>
        </div>
      )}

      {/* Tab: Manage Roles (SuperAdmin only) */}
      {activeTab === "manage" && isSuperAdmin() && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              All Residents
            </h2>
            <button
              onClick={fetchResidents}
              disabled={loadingResidents}
              className="text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50"
            >
              {loadingResidents ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {loadingResidents && residents.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Loading residents...
            </p>
          ) : residents.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No residents found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600">
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Email</th>
                    <th className="pb-3 pr-4 font-medium">Block / Flat</th>
                    <th className="pb-3 pr-4 font-medium">Phone</th>
                    <th className="pb-3 pr-4 font-medium">Type</th>
                    <th className="pb-3 pr-4 font-medium">Role</th>
                    <th className="pb-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {residents.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 pr-4 font-medium text-gray-900">
                        {r.name}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">{r.email}</td>
                      <td className="py-3 pr-4 text-gray-600">
                        B{r.block} - {r.flatNumber}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">{r.phone}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={clsx(
                            "inline-block px-2 py-0.5 text-xs font-medium rounded-full",
                            r.residentType === "OWNER"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-amber-100 text-amber-700"
                          )}
                        >
                          {r.residentType}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={clsx(
                            "inline-block px-2 py-0.5 text-xs font-medium rounded-full",
                            r.role.name === "SUPERADMIN" &&
                              "bg-purple-100 text-purple-700",
                            r.role.name === "ADMIN" &&
                              "bg-green-100 text-green-700",
                            r.role.name === "RESIDENT" &&
                              "bg-gray-100 text-gray-700"
                          )}
                        >
                          {r.role.name}
                        </span>
                      </td>
                      <td className="py-3">
                        {r.role.name === "SUPERADMIN" ? (
                          <span className="text-xs text-gray-400">&mdash;</span>
                        ) : (
                          <select
                            value={r.role.name}
                            disabled={updatingId === r.id}
                            onChange={(e) =>
                              handleRoleChange(r.id, e.target.value)
                            }
                            className="text-sm border border-gray-300 rounded px-2 py-1 disabled:opacity-50"
                          >
                            <option value="RESIDENT">Resident</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
