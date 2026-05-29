import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { API_BASE_URL } from "../config";
import { useAuth } from "../auth/AuthProvider";

// ── Types ──────────────────────────────────────────────────────────────────

interface DishDraft {
  id?: string; // present when editing an existing dish
  name: string;
  description: string;
  price: string;
  imageUrl: string | null;
  soldOut?: boolean;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function FoodMenuEdit() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== "new";
  const { token } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayIso());
  const [orderByAt, setOrderByAt] = useState(""); // datetime-local string
  const [pickupInfo, setPickupInfo] = useState("");
  const [dishes, setDishes] = useState<DishDraft[]>([
    { name: "", description: "", price: "", imageUrl: null },
  ]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Load existing menu in edit mode.
  const load = useCallback(async () => {
    if (!isEdit) return;
    try {
      const res = await apiFetch(`/api/food/menus/${id}`, { token });
      if (!res.ok) {
        setErr("Could not load menu");
        return;
      }
      const m = await res.json();
      setTitle(m.title);
      setDescription(m.description ?? "");
      setDate(new Date(m.date).toISOString().slice(0, 10));
      setOrderByAt(m.orderByAt ? toLocalInput(m.orderByAt) : "");
      setPickupInfo(m.pickupInfo ?? "");
      setDishes(
        (m.items ?? []).map((d: { id: string; name: string; description: string | null; price: number; imageUrl: string | null; soldOut: boolean }) => ({
          id: d.id,
          name: d.name,
          description: d.description ?? "",
          price: String(d.price),
          imageUrl: d.imageUrl,
          soldOut: d.soldOut,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [id, isEdit, token]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateDish(i: number, patch: Partial<DishDraft>) {
    setDishes((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  function addDish() {
    setDishes((prev) => [...prev, { name: "", description: "", price: "", imageUrl: null }]);
  }
  function removeDish(i: number) {
    setDishes((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    setErr(null);
    if (!title.trim()) {
      setErr("Give your menu a title");
      return;
    }
    const cleanDishes = dishes
      .map((d) => ({
        id: d.id,
        name: d.name.trim(),
        description: d.description.trim() || null,
        price: parseFloat(d.price) || 0,
        imageUrl: d.imageUrl,
        soldOut: d.soldOut,
      }))
      .filter((d) => d.name);
    if (cleanDishes.length === 0) {
      setErr("Add at least one dish with a name");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        const res = await apiFetch(`/api/food/menus/${id}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            pickupInfo: pickupInfo.trim() || null,
            orderByAt: orderByAt ? new Date(orderByAt).toISOString() : null,
            items: cleanDishes,
          }),
        });
        if (!res.ok) {
          setErr((await res.json().catch(() => null))?.error ?? "Could not save");
          return;
        }
        navigate(`/food/menus/${id}`, { replace: true });
      } else {
        const res = await apiFetch("/api/food/menus", {
          method: "POST",
          token,
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            date,
            orderByAt: orderByAt ? new Date(orderByAt).toISOString() : null,
            pickupInfo: pickupInfo.trim() || null,
            items: cleanDishes,
          }),
        });
        if (!res.ok) {
          setErr((await res.json().catch(() => null))?.error ?? "Could not create");
          return;
        }
        const data = await res.json();
        navigate(`/food/menus/${data.id}`, { replace: true });
      }
    } catch {
      setErr("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-500">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link to={isEdit ? `/food/menus/${id}` : "/food"} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">
          {isEdit ? "Edit menu" : "New menu"}
        </h1>
      </header>

      <div className="flex-1 space-y-3 pb-4">
        <Field label="Menu title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Today's Lunch — South Indian" className={inputCls} />
        </Field>
        <Field label="Description (optional)">
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A line about today's food" className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="For date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isEdit} className={clsx(inputCls, isEdit && "opacity-60")} />
          </Field>
          <Field label="Order by (optional)">
            <input type="datetime-local" value={orderByAt} onChange={(e) => setOrderByAt(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label="Pickup / delivery info (optional)">
          <input value={pickupInfo} onChange={(e) => setPickupInfo(e.target.value)} placeholder="e.g. Pickup from B2-304 after 12:30" className={inputCls} />
        </Field>

        {/* Dishes */}
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Dishes</p>
          <div className="space-y-2">
            {dishes.map((d, i) => (
              <DishRow
                key={i}
                dish={d}
                token={token}
                onChange={(patch) => updateDish(i, patch)}
                onRemove={dishes.length > 1 ? () => removeDish(i) : undefined}
              />
            ))}
          </div>
          <button type="button" onClick={addDish} className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-slate-700 py-2.5 text-[12px] font-medium text-slate-300 active:bg-slate-800">
            <Plus size={14} /> Add another dish
          </button>
        </div>

        {err && <p className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-2 text-[11px] text-red-200">{err}</p>}

        <button type="button" onClick={save} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white active:bg-indigo-600 disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {isEdit ? "Save menu" : "Publish menu"}
        </button>
      </div>
    </div>
  );
}

// ── Dish row with photo upload ──────────────────────────────────────────────

function DishRow({
  dish,
  token,
  onChange,
  onRemove,
}: {
  dish: DishDraft;
  token: string | null;
  onChange: (patch: Partial<DishDraft>) => void;
  onRemove?: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function upload(file: File) {
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
        if (data?.url) onChange({ imageUrl: data.url });
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-slate-700 bg-slate-800/60 p-2.5">
      <div className="flex gap-2">
        {/* photo */}
        {dish.imageUrl ? (
          <div className="relative h-16 w-16 flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dish.imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
            <button type="button" onClick={() => onChange({ imageUrl: null })} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/80 text-white" aria-label="Remove photo">
              <X size={11} />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex h-16 w-16 flex-shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-700 text-slate-500 active:bg-slate-800">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
        <div className="flex flex-1 flex-col gap-1.5">
          <input value={dish.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Dish name" className={inputCls} />
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-slate-400">₹</span>
            <input type="number" value={dish.price} onChange={(e) => onChange({ price: e.target.value })} placeholder="Price" className={inputCls} />
          </div>
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label="Remove dish" className="flex h-7 w-7 flex-shrink-0 items-center justify-center self-start rounded-full text-slate-500 active:bg-slate-800 active:text-red-300">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <input value={dish.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="Short description (optional)" className={inputCls} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none";

// ── Helpers ────────────────────────────────────────────────────────────────

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toLocalInput(iso: string): string {
  // ISO → "YYYY-MM-DDTHH:mm" in local time for datetime-local input.
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
