"use client";

import { useState } from "react";
import { Send, Link2, X } from "lucide-react";
import ImageUpload from "./ImageUpload";

interface PostData {
  id: string;
  content: string;
  images: string[];
  videoUrl: string | null;
  author: { id: string; name: string; block: number; flatNumber: string; googleImage: string | null };
  commentCount: number;
  likeCount: number;
  isLiked: boolean;
  createdAt: string;
}

interface CreatePostProps {
  onPostCreated: (post: PostData) => void;
}

export default function CreatePost({ onPostCreated }: CreatePostProps) {
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [posting, setPosting] = useState(false);

  const canPost = content.trim().length > 0;

  const handleSubmit = async () => {
    if (!canPost || posting) return;
    setPosting(true);

    try {
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          images,
          videoUrl: videoUrl.trim() || undefined,
        }),
      });

      if (res.ok) {
        const post = await res.json();
        onPostCreated(post);
        setContent("");
        setImages([]);
        setVideoUrl("");
        setShowVideoInput(false);
      }
    } catch {
      // ignore
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Share something with your community..."
        rows={3}
        className="w-full resize-none border-0 focus:ring-0 text-sm text-gray-900 placeholder:text-gray-400 p-0"
      />

      <ImageUpload images={images} onChange={setImages} disabled={posting} />

      {showVideoInput && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Paste YouTube link..."
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <button
            onClick={() => {
              setShowVideoInput(false);
              setVideoUrl("");
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1">
          {!showVideoInput && (
            <button
              onClick={() => setShowVideoInput(true)}
              disabled={posting}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors disabled:opacity-50"
            >
              <Link2 size={16} />
              Video Link
            </button>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canPost || posting}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          <Send size={14} />
          {posting ? "Posting..." : "Post"}
        </button>
      </div>
    </div>
  );
}
