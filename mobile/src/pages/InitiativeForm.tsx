import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Upload, X } from "lucide-react";
import { apiFetch } from "../lib/api";
import { API_BASE_URL } from "../config";
import { useAuth } from "../auth/AuthProvider";

const MAX_TITLE = 150;
const MAX_BODY = 5000;

interface Detail {
  title: string; body: string; imageUrl: string | null; commentsCloseAt: string; canManage: boolean;
}

export default function InitiativeForm() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = !!id;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
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
    const closeDate = new Date(commentsCloseAt);
    if (isNaN(closeDate.getTime()) || closeDate.getTime() <= Date.now()) {
      setErr("The deadline must be in the future"); return;
    }
    setBusy(true);
    try {
      const payload = { title: title.trim(), body: body.trim(), imageUrl, commentsCloseAt: closeDate.toISOString() };
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

  if (loading) return <div className="flex flex-1 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-b-2 border-blue-400" /></div>;

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-6">
      <button onClick={() => navigate(editing ? `/initiatives/${id}` : "/initiatives")} className="flex items-center gap-1 py-4 text-sm text-slate-400">
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="mb-4 text-xl font-bold text-white">{editing ? "Edit initiative" : "New initiative"}</h1>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-[11px] text-slate-400">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))} placeholder="e.g. New visitor parking policy" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-slate-400">Details</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))} placeholder="Explain the initiative and what feedback you're looking for…" rows={6} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-slate-400">Feedback open until</label>
          <input type="datetime-local" value={commentsCloseAt} onChange={(e) => setCommentsCloseAt(e.target.value)} className={inputCls} />
          <p className="mt-1 text-[10px] text-slate-500">After this, no new feedback or replies (likes stay open).</p>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-slate-400">Image (optional)</label>
          {imageUrl ? (
            <div className="relative inline-block">
              <img src={imageUrl} alt="" className="h-32 rounded-lg border border-slate-700 object-cover" />
              <button onClick={() => setImageUrl(null)} className="absolute -right-2 -top-2 rounded-full bg-slate-700 p-1 text-white"><X size={12} /></button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-700 px-4 py-2 text-sm text-slate-400">
              <Upload size={15} /> {uploading ? "Uploading…" : "Upload image"}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
        </div>

        {err && <p className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-2 text-[12px] text-red-200">{err}</p>}
        <button onClick={submit} disabled={busy} className="w-full rounded-xl bg-indigo-500 py-2.5 font-medium text-white active:bg-indigo-600 disabled:opacity-50">
          {busy ? "Saving…" : editing ? "Save changes" : "Post initiative"}
        </button>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none";
function defaultDeadline(): string {
  return toLocalInput(new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString());
}
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
