"use client";

import { useState, useEffect, useCallback } from "react";
import { useRole } from "@/hooks/useRole";
import {
  Loader2,
  Folder,
  FileText,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  FileSpreadsheet,
  FileImage,
  FileVideo,
  File,
} from "lucide-react";

interface DocumentFile {
  id: string;
  name: string;
  folderId: string;
  driveUrl: string | null;
  fileUrl: string | null;
  fileType: string | null;
}

interface DocumentFolder {
  id: string;
  name: string;
  parentId: string | null;
  driveUrl: string | null;
  children: DocumentFolder[];
  files: DocumentFile[];
}

function getFileIcon(fileType: string | null) {
  switch (fileType) {
    case "pdf":
      return <FileText size={20} className="text-red-500" />;
    case "xlsx":
      return <FileSpreadsheet size={20} className="text-green-600" />;
    case "doc":
      return <FileText size={20} className="text-blue-600" />;
    case "image":
      return <FileImage size={20} className="text-purple-500" />;
    case "video":
      return <FileVideo size={20} className="text-pink-500" />;
    default:
      return <File size={20} className="text-gray-500" />;
  }
}

export default function DocumentsPage() {
  const { canManageDocuments, isLoading: roleLoading } = useRole();
  const [rootFolders, setRootFolders] = useState<DocumentFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState<DocumentFolder[]>([]);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (!res.ok) return;
      const data = await res.json();
      setRootFolders(data.folders);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!roleLoading && canManageDocuments()) fetchDocuments();
  }, [roleLoading, canManageDocuments, fetchDocuments]);

  const currentFolder = path.length > 0 ? path[path.length - 1] : null;
  const displayFolders = currentFolder ? (currentFolder.children || []) : rootFolders;
  const displayFiles = currentFolder ? (currentFolder.files || []) : [];

  const navigateInto = (folder: DocumentFolder) => {
    setPath((prev) => [...prev, folder]);
  };

  const navigateBack = () => {
    setPath((prev) => prev.slice(0, -1));
  };

  const navigateTo = (index: number) => {
    setPath((prev) => prev.slice(0, index + 1));
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
        You do not have permission to view documents.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Documents</h1>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-gray-500 mb-4 flex-wrap">
        <button
          onClick={() => setPath([])}
          className={`hover:text-primary-600 transition-colors ${
            path.length === 0 ? "text-gray-900 font-medium" : ""
          }`}
        >
          Documents
        </button>
        {path.map((folder, i) => (
          <span key={folder.id} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-gray-300" />
            <button
              onClick={() => navigateTo(i)}
              className={`hover:text-primary-600 transition-colors ${
                i === path.length - 1 ? "text-gray-900 font-medium" : ""
              }`}
            >
              {folder.name}
            </button>
          </span>
        ))}
      </div>

      {/* Back button */}
      {path.length > 0 && (
        <button
          onClick={navigateBack}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary-600 mb-4 transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {displayFolders.length === 0 && displayFiles.length === 0 ? (
          <p className="text-gray-400 text-center py-12">
            {path.length === 0
              ? "No documents yet."
              : "This folder is empty."}
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Folders */}
            {displayFolders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigateInto(folder)}
              >
                <Folder size={20} className="text-amber-500 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-800 flex-1">
                  {folder.name}
                </span>
                {folder.driveUrl && (
                  <a
                    href={folder.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-500 hover:text-primary-700 p-1"
                    title="Open in Google Drive"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={15} />
                  </a>
                )}
                <ChevronRight size={16} className="text-gray-300" />
              </div>
            ))}

            {/* Files */}
            {displayFiles.map((file) => {
              const url = file.driveUrl || file.fileUrl;
              return (
                <div
                  key={file.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  {getFileIcon(file.fileType)}
                  <span className="text-sm text-gray-700 flex-1">{file.name}</span>
                  {file.fileType && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase">
                      {file.fileType}
                    </span>
                  )}
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-500 hover:text-primary-700 p-1"
                      title="Open file"
                    >
                      <ExternalLink size={15} />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
