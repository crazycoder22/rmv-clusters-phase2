import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { API_BASE_URL } from "../config";
import { useAuth } from "../auth/AuthProvider";
import { ArrowLeft, Upload, X, IndianRupee } from "lucide-react";

const MAX_RATE = 1000;

interface SlotDetail {
  label: string; location: string | null; description: string | null;
  hourlyRate: number; payInfo: string | null; payQrUrl: string | null; active: boolean;
  owner: { isMe: boolean };
}

export default function ParkingSlotEdit() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = !!id;

  const [label, setLabel] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [payInfo, setPayInfo] = useState("");
  const [payQrUrl, setPayQrUrl] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await apiFetch(`/api/parking/slots/${id}`, { token });
        if (res.ok) {
          const d: SlotDetail = await res.json();
          if (!d.owner?.isMe) { navigate(`/parking/${id}`); return; }
          setLabel(d.label ?? "");
          setLocation(d.location ?? "");
          setDescription(d.description ?? "");
          setHourlyRate(String(d.hourlyRate ?? ""));
          setPayInfo(d.payInfo ?? "");
          setPayQrUrl(d.payQrUrl ?? null);
          setActive(d.active);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token, navigate]);

  async function uploadQr(file: File) {
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
      if (res.ok && data?.url) setPayQrUrl(data.url);
      else setErr("Could not upload image");
    } catch {
      setErr("Could not upload image");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setErr(null);
    if (!label.trim()) { setErr("Give the slot a name/number"); return; }
    const rate = parseFloat(hourlyRate);
    if (isNaN(rate) || rate < 0 || rate > MAX_RATE) { setErr(`Enter a valid hourly rate (0–${MAX_RATE})`); return; }
    setBusy(true);
    try {
      const payload = {
        label: label.trim(),
        location: location.trim() || null,
        description: description.trim() || null,
        hourlyRate: rate,
        payInfo: payInfo.trim() || null,
        payQrUrl,
        active,
      };
      const res = await apiFetch(editing ? `/api/parking/slots/${id}` : "/api/parking/slots", {
        method: editing ? "PATCH" : "POST",
        token,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setErr(data?.error ?? "Could not save"); return; }
      navigate(`/parking/${editing ? id : data.id}`);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="flex flex-1 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-b-2 border-blue-400" /></div>;

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-6">
      <button onClick={() => navigate(editing ? `/parking/${id}` : "/parking")} className="flex items-center gap-1 py-4 text-sm text-slate-400">
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="mb-4 text-xl font-bold text-white">{editing ? "Edit slot" : "List your parking slot"}</h1>

      <div className="space-y-4">
        <Field label="Slot name / number">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Basement P2 - 45" className={inputCls} />
        </Field>
        <Field label="Location / directions" optional>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Near lift lobby B" className={inputCls} />
        </Field>
        <Field label="Hourly rate">
          <div className="relative">
            <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="number" inputMode="decimal" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="30" className={`${inputCls} pl-8`} />
          </div>
        </Field>
        <Field label="Notes" optional>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="compact cars only, covered" rows={2} className={inputCls} />
        </Field>

        <div className="space-y-4 border-t border-slate-800 pt-2">
          <Field label="Your payment handle (UPI ID / phone)" optional>
            <input value={payInfo} onChange={(e) => setPayInfo(e.target.value)} placeholder="name@upi or 98xxxxxxxx" className={inputCls} />
          </Field>
          <Field label="Payment QR image" optional>
            {payQrUrl ? (
              <div className="relative inline-block">
                <img src={payQrUrl} alt="Payment QR" className="h-32 w-32 rounded-lg bg-white object-contain p-1" />
                <button onClick={() => setPayQrUrl(null)} className="absolute -right-2 -top-2 rounded-full bg-slate-700 p-1 text-white"><X size={12} /></button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-700 px-4 py-2 text-sm text-slate-400">
                <Upload size={15} /> {uploading ? "Uploading…" : "Upload UPI QR"}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadQr(f); e.target.value = ""; }} />
          </Field>
          <p className="text-[11px] text-slate-500">Bookers see these to pay you directly. Payment stays offline.</p>
        </div>

        {editing && (
          <label className="flex items-center gap-2 border-t border-slate-800 pt-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span className="text-sm text-slate-300">Listed (accepting bookings)</span>
          </label>
        )}

        {err && <p className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-2 text-[12px] text-red-200">{err}</p>}
        <button onClick={submit} disabled={busy} className="w-full rounded-xl bg-indigo-500 py-2.5 font-medium text-white active:bg-indigo-600 disabled:opacity-50">
          {busy ? "Saving…" : editing ? "Save changes" : "List slot"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-slate-400">{label}{optional && <span className="text-slate-600"> (optional)</span>}</label>
      {children}
    </div>
  );
}
const inputCls = "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none";
