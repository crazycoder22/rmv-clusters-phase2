"use client";

import { useState, useEffect, useCallback } from "react";
import { useRole } from "@/hooks/useRole";
import {
  Loader2,
  FolderPlus,
  FilePlus,
  Trash2,
  Pencil,
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  ExternalLink,
  X,
  Check,
} from "lucide-react";

interface DocumentFile {
  id: string;
  name: string;
  folderId: string;
  driveUrl: string | null;
  fileUrl: string | null;
  fileType: string | null;
  sortOrder: number;
}

interface DocumentFolder {
  id: string;
  name: string;
  parentId: string | null;
  driveUrl: string | null;
  sortOrder: number;
  children: DocumentFolder[];
  files: DocumentFile[];
}

export default function AdminDocumentsPage() {
  const { canManageDocuments, isLoading: roleLoading } = useRole();
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Add folder state
  const [addingFolderParentId, setAddingFolderParentId] = useState<string | null | "root">(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDriveUrl, setNewFolderDriveUrl] = useState("");

  // Add file state
  const [addingFileToFolderId, setAddingFileToFolderId] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [newFileDriveUrl, setNewFileDriveUrl] = useState("");
  const [newFileType, setNewFileType] = useState("");

  // Edit state
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [editFolderDriveUrl, setEditFolderDriveUrl] = useState("");
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editFileName, setEditFileName] = useState("");
  const [editFileDriveUrl, setEditFileDriveUrl] = useState("");
  const [editFileType, setEditFileType] = useState("");

  const [saving, setSaving] = useState(false);

  const fetchFolders = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/documents/folders");
      if (!res.ok) return;
      const data = await res.json();
      setFolders(data.folders);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!roleLoading && canManageDocuments()) fetchFolders();
  }, [roleLoading, canManageDocuments, fetchFolders]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Build a flat list of all folders for lookup
  function flattenFolders(folders: DocumentFolder[]): DocumentFolder[] {
    const result: DocumentFolder[] = [];
    for (const f of folders) {
      result.push(f);
      if (f.children) result.push(...flattenFolders(f.children));
    }
    return result;
  }

  const allFolders = flattenFolders(folders);

  const handleAddFolder = async () => {
    if (!newFolderName.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/documents/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFolderName,
          parentId: addingFolderParentId === "root" ? null : addingFolderParentId,
          driveUrl: newFolderDriveUrl || null,
        }),
      });
      if (res.ok) {
        setAddingFolderParentId(null);
        setNewFolderName("");
        setNewFolderDriveUrl("");
        await fetchFolders();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddFile = async () => {
    if (!newFileName.trim() || !addingFileToFolderId || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/documents/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFileName,
          folderId: addingFileToFolderId,
          driveUrl: newFileDriveUrl || null,
          fileType: newFileType || null,
        }),
      });
      if (res.ok) {
        setAddingFileToFolderId(null);
        setNewFileName("");
        setNewFileDriveUrl("");
        setNewFileType("");
        await fetchFolders();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateFolder = async (id: string) => {
    if (!editFolderName.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/documents/folders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editFolderName,
          driveUrl: editFolderDriveUrl || null,
        }),
      });
      if (res.ok) {
        setEditingFolder(null);
        await fetchFolders();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateFile = async (id: string) => {
    if (!editFileName.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/documents/files/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editFileName,
          driveUrl: editFileDriveUrl || null,
          fileType: editFileType || null,
        }),
      });
      if (res.ok) {
        setEditingFile(null);
        await fetchFolders();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    const folder = allFolders.find((f) => f.id === id);
    const hasContent = folder && (folder.children.length > 0 || folder.files.length > 0);
    const msg = hasContent
      ? "This folder has contents that will also be deleted. Are you sure?"
      : "Delete this folder?";
    if (!confirm(msg)) return;

    await fetch(`/api/admin/documents/folders/${id}`, { method: "DELETE" });
    await fetchFolders();
  };

  const handleDeleteFile = async (id: string) => {
    if (!confirm("Delete this file?")) return;
    await fetch(`/api/admin/documents/files/${id}`, { method: "DELETE" });
    await fetchFolders();
  };

  if (roleLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }

  if (!canManageDocuments()) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center text-gray-500">
        You do not have permission to manage documents.
      </div>
    );
  }

  const renderFolder = (folder: DocumentFolder, depth: number = 0) => {
    const isExpanded = expanded.has(folder.id);
    const isEditing = editingFolder === folder.id;

    return (
      <div key={folder.id} style={{ marginLeft: depth * 20 }}>
        <div className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 group">
          <button
            onClick={() => toggleExpand(folder.id)}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <Folder size={18} className="text-amber-500 flex-shrink-0" />

          {isEditing ? (
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={editFolderName}
                onChange={(e) => setEditFolderName(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
                placeholder="Folder name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUpdateFolder(folder.id);
                  if (e.key === "Escape") setEditingFolder(null);
                }}
              />
              <input
                type="text"
                value={editFolderDriveUrl}
                onChange={(e) => setEditFolderDriveUrl(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm w-48"
                placeholder="Google Drive URL (optional)"
              />
              <button
                onClick={() => handleUpdateFolder(folder.id)}
                className="text-green-600 hover:text-green-700"
                disabled={saving}
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => setEditingFolder(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <span className="text-sm font-medium text-gray-800 flex-1">{folder.name}</span>
              {folder.driveUrl && (
                <a
                  href={folder.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-500 hover:text-primary-700"
                  title="Open in Google Drive"
                >
                  <ExternalLink size={14} />
                </a>
              )}
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                <button
                  onClick={() => {
                    setAddingFolderParentId(folder.id);
                    setNewFolderName("");
                    setNewFolderDriveUrl("");
                  }}
                  className="text-gray-400 hover:text-amber-600 p-1"
                  title="Add subfolder"
                >
                  <FolderPlus size={15} />
                </button>
                <button
                  onClick={() => {
                    setAddingFileToFolderId(folder.id);
                    setNewFileName("");
                    setNewFileDriveUrl("");
                    setNewFileType("");
                  }}
                  className="text-gray-400 hover:text-primary-600 p-1"
                  title="Add file"
                >
                  <FilePlus size={15} />
                </button>
                <button
                  onClick={() => {
                    setEditingFolder(folder.id);
                    setEditFolderName(folder.name);
                    setEditFolderDriveUrl(folder.driveUrl || "");
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1"
                  title="Edit folder"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDeleteFolder(folder.id)}
                  className="text-gray-400 hover:text-red-600 p-1"
                  title="Delete folder"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </>
          )}
        </div>

        {isExpanded && (
          <div>
            {/* Add subfolder form */}
            {addingFolderParentId === folder.id && (
              <div
                className="flex items-center gap-2 py-2 px-3 ml-5 bg-amber-50 rounded-lg"
                style={{ marginLeft: (depth + 1) * 20 }}
              >
                <Folder size={18} className="text-amber-400 flex-shrink-0" />
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
                  placeholder="Subfolder name"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddFolder();
                    if (e.key === "Escape") setAddingFolderParentId(null);
                  }}
                />
                <input
                  type="text"
                  value={newFolderDriveUrl}
                  onChange={(e) => setNewFolderDriveUrl(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm w-48"
                  placeholder="Google Drive URL (optional)"
                />
                <button
                  onClick={handleAddFolder}
                  disabled={saving || !newFolderName.trim()}
                  className="text-green-600 hover:text-green-700 disabled:opacity-50"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => setAddingFolderParentId(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Add file form */}
            {addingFileToFolderId === folder.id && (
              <div
                className="flex items-center gap-2 py-2 px-3 bg-blue-50 rounded-lg"
                style={{ marginLeft: (depth + 1) * 20 }}
              >
                <FileText size={18} className="text-primary-400 flex-shrink-0" />
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
                  placeholder="File name"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddFile();
                    if (e.key === "Escape") setAddingFileToFolderId(null);
                  }}
                />
                <input
                  type="text"
                  value={newFileDriveUrl}
                  onChange={(e) => setNewFileDriveUrl(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm w-48"
                  placeholder="Google Drive URL"
                />
                <select
                  value={newFileType}
                  onChange={(e) => setNewFileType(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">Type</option>
                  <option value="pdf">PDF</option>
                  <option value="xlsx">Excel</option>
                  <option value="doc">Word</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="other">Other</option>
                </select>
                <button
                  onClick={handleAddFile}
                  disabled={saving || !newFileName.trim()}
                  className="text-green-600 hover:text-green-700 disabled:opacity-50"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => setAddingFileToFolderId(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Subfolders */}
            {folder.children.map((child) => renderFolder(child, depth + 1))}

            {/* Files */}
            {folder.files.map((file) => renderFile(file, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderFile = (file: DocumentFile, depth: number) => {
    const isEditing = editingFile === file.id;

    return (
      <div
        key={file.id}
        className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 group"
        style={{ marginLeft: depth * 20 }}
      >
        <div className="w-4 flex-shrink-0" />
        <FileText size={16} className="text-primary-500 flex-shrink-0" />

        {isEditing ? (
          <div className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={editFileName}
              onChange={(e) => setEditFileName(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
              placeholder="File name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUpdateFile(file.id);
                if (e.key === "Escape") setEditingFile(null);
              }}
            />
            <input
              type="text"
              value={editFileDriveUrl}
              onChange={(e) => setEditFileDriveUrl(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm w-48"
              placeholder="Google Drive URL"
            />
            <select
              value={editFileType}
              onChange={(e) => setEditFileType(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="">Type</option>
              <option value="pdf">PDF</option>
              <option value="xlsx">Excel</option>
              <option value="doc">Word</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="other">Other</option>
            </select>
            <button
              onClick={() => handleUpdateFile(file.id)}
              className="text-green-600 hover:text-green-700"
              disabled={saving}
            >
              <Check size={16} />
            </button>
            <button
              onClick={() => setEditingFile(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <span className="text-sm text-gray-700 flex-1">{file.name}</span>
            {file.fileType && (
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase">
                {file.fileType}
              </span>
            )}
            {file.driveUrl && (
              <a
                href={file.driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-500 hover:text-primary-700"
                title="Open in Google Drive"
              >
                <ExternalLink size={14} />
              </a>
            )}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
              <button
                onClick={() => {
                  setEditingFile(file.id);
                  setEditFileName(file.name);
                  setEditFileDriveUrl(file.driveUrl || "");
                  setEditFileType(file.fileType || "");
                }}
                className="text-gray-400 hover:text-gray-600 p-1"
                title="Edit file"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => handleDeleteFile(file.id)}
                className="text-gray-400 hover:text-red-600 p-1"
                title="Delete file"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Manage Documents</h1>
        <button
          onClick={() => {
            setAddingFolderParentId("root");
            setNewFolderName("");
            setNewFolderDriveUrl("");
          }}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          <FolderPlus size={16} />
          New Folder
        </button>
      </div>

      {/* Add root folder form */}
      {addingFolderParentId === "root" && (
        <div className="flex items-center gap-2 py-2 px-3 mb-4 bg-amber-50 rounded-lg">
          <Folder size={18} className="text-amber-400 flex-shrink-0" />
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
            placeholder="Folder name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddFolder();
              if (e.key === "Escape") setAddingFolderParentId(null);
            }}
          />
          <input
            type="text"
            value={newFolderDriveUrl}
            onChange={(e) => setNewFolderDriveUrl(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm w-64"
            placeholder="Google Drive URL (optional)"
          />
          <button
            onClick={handleAddFolder}
            disabled={saving || !newFolderName.trim()}
            className="text-green-600 hover:text-green-700 disabled:opacity-50"
          >
            <Check size={16} />
          </button>
          <button
            onClick={() => setAddingFolderParentId(null)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        {folders.filter((f) => !f.parentId).length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            No folders yet. Create your first folder to get started.
          </p>
        ) : (
          folders
            .filter((f) => !f.parentId)
            .map((folder) => renderFolder(folder, 0))
        )}
      </div>
    </div>
  );
}
