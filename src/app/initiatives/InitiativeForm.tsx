"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, X } from "lucide-react";

const MAX_TITLE = 150;
const MAX_BODY = 5000;

export default function InitiativeForm({ initiativeId }: { initiativeId?: string }) {
  const { status } = useSession();
  const router = useRouter();
  const editing = !!initiativeId;

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
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!initiativeId) return;
    (async () => {
      try {
        const res = await fetch(`/api/initiatives/${initiativeId}`);
        if (res.ok) {
          const d = await res.json();
          if (!d.canManage) { router.push(`/initiatives/${initiativeId}`); return; }
          setTitle(d.title ?? "");
          setBody(d.body ?? "");
          setImageUrl(d.imageUrl ?? null);
          setCommentsCloseAt(toLocalInput(d.commentsCloseAt));
        } else if (res.status === 403) {
          router.push("/initiatives");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [initiativeId, router]);

  async function upload(file: File) {
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.url) setImageUrl(data.url);
      else setErr("Could not upload image");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setErr(null);
    if (!title.trim()) { setErr("Give the initiative a title"); return; }
    if (!body.trim()) { setErr("Describe the initiative"); return; }
    if (!commentsCloseAt) { setErr("Set a feedback deadline"); return; }
    const closeDate = new Date(commentsCloseAt);
    if (isNaN(closeDate.getTime()) || closeDate.getTime() <= Date.now()) {
      setErr("The deadline must be in the future");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        imageUrl,
        commentsCloseAt: closeDate.toISOString(),
      };
      const res = editing
        ? await fetch(`/api/initiatives/${initiativeId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/initiatives", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setErr(data?.error ?? "Could not save"); return; }
      router.push(`/initiatives/${editing ? initiativeId : data.id}`);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Link href={editing ? `/initiatives/${initiativeId}` : "/initiatives"} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"><ArrowLeft size={16} /> Back</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-3 mb-6">{editing ? "Edit initiative" : "New initiative"}</h1>

        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))} placeholder="e.g. New visitor parking policy" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Details</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))} placeholder="Explain the initiative, the rationale, and what feedback you're looking for…" rows={6} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Feedback open until</label>
            <input type="datetime-local" value={commentsCloseAt} onChange={(e) => setCommentsCloseAt(e.target.value)} className={inputCls} />
            <p className="text-xs text-gray-400 mt-1">After this time, no one can add feedback or replies (likes stay open).</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image <span className="text-gray-400 font-normal">(optional)</span></label>
            {imageUrl ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="" className="h-32 rounded-lg border border-gray-200 object-cover" />
                <button type="button" onClick={() => setImageUrl(null)} className="absolute -top-2 -right-2 bg-gray-900 text-white rounded-full p-1"><X size={12} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 border border-dashed border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                <Upload size={15} /> {uploading ? "Uploading…" : "Upload image"}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
          </div>

          {err && <p className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{err}</p>}
          <button type="button" onClick={submit} disabled={busy} className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50">
            {busy ? "Saving…" : editing ? "Save changes" : "Post initiative"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

function defaultDeadline(): string {
  // default: 7 days from now, local time
  const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  return toLocalInput(d.toISOString());
}
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
