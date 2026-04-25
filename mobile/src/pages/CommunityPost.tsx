import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Heart,
  Loader2,
  MessageCircle,
  Send,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { Avatar, timeAgo } from "./Community";

type Author = {
  id: string;
  name: string;
  block: number;
  flatNumber: string;
  googleImage: string | null;
};

type Post = {
  id: string;
  content: string;
  images: string[];
  videoUrl: string | null;
  author: Author;
  commentCount: number;
  likeCount: number;
  isLiked: boolean;
  createdAt: string;
};

type Comment = {
  id: string;
  content: string;
  author: Author;
  createdAt: string;
};

export default function CommunityPost() {
  const { id = "" } = useParams<{ id: string }>();
  const { user, token } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const refresh = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const [postRes, commentsRes] = await Promise.all([
        apiFetch(`/api/feed/${id}`, { token }),
        apiFetch(`/api/feed/${id}/comments`, { token }),
      ]);
      if (postRes.ok) setPost(await postRes.json());
      else {
        const data = await postRes.json().catch(() => ({}));
        setError(data.error ?? "Could not load post");
      }
      if (commentsRes.ok) {
        const data = await commentsRes.json();
        setComments(data.comments ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleLike = async () => {
    if (!post) return;
    const next: Post = {
      ...post,
      isLiked: !post.isLiked,
      likeCount: post.likeCount + (post.isLiked ? -1 : 1),
    };
    setPost(next);
    try {
      const res = await apiFetch(`/api/feed/${id}/like`, {
        method: "POST",
        token,
      });
      if (!res.ok) setPost(post);
    } catch {
      setPost(post);
    }
  };

  const submitComment = async () => {
    const content = text.trim();
    if (!content) return;
    setPosting(true);
    try {
      const res = await apiFetch(`/api/feed/${id}/comments`, {
        method: "POST",
        token,
        body: JSON.stringify({ content }),
      });
      if (!res.ok) return;
      const newComment = (await res.json()) as Comment;
      setComments((prev) => [...prev, newComment]);
      setText("");
      if (post) setPost({ ...post, commentCount: post.commentCount + 1 });
    } finally {
      setPosting(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!confirm("Delete this comment?")) return;
    const prev = comments;
    setComments((c) => c.filter((x) => x.id !== commentId));
    try {
      const res = await apiFetch(
        `/api/feed/${id}/comments/${commentId}`,
        { method: "DELETE", token }
      );
      if (!res.ok) setComments(prev);
      else if (post) setPost({ ...post, commentCount: post.commentCount - 1 });
    } catch {
      setComments(prev);
    }
  };

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/community"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">Post</h1>
      </header>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
      ) : !post ? (
        <p className="py-10 text-center text-sm text-red-400">
          {error ?? "Not found"}
        </p>
      ) : (
        <>
          <article className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60">
            <div className="flex items-start gap-3 px-4 pt-4">
              <Avatar
                name={post.author.name}
                imageUrl={post.author.googleImage}
              />
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">
                  {post.author.name}
                </p>
                <p className="text-[11px] text-slate-500">
                  Block {post.author.block}, {post.author.flatNumber} ·{" "}
                  {timeAgo(post.createdAt)}
                </p>
              </div>
            </div>
            <div className="px-4 pt-2">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-100">
                {post.content}
              </p>
            </div>
            {post.images.length > 0 && (
              <div
                className={clsx(
                  "mt-3 grid gap-1 px-4",
                  post.images.length === 1 ? "grid-cols-1" : "grid-cols-2"
                )}
              >
                {post.images.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="aspect-square w-full rounded-lg object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
            )}
            <div className="mt-3 flex items-center gap-4 border-t border-slate-700 px-4 py-2.5 text-xs">
              <button
                onClick={toggleLike}
                className={clsx(
                  "flex items-center gap-1.5",
                  post.isLiked ? "text-red-400" : "text-slate-400"
                )}
              >
                <Heart
                  size={14}
                  fill={post.isLiked ? "currentColor" : "none"}
                />
                <span className="font-medium">{post.likeCount}</span>
              </button>
              <span className="flex items-center gap-1.5 text-slate-400">
                <MessageCircle size={14} />
                <span className="font-medium">{post.commentCount}</span>
              </span>
            </div>
          </article>

          {/* Comments */}
          <h2 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {comments.length} comment{comments.length === 1 ? "" : "s"}
          </h2>
          <div className="space-y-2">
            {comments.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500">
                No comments yet. Be the first.
              </p>
            ) : (
              comments.map((c) => {
                const mine = c.author.id === user?.id;
                return (
                  <div
                    key={c.id}
                    className="flex items-start gap-2 rounded-xl border border-slate-700 bg-slate-800/40 px-3 py-2.5"
                  >
                    <Avatar
                      name={c.author.name}
                      imageUrl={c.author.googleImage}
                      size={28}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-100">
                        {c.author.name}
                        <span className="ml-1.5 text-[10px] font-normal text-slate-500">
                          Block {c.author.block} · {timeAgo(c.createdAt)}
                        </span>
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-200">
                        {c.content}
                      </p>
                    </div>
                    {mine && (
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="text-slate-500 active:text-red-400"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Compose comment */}
          <div className="sticky bottom-[max(76px,calc(env(safe-area-inset-bottom,0px)+76px))] mt-4 rounded-2xl border border-slate-700 bg-slate-900 p-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 bg-transparent px-2 py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitComment();
                  }
                }}
              />
              <button
                onClick={submitComment}
                disabled={posting || !text.trim()}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white active:bg-indigo-600 disabled:opacity-50"
              >
                {posting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Send size={12} />
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
