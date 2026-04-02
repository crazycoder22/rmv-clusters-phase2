"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  User,
  Globe,
  Lock,
  Pencil,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileText,
  Paperclip,
  X,
  Search,
  FolderOpen,
  File,
  FileSpreadsheet,
  Image,
  Video,
} from "lucide-react";
import { canManageMeetings } from "@/lib/roles";

interface MeetingRsvp {
  id: string;
  status: string;
  resident: {
    id: string;
    name: string;
    email: string;
    block: number;
    flatNumber: string;
  };
}

interface LinkedDocument {
  id: string;
  document: {
    id: string;
    name: string;
    driveUrl: string | null;
    fileUrl: string | null;
    fileType: string | null;
    folder: { name: string };
  };
}

interface SearchDocument {
  id: string;
  name: string;
  driveUrl: string | null;
  fileType: string | null;
  folder: { name: string };
}

interface Meeting {
  id: string;
  title: string;
  agenda: string;
  date: string;
  location: string;
  status: string;
  isPublic: boolean;
  momUrl: string | null;
  momSummary: string | null;
  creator: { name: string; email: string };
  rsvps: MeetingRsvp[];
  documents: LinkedDocument[];
}

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const RSVP_ICONS: Record<string, typeof CheckCircle2> = {
  ATTENDING: CheckCircle2,
  DECLINED: XCircle,
  MAYBE: HelpCircle,
};

const RSVP_COLORS: Record<string, string> = {
  ATTENDING: "bg-green-600 text-white",
  MAYBE: "bg-amber-500 text-white",
  DECLINED: "bg-red-600 text-white",
};

const RSVP_OUTLINE: Record<string, string> = {
  ATTENDING: "border-green-600 text-green-700 hover:bg-green-50 dark:hover:bg-green-900/30",
  MAYBE: "border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30",
  DECLINED: "border-red-600 text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30",
};

const FILE_TYPE_ICONS: Record<string, typeof File> = {
  pdf: FileText,
  xlsx: FileSpreadsheet,
  xls: FileSpreadsheet,
  doc: FileText,
  docx: FileText,
  image: Image,
  video: Video,
};

