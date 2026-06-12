import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { API_BASE_URL } from "../config";
import { useAuth } from "../auth/AuthProvider";
import Icon from "../components/Icon";

const MAX_RATE = 1000;

// Token-styled inputs (OneRMV: surface-2 fill, strong border, r11).
const inputCls = "w-full rounded-[11px] px-3.5 py-3 text-[15px] outline-none";
const inputStyle = {
  background: "var(--surface-2)",
  border: "1px solid var(--border-strong)",
  color: "var(--text)",
} as const;
const uploadStyle = { border: "1.5px dashed var(--border-strong)", color: "var(--text-2)" } as const;

interface SlotDetail {
  label: string; location: string | null; description: string | null;
  hourlyRate: number; monthlyRate: number | null; payInfo: string | null; payQrUrl: string | null; photoUrl: string | null; active: boolean;
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
  const [monthlyRate, setMonthlyRate] = useState("");
  const [payInfo, setPayInfo] = useState("");
  const [payQrUrl, setPayQrUrl] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

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
          setMonthlyRate(d.monthlyRate != null ? String(d.monthlyRate) : "");
          setPayInfo(d.payInfo ?? "");
          setPayQrUrl(d.payQrUrl ?? null);
          setPhotoUrl(d.photoUrl ?? null);
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

  async function uploadPhoto(file: File) {
    setPhotoUploading(true);
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
      if (res.ok && data?.url) setPhotoUrl(data.url);
      else setErr("Could not upload image");
    } catch {
      setErr("Could not upload image");
    } finally {
      setPhotoUploading(false);
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
        monthlyRate: monthlyRate.trim() === "" ? null : parseFloat(monthlyRate),
        payInfo: payInfo.trim() || null,
        payQrUrl,
        photoUrl,
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

  if (loading) return <div className="one-surface flex flex-1 items-center justify-center" style={{ background: "var(--bg)" }}><div className="h-7 w-7 animate-spin rounded-full border-b-2" style={{ borderColor: "var(--accent)" }} /></div>;

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-6"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <button onClick={() => navigate(editing ? `/parking/${id}` : "/parking")} className="flex items-center gap-1.5 py-3.5 text-[15px] font-semibold" style={{ color: "var(--text-2)" }}>
        <Icon name="arrow_back" size={20} style={{ color: "var(--text-2)" }} /> {editing ? "Back" : "Parking"}
      </button>
      <h1 className="mb-5 text-[23px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>{editing ? "Edit slot" : "List your parking slot"}</h1>

      <div className="space-y-4">
        <Field label="Slot name / number">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Basement P2 - 45" className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Location / directions" optional>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Near lift lobby B" className={inputCls} style={inputStyle} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hourly rate">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-bold" style={{ color: "var(--text-2)" }}>₹</span>
              <input type="number" inputMode="decimal" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="30" className={`${inputCls} pl-8`} style={inputStyle} />
            </div>
          </Field>
          <Field label="Monthly" optional>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-bold" style={{ color: "var(--text-2)" }}>₹</span>
              <input type="number" inputMode="decimal" value={monthlyRate} onChange={(e) => setMonthlyRate(e.target.value)} placeholder="3000" className={`${inputCls} pl-8`} style={inputStyle} />
            </div>
          </Field>
        </div>
        <p className="-mt-2 text-[12px]" style={{ color: "var(--text-3)" }}>Add a monthly rate to also offer this slot for monthly rental.</p>
        <Field label="Notes" optional>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="compact cars only, covered" rows={2} className={inputCls} style={inputStyle} />
        </Field>

        <Field label="Slot photo" optional>
          {photoUrl ? (
            <div className="relative inline-block">
              <img src={photoUrl} alt="Parking slot" className="h-40 w-full max-w-xs rounded-[11px] object-cover" style={{ border: "1px solid var(--border)" }} />
              <button onClick={() => setPhotoUrl(null)} className="absolute -right-2 -top-2 rounded-full p-1 text-white" style={{ background: "var(--surface-3)" }}><Icon name="close" size={12} style={{ color: "var(--text)" }} /></button>
            </div>
          ) : (
            <button onClick={() => photoRef.current?.click()} disabled={photoUploading} className="flex items-center gap-2 rounded-[11px] px-4 py-3 text-[14px] font-semibold" style={uploadStyle}>
              <Icon name="upload" size={20} style={{ color: "var(--text-2)" }} /> {photoUploading ? "Uploading…" : "Upload slot photo"}
            </button>
          )}
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f); e.target.value = ""; }} />
        </Field>
        <p className="-mt-2 text-[12px]" style={{ color: "var(--text-3)" }}>A photo of the spot helps bookers recognise it.</p>

        <div className="space-y-4 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <Field label="Payment handle — UPI ID / phone" optional>
            <input value={payInfo} onChange={(e) => setPayInfo(e.target.value)} placeholder="name@upi or 98xxxxxxxx" className={inputCls} style={inputStyle} />
          </Field>
          <Field label="Payment QR image" optional>
            {payQrUrl ? (
              <div className="relative inline-block">
                <img src={payQrUrl} alt="Payment QR" className="h-32 w-32 rounded-[11px] bg-white object-contain p-1" />
                <button onClick={() => setPayQrUrl(null)} className="absolute -right-2 -top-2 rounded-full p-1 text-white" style={{ background: "var(--surface-3)" }}><Icon name="close" size={12} style={{ color: "var(--text)" }} /></button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-2 rounded-[11px] px-4 py-3 text-[14px] font-semibold" style={uploadStyle}>
                <Icon name="qr_code_2" size={20} style={{ color: "var(--text-2)" }} /> {uploading ? "Uploading…" : "Upload UPI QR"}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadQr(f); e.target.value = ""; }} />
          </Field>
          <p className="text-[12px]" style={{ color: "var(--text-3)" }}>Bookers see these to pay you directly. Payment stays offline.</p>
        </div>

        {editing && (
          <label className="flex items-center gap-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-[var(--accent)]" />
            <span className="text-[14px]" style={{ color: "var(--text-2)" }}>Listed (accepting bookings)</span>
          </label>
        )}

        {err && <p className="rounded-[11px] px-3.5 py-2.5 text-[13px]" style={{ background: "var(--danger-soft)", border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)", color: "var(--danger)" }}>{err}</p>}
        <button onClick={submit} disabled={busy} className="w-full rounded-[13px] py-3.5 text-[16px] font-bold text-white active:opacity-90 disabled:opacity-50" style={{ background: "var(--accent-strong)" }}>
          {busy ? "Saving…" : editing ? "Save changes" : "List slot"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-semibold" style={{ color: "var(--text-2)" }}>
        {label}{optional && <span style={{ color: "var(--text-3)", fontWeight: 500 }}> (optional)</span>}
      </label>
      {children}
    </div>
  );
}
