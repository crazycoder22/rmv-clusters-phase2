"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { MARKET_UNITS } from "@/lib/market";
import { VENDOR_SECTIONS } from "@/lib/vendors";

interface ItemDraft {
  name: string;
  price: string;
  unit: string | null;
  section: string;
  note: string;
}

const emptyItem = (): ItemDraft => ({ name: "", price: "", unit: null, section: "", note: "" });

export default function VendorForm({ vendorId }: { vendorId?: string }) {
  const { status } = useSession();
  const router = useRouter();
  const isEdit = !!vendorId;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState("");
  const [notes, setNotes] = useState("");
  const [forDate, setForDate] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  const load = useCallback(async () => {
    if (!vendorId) return;
    try {
      const res = await fetch(`/api/vendors/${vendorId}`);
      if (!res.ok) { setErr("Could not load vendor"); return; }
      const v = await res.json();
      if (!v.canEdit) { router.push(`/vendors/${vendorId}`); return; }
      setName(v.name);
      setPhone(v.phone);
      setDescription(v.description ?? "");
      setDeliveryInfo(v.deliveryInfo ?? "");
      setNotes(v.notes ?? "");
      setForDate(v.forDate ? new Date(v.forDate).toISOString().slice(0, 10) : "");
      setPhotoUrl(v.photoUrl ?? null);
      setItems(
        (v.items ?? []).map((it: { name: string; price: number; unit: string | null; section: string | null; note: string | null }) => ({
          name: it.name, price: String(it.price), unit: it.unit, section: it.section ?? "", note: it.note ?? "",
        }))
      );
    } finally { setLoading(false); }
  }, [vendorId, router]);

  useEffect(() => { void load(); }, [load]);

  function updateItem(i: number, patch: Partial<ItemDraft>) {
    setItems((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.url) setPhotoUrl(d.url);
      else setErr("Could not upload image");
    } finally { setUploading(false); }
  }

  async function save() {
    setErr(null);
    if (!name.trim()) { setErr("Vendor name is required"); return; }
    if (!phone.trim()) { setErr("Phone number is required"); return; }
    const cleanItems = items
      .map((it) => ({ name: it.name.trim(), price: parseFloat(it.price) || 0, unit: it.unit, section: it.section.trim() || null, note: it.note.trim() || null }))
      .filter((it) => it.name);
    if (cleanItems.length === 0) { setErr("Add at least one item with a name"); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(), phone: phone.trim(),
        description: description.trim() || null,
        deliveryInfo: deliveryInfo.trim() || null,
        notes: notes.trim() || null,
        forDate: forDate || null,
        photoUrl,
        items: cleanItems,
      };
      const res = await fetch(isEdit ? `/api/vendors/${vendorId}` : "/api/vendors", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) { setErr(d?.error ?? "Could not save"); return; }
      router.push(`/vendors/${isEdit ? vendorId : d.id}`);
    } finally { setSaving(false); }
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex justify-center pt-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Link href={isEdit ? `/vendors/${vendorId}` : "/vendors"} className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900"><ArrowLeft size={16} /> Back</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-3 mb-6">{isEdit ? "Edit vendor" : "Add a food vendor"}</h1>

        <div className="space-y-4">
          <Field label="Vendor name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sona's Coastal Kitchen" className={inputCls} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="WhatsApp / phone">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98xxxxxxxx" className={`${inputCls} min-w-0`} />
            </Field>
            <Field label="For date (optional)">
              <input type="date" value={forDate} onChange={(e) => setForDate(e.target.value)} className={`${inputCls} min-w-0`} />
            </Field>
          </div>
          <Field label="Delivery / pickup info (optional)">
            <input value={deliveryInfo} onChange={(e) => setDeliveryInfo(e.target.value)} placeholder="e.g. Delivery 10am–1pm" className={inputCls} />
          </Field>
          <Field label="Description (optional)">
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A line about the vendor" className={inputCls} />
          </Field>
          <Field label="Notes (optional)">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Veg sold by weight, min ½ kg" rows={2} className={inputCls} />
          </Field>

          <Field label="Photo (optional)">
            {photoUrl ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="" className="h-32 w-full max-w-xs object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                <button type="button" onClick={() => setPhotoUrl(null)} className="absolute -top-2 -right-2 bg-gray-900 text-white rounded-full p-1"><X size={12} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => photoRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                <ImagePlus size={15} /> {uploading ? "Uploading…" : "Upload photo"}
              </button>
            )}
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f); e.target.value = ""; }} />
          </Field>

          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Menu items</p>
            <div className="space-y-3">
              {items.map((it, i) => (
                <ItemRow key={i} item={it} onChange={(p) => updateItem(i, p)} onRemove={items.length > 1 ? () => setItems((prev) => prev.filter((_, idx) => idx !== i)) : undefined} />
              ))}
            </div>
            <button type="button" onClick={() => setItems((p) => [...p, emptyItem()])} className="mt-3 w-full inline-flex items-center justify-center gap-1 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Plus size={15} /> Add another item
            </button>
          </div>

          {err && <p className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{err}</p>}
          <button type="button" onClick={save} disabled={saving} className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving…" : isEdit ? "Save vendor" : "Add vendor"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemRow({ item, onChange, onRemove }: { item: ItemDraft; onChange: (p: Partial<ItemDraft>) => void; onRemove?: () => void }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
      <div className="flex gap-2">
        <input value={item.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Item name" className={`${inputCls} flex-1`} />
        {onRemove && <button type="button" onClick={onRemove} className="h-8 w-8 flex items-center justify-center self-start text-gray-400 dark:text-gray-500 hover:text-red-600"><Trash2 size={16} /></button>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-500 dark:text-gray-400">₹</span>
        <input type="number" inputMode="decimal" value={item.price} onChange={(e) => onChange({ price: e.target.value })} placeholder="Price" className={`${inputCls} w-24`} />
        <span className="text-gray-400 dark:text-gray-500">/</span>
        <select value={item.unit ?? ""} onChange={(e) => onChange({ unit: e.target.value || null })} className={`${inputCls} w-28`}>
          <option value="">(flat ₹)</option>
          {MARKET_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
        </select>
        <select value={item.section} onChange={(e) => onChange({ section: e.target.value })} className={`${inputCls} w-28`}>
          <option value="">(no tag)</option>
          {VENDOR_SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <input value={item.note} onChange={(e) => onChange({ note: e.target.value })} placeholder="Note (optional) — e.g. 25 pieces" className={inputCls} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      {children}
    </div>
  );
}
const inputCls = "w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
