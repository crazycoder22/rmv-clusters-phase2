"use client";

import { useState } from "react";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import YouTubeEmbed from "./YouTubeEmbed";
import CommentSection from "./CommentSection";

interface PostData {
  id: string;
  content: string;
  images: string[];
  videoUrl: string | null;
  author: {
    id: string;
    name: string;
    block: number;
    flatNumber: string;
    googleImage: string | null;
  };
  commentCount: number;
  likeCount: number;
  isLiked: boolean;
  createdAt: string;
}

interface FeedPostProps {
  post: PostData;
  currentUserId: string;
  isAdmin: boolean;
  onDelete: (postId: string) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function FeedPost({ post, currentUserId, isAdmin, onDelete }: FeedPostProps) {
  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [showComments, setShowComments] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canDelete = post.author.id === currentUserId || isAdmin;

  const handleLike = async () => {
    // Optimistic update
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);

    try {
      const res = await fetch(`/api/feed/${post.id}/like`, { method: "POST" });
      if (!res.ok) {
        // Revert on error
        setLiked(liked);
        setLikeCount(likeCount);
      }
    } catch {
      setLiked(liked);
      setLikeCount(likeCount);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/feed/${post.id}`, { method: "DELETE" });
      if (res.ok) onDelete(post.id);
    } catch {
      setDeleting(false);
    }
  };

  // Image grid layout
  const renderImages = () => {
    if (post.images.length === 0) return null;
    const count = post.images.length;

    if (count === 1) {
      return (
        <div className="mt-3 rounded-lg overflow-hidden bg-gray-50">
          <img src={post.images[0]} alt="" className="w-full object-contain max-h-[500px]" />
        </div>
      );
    }

    return (
      <div className={`mt-3 grid gap-1 rounded-lg overflow-hidden ${
        count === 2 ? "grid-cols-2" : "grid-cols-2"
      }`}>
        {post.images.map((url, i) => (
          <div key={i} className={`${count === 3 && i === 0 ? "row-span-2" : ""} bg-gray-50`}>
            <img src={url} alt="" className="w-full h-full object-contain" style={{ minHeight: "120px", maxHeight: count <= 2 ? "300px" : "200px" }} />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 mb-4 ${deleting ? "opacity-50" : ""}`}>
      {/* Author header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
            {post.author.googleImage ? (
              <img
                src={post.author.googleImage}
                alt=""
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-sm font-bold text-primary-600">
                {post.author.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{post.author.name}</p>
            <p className="text-xs text-gray-400">
              B{post.author.block} - {post.author.flatNumber} &middot; {timeAgo(post.createdAt)}
            </p>
          </div>
        </div>

        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
            title="Delete post"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="text-sm text-gray-800 whitespace-pre-line">{post.content}</div>

      {/* Images */}
      {renderImages()}

      {/* Video */}
      {post.videoUrl && <YouTubeEmbed url={post.videoUrl} />}

      {/* Like & Comment buttons */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
            liked ? "text-red-500" : "text-gray-500 hover:text-red-500"
          }`}
        >
          <Heart size={16} fill={liked ? "currentColor" : "none"} />
          {likeCount > 0 && likeCount}
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-primary-600 transition-colors"
        >
          <MessageCircle size={16} />
          {commentCount > 0 && commentCount}
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <CommentSection
          postId={post.id}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onCommentCountChange={(delta) => setCommentCount((c) => c + delta)}
        />
      )}
    </div>
  );
}
