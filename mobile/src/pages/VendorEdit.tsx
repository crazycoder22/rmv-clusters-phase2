import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import clsx from "clsx";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { API_BASE_URL } from "../config";
import { useAuth } from "../auth/AuthProvider";
import { MARKET_UNITS } from "../lib/market";
import { VENDOR_SECTIONS } from "../lib/vendors";

interface ItemDraft { name: string; price: string; unit: string | null; section: string; note: string; }
const emptyItem = (): ItemDraft => ({ name: "", price: "", unit: null, section: "", note: "" });

export default function VendorEdit() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== "new";
  const { token } = useAuth();
  const navigate = useNavigate();

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

  const load = useCallback(async () => {
    if (!isEdit) return;
    try {
      const res = await apiFetch(`/api/vendors/${id}`, { token });
      if (!res.ok) { setErr("Could not load vendor"); return; }
      const v = await res.json();
      if (!v.canEdit) { navigate(`/vendors/${id}`, { replace: true }); return; }
      setName(v.name); setPhone(v.phone);
      setDescription(v.description ?? ""); setDeliveryInfo(v.deliveryInfo ?? ""); setNotes(v.notes ?? "");
      setForDate(v.forDate ? new Date(v.forDate).toISOString().slice(0, 10) : "");
      setPhotoUrl(v.photoUrl ?? null);
      setItems((v.items ?? []).map((it: { name: string; price: number; unit: string | null; section: string | null; note: string | null }) => ({
        name: it.name, price: String(it.price), unit: it.unit, section: it.section ?? "", note: it.note ?? "",
      })));
    } finally { setLoading(false); }
  }, [id, isEdit, token, navigate]);

  useEffect(() => { void load(); }, [load]);

  function updateItem(i: number, patch: Partial<ItemDraft>) {
    setItems((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE_URL}/api/upload`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: fd });
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
      const payload = { name: name.trim(), phone: phone.trim(), description: description.trim() || null, deliveryInfo: deliveryInfo.trim() || null, notes: notes.trim() || null, forDate: forDate || null, photoUrl, items: cleanItems };
      const res = await apiFetch(isEdit ? `/api/vendors/${id}` : "/api/vendors", { method: isEdit ? "PATCH" : "POST", token, body: JSON.stringify(payload) });
      const d = await res.json().catch(() => null);
      if (!res.ok) { setErr(d?.error ?? "Could not save"); return; }
      navigate(`/vendors/${isEdit ? id : d.id}`, { replace: true });
    } catch { setErr("Network error"); } finally { setSaving(false); }
  }

  if (loading) return <div className="one-surface flex flex-1 items-center justify-center" style={{ background: "var(--bg)", color: "var(--text-3)" }}><Loader2 size={20} className="animate-spin" /></div>;

  return (
    <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)]" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <header className="flex items-center gap-3 py-3">
        <button onClick={() => navigate(isEdit ? `/vendors/${id}` : "/food")} className="flex" style={{ color: "var(--text-2)" }}><Icon name="arrow_back" size={24} style={{ color: "var(--text-2)" }} /></button>
        <h1 className="text-[21px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>{isEdit ? "Edit vendor" : "Add a food vendor"}</h1>
      </header>

      <div className="flex-1 space-y-3 pb-6">
        <Field label="Vendor name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sona's Coastal Kitchen" className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="WhatsApp / phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98xxxxxxxx" className={clsx(inputCls, "min-w-0")} /></Field>
          <Field label="For date (optional)"><input type="date" value={forDate} onChange={(e) => setForDate(e.target.value)} className={clsx(inputCls, "min-w-0 appearance-none")} /></Field>
        </div>
        <Field label="Delivery info (optional)"><input value={deliveryInfo} onChange={(e) => setDeliveryInfo(e.target.value)} placeholder="e.g. Delivery 10am–1pm" className={inputCls} /></Field>
        <Field label="Description (optional)"><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A line about the vendor" className={inputCls} /></Field>
        <Field label="Notes (optional)"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Veg sold by weight, min ½ kg" rows={2} className={inputCls} /></Field>

        <Field label="Photo (optional)">
          {photoUrl ? (
            <div className="relative inline-block">
              <img src={photoUrl} alt="" className="h-32 w-full max-w-xs rounded-[11px] object-cover" style={{ border: "1px solid var(--border)" }} />
              <button onClick={() => setPhotoUrl(null)} className="absolute -right-2 -top-2 rounded-full p-1 text-white" style={{ background: "var(--surface-3)" }}><X size={12} /></button>
            </div>
          ) : (
            <button onClick={() => photoRef.current?.click()} disabled={uploading} className="flex items-center gap-2 rounded-[11px] px-4 py-3 text-[14px] font-semibold" style={{ border: "1.5px dashed var(--border-strong)", color: "var(--text-2)" }}>
              <ImagePlus size={18} /> {uploading ? "Uploading…" : "Upload photo"}
            </button>
          )}
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f); e.target.value = ""; }} />
        </Field>

        <div>
          <p className="one-mono mb-2 text-[10px] font-medium uppercase" style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}>Menu items</p>
          <div className="space-y-2.5">
            {items.map((it, i) => (
              <div key={i} className="space-y-2.5 rounded-[14px] p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex gap-2">
                  <input value={it.name} onChange={(e) => updateItem(i, { name: e.target.value })} placeholder="Item name" className="one-input flex-1 rounded-[10px] px-3 py-2.5 text-[14px]" />
                  {items.length > 1 && <button onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} className="flex h-7 w-7 flex-shrink-0 items-center justify-center self-start rounded-full" style={{ color: "var(--text-3)" }}><Trash2 size={14} /></button>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-bold" style={{ color: "var(--text-2)" }}>₹</span>
                  <input type="number" inputMode="decimal" value={it.price} onChange={(e) => updateItem(i, { price: e.target.value })} placeholder="Price" className="one-input w-20 rounded-[10px] px-3 py-2.5 text-[14px]" />
                  <span style={{ color: "var(--text-3)" }}>/</span>
                  <select value={it.unit ?? ""} onChange={(e) => updateItem(i, { unit: e.target.value || null })} className="one-input w-24 appearance-none rounded-[10px] px-3 py-2.5 text-[14px]">
                    <option value="">flat ₹</option>
                    {MARKET_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                  <select value={it.section} onChange={(e) => updateItem(i, { section: e.target.value })} className="one-input w-24 appearance-none rounded-[10px] px-3 py-2.5 text-[14px]">
                    <option value="">no tag</option>
                    {VENDOR_SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <input value={it.note} onChange={(e) => updateItem(i, { note: e.target.value })} placeholder="Note (optional) — e.g. 25 pieces" className="one-input w-full rounded-[10px] px-3 py-2.5 text-[14px]" />
              </div>
            ))}
          </div>
          <button onClick={() => setItems((p) => [...p, emptyItem()])} className="mt-3 flex w-full items-center justify-center gap-2 rounded-[12px] py-3 text-[14px] font-semibold active:opacity-80" style={{ border: "1.5px dashed var(--border-strong)", color: "var(--text-2)" }}>
            <Plus size={16} /> Add another item
          </button>
        </div>

        {err && <p className="rounded-[11px] px-3.5 py-2.5 text-[13px]" style={{ background: "var(--danger-soft)", border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)", color: "var(--danger)" }}>{err}</p>}
        <button onClick={save} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-[13px] py-3.5 text-[16px] font-bold text-white active:opacity-90 disabled:opacity-50" style={{ background: "var(--accent-strong)" }}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {isEdit ? "Save vendor" : "Add vendor"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="one-mono mb-1.5 text-[10px] font-medium uppercase" style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}>{label}</p>
      {children}
    </div>
  );
}
const inputCls = "one-input w-full rounded-[11px] px-3.5 py-3 text-[15px]";
