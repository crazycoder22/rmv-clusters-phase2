import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Browser } from "@capacitor/browser";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

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
  author: { id: string; name: string; block: number | null; flatNumber: string };
  isCommittee: boolean;
  canManage: boolean;
  comments: Comment[];
}

function youtubeId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export default function InitiativeDetail() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const [data, setData] = useState<InitiativeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/initiatives/${id}`, { token });
      if (!res.ok) { setError(res.status === 404 ? "Initiative not found" : "Could not load"); return; }
      setData(await res.json());
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => { if (id) void refresh(); }, [id, refresh]);

  async function postFeedback() {
    if (!feedback.trim()) return;
    setPosting(true);
    try {
      const res = await apiFetch(`/api/initiatives/${id}/comments`, {
        method: "POST", token, body: JSON.stringify({ content: feedback.trim() }),
      });
      if (res.ok) { setFeedback(""); await refresh(); }
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(commentId: string) {
    setData((d) => d ? { ...d, comments: d.comments.map((c) => mapLike(c, commentId)) } : d);
    const res = await apiFetch(`/api/initiatives/${id}/comments/${commentId}/like`, { method: "POST", token });
    if (!res.ok) void refresh();
  }

  async function deleteComment(commentId: string) {
    if (!confirm("Delete this comment?")) return;
    const res = await apiFetch(`/api/initiatives/${id}/comments/${commentId}`, { method: "DELETE", token });
    if (res.ok) await refresh();
  }

  async function deleteInitiative() {
    if (!data || !confirm(`Delete "${data.title}"? This removes all feedback too.`)) return;
    const res = await apiFetch(`/api/initiatives/${id}`, { method: "DELETE", token });
    if (res.ok) navigate("/initiatives");
  }

  if (loading) {
    return <div className="flex flex-1 items-center justify-center" style={{ background: "var(--bg)" }}><Loader2 className="animate-spin" size={24} style={{ color: "var(--text-3)" }} /></div>;
  }
  if (error || !data) {
    return (
      <div className="flex flex-1 items-center justify-center px-4" style={{ background: "var(--bg)" }}>
        <div className="text-center">
          <p className="mb-3" style={{ color: "var(--danger)" }}>{error ?? "Not found"}</p>
          <button onClick={() => navigate("/initiatives")} className="text-[14px]" style={{ color: "var(--accent)" }}>← All initiatives</button>
        </div>
      </div>
    );
  }

  const vid = youtubeId(data.youtubeUrl);

  return (
    <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <div className="flex items-center justify-between py-3">
        <button onClick={() => navigate("/initiatives")} className="flex items-center gap-2 text-[15px] font-semibold active:opacity-70" style={{ color: "var(--text-2)" }}>
          <Icon name="arrow_back" size={22} style={{ color: "var(--text-2)" }} /> All initiatives
        </button>
        {data.canManage && (
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/initiatives/${id}/edit`)} aria-label="Edit"><Icon name="edit" size={21} style={{ color: "var(--text-2)" }} /></button>
            <button onClick={deleteInitiative} aria-label="Delete"><Icon name="delete" size={21} style={{ color: "var(--text-2)" }} /></button>
          </div>
        )}
      </div>

      {/* Title */}
      <div className="mt-1 flex items-start gap-2.5">
        <span className="flex-shrink-0 text-[24px] leading-tight">📢</span>
        <h1 className="text-[22px] font-extrabold leading-snug tracking-tight" style={{ color: "var(--text)" }}>{data.title}</h1>
      </div>
      <p className="mt-2.5 text-[13px]" style={{ color: "var(--text-3)" }}>by {data.author.name} · B{data.author.block ?? "—"}, {data.author.flatNumber}</p>

      {/* Body */}
      <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed" style={{ color: "var(--text)" }}>{data.body}</p>

      {/* YouTube video */}
      {vid && (
        <>
          <button
            onClick={() => { Browser.open({ url: data.youtubeUrl! }).catch(() => window.open(data.youtubeUrl!, "_blank")); }}
            className="relative mt-[18px] block aspect-video w-full overflow-hidden rounded-[14px] active:opacity-95"
            style={{ border: "1px solid var(--border)", background: "#0b1220" }}
          >
            <img src={`https://img.youtube.com/vi/${vid}/hqdefault.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-[7px] px-2 py-1" style={{ background: "rgba(0,0,0,0.62)" }}>
              <Icon name="smart_display" size={16} fill style={{ color: "#ff0033" }} />
              <span className="text-[11px] font-bold text-white">YouTube</span>
            </span>
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-[45px] w-[64px] items-center justify-center rounded-[13px]" style={{ background: "#ff0033", boxShadow: "0 8px 22px rgba(255,0,51,0.45)" }}>
                <Icon name="play_arrow" size={30} fill style={{ color: "#fff" }} />
              </span>
            </span>
          </button>
          <p className="mt-2 flex items-center gap-1.5 truncate text-[12px]" style={{ color: "var(--text-3)" }}>
            <Icon name="link" size={15} style={{ color: "var(--text-3)" }} />
            <span className="truncate">{data.youtubeUrl}</span>
          </p>
        </>
      )}

      {/* Image */}
      {data.imageUrl && <img src={data.imageUrl} alt="" className="mt-3.5 w-full rounded-[14px] object-cover" style={{ border: "1px solid var(--border)" }} />}

      {/* Deadline */}
      {data.isOpen ? (
        <div className="mt-[18px] rounded-[12px] px-4 py-3.5 text-[13.5px] font-semibold" style={{ background: "var(--success-soft)", border: "1px solid var(--success)", color: "var(--success)" }}>
          Feedback open until {fmtDateTime(data.commentsCloseAt)}.
        </div>
      ) : (
        <div className="mt-[18px] inline-flex items-center gap-1.5 rounded-[12px] px-4 py-3 text-[13px]" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-3)" }}>
          <Icon name="lock" size={14} style={{ color: "var(--text-3)" }} /> Commenting closed{data.status === "ARCHIVED" ? " (archived)" : ""}.
        </div>
      )}

      {/* Feedback */}
      <div className="my-5 h-px" style={{ background: "var(--border)" }} />
      <div className="mb-3.5 flex items-center gap-2" style={{ color: "var(--text-3)" }}>
        <Icon name="chat_bubble_outline" size={17} style={{ color: "var(--text-3)" }} />
        <span className="text-[12px] font-bold tracking-wide">FEEDBACK ({data.comments.length})</span>
      </div>

      {data.comments.length === 0 ? (
        <p className="text-[14px]" style={{ color: "var(--text-3)" }}>No feedback yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {data.comments.map((c) => (
            <div key={c.id}>
              <CommentCard
                c={c}
                onLike={() => toggleLike(c.id)}
                onDelete={c.isMine || data.isCommittee ? () => deleteComment(c.id) : undefined}
                onReply={data.isCommittee && data.isOpen ? () => setReplyTo(replyTo === c.id ? null : c.id) : undefined}
              />
              {c.replies && c.replies.length > 0 && (
                <div className="ml-5 mt-2.5 flex flex-col gap-2.5 pl-3" style={{ borderLeft: "2px solid var(--border)" }}>
                  {c.replies.map((r) => (
                    <CommentCard key={r.id} c={r} compact onLike={() => toggleLike(r.id)} onDelete={r.isMine || data.isCommittee ? () => deleteComment(r.id) : undefined} />
                  ))}
                </div>
              )}
              {replyTo === c.id && (
                <div className="ml-5 mt-2.5 pl-3">
                  <ReplyBox initiativeId={id} commentId={c.id} token={token} onPosted={async () => { setReplyTo(null); await refresh(); }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Composer */}
      {data.isOpen ? (
        <div className="mt-6 rounded-[16px] p-3.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)" }}>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Share your feedback or concern…"
            rows={3}
            className="w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none"
            style={{ color: "var(--text)" }}
          />
          <div className="flex justify-end">
            <button onClick={postFeedback} disabled={posting || !feedback.trim()} className="inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-[14px] font-bold text-white active:opacity-90 disabled:opacity-50" style={{ background: "var(--accent-strong)" }}>
              <Icon name="near_me" size={17} fill style={{ color: "#fff" }} /> {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-center text-[14px]" style={{ color: "var(--text-3)" }}>Commenting is closed for this initiative.</p>
      )}
    </div>
  );
}

function CommentCard({ c, compact, onLike, onDelete, onReply }: { c: Comment; compact?: boolean; onLike: () => void; onDelete?: () => void; onReply?: () => void }) {
  return (
    <div className="rounded-[14px] p-3.5" style={c.isOfficial
      ? { background: "var(--accent-soft)", border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)" }
      : { background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2">
        {compact && <Icon name="subdirectory_arrow_right" size={14} style={{ color: "var(--text-3)" }} className="flex-shrink-0" />}
        <span className="text-[13.5px] font-bold" style={{ color: "var(--text)" }}>{c.author.name}</span>
        <span className="one-mono text-[11px]" style={{ color: "var(--text-3)" }}>B{c.author.block ?? "—"}</span>
        {c.isOfficial && (
          <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <Icon name="verified" size={10} fill style={{ color: "var(--accent)" }} /> Committee
          </span>
        )}
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-snug" style={{ color: "var(--text-2)" }}>{c.content}</p>
      <div className="mt-2 flex items-center gap-4">
        <button onClick={onLike} className="inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: c.myLiked ? "var(--like)" : "var(--text-3)" }}>
          <Icon name="favorite" size={14} fill={c.myLiked} style={{ color: c.myLiked ? "var(--like)" : "var(--text-3)" }} /> {c.likeCount > 0 ? c.likeCount : ""}
        </button>
        {onReply && <button onClick={onReply} className="text-[12px] font-bold" style={{ color: "var(--accent)" }}>Reply</button>}
        {onDelete && <button onClick={onDelete} className="ml-auto" aria-label="Delete"><Icon name="delete" size={14} style={{ color: "var(--text-3)" }} /></button>}
        <span className={onDelete ? "text-[11px]" : "ml-auto text-[11px]"} style={{ color: "var(--text-3)" }}>{timeAgo(c.createdAt)}</span>
      </div>
    </div>
  );
}

function ReplyBox({ initiativeId, commentId, token, onPosted }: { initiativeId: string; commentId: string; token: string | null; onPosted: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/initiatives/${initiativeId}/comments/${commentId}`, {
        method: "POST", token, body: JSON.stringify({ content: text.trim() }),
      });
      if (res.ok) onPosted();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-[14px] p-2.5" style={{ background: "var(--surface-2)", border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)" }}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Committee reply…" rows={2} autoFocus className="w-full resize-none bg-transparent text-[14px] outline-none" style={{ color: "var(--text)" }} />
      <div className="flex justify-end">
        <button onClick={submit} disabled={busy || !text.trim()} className="inline-flex items-center gap-1 rounded-[8px] px-3 py-1.5 text-[12px] font-bold text-white active:opacity-90 disabled:opacity-50" style={{ background: "var(--accent-strong)" }}>
          <Icon name="near_me" size={13} fill style={{ color: "#fff" }} /> {busy ? "…" : "Reply"}
        </button>
      </div>
    </div>
  );
}

function mapLike(c: Comment, targetId: string): Comment {
  if (c.id === targetId) return { ...c, myLiked: !c.myLiked, likeCount: c.likeCount + (c.myLiked ? -1 : 1) };
  if (c.replies) return { ...c, replies: c.replies.map((r) => mapLike(r, targetId)) };
  return c;
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
