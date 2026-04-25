import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
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

const PAGE_SIZE = 10;

export default function Community() {
  const { user, token } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [composeText, setComposeText] = useState("");
  const [composing, setComposing] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchPage = useCallback(
    async (cursor?: string | null) => {
      if (!token) return null;
      const url = cursor
        ? `/api/feed?cursor=${cursor}&limit=${PAGE_SIZE}`
        : `/api/feed?limit=${PAGE_SIZE}`;
      const res = await apiFetch(url, { token });
      if (!res.ok) return null;
      return (await res.json()) as { posts: Post[]; nextCursor: string | null };
    },
    [token]
  );

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPage(null)
      .then((data) => {
        if (cancelled || !data) return;
        setPosts(data.posts);
        setNextCursor(data.nextCursor);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  // Infinite scroll.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !nextCursor || loadingMore) return;
    const obs = new IntersectionObserver(async (entries) => {
      if (!entries[0]?.isIntersecting) return;
      setLoadingMore(true);
      const data = await fetchPage(nextCursor);
      if (data) {
        setPosts((prev) => [...prev, ...data.posts]);
        setNextCursor(data.nextCursor);
      }
      setLoadingMore(false);
    });
    obs.observe(node);
    return () => obs.disconnect();
  }, [nextCursor, loadingMore, fetchPage]);

  const submitPost = async () => {
    const content = composeText.trim();
    if (!content) return;
    setComposing(true);
    setComposeError(null);
    try {
      const res = await apiFetch("/api/feed", {
        method: "POST",
        token,
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setComposeError(data.error ?? "Could not post.");
        return;
      }
      setPosts((prev) => [data as Post, ...prev]);
      setComposeText("");
    } finally {
      setComposing(false);
    }
  };

  const toggleLike = async (postId: string) => {
    // Optimistic
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              isLiked: !p.isLiked,
              likeCount: p.likeCount + (p.isLiked ? -1 : 1),
            }
          : p
      )
    );
    try {
      const res = await apiFetch(`/api/feed/${postId}/like`, {
        method: "POST",
        token,
      });
      if (!res.ok) {
        // Roll back if server disagreed.
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  isLiked: !p.isLiked,
                  likeCount: p.likeCount + (p.isLiked ? -1 : 1),
                }
              : p
          )
        );
      }
    } catch {
      /* ignore */
    }
  };

  const deletePost = async (postId: string) => {
    if (!confirm("Delete this post?")) return;
    const prev = posts;
    setPosts((p) => p.filter((x) => x.id !== postId));
    try {
      const res = await apiFetch(`/api/feed/${postId}`, {
        method: "DELETE",
        token,
      });
      if (!res.ok) setPosts(prev);
    } catch {
      setPosts(prev);
    }
  };

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/more"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">Community</h1>
      </header>

      {/* Compose */}
      <div className="mb-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
        <div className="flex gap-3">
          <Avatar
            name={user?.name ?? ""}
            imageUrl={user?.imageUrl ?? null}
          />
          <div className="flex-1">
            <textarea
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              placeholder="Share something with the community…"
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
            />
            {composeError && (
              <p className="mt-1 text-xs text-red-400">{composeError}</p>
            )}
            <div className="mt-2 flex items-center justify-end">
              <button
                onClick={submitPost}
                disabled={composing || !composeText.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white active:bg-indigo-600 disabled:opacity-50"
              >
                {composing ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Posting…
                  </>
                ) : (
                  <>
                    <Send size={12} />
                    Post
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center">
          <MessageCircle size={32} className="mx-auto mb-2 text-slate-600" />
          <p className="text-sm text-slate-400">No posts yet.</p>
          <p className="mt-1 text-xs text-slate-500">
            Be the first to share something.
          </p>
        </div>
      ) : (
        <div className="space-y-3 pb-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user?.id}
              onLike={() => toggleLike(post.id)}
              onDelete={() => deletePost(post.id)}
            />
          ))}
          {nextCursor && (
            <div ref={sentinelRef} className="py-4 text-center text-xs text-slate-500">
              {loadingMore ? "Loading more…" : "Scroll for more"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PostCard({
  post,
  currentUserId,
  onLike,
  onDelete,
}: {
  post: Post;
  currentUserId: string | undefined;
  onLike: () => void;
  onDelete: () => void;
}) {
  const isMine = currentUserId === post.author.id;
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60">
      <div className="flex items-start gap-3 px-4 pt-4">
        <Avatar
          name={post.author.name}
          imageUrl={post.author.googleImage}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">
            {post.author.name}
          </p>
          <p className="text-[11px] text-slate-500">
            Block {post.author.block}, {post.author.flatNumber} ·{" "}
            {timeAgo(post.createdAt)}
          </p>
        </div>
        {isMine && (
          <button
            onClick={onDelete}
            className="text-slate-500 active:text-red-400"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <Link to={`/community/${post.id}`} className="block px-4 pt-2">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-100">
          {post.content}
        </p>
      </Link>

      {post.images.length > 0 && (
        <div
          className={clsx(
            "mt-3 grid gap-1 px-4",
            post.images.length === 1
              ? "grid-cols-1"
              : post.images.length === 2
                ? "grid-cols-2"
                : "grid-cols-2"
          )}
        >
          {post.images.slice(0, 4).map((src, i) => (
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
          onClick={onLike}
          className={clsx(
            "flex items-center gap-1.5 transition-colors",
            post.isLiked ? "text-red-400" : "text-slate-400 active:text-red-400"
          )}
        >
          <Heart
            size={14}
            fill={post.isLiked ? "currentColor" : "none"}
          />
          <span className="font-medium">{post.likeCount}</span>
        </button>
        <Link
          to={`/community/${post.id}`}
          className="flex items-center gap-1.5 text-slate-400 active:text-indigo-400"
        >
          <MessageCircle size={14} />
          <span className="font-medium">{post.commentCount}</span>
        </Link>
      </div>
    </article>
  );
}

export function Avatar({
  name,
  imageUrl,
  size = 40,
}: {
  name: string;
  imageUrl: string | null;
  size?: number;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        style={{ width: size, height: size }}
        className="flex-shrink-0 rounded-full border border-slate-700 object-cover"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-semibold text-indigo-300"
    >
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}
