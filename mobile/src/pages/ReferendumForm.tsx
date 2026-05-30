import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Upload, X, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "../lib/api";
import { API_BASE_URL } from "../config";
import { useAuth } from "../auth/AuthProvider";

const MAX_TITLE = 150;
const MAX_BODY = 5000;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

type Eligibility = "OWNERS_ONLY" | "ALL_RESIDENTS";

interface Detail {
  title: string; body: string; eligibility: Eligibility; imageUrl: string | null;
  closesAt: string; canManage: boolean; turnout: number;
  options: { text: string }[];
}

export default function ReferendumForm() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = !!id;

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

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await apiFetch(`/api/referendums/${id}`, { token });
        if (res.ok) {
          const d: Detail = await res.json();
          if (!d.canManage || d.turnout > 0) { navigate(`/referendums/${id}`); return; }
          setTitle(d.title ?? "");
          setBody(d.body ?? "");
          setEligibility(d.eligibility);
          setOptions((d.options ?? []).map((o) => o.text));
          setImageUrl(d.imageUrl ?? null);
          setClosesAt(toLocalInput(d.closesAt));
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

  function setOption(i: number, val: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));
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
      const res = await apiFetch(editing ? `/api/referendums/${id}` : "/api/referendums", {
        method: editing ? "PATCH" : "POST", token, body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setErr(data?.error ?? "Could not save"); return; }
      navigate(`/referendums/${editing ? id : data.id}`);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="flex flex-1 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-b-2 border-blue-400" /></div>;

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-6">
      <button onClick={() => navigate(editing ? `/referendums/${id}` : "/referendums")} className="flex items-center gap-1 py-4 text-sm text-slate-400">
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="mb-4 text-xl font-bold text-white">{editing ? "Edit referendum" : "New referendum"}</h1>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-[11px] text-slate-400">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))} placeholder="e.g. Approve the clubhouse renovation budget" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-slate-400">Details</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))} placeholder="Explain the decision and what each option means…" rows={5} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-slate-400">Who can vote</label>
          <select value={eligibility} onChange={(e) => setEligibility(e.target.value as Eligibility)} className={inputCls}>
            <option value="ALL_RESIDENTS">All residents (owners + tenants)</option>
            <option value="OWNERS_ONLY">Owners only</option>
          </select>
          <p className="mt-1 text-[10px] text-slate-500">One vote per flat, regardless of how many residents live there.</p>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-slate-400">Options</label>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={o} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`} className={inputCls} />
                {options.length > MIN_OPTIONS && (
                  <button onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))} className="shrink-0 text-slate-500"><Trash2 size={16} /></button>
                )}
              </div>
            ))}
          </div>
          {options.length < MAX_OPTIONS && (
            <button onClick={() => setOptions((prev) => [...prev, ""])} className="mt-2 inline-flex items-center gap-1 text-sm text-blue-400"><Plus size={14} /> Add option</button>
          )}
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-slate-400">Voting closes</label>
          <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className={inputCls} />
          <p className="mt-1 text-[10px] text-slate-500">Results stay hidden until then (or until closed early). Can never be reopened.</p>
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
          {busy ? "Saving…" : editing ? "Save changes" : "Create referendum"}
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
