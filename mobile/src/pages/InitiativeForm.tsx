import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { API_BASE_URL } from "../config";
import { useAuth } from "../auth/AuthProvider";

const MAX_TITLE = 150;
const MAX_BODY = 5000;

interface Detail {
  title: string;
  body: string;
  imageUrl: string | null;
  youtubeUrl: string | null;
  commentsCloseAt: string;
  canManage: boolean;
}

function looksLikeYoutube(url: string): boolean {
  return /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/.test(url);
}

export default function InitiativeForm() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = !!id;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [commentsCloseAt, setCommentsCloseAt] = useState(defaultDeadline());
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await apiFetch(`/api/initiatives/${id}`, { token });
        if (res.ok) {
          const d: Detail = await res.json();
          if (!d.canManage) { navigate(`/initiatives/${id}`); return; }
          setTitle(d.title ?? "");
          setBody(d.body ?? "");
          setImageUrl(d.imageUrl ?? null);
          setYoutubeUrl(d.youtubeUrl ?? "");
          setCommentsCloseAt(toLocalInput(d.commentsCloseAt));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token, navigate]);

  async function upload(file: File) {
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.url) setImageUrl(data.url);
      else setErr("Could not upload image");
    } catch {
      setErr("Could not upload image");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setErr(null);
    if (!title.trim()) { setErr("Give the initiative a title"); return; }
    if (!body.trim()) { setErr("Describe the initiative"); return; }
    if (youtubeUrl.trim() && !looksLikeYoutube(youtubeUrl.trim())) {
      setErr("That doesn't look like a YouTube link"); return;
    }
    const closeDate = new Date(commentsCloseAt);
    if (isNaN(closeDate.getTime()) || closeDate.getTime() <= Date.now()) {
      setErr("The deadline must be in the future"); return;
    }
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        imageUrl,
        youtubeUrl: youtubeUrl.trim() || null,
        commentsCloseAt: closeDate.toISOString(),
      };
      const res = await apiFetch(editing ? `/api/initiatives/${id}` : "/api/initiatives", {
        method: editing ? "PATCH" : "POST", token, body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setErr(data?.error ?? "Could not save"); return; }
      navigate(`/initiatives/${editing ? id : data.id}`);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="flex flex-1 items-center justify-center" style={{ background: "var(--bg)" }}><Loader2 className="animate-spin" size={24} style={{ color: "var(--text-3)" }} /></div>;
  }

  const lbl = "mb-2 block text-[13px] font-semibold";
  const field = "one-input w-full rounded-[12px] px-3.5 py-3.5 text-[14.5px]";

  return (
    <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-10" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <button onClick={() => navigate(editing ? `/initiatives/${id}` : "/initiatives")} className="flex items-center gap-1.5 py-3 text-[15px] font-semibold active:opacity-70" style={{ color: "var(--text-2)" }}>
        <Icon name="arrow_back" size={22} style={{ color: "var(--text-2)" }} /> Back
      </button>
      <h1 className="mb-5 mt-1.5 text-[25px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>{editing ? "Edit initiative" : "New initiative"}</h1>

      <div>
        <label className={lbl} style={{ color: "var(--text-2)" }}>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))} placeholder="e.g. New visitor parking policy" className={field} />

        <label className={`${lbl} mt-[18px]`} style={{ color: "var(--text-2)" }}>Details</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))} placeholder="Explain the initiative and what feedback you're looking for…" rows={6} className={`${field} resize-none leading-relaxed`} />

        <label className={`${lbl} mt-[18px]`} style={{ color: "var(--text-2)" }}>Feedback open until</label>
        <div className="flex items-center gap-2.5 rounded-[12px] px-3.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)" }}>
          <Icon name="event" size={20} style={{ color: "var(--accent)" }} />
          <input type="datetime-local" value={commentsCloseAt} onChange={(e) => setCommentsCloseAt(e.target.value)} className="flex-1 bg-transparent py-3.5 text-[14.5px] font-semibold outline-none" style={{ color: "var(--text)" }} />
        </div>
        <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--text-3)" }}>After this, no new feedback or replies (likes stay open).</p>

        {/* Media — YouTube link */}
        <label className={`${lbl} mt-[18px]`} style={{ color: "var(--text-2)" }}>
          Media <span className="font-normal" style={{ color: "var(--text-3)" }}>(optional)</span>
        </label>
        <div className="flex items-center gap-2.5 rounded-[12px] px-3.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)" }}>
          <Icon name="smart_display" size={21} fill style={{ color: "#ff0033" }} />
          <input
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            inputMode="url"
            placeholder="Paste a YouTube link"
            className="flex-1 bg-transparent py-3.5 text-[14.5px] outline-none"
            style={{ color: "var(--text)" }}
          />
          {youtubeUrl && (
            <button onClick={() => setYoutubeUrl("")} aria-label="Clear link"><Icon name="close" size={18} style={{ color: "var(--text-3)" }} /></button>
          )}
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "var(--text-3)" }}>Add a walkthrough or explainer video.</p>

        {/* Image upload */}
        <div className="mt-3.5">
          {imageUrl ? (
            <div className="relative inline-block">
              <img src={imageUrl} alt="" className="h-32 rounded-[12px] object-cover" style={{ border: "1px solid var(--border)" }} />
              <button onClick={() => setImageUrl(null)} className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}>
                <Icon name="close" size={13} style={{ color: "var(--text)" }} />
              </button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 rounded-[12px] px-4 py-3 text-[14px] font-semibold disabled:opacity-60" style={{ border: "1.5px dashed var(--border-strong)", color: "var(--text-2)" }}>
              {uploading ? <Loader2 size={17} className="animate-spin" /> : <Icon name="image" size={19} style={{ color: "var(--text-2)" }} />}
              {uploading ? "Uploading…" : "Upload image"}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
        </div>

        {err && <p className="mt-4 rounded-[12px] px-3.5 py-2.5 text-[13px]" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>{err}</p>}

        <button onClick={submit} disabled={busy} className="mt-6 flex w-full items-center justify-center gap-2 rounded-[14px] py-4 text-[16px] font-bold text-white active:opacity-90 disabled:opacity-50" style={{ background: "var(--accent-strong)", boxShadow: "0 8px 22px var(--accent-soft)" }}>
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Icon name="campaign" size={20} style={{ color: "#fff" }} />}
          {busy ? "Saving…" : editing ? "Save changes" : "Post initiative"}
        </button>
      </div>
    </div>
  );
}

function defaultDeadline(): string {
  return toLocalInput(new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString());
}
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
