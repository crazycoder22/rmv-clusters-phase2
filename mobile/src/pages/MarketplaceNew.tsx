import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";
import { apiFetch } from "../lib/api";
import { API_BASE_URL } from "../config";
import { useAuth } from "../auth/AuthProvider";
import { MARKETPLACE_CATEGORIES, LISTING_TYPES, RENT_PERIODS } from "../lib/marketplace";

const MAX_IMAGES = 5;

export default function MarketplaceNew() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("FURNITURE");
  const [listingType, setListingType] = useState("SELL");
  const [price, setPrice] = useState("");
  const [rentPeriod, setRentPeriod] = useState("MONTH");
  const [whatsappNumber, setWhatsappNumber] = useState(user?.phone ?? "");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (images.length >= MAX_IMAGES) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.url) setImages((prev) => [...prev, data.url]);
      } else {
        setErr("Image upload failed. Try a smaller photo.");
      }
    } catch {
      setErr("Image upload failed. Check your connection.");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setErr(null);
    if (!title.trim()) return setErr("Title is required");
    if (!description.trim()) return setErr("Description is required");
    if (!whatsappNumber.trim()) return setErr("WhatsApp number is required");
    setSaving(true);
    try {
      const res = await apiFetch("/api/marketplace", {
        method: "POST",
        token,
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          images,
          category,
          listingType,
          price: listingType === "GIVEAWAY" ? 0 : Number(price) || 0,
          rentPeriod: listingType === "RENT" ? rentPeriod : null,
          whatsappNumber: whatsappNumber.trim(),
        }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.listing?.id) navigate(`/marketplace/${d.listing.id}`);
      else setErr(d?.error ?? "Could not post listing");
    } finally {
      setSaving(false);
    }
  }

  const field = "w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none";
  const lbl = "mb-1 block text-xs font-medium text-slate-400";

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-10">
      <header className="flex items-center gap-2 py-3">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-semibold text-white">New listing</h1>
      </header>

      <div className="space-y-3">
        {/* Photos */}
        <div>
          <label className={lbl}>Photos ({images.length}/{MAX_IMAGES})</label>
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative h-20 w-20 overflow-hidden rounded-xl border border-slate-700">
                <img src={img} alt="" className="h-full w-full object-cover" />
                <button onClick={() => setImages((p) => p.filter((_, idx) => idx !== i))} className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"><X size={12} /></button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex h-20 w-20 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 text-slate-500 active:bg-slate-800 disabled:opacity-60"
              >
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </div>

        <div>
          <label className={lbl}>Title</label>
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Study table" />
        </div>
        <div>
          <label className={lbl}>Description</label>
          <textarea className={field} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Condition, age, why selling…" />
        </div>
        <div>
          <label className={lbl}>Category</label>
          <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
            {MARKETPLACE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Type</label>
          <div className="flex gap-2">
            {LISTING_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setListingType(t.value)}
                className={
                  "flex-1 rounded-xl px-3 py-2 text-sm font-medium " +
                  (listingType === t.value ? "bg-indigo-600 text-white" : "border border-slate-700 bg-slate-800/60 text-slate-300")
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {listingType !== "GIVEAWAY" && (
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={lbl}>Price (₹)</label>
              <input className={field} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
            </div>
            {listingType === "RENT" && (
              <div className="flex-1">
                <label className={lbl}>Per</label>
                <select className={field} value={rentPeriod} onChange={(e) => setRentPeriod(e.target.value)}>
                  {RENT_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            )}
          </div>
        )}
        <div>
          <label className={lbl}>WhatsApp number</label>
          <input className={field} inputMode="tel" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="10-digit number" />
        </div>

        {err && <p className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-2 text-xs text-red-200">{err}</p>}

        <button
          onClick={() => void submit()}
          disabled={saving || uploading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white active:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          Post listing
        </button>
      </div>
    </div>
  );
}
