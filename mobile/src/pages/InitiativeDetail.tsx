import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Megaphone, Heart, MessageSquare, Lock, ShieldCheck,
  Trash2, Pencil, Send, CornerDownRight,
} from "lucide-react";
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
  status: "OPEN" | "CLOSED" | "ARCHIVED";
  commentsCloseAt: string;
  isOpen: boolean;
  author: { id: string; name: string; block: number | null; flatNumber: string };
  isCommittee: boolean;
  canManage: boolean;
  comments: Comment[];
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
    if (!data || !confirm(`Delete “${data.title}”? This removes all feedback too.`)) return;
    const res = await apiFetch(`/api/initiatives/${id}`, { method: "DELETE", token });
    if (res.ok) navigate("/initiatives");
  }

  if (loading) return <Centered><div className="h-7 w-7 animate-spin rounded-full border-b-2 border-blue-400" /></Centered>;
  if (error || !data) return (
    <Centered>
      <div className="text-center">
        <p className="mb-3 text-red-400">{error ?? "Not found"}</p>
        <button onClick={() => navigate("/initiatives")} className="text-sm text-blue-400">← All initiatives</button>
      </div>
    </Centered>
  );

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-6">
      <div className="flex items-center justify-between py-4">
        <button onClick={() => navigate("/initiatives")} className="flex items-center gap-1 text-sm text-slate-400">
          <ArrowLeft size={16} /> All initiatives
        </button>
        {data.canManage && (
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/initiatives/${id}/edit`)} className="text-slate-400"><Pencil size={18} /></button>
            <button onClick={deleteInitiative} className="text-slate-400"><Trash2 size={18} /></button>
          </div>
        )}
      </div>

      <h1 className="flex items-start gap-2 text-xl font-bold text-white"><Megaphone className="mt-1 shrink-0 text-blue-400" size={20} /> {data.title}</h1>
      <p className="mt-1 text-[11px] text-slate-500">by {data.author.name} · B{data.author.block ?? "—"}, {data.author.flatNumber}</p>

      {data.imageUrl && <img src={data.imageUrl} alt="" className="mt-3 w-full rounded-lg border border-slate-700 object-cover" />}

      <p className="mt-3 whitespace-pre-wrap leading-relaxed text-slate-200">{data.body}</p>

      {data.isOpen ? (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-300">
          Feedback open until {fmtDateTime(data.commentsCloseAt)}.
        </div>
      ) : (
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-[12px] text-slate-400">
          <Lock size={13} /> Commenting closed{data.status === "ARCHIVED" ? " (archived)" : ""}.
        </div>
      )}

      <h2 className="mt-6 mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        <MessageSquare size={13} /> Feedback ({data.comments.length})
      </h2>

      {data.comments.length === 0 ? (
        <p className="text-sm text-slate-500">No feedback yet.</p>
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
              {c.replies && c.replies.length > 0 && (
                <div className="ml-5 mt-2 space-y-2 border-l-2 border-slate-800 pl-3">
                  {c.replies.map((r) => (
                    <CommentCard key={r.id} c={r} compact onLike={() => toggleLike(r.id)} onDelete={r.isMine || data.isCommittee ? () => deleteComment(r.id) : undefined} />
                  ))}
                </div>
              )}
              {replyTo === c.id && (
                <div className="ml-5 mt-2 pl-3">
                  <ReplyBox initiativeId={id} commentId={c.id} token={token} onPosted={async () => { setReplyTo(null); await refresh(); }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {data.isOpen ? (
        <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Share your feedback or concern…"
            rows={3}
            className="w-full resize-none bg-transparent text-sm text-slate-100 focus:outline-none"
          />
          <div className="flex justify-end">
            <button onClick={postFeedback} disabled={posting || !feedback.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white active:bg-indigo-600 disabled:opacity-50">
              <Send size={14} /> {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-center text-sm text-slate-500">Commenting is closed for this initiative.</p>
      )}
    </div>
  );
}

function CommentCard({ c, compact, onLike, onDelete, onReply }: { c: Comment; compact?: boolean; onLike: () => void; onDelete?: () => void; onReply?: () => void }) {
  return (
    <div className={`rounded-2xl border p-3 ${c.isOfficial ? "border-blue-500/40 bg-blue-500/10" : "border-slate-700 bg-slate-800/60"}`}>
      <div className="flex items-center gap-2">
        {compact && <CornerDownRight size={13} className="shrink-0 text-slate-600" />}
        <span className="text-sm font-semibold text-white">{c.author.name}</span>
        <span className="text-[11px] text-slate-500">B{c.author.block ?? "—"}</span>
        {c.isOfficial && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-blue-300">
            <ShieldCheck size={9} /> Committee
          </span>
        )}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">{c.content}</p>
      <div className="mt-2 flex items-center gap-4">
        <button onClick={onLike} className={`inline-flex items-center gap-1 text-[12px] ${c.myLiked ? "text-red-400" : "text-slate-500"}`}>
          <Heart size={13} fill={c.myLiked ? "currentColor" : "none"} /> {c.likeCount > 0 ? c.likeCount : ""}
        </button>
        {onReply && <button onClick={onReply} className="text-[12px] text-blue-400">Reply</button>}
        {onDelete && <button onClick={onDelete} className="ml-auto text-slate-500"><Trash2 size={13} /></button>}
        <span className="ml-auto text-[10px] text-slate-600">{timeAgo(c.createdAt)}</span>
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
    <div className="rounded-2xl border border-blue-500/40 bg-slate-800/60 p-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Committee reply…" rows={2} autoFocus className="w-full resize-none bg-transparent text-sm text-slate-100 focus:outline-none" />
      <div className="flex justify-end">
        <button onClick={submit} disabled={busy || !text.trim()} className="inline-flex items-center gap-1 rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white active:bg-indigo-600 disabled:opacity-50">
          <Send size={12} /> {busy ? "…" : "Reply"}
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
function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 items-center justify-center px-4">{children}</div>;
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
