"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Megaphone, Heart, MessageSquare, Lock, ShieldCheck,
  Trash2, Pencil, Send, CornerDownRight,
} from "lucide-react";
import { youtubeId } from "@/lib/initiatives";
import RichTextViewer from "@/components/editor/RichTextViewer";
import { track } from "@/lib/track-client";

const looksLikeHtml = (s: string) => /<[a-z][\s\S]*>/i.test(s);

interface Comment {
  id: string;
  content: string;
  isOfficial: boolean;
  createdAt: string;
  author: { name: string; block: number | null; flatNumber: string };
  isMine: boolean;
  likeCount: number;
  myLiked: boolean;
  replies?: Comment[];
}
interface InitiativeDetail {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  youtubeUrl: string | null;
  status: "OPEN" | "CLOSED" | "ARCHIVED";
  commentsCloseAt: string;
  isOpen: boolean;
  createdAt: string;
  author: { id: string; name: string; block: number | null; flatNumber: string };
  isCommittee: boolean;
  canManage: boolean;
  comments: Comment[];
}

export default function InitiativeDetailPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [data, setData] = useState<InitiativeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/initiatives/${id}`);
      if (!res.ok) { setError(res.status === 404 ? "Initiative not found" : "Could not load"); return; }
      setData(await res.json());
      setError(null);
      track("initiatives", "detail", id);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) void refresh(); }, [id, refresh]);

  async function postFeedback() {
    if (!feedback.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/initiatives/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: feedback.trim() }),
      });
      if (res.ok) { setFeedback(""); await refresh(); }
      else alert((await res.json().catch(() => null))?.error ?? "Could not post");
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(commentId: string) {
    // optimistic
    setData((d) => d ? { ...d, comments: d.comments.map((c) => mapLike(c, commentId)) } : d);
    const res = await fetch(`/api/initiatives/${id}/comments/${commentId}/like`, { method: "POST" });
    if (!res.ok) void refresh(); // rollback on failure
  }

  async function deleteComment(commentId: string) {
    if (!confirm("Delete this comment?")) return;
    const res = await fetch(`/api/initiatives/${id}/comments/${commentId}`, { method: "DELETE" });
    if (res.ok) await refresh();
    else alert((await res.json().catch(() => null))?.error ?? "Could not delete");
  }

  async function deleteInitiative() {
    if (!data || !confirm(`Delete the initiative “${data.title}”? This removes all feedback too.`)) return;
    const res = await fetch(`/api/initiatives/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/initiatives");
  }

  if (loading) return <Centered><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></Centered>;
  if (error || !data) return <Centered><div className="text-center"><p className="text-red-600 mb-3">{error ?? "Not found"}</p><Link href="/initiatives" className="text-blue-600 text-sm">← All initiatives</Link></div></Centered>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between">
          <Link href="/initiatives" className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900"><ArrowLeft size={16} /> All initiatives</Link>
          {data.canManage && (
            <div className="flex items-center gap-3">
              <Link href={`/initiatives/${id}/edit`} className="text-gray-400 dark:text-gray-500 hover:text-blue-600"><Pencil size={18} /></Link>
              <button type="button" onClick={deleteInitiative} className="text-gray-400 dark:text-gray-500 hover:text-red-600"><Trash2 size={18} /></button>
            </div>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-3 flex items-start gap-2"><Megaphone className="text-blue-600 mt-1 shrink-0" size={22} /> {data.title}</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">by {data.author.name} · Block {data.author.block ?? "—"}, {data.author.flatNumber}</p>

        {data.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.imageUrl} alt="" className="mt-3 w-full rounded-lg border border-gray-200 dark:border-gray-700 object-cover" />
        )}

        {youtubeId(data.youtubeUrl) && (
          <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId(data.youtubeUrl)}`}
              title="Initiative video"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {looksLikeHtml(data.body) ? (
          <RichTextViewer html={data.body} className="mt-3 text-gray-800 dark:text-gray-200 leading-relaxed" />
        ) : (
          <p className="mt-3 text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{data.body}</p>
        )}

        {/* Open/closed banner */}
        {data.isOpen ? (
          <div className="mt-4 text-sm text-green-700 bg-green-50 dark:bg-green-900/30 border border-green-200 rounded-lg px-3 py-2">
            Feedback is open until {fmtDateTime(data.commentsCloseAt)}.
          </div>
        ) : (
          <div className="mt-4 inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
            <Lock size={14} /> Commenting closed{data.status === "ARCHIVED" ? " (archived)" : ` on ${fmtDateTime(data.commentsCloseAt)}`}.
          </div>
        )}

        {/* Feedback list */}
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-6 mb-3 flex items-center gap-1.5">
          <MessageSquare size={14} /> Feedback ({data.comments.length})
        </h2>

        {data.comments.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No feedback yet.{data.isOpen ? " Be the first to share your thoughts." : ""}</p>
        ) : (
          <div className="space-y-4">
            {data.comments.map((c) => (
              <div key={c.id}>
                <CommentCard
                  c={c}
                  onLike={() => toggleLike(c.id)}
                  onDelete={c.isMine || data.isCommittee ? () => deleteComment(c.id) : undefined}
                  onReply={data.isCommittee && data.isOpen ? () => setReplyTo(replyTo === c.id ? null : c.id) : undefined}
                />
                {/* replies */}
                {c.replies && c.replies.length > 0 && (
                  <div className="ml-6 mt-2 space-y-2 border-l-2 border-gray-100 dark:border-gray-700 pl-4">
                    {c.replies.map((r) => (
                      <CommentCard
                        key={r.id}
                        c={r}
                        compact
                        onLike={() => toggleLike(r.id)}
                        onDelete={r.isMine || data.isCommittee ? () => deleteComment(r.id) : undefined}
                      />
                    ))}
                  </div>
                )}
                {/* committee reply box */}
                {replyTo === c.id && (
                  <div className="ml-6 mt-2 pl-4">
                    <ReplyBox
                      initiativeId={id}
                      commentId={c.id}
                      onPosted={async () => { setReplyTo(null); await refresh(); }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Compose feedback */}
        {data.isOpen ? (
          <div className="mt-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Share your feedback or concern…"
              rows={3}
              className="w-full text-sm focus:outline-none resize-none bg-transparent dark:text-gray-100"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={postFeedback}
                disabled={posting || !feedback.trim()}
                className="inline-flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                <Send size={14} /> {posting ? "Posting…" : "Post feedback"}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-gray-400 dark:text-gray-500 text-center">Commenting is closed for this initiative.</p>
        )}
      </div>
    </div>
  );
}

function CommentCard({
  c, compact, onLike, onDelete, onReply,
}: {
  c: Comment; compact?: boolean; onLike: () => void; onDelete?: () => void; onReply?: () => void;
}) {
  return (
    <div className={`bg-white dark:bg-gray-800 border rounded-lg p-3 ${c.isOfficial ? "border-blue-200 bg-blue-50 dark:bg-blue-900/30/40" : "border-gray-200 dark:border-gray-700"}`}>
      <div className="flex items-center gap-2">
        {compact && <CornerDownRight size={13} className="text-gray-300 dark:text-gray-600 shrink-0" />}
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{c.author.name}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">Block {c.author.block ?? "—"}</span>
        {c.isOfficial && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-700 bg-blue-100 rounded-full px-1.5 py-0.5 uppercase">
            <ShieldCheck size={10} /> Committee
          </span>
        )}
      </div>
      <p className="text-sm text-gray-800 dark:text-gray-200 mt-1 whitespace-pre-wrap">{c.content}</p>
      <div className="flex items-center gap-4 mt-2">
        <button
          type="button"
          onClick={onLike}
          className={`inline-flex items-center gap-1 text-xs ${c.myLiked ? "text-red-600" : "text-gray-400 dark:text-gray-500 hover:text-gray-600"}`}
        >
          <Heart size={13} fill={c.myLiked ? "currentColor" : "none"} /> {c.likeCount > 0 ? c.likeCount : ""}
        </button>
        {onReply && (
          <button type="button" onClick={onReply} className="text-xs text-blue-600 hover:underline">Reply</button>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete} className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-600 ml-auto"><Trash2 size={13} /></button>
        )}
        <span className="text-[11px] text-gray-300 dark:text-gray-600 ml-auto">{timeAgo(c.createdAt)}</span>
      </div>
    </div>
  );
}

function ReplyBox({ initiativeId, commentId, onPosted }: { initiativeId: string; commentId: string; onPosted: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/initiatives/${initiativeId}/comments/${commentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.trim() }),
      });
      if (res.ok) onPosted();
      else alert((await res.json().catch(() => null))?.error ?? "Could not reply");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="bg-white dark:bg-gray-800 border border-blue-200 rounded-lg p-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Committee reply…"
        rows={2}
        className="w-full text-sm focus:outline-none resize-none bg-transparent dark:text-gray-100"
        autoFocus
      />
      <div className="flex justify-end">
        <button type="button" onClick={submit} disabled={busy || !text.trim()} className="inline-flex items-center gap-1 bg-blue-600 text-white rounded-md px-3 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
          <Send size={12} /> {busy ? "…" : "Reply"}
        </button>
      </div>
    </div>
  );
}

function mapLike(c: Comment, targetId: string): Comment {
  if (c.id === targetId) {
    return { ...c, myLiked: !c.myLiked, likeCount: c.likeCount + (c.myLiked ? -1 : 1) };
  }
  if (c.replies) return { ...c, replies: c.replies.map((r) => mapLike(r, targetId)) };
  return c;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">{children}</div>;
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); return `${d}d ago`;
}
