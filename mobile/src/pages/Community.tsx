import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import clsx from "clsx";
import { Share } from "@capacitor/share";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { API_BASE_URL } from "../config";
import { useAuth } from "../auth/AuthProvider";

// Open the native share sheet for a post (clipboard fallback on web / failure).
export async function sharePost(post: { id: string; content: string; author: { name: string } }) {
  const url = `${API_BASE_URL}/community/${post.id}`;
  const snippet = post.content?.trim().slice(0, 80);
  const text = snippet ? `${post.author.name}: ${snippet}` : `${post.author.name} shared a post`;
  try {
    await Share.share({ title: "Community post", text, url, dialogTitle: "Share post" });
  } catch {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* nothing else we can do */
    }
  }
}

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
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeImages, setComposeImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const MAX_IMAGES = 4;

  async function uploadImage(file: File) {
    if (composeImages.length >= MAX_IMAGES) return;
    setUploading(true);
    setComposeError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.url) setComposeImages((prev) => [...prev, data.url]);
      } else {
        setComposeError("Image upload failed. Try a smaller photo.");
      }
    } catch {
      setComposeError("Image upload failed. Check your connection.");
    } finally {
      setUploading(false);
    }
  }

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
    if (!content && composeImages.length === 0) return;
    setComposing(true);
    setComposeError(null);
    try {
      const res = await apiFetch("/api/feed", {
        method: "POST",
        token,
        body: JSON.stringify({ content, images: composeImages }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setComposeError(data.error ?? "Could not post.");
        return;
      }
      setPosts((prev) => [data as Post, ...prev]);
      setComposeText("");
      setComposeImages([]);
      setComposeOpen(false);
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
    <div
      className="one-surface flex flex-1 flex-col"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      {/* Header */}
      <header className="flex flex-shrink-0 items-center gap-3 px-[18px] pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-3">
        <Link to="/community" className="flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={22} style={{ color: "var(--text-2)" }} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-extrabold leading-tight tracking-tight" style={{ color: "var(--text)" }}>
            Community Feed
          </h1>
          <p className="mt-px text-[12px]" style={{ color: "var(--text-3)" }}>
            {user?.block ? `Block ${user.block} · ` : ""}Moments &amp; updates from your block
          </p>
        </div>
        <Link
          to="/messages"
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full active:opacity-80"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          aria-label="Messages"
        >
          <Icon name="send" size={20} style={{ color: "var(--text-2)" }} />
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Composer */}
        <div className="px-[18px] pb-4">
          {/* Hidden picker — on iOS this offers Photo Library / Take Photo / Choose File */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadImage(f);
              e.target.value = "";
            }}
          />
          {!composeOpen ? (
            <div
              className="flex w-full items-center gap-3 rounded-[16px] p-[11px_13px] text-left"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <Avatar name={user?.name ?? ""} imageUrl={user?.imageUrl ?? null} size={38} />
              <button onClick={() => setComposeOpen(true)} className="flex-1 text-left text-[13.5px] active:opacity-80" style={{ color: "var(--text-3)" }}>
                Share a moment with your block…
              </button>
              <button
                onClick={() => {
                  setComposeOpen(true);
                  fileRef.current?.click();
                }}
                aria-label="Add a photo"
                className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] active:opacity-80"
                style={{ background: "var(--accent-soft)" }}
              >
                <Icon name="add_photo_alternate" size={20} style={{ color: "var(--accent)" }} />
              </button>
            </div>
          ) : (
            <div className="rounded-[16px] p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex gap-3">
                <Avatar name={user?.name ?? ""} imageUrl={user?.imageUrl ?? null} size={38} />
                <div className="min-w-0 flex-1">
                  <textarea
                    autoFocus
                    value={composeText}
                    onChange={(e) => setComposeText(e.target.value)}
                    placeholder="Share a moment with your block…"
                    rows={3}
                    className="one-input w-full resize-none rounded-[12px] px-3 py-2.5 text-[14px]"
                  />

                  {/* Image thumbnails */}
                  {(composeImages.length > 0 || uploading) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {composeImages.map((src, i) => (
                        <div key={i} className="relative h-[68px] w-[68px] overflow-hidden rounded-[10px]" style={{ border: "1px solid var(--border)" }}>
                          <img src={src} alt="" className="h-full w-full object-cover" />
                          <button
                            onClick={() => setComposeImages((p) => p.filter((_, idx) => idx !== i))}
                            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                            aria-label="Remove photo"
                          >
                            <Icon name="close" size={12} style={{ color: "#fff" }} />
                          </button>
                        </div>
                      ))}
                      {uploading && (
                        <div className="flex h-[68px] w-[68px] items-center justify-center rounded-[10px]" style={{ border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                          <Loader2 size={18} className="animate-spin" style={{ color: "var(--text-3)" }} />
                        </div>
                      )}
                    </div>
                  )}

                  {composeError && (
                    <p className="mt-1.5 text-[12px]" style={{ color: "var(--danger)" }}>{composeError}</p>
                  )}

                  <div className="mt-2 flex items-center gap-2">
                    {/* Add photo */}
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading || composeImages.length >= MAX_IMAGES}
                      aria-label="Add a photo"
                      className="flex h-9 w-9 items-center justify-center rounded-[10px] disabled:opacity-50"
                      style={{ background: "var(--accent-soft)" }}
                    >
                      <Icon name="add_photo_alternate" size={20} style={{ color: "var(--accent)" }} />
                    </button>
                    <span className="text-[11px]" style={{ color: "var(--text-3)" }}>{composeImages.length}/{MAX_IMAGES}</span>
                    <div className="flex-1" />
                    <button
                      onClick={() => {
                        setComposeOpen(false);
                        setComposeText("");
                        setComposeImages([]);
                        setComposeError(null);
                      }}
                      className="rounded-[10px] px-3.5 py-2 text-[13px] font-semibold"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-2)" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitPost}
                      disabled={composing || uploading || (!composeText.trim() && composeImages.length === 0)}
                      className="inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-[13px] font-bold text-white active:opacity-90 disabled:opacity-50"
                      style={{ background: "var(--accent-strong)" }}
                    >
                      {composing ? <Loader2 size={13} className="animate-spin" /> : <Icon name="send" size={15} style={{ color: "#fff" }} />}
                      Post
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Feed */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin" size={22} style={{ color: "var(--text-3)" }} />
          </div>
        ) : posts.length === 0 ? (
          <div className="px-[18px] py-16 text-center">
            <Icon name="forum" size={38} style={{ color: "var(--text-3)" }} />
            <p className="mt-2 text-[14px]" style={{ color: "var(--text-2)" }}>No posts yet.</p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--text-3)" }}>Be the first to share something.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 px-[18px] pb-5">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={user?.id}
                  onLike={() => toggleLike(post.id)}
                  onDelete={() => deletePost(post.id)}
                />
              ))}
            </div>
            {nextCursor ? (
              <div ref={sentinelRef} className="flex justify-center pb-6 pt-1">
                {loadingMore && <Loader2 className="animate-spin" size={18} style={{ color: "var(--text-3)" }} />}
              </div>
            ) : (
              <div className="one-mono pb-6 pt-1 text-center text-[10px]" style={{ color: "var(--text-3)", letterSpacing: "0.1em" }}>
                YOU'RE ALL CAUGHT UP ✦
              </div>
            )}
          </>
        )}
      </div>
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
  const imgs = post.images ?? [];
  return (
    <article
      className="overflow-hidden rounded-[20px]"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 p-3">
        <Avatar name={post.author.name} imageUrl={post.author.googleImage} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-bold" style={{ color: "var(--text)" }}>{post.author.name}</p>
          <p className="text-[11.5px]" style={{ color: "var(--text-3)" }}>
            Block {post.author.block}, {post.author.flatNumber} · {timeAgo(post.createdAt)}
          </p>
        </div>
        {isMine && (
          <button onClick={onDelete} className="flex active:opacity-70" title="Delete post">
            <Icon name="more_horiz" size={20} style={{ color: "var(--text-3)" }} />
          </button>
        )}
      </div>

      {/* Photo(s) */}
      {imgs.length > 0 && (
        <Link to={`/community/${post.id}`} className="block">
          {imgs.length === 1 ? (
            <img src={imgs[0]} alt="" loading="lazy" className="h-[300px] w-full object-cover" />
          ) : (
            <div className={clsx("grid gap-0.5", imgs.length === 2 ? "grid-cols-2" : "grid-cols-2")}>
              {imgs.slice(0, 4).map((src, i) => (
                <img key={i} src={src} alt="" loading="lazy" className="aspect-square w-full object-cover" />
              ))}
            </div>
          )}
        </Link>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 px-3 pb-1.5 pt-2.5">
        <button onClick={onLike} className="flex items-center gap-1.5 p-1 active:opacity-70">
          <Icon name="favorite" size={25} fill={post.isLiked} style={{ color: post.isLiked ? "var(--like)" : "var(--text-2)" }} />
          <span className="text-[13px] font-bold" style={{ color: "var(--text)" }}>{post.likeCount}</span>
        </button>
        <Link to={`/community/${post.id}`} className="ml-1.5 flex items-center gap-1.5 p-1 active:opacity-70">
          <Icon name="mode_comment" size={24} style={{ color: "var(--text-2)" }} />
          <span className="text-[13px] font-bold" style={{ color: "var(--text)" }}>{post.commentCount}</span>
        </Link>
        <button onClick={() => void sharePost(post)} className="ml-1.5 flex p-1 active:opacity-70" aria-label="Share post">
          <Icon name="send" size={24} style={{ color: "var(--text-2)" }} />
        </button>
      </div>

      {/* Caption */}
      {post.content && (
        <Link to={`/community/${post.id}`} className="block px-3 pb-1.5">
          <p className="whitespace-pre-wrap text-[13.5px] leading-snug" style={{ color: "var(--text)" }}>
            <span className="font-bold">{post.author.name}</span> {post.content}
          </p>
        </Link>
      )}

      {/* Comments link */}
      {post.commentCount > 0 && (
        <Link to={`/community/${post.id}`} className="block px-3 pb-3.5 text-[13px]" style={{ color: "var(--text-3)" }}>
          View all {post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}
        </Link>
      )}
      {post.commentCount === 0 && <div className="pb-2" />}
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
        className="flex-shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className="flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white"
    >
      <span
        className="flex h-full w-full items-center justify-center rounded-full"
        style={{ background: "linear-gradient(140deg, var(--accent-strong), var(--accent))" }}
      >
        {name?.[0]?.toUpperCase() ?? "?"}
      </span>
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
