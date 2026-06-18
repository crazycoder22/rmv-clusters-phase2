"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useRequireSignIn } from "@/hooks/useRequireSignIn";
import Link from "next/link";
import { ArrowLeft, Upload, X, Plus, Trash2 } from "lucide-react";

const MAX_TITLE = 150;
const MAX_BODY = 5000;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

type Eligibility = "OWNERS_ONLY" | "ALL_RESIDENTS";

export default function ReferendumForm({ referendumId }: { referendumId?: string }) {
  const { status } = useSession();
  const router = useRouter();
  const editing = !!referendumId;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [eligibility, setEligibility] = useState<Eligibility>("ALL_RESIDENTS");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [closesAt, setClosesAt] = useState(defaultDeadline());
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useRequireSignIn(status);

  useEffect(() => {
    if (!referendumId) return;
    (async () => {
      try {
        const res = await fetch(`/api/referendums/${referendumId}`);
        if (res.ok) {
          const d = await res.json();
          if (!d.canManage) { router.push(`/referendums/${referendumId}`); return; }
          if (d.turnout > 0) { router.push(`/referendums/${referendumId}`); return; } // locked once voting starts
          setTitle(d.title ?? "");
          setBody(d.body ?? "");
          setEligibility(d.eligibility);
          setOptions((d.options ?? []).map((o: { text: string }) => o.text));
          setImageUrl(d.imageUrl ?? null);
          setClosesAt(toLocalInput(d.closesAt));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [referendumId, router]);

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

  function setOption(i: number, val: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));
  }
  function addOption() {
    if (options.length < MAX_OPTIONS) setOptions((prev) => [...prev, ""]);
  }
  function removeOption(i: number) {
    if (options.length > MIN_OPTIONS) setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setErr(null);
    if (!title.trim()) { setErr("Give the referendum a title"); return; }
    if (!body.trim()) { setErr("Describe what residents are voting on"); return; }
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < MIN_OPTIONS) { setErr(`Add at least ${MIN_OPTIONS} options`); return; }
    const closeDate = new Date(closesAt);
    if (isNaN(closeDate.getTime()) || closeDate.getTime() <= Date.now()) {
      setErr("The deadline must be in the future"); return;
    }
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        eligibility,
        imageUrl,
        closesAt: closeDate.toISOString(),
        options: cleanOptions,
      };
      const res = editing
        ? await fetch(`/api/referendums/${referendumId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/referendums", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setErr(data?.error ?? "Could not save"); return; }
      router.push(`/referendums/${editing ? referendumId : data.id}`);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Link href={editing ? `/referendums/${referendumId}` : "/referendums"} className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900"><ArrowLeft size={16} /> Back</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-3 mb-6">{editing ? "Edit referendum" : "New referendum"}</h1>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))} placeholder="e.g. Approve the clubhouse renovation budget" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Details</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))} placeholder="Explain the decision, the context, and what each option means…" rows={5} className={inputCls} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Who can vote</label>
            <select value={eligibility} onChange={(e) => setEligibility(e.target.value as Eligibility)} className={inputCls}>
              <option value="ALL_RESIDENTS">All residents (owners + tenants)</option>
              <option value="OWNERS_ONLY">Owners only</option>
            </select>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">One vote per flat, regardless of how many residents live there.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Options</label>
            <div className="space-y-2">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={o} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`} className={inputCls} />
                  {options.length > MIN_OPTIONS && (
                    <button type="button" onClick={() => removeOption(i)} className="text-gray-400 dark:text-gray-500 hover:text-red-600 shrink-0"><Trash2 size={16} /></button>
                  )}
                </div>
              ))}
            </div>
            {options.length < MAX_OPTIONS && (
              <button type="button" onClick={addOption} className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"><Plus size={14} /> Add option</button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Voting closes</label>
            <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className={inputCls} />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Results stay hidden until this time (or until you close it early). A referendum can never be reopened.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Image <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span></label>
            {imageUrl ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="" className="h-32 rounded-lg border border-gray-200 dark:border-gray-700 object-cover" />
                <button type="button" onClick={() => setImageUrl(null)} className="absolute -top-2 -right-2 bg-gray-900 text-white rounded-full p-1"><X size={12} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                <Upload size={15} /> {uploading ? "Uploading…" : "Upload image"}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
          </div>

          {err && <p className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{err}</p>}
          <button type="button" onClick={submit} disabled={busy} className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50">
            {busy ? "Saving…" : editing ? "Save changes" : "Create referendum"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

function defaultDeadline(): string {
  return toLocalInput(new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString());
}
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
