"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, X, IndianRupee } from "lucide-react";
import { MAX_RATE } from "@/lib/parking";

export default function SlotForm({ slotId }: { slotId?: string }) {
  const { status } = useSession();
  const router = useRouter();
  const editing = !!slotId;

  const [label, setLabel] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [monthlyRate, setMonthlyRate] = useState("");
  const [payInfo, setPayInfo] = useState("");
  const [payQrUrl, setPayQrUrl] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  useEffect(() => {
    if (!slotId) return;
    (async () => {
      try {
        const res = await fetch(`/api/parking/slots/${slotId}`);
        if (res.ok) {
          const d = await res.json();
          if (!d.owner?.isMe) { router.push(`/parking/${slotId}`); return; }
          setLabel(d.label ?? "");
          setLocation(d.location ?? "");
          setDescription(d.description ?? "");
          setHourlyRate(String(d.hourlyRate ?? ""));
          setMonthlyRate(d.monthlyRate != null ? String(d.monthlyRate) : "");
          setPayInfo(d.payInfo ?? "");
          setPayQrUrl(d.payQrUrl ?? null);
          setActive(d.active);
        }
      } finally { setLoading(false); }
    })();
  }, [slotId, router]);

  async function uploadQr(file: File) {
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.url) setPayQrUrl(d.url);
      else setErr("Could not upload image");
    } finally { setUploading(false); }
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
        // Empty → not offered monthly (PATCH clears, POST omits).
        monthlyRate: monthlyRate.trim() === "" ? null : parseFloat(monthlyRate),
        payInfo: payInfo.trim() || null,
        payQrUrl,
        active,
      };
      const res = editing
        ? await fetch(`/api/parking/slots/${slotId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/parking/slots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await res.json().catch(() => null);
      if (!res.ok) { setErr(d?.error ?? "Could not save"); return; }
      router.push(`/parking/${editing ? slotId : d.id}`);
    } finally { setBusy(false); }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
        <Link href={editing ? `/parking/${slotId}` : "/parking"} className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900"><ArrowLeft size={16} /> Back</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-3 mb-6">{editing ? "Edit slot" : "List your parking slot"}</h1>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-4">
          <Field label="Slot name / number">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Basement P2 - 45" className={inputCls} />
          </Field>
          <Field label="Location / directions" optional>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Near lift lobby B" className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hourly rate">
              <div className="relative">
                <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input type="number" inputMode="decimal" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="30" className={`${inputCls} pl-8`} />
              </div>
            </Field>
            <Field label="Monthly rate" optional>
              <div className="relative">
                <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input type="number" inputMode="decimal" value={monthlyRate} onChange={(e) => setMonthlyRate(e.target.value)} placeholder="3000" className={`${inputCls} pl-8`} />
              </div>
            </Field>
          </div>
          <p className="-mt-2 text-xs text-gray-400 dark:text-gray-500">Add a monthly rate to also offer this slot for monthly rental.</p>
          <Field label="Notes" optional>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. compact cars only, covered" rows={2} className={inputCls} />
          </Field>

          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <Field label="Your payment handle (UPI ID / phone)" optional>
              <input value={payInfo} onChange={(e) => setPayInfo(e.target.value)} placeholder="name@upi or 98xxxxxxxx" className={inputCls} />
            </Field>
            <Field label="Payment QR image" optional>
              {payQrUrl ? (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={payQrUrl} alt="Payment QR" className="h-32 w-32 object-contain bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1" />
                  <button type="button" onClick={() => setPayQrUrl(null)} className="absolute -top-2 -right-2 bg-gray-900 text-white rounded-full p-1"><X size={12} /></button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Upload size={15} /> {uploading ? "Uploading…" : "Upload UPI QR"}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadQr(f); }} />
            </Field>
            <p className="text-xs text-gray-400 dark:text-gray-500">Bookers see these to pay you directly. Payment stays offline.</p>
          </div>

          {editing && (
            <label className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Listed (accepting bookings)</span>
            </label>
          )}

          {err && <p className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{err}</p>}
          <button type="button" onClick={submit} disabled={busy} className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50">
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
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}{optional && <span className="text-gray-400 dark:text-gray-500 font-normal"> (optional)</span>}</label>
      {children}
    </div>
  );
}
const inputCls = "w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
