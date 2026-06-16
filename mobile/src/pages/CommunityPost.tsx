import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import clsx from "clsx";
import Icon from "../components/Icon";
import MentionTextarea, { renderWithMentions, type CommentMention } from "../components/MentionTextarea";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { Avatar, timeAgo, sharePost } from "./Community";

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
  mentions: CommentMention[];
  author: Author;
  createdAt: string;
};

export default function CommunityPost() {
  const { id = "" } = useParams<{ id: string }>();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<CommentMention[]>([]);
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
      const res = await apiFetch(`/api/feed/${id}/like`, { method: "POST", token });
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
      const mentionedIds = mentions.filter((m) => content.includes(`@${m.name}`)).map((m) => m.id);
      const res = await apiFetch(`/api/feed/${id}/comments`, {
        method: "POST",
        token,
        body: JSON.stringify({ content, mentionedIds }),
      });
      if (!res.ok) return;
      const newComment = (await res.json()) as Comment;
      setComments((prev) => [...prev, newComment]);
      setText("");
      setMentions([]);
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
      const res = await apiFetch(`/api/feed/${id}/comments/${commentId}`, { method: "DELETE", token });
      if (!res.ok) setComments(prev);
      else if (post) setPost({ ...post, commentCount: post.commentCount - 1 });
    } catch {
      setComments(prev);
    }
  };

  const deletePost = async () => {
    if (!post || !confirm("Delete this post?")) return;
    try {
      const res = await apiFetch(`/api/feed/${id}`, { method: "DELETE", token });
      if (res.ok) navigate("/community/feed");
    } catch {
      /* ignore */
    }
  };

  const draft = text.trim().length > 0;
  const isMyPost = post?.author.id === user?.id;

  return (
    <div className="one-surface flex flex-1 flex-col" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <header
        className="flex flex-shrink-0 items-center gap-3 px-[18px] pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <button onClick={() => navigate(-1)} className="flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={22} style={{ color: "var(--text-2)" }} />
        </button>
        <div className="min-w-0 flex-1 text-[19px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Post</div>
        {isMyPost && (
          <button onClick={deletePost} className="flex active:opacity-70" aria-label="Post options">
            <Icon name="more_horiz" size={22} style={{ color: "var(--text-2)" }} />
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin" size={22} style={{ color: "var(--text-3)" }} /></div>
        ) : !post ? (
          <p className="py-12 text-center text-[14px]" style={{ color: "var(--danger)" }}>{error ?? "Not found"}</p>
        ) : (
          <>
            {/* POST */}
            <div className="px-[18px] pb-1 pt-3.5">
              {/* author */}
              <div className="flex items-center gap-3">
                <Avatar name={post.author.name} imageUrl={post.author.googleImage} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold" style={{ color: "var(--text)" }}>{post.author.name}</p>
                  <p className="mt-px text-[12px]" style={{ color: "var(--text-3)" }}>
                    Block {post.author.block}, {post.author.flatNumber} · {timeAgo(post.createdAt)}
                  </p>
                </div>
              </div>

              {/* caption */}
              {post.content && (
                <p className="mx-0.5 my-3 whitespace-pre-wrap text-[15px] leading-relaxed" style={{ color: "var(--text)" }}>
                  {post.content}
                </p>
              )}

              {/* photo(s) */}
              {post.images.length > 0 && (
                post.images.length === 1 ? (
                  <img src={post.images[0]} alt="" loading="lazy" className="h-[320px] w-full rounded-[18px] object-cover" style={{ border: "1px solid var(--border)" }} />
                ) : (
                  <div className="grid grid-cols-2 gap-1">
                    {post.images.map((src, i) => (
                      <img key={i} src={src} alt="" loading="lazy" className="aspect-square w-full rounded-[14px] object-cover" style={{ border: "1px solid var(--border)" }} />
                    ))}
                  </div>
                )
              )}

              {/* actions */}
              <div className="flex items-center gap-1.5 pb-1 pt-3">
                <button onClick={toggleLike} className="flex items-center gap-1.5 p-1 active:opacity-70">
                  <Icon name="favorite" size={25} fill={post.isLiked} style={{ color: post.isLiked ? "var(--like)" : "var(--text-2)" }} />
                  <span className="text-[14px] font-bold" style={{ color: "var(--text)" }}>{post.likeCount}</span>
                </button>
                <div className="ml-2 flex items-center gap-1.5 p-1">
                  <Icon name="mode_comment" size={25} style={{ color: "var(--text-2)" }} />
                  <span className="text-[14px] font-bold" style={{ color: "var(--text)" }}>{post.commentCount}</span>
                </div>
                <button onClick={() => void sharePost(post)} className="ml-2 flex p-1 active:opacity-70" aria-label="Share post">
                  <Icon name="send" size={25} style={{ color: "var(--text-2)" }} />
                </button>
              </div>

              {/* likes summary */}
              {post.likeCount > 0 && (
                <p className="pb-0.5 pt-1.5 text-[12.5px]" style={{ color: "var(--text-2)" }}>
                  <span className="font-bold" style={{ color: "var(--text)" }}>{post.likeCount}</span>{" "}
                  {post.likeCount === 1 ? "like" : "likes"}
                </p>
              )}
            </div>

            <div className="mx-[18px] mt-3.5 h-px" style={{ background: "var(--border)" }} />

            {/* COMMENTS */}
            <div className="px-[18px] pb-3 pt-4">
              <div className="one-mono mb-4 text-[11px]" style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}>
                COMMENTS · {comments.length}
              </div>

              {comments.length === 0 ? (
                <div className="flex flex-col items-center gap-2.5 px-5 py-8 text-center">
                  <Icon name="forum" size={34} style={{ color: "var(--text-3)" }} />
                  <p className="text-[13.5px]" style={{ color: "var(--text-3)" }}>No comments yet. Be the first to say something.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-[18px]">
                  {comments.map((c) => {
                    const mine = c.author.id === user?.id;
                    return (
                      <div key={c.id} className="flex gap-3">
                        <Avatar name={c.author.name} imageUrl={c.author.googleImage} size={34} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] leading-snug" style={{ color: "var(--text)" }}>
                            <span className="font-bold">{c.author.name}</span>{" "}
                            <span className="whitespace-pre-wrap">{renderWithMentions(c.content, c.mentions)}</span>
                          </p>
                          <div className="mt-1.5 flex items-center gap-4 text-[11.5px] font-bold" style={{ color: "var(--text-3)" }}>
                            <span>{timeAgo(c.createdAt)}</span>
                            <span style={{ color: "var(--text-3)" }}>Block {c.author.block}</span>
                            {mine && (
                              <button onClick={() => deleteComment(c.id)} className="active:opacity-70" style={{ color: "var(--danger)" }}>
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Composer */}
      {post && (
        <div className="flex-shrink-0" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
          <div className="flex items-end gap-2.5 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3">
            <Avatar name={user?.name ?? ""} imageUrl={user?.imageUrl ?? null} size={36} />
            <div className="flex-1">
              <MentionTextarea
                value={text}
                mentions={mentions}
                onChange={(v, m) => { setText(v); setMentions(m); }}
                token={token}
                dropUp
                rows={1}
                placeholder="Add a comment… @ to tag"
                className="w-full resize-none rounded-[20px] px-3.5 py-2.5 text-[13.5px] outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
              />
            </div>
            <button
              onClick={submitComment}
              disabled={posting || !draft}
              className={clsx("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-all", !draft && "opacity-60")}
              style={{ background: draft ? "var(--accent-strong)" : "var(--surface-3)" }}
              aria-label="Send comment"
            >
              {posting ? <Loader2 size={16} className="animate-spin text-white" /> : <Icon name="send" size={20} fill style={{ color: "#fff" }} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
