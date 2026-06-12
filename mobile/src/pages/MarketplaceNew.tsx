import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
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

  const field = "one-input w-full rounded-[12px] px-3.5 py-3 text-[15px]";
  const lbl = "mb-1.5 block text-[13px] font-semibold";

  return (
    <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-10" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <header className="flex items-center gap-2 py-3">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full active:opacity-70" style={{ color: "var(--text-2)" }}>
          <Icon name="arrow_back" size={22} style={{ color: "var(--text-2)" }} />
        </button>
        <h1 className="text-[20px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>New listing</h1>
      </header>

      <div className="space-y-4">
        {/* Photos */}
        <div>
          <label className={lbl} style={{ color: "var(--text-2)" }}>Photos ({images.length}/{MAX_IMAGES})</label>
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative h-[78px] w-[78px] overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--border)" }}>
                <img src={img} alt="" className="h-full w-full object-cover" />
                <button onClick={() => setImages((p) => p.filter((_, idx) => idx !== i))} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white">
                  <Icon name="close" size={13} style={{ color: "#fff" }} />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex h-[78px] w-[78px] flex-col items-center justify-center rounded-[12px] active:opacity-70 disabled:opacity-60"
                style={{ border: "2px dashed var(--border-strong)", color: "var(--text-3)" }}
              >
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Icon name="add_a_photo" size={20} style={{ color: "var(--text-3)" }} />}
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
          <label className={lbl} style={{ color: "var(--text-2)" }}>Title</label>
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Study table" />
        </div>
        <div>
          <label className={lbl} style={{ color: "var(--text-2)" }}>Description</label>
          <textarea className={field} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Condition, age, why selling…" />
        </div>
        <div>
          <label className={lbl} style={{ color: "var(--text-2)" }}>Category</label>
          <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
            {MARKETPLACE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl} style={{ color: "var(--text-2)" }}>Type</label>
          <div className="grid grid-cols-3 gap-2">
            {LISTING_TYPES.map((t) => {
              const active = listingType === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setListingType(t.value)}
                  className="rounded-[12px] px-3 py-2.5 text-[14px] font-semibold"
                  style={active
                    ? { background: "var(--accent-strong)", color: "#fff" }
                    : { background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-2)" }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        {listingType !== "GIVEAWAY" && (
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={lbl} style={{ color: "var(--text-2)" }}>Price (₹)</label>
              <input className={field} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
            </div>
            {listingType === "RENT" && (
              <div className="flex-1">
                <label className={lbl} style={{ color: "var(--text-2)" }}>Per</label>
                <select className={field} value={rentPeriod} onChange={(e) => setRentPeriod(e.target.value)}>
                  {RENT_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            )}
          </div>
        )}
        <div>
          <label className={lbl} style={{ color: "var(--text-2)" }}>WhatsApp number</label>
          <input className={field} inputMode="tel" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="10-digit number" />
        </div>

        {err && <p className="rounded-[12px] px-3.5 py-2.5 text-[13px]" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>{err}</p>}

        <button
          onClick={() => void submit()}
          disabled={saving || uploading}
          className="flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-3.5 text-[15px] font-bold text-white active:opacity-90 disabled:opacity-60"
          style={{ background: "var(--accent-strong)" }}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          Post listing
        </button>
      </div>
    </div>
  );
}
