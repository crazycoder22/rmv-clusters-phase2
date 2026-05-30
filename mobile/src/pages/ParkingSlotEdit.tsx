import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, apiUpload } from "../lib/api";
import { ArrowLeft, Upload, X, IndianRupee } from "lucide-react";

const MAX_RATE = 1000;

interface SlotDetail {
  label: string; location: string | null; description: string | null;
  hourlyRate: number; payInfo: string | null; payQrUrl: string | null; active: boolean;
  owner: { isMe: boolean };
}

export default function ParkingSlotEdit() {
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
        const d = await api<SlotDetail>(`/api/parking/slots/${id}`);
        if (!d.owner?.isMe) { navigate(`/parking/${id}`); return; }
        setLabel(d.label ?? "");
        setLocation(d.location ?? "");
        setDescription(d.description ?? "");
        setHourlyRate(String(d.hourlyRate ?? ""));
        setPayInfo(d.payInfo ?? "");
        setPayQrUrl(d.payQrUrl ?? null);
        setActive(d.active);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  async function uploadQr(file: File) {
    setUploading(true);
    setErr(null);
    try {
      const { url } = await apiUpload("/api/upload", file);
      setPayQrUrl(url);
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
      const body = {
        label: label.trim(),
        location: location.trim() || null,
        description: description.trim() || null,
        hourlyRate: rate,
        payInfo: payInfo.trim() || null,
        payQrUrl,
        active,
      };
      if (editing) {
        await api(`/api/parking/slots/${id}`, { method: "PATCH", body });
        navigate(`/parking/${id}`);
      } else {
        const r = await api<{ id: string }>("/api/parking/slots", { method: "POST", body });
        navigate(`/parking/${r.id}`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-400" /></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <div className="px-4 padding-safe-top">
        <button onClick={() => navigate(editing ? `/parking/${id}` : "/parking")} className="flex items-center gap-1 text-sm text-slate-400 pt-4 pb-2">
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="text-xl font-bold mb-4">{editing ? "Edit slot" : "List your parking slot"}</h1>

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

          <div className="pt-2 border-t border-slate-800 space-y-4">
            <Field label="Your payment handle (UPI ID / phone)" optional>
              <input value={payInfo} onChange={(e) => setPayInfo(e.target.value)} placeholder="name@upi or 98xxxxxxxx" className={inputCls} />
            </Field>
            <Field label="Payment QR image" optional>
              {payQrUrl ? (
                <div className="relative inline-block">
                  <img src={payQrUrl} alt="Payment QR" className="h-32 w-32 object-contain bg-white rounded-lg p-1" />
                  <button onClick={() => setPayQrUrl(null)} className="absolute -top-2 -right-2 bg-slate-700 text-white rounded-full p-1"><X size={12} /></button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 border border-dashed border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-400">
                  <Upload size={15} /> {uploading ? "Uploading…" : "Upload UPI QR"}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadQr(f); e.target.value = ""; }} />
            </Field>
            <p className="text-xs text-slate-500">Bookers see these to pay you directly. Payment stays offline.</p>
          </div>

          {editing && (
            <label className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              <span className="text-sm text-slate-300">Listed (accepting bookings)</span>
            </label>
          )}

          {err && <p className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg px-3 py-2 text-sm">{err}</p>}
          <button onClick={submit} disabled={busy} className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium disabled:opacity-50">
            {busy ? "Saving…" : editing ? "Save changes" : "List slot"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}{optional && <span className="text-slate-600"> (optional)</span>}</label>
      {children}
    </div>
  );
}
const inputCls = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none";