export default function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [myRsvp, setMyRsvp] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  // MOM editing
  const [editingMom, setEditingMom] = useState(false);
  const [momUrl, setMomUrl] = useState("");
  const [momSummary, setMomSummary] = useState("");
  const [momSaving, setMomSaving] = useState(false);

  // Document picker
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [docSearch, setDocSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchDocument[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [linkingDocId, setLinkingDocId] = useState<string | null>(null);

  const roles = session?.user?.roles ?? [];
  const hasAccess = canManageMeetings(roles);

  const fetchMeeting = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/meetings/${id}`);
    if (res.ok) {
      const data = await res.json();
      setMeeting(data.meeting);
      setMomUrl(data.meeting.momUrl || "");
      setMomSummary(data.meeting.momSummary || "");

      // Find current user's RSVP
      const userRsvp = data.meeting.rsvps.find(
        (r: MeetingRsvp) => r.resident.email === session?.user?.email
      );
      setMyRsvp(userRsvp?.status || null);
    }
    setLoading(false);
  }, [id, session?.user?.email]);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!hasAccess) {
      setLoading(false);
      return;
    }
    fetchMeeting();
  }, [authStatus, hasAccess, fetchMeeting]);

  async function handleRsvp(status: string) {
    setRsvpLoading(true);
    const res = await fetch(`/api/meetings/${id}/rsvp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setMyRsvp(status);
      await fetchMeeting();
    }
    setRsvpLoading(false);
  }

  async function handleStatusChange(newStatus: string) {
    setStatusLoading(true);
    const res = await fetch(`/api/meetings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      await fetchMeeting();
    }
    setStatusLoading(false);
  }

  async function handleDelete() {
    const res = await fetch(`/api/meetings/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/meetings");
    }
  }

  async function handleSaveMom() {
    setMomSaving(true);
    const res = await fetch(`/api/meetings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ momUrl, momSummary }),
    });
    if (res.ok) {
      setEditingMom(false);
      await fetchMeeting();
    }
    setMomSaving(false);
  }

  // Document picker functions
  async function searchDocuments(query: string) {
    setSearchLoading(true);
    const params = new URLSearchParams({ meetingId: id });
    if (query) params.set("q", query);
    const res = await fetch(`/api/documents/search?${params}`);
    if (res.ok) {
      const data = await res.json();
      setSearchResults(data.documents);
    }
    setSearchLoading(false);
  }

  async function handleLinkDocument(documentId: string) {
    setLinkingDocId(documentId);
    const res = await fetch(`/api/meetings/${id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });
    if (res.ok) {
      await fetchMeeting();
      // Refresh search results to exclude the newly linked doc
      await searchDocuments(docSearch);
    }
    setLinkingDocId(null);
  }

  async function handleUnlinkDocument(documentId: string) {
    const res = await fetch(`/api/meetings/${id}/documents`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });
    if (res.ok) {
      await fetchMeeting();
    }
  }

  function openDocPicker() {
    setShowDocPicker(true);
    setDocSearch("");
    searchDocuments("");
  }

  if (authStatus === "loading" || loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">You do not have access to this page.</p>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">Meeting not found.</p>
      </div>
    );
  }

  const attending = meeting.rsvps.filter((r) => r.status === "ATTENDING");
  const maybe = meeting.rsvps.filter((r) => r.status === "MAYBE");
  const declined = meeting.rsvps.filter((r) => r.status === "DECLINED");

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href="/admin/meetings"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 mb-6"
      >
        <ArrowLeft size={16} />
        Back to Meetings
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{meeting.title}</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                STATUS_COLORS[meeting.status] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {meeting.status.charAt(0) + meeting.status.slice(1).toLowerCase()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {meeting.status !== "CANCELLED" && (
            <Link
              href={`/admin/meetings/${id}/edit`}
              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
            >
              <Pencil size={18} />
            </Link>
          )}
          <button
            onClick={() => setDeleteConfirm(true)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/30 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300 mb-3">
            Are you sure you want to delete this meeting? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            >
              Delete
            </button>
            <button
              onClick={() => setDeleteConfirm(false)}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Details card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 dark:bg-gray-800 dark:border-gray-700">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Calendar size={16} className="text-gray-400" />
            {new Date(meeting.date).toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <MapPin size={16} className="text-gray-400" />
            {meeting.location}
          </div>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <User size={16} className="text-gray-400" />
            Created by {meeting.creator.name}
          </div>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            {meeting.isPublic ? (
              <>
                <Globe size={16} className="text-gray-400" />
                Visible on public calendar
              </>
            ) : (
              <>
                <Lock size={16} className="text-gray-400" />
                Private (admin only)
              </>
            )}
          </div>
        </div>
      </div>

      {/* Status actions */}
      {meeting.status !== "CANCELLED" && (
        <div className="flex gap-2 mb-6">
          {meeting.status === "SCHEDULED" && (
            <button
              onClick={() => handleStatusChange("COMPLETED")}
              disabled={statusLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Mark as Completed
            </button>
          )}
          {meeting.status === "SCHEDULED" && (
            <button
              onClick={() => handleStatusChange("CANCELLED")}
              disabled={statusLoading}
              className="px-4 py-2 bg-white border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50 dark:bg-gray-800 dark:border-red-700"
            >
              Cancel Meeting
            </button>
          )}
        </div>
      )}

      {/* Agenda */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 dark:bg-gray-800 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Agenda</h2>
        <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{meeting.agenda}</div>
      </div>

      {/* RSVP section */}
      {meeting.status !== "CANCELLED" && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 dark:bg-gray-800 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">RSVP</h2>

          {/* Your RSVP */}
          <div className="mb-5">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Your response:</p>
            <div className="flex gap-2">
              {(["ATTENDING", "MAYBE", "DECLINED"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => handleRsvp(status)}
                  disabled={rsvpLoading}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border disabled:opacity-50 ${
                    myRsvp === status
                      ? RSVP_COLORS[status]
                      : RSVP_OUTLINE[status]
                  }`}
                >
                  {status === "ATTENDING"
                    ? "Attending"
                    : status === "MAYBE"
                    ? "Maybe"
                    : "Decline"}
                </button>
              ))}
            </div>
          </div>

          {/* Attendee list */}
          <div className="space-y-4">
            {attending.length > 0 && (
              <div>
                <p className="text-sm font-medium text-green-700 mb-2">
                  Attending ({attending.length})
                </p>
                <div className="space-y-1">
                  {attending.map((r) => (
                    <RsvpRow key={r.id} rsvp={r} />
                  ))}
                </div>
              </div>
            )}
            {maybe.length > 0 && (
              <div>
                <p className="text-sm font-medium text-amber-600 mb-2">
                  Maybe ({maybe.length})
                </p>
                <div className="space-y-1">
                  {maybe.map((r) => (
                    <RsvpRow key={r.id} rsvp={r} />
                  ))}
                </div>
              </div>
            )}
            {declined.length > 0 && (
              <div>
                <p className="text-sm font-medium text-red-600 mb-2">
                  Declined ({declined.length})
                </p>
                <div className="space-y-1">
                  {declined.map((r) => (
                    <RsvpRow key={r.id} rsvp={r} />
                  ))}
                </div>
              </div>
            )}
            {meeting.rsvps.length === 0 && (
              <p className="text-sm text-gray-400">No RSVPs yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Minutes of Meeting */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FileText size={20} />
            Minutes of Meeting
          </h2>
          {!editingMom && meeting.status !== "CANCELLED" && (
            <button
              onClick={() => setEditingMom(true)}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              {meeting.momUrl || meeting.momSummary ? "Edit" : "Add MOM"}
            </button>
          )}
        </div>

        {editingMom ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Google Drive Link
              </label>
              <input
                type="url"
                value={momUrl}
                onChange={(e) => setMomUrl(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                placeholder="https://drive.google.com/..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Summary / Highlights
              </label>
              <textarea
                value={momSummary}
                onChange={(e) => setMomSummary(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                placeholder="Key decisions and action items from the meeting..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveMom}
                disabled={momSaving}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {momSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditingMom(false);
                  setMomUrl(meeting.momUrl || "");
                  setMomSummary(meeting.momSummary || "");
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : meeting.momUrl || meeting.momSummary ? (
          <div className="space-y-3">
            {meeting.momUrl && (
              <a
                href={meeting.momUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                <ExternalLink size={14} />
                View Full Document
              </a>
            )}
            {meeting.momSummary && (
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                {meeting.momSummary}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            No minutes added yet. Click &quot;Add MOM&quot; to add meeting notes.
          </p>
        )}

        {/* Linked Documents */}
        <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Paperclip size={16} />
              Linked Documents
              {meeting.documents.length > 0 && (
                <span className="text-xs font-normal text-gray-400">
                  ({meeting.documents.length})
                </span>
              )}
            </h3>
            {meeting.status !== "CANCELLED" && (
              <button
                onClick={openDocPicker}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Attach Document
              </button>
            )}
          </div>

          {/* List of linked documents */}
          {meeting.documents.length > 0 ? (
            <div className="space-y-2">
              {meeting.documents.map((link) => {
                const FileIcon =
                  FILE_TYPE_ICONS[link.document.fileType || ""] || File;
                const docUrl = link.document.driveUrl || link.document.fileUrl;
                return (
                  <div
                    key={link.id}
                    className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2.5 group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileIcon
                        size={16}
                        className="text-gray-400 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        {docUrl ? (
                          <a
                            href={docUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-primary-600 hover:text-primary-700 truncate block"
                          >
                            {link.document.name}
                          </a>
                        ) : (
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate block">
                            {link.document.name}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <FolderOpen size={10} />
                          {link.document.folder.name}
                          {link.document.fileType && (
                            <>
                              {" "}
                              &middot;{" "}
                              {link.document.fileType.toUpperCase()}
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    {meeting.status !== "CANCELLED" && (
                      <button
                        onClick={() =>
                          handleUnlinkDocument(link.document.id)
                        }
                        className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        title="Unlink document"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            !showDocPicker && (
              <p className="text-sm text-gray-400">
                No documents linked yet.
              </p>
            )
          )}

          {/* Document picker */}
          {showDocPicker && (
            <div className="mt-3 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
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
                  className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400 dark:text-gray-100"
                  autoFocus
                />
                <button
                  onClick={() => setShowDocPicker(false)}
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
                  searchResults.map((doc) => {
                    const FileIcon =
                      FILE_TYPE_ICONS[doc.fileType || ""] || File;
                    return (
                      <button
                        key={doc.id}
                        onClick={() => handleLinkDocument(doc.id)}
                        disabled={linkingDocId === doc.id}
                        className="w-full text-left px-3 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/30 flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 last:border-0 disabled:opacity-50"
                      >
                        <FileIcon
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
                        {linkingDocId === doc.id ? (
                          <span className="text-xs text-gray-400">
                            Linking...
                          </span>
                        ) : (
                          <Paperclip
                            size={12}
                            className="text-gray-300 flex-shrink-0"
                          />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RsvpRow({ rsvp }: { rsvp: MeetingRsvp }) {
  const Icon = RSVP_ICONS[rsvp.status] || HelpCircle;
  return (
    <div className="flex items-center gap-2 text-sm py-1">
      <Icon
        size={14}
        className={
          rsvp.status === "ATTENDING"
            ? "text-green-600"
            : rsvp.status === "DECLINED"
            ? "text-red-500"
            : "text-amber-500"
        }
      />
      <span className="text-gray-800 dark:text-gray-200">{rsvp.resident.name}</span>
      <span className="text-gray-400">
        Block {rsvp.resident.block}, {rsvp.resident.flatNumber}
      </span>
    </div>
  );
}
