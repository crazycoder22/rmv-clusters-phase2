"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ImagePlus, Plus, Trash2, X } from "lucide-react";

// Shared create/edit form. Pass menuId to edit an existing menu.
interface DishDraft {
  id?: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string | null;
  soldOut?: boolean;
}

export default function MenuForm({ menuId }: { menuId?: string }) {
  const isEdit = !!menuId;
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayIso());
  const [orderByAt, setOrderByAt] = useState("");
  const [pickupInfo, setPickupInfo] = useState("");
  const [dishes, setDishes] = useState<DishDraft[]>([
    { name: "", description: "", price: "", imageUrl: null },
  ]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isEdit) return;
    try {
      const res = await fetch(`/api/food/menus/${menuId}`);
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
  }, [isEdit, menuId]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateDish(i: number, patch: Partial<DishDraft>) {
    setDishes((p) => p.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
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
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        pickupInfo: pickupInfo.trim() || null,
        orderByAt: orderByAt ? new Date(orderByAt).toISOString() : null,
        items: cleanDishes,
        ...(isEdit ? {} : { date }),
      };
      const res = await fetch(isEdit ? `/api/food/menus/${menuId}` : "/api/food/menus", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setErr((await res.json().catch(() => null))?.error ?? "Could not save");
        return;
      }
      const data = await res.json().catch(() => ({}));
      router.push(`/food/menus/${isEdit ? menuId : data.id}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex justify-center pt-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Link href={isEdit ? `/food/menus/${menuId}` : "/food"} className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900">
          <ArrowLeft size={16} /> Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-3 mb-6">{isEdit ? "Edit menu" : "New menu"}</h1>

        <div className="space-y-4">
          <Field label="Menu title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Today's Lunch — South Indian" className={inputCls} />
          </Field>
          <Field label="Description (optional)">
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A line about today's food" className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="For date">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isEdit} className={inputCls} />
            </Field>
            <Field label="Order by (optional)">
              <input type="datetime-local" value={orderByAt} onChange={(e) => setOrderByAt(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Pickup / delivery info (optional)">
            <input value={pickupInfo} onChange={(e) => setPickupInfo(e.target.value)} placeholder="e.g. Pickup from B2-304 after 12:30" className={inputCls} />
          </Field>

          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Dishes</p>
            <div className="space-y-3">
              {dishes.map((d, i) => (
                <DishRow key={i} dish={d} onChange={(p) => updateDish(i, p)} onRemove={dishes.length > 1 ? () => setDishes((prev) => prev.filter((_, idx) => idx !== i)) : undefined} />
              ))}
            </div>
            <button type="button" onClick={() => setDishes((p) => [...p, { name: "", description: "", price: "", imageUrl: null }])} className="mt-3 w-full inline-flex items-center justify-center gap-1 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Plus size={15} /> Add another dish
            </button>
          </div>

          {err && <p className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{err}</p>}

          <button type="button" onClick={save} disabled={saving} className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving…" : isEdit ? "Save menu" : "Publish menu"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DishRow({ dish, onChange, onRemove }: { dish: DishDraft; onChange: (p: Partial<DishDraft>) => void; onRemove?: () => void }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function upload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const { url } = await res.json();
        if (url) onChange({ imageUrl: url });
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
      <div className="flex gap-3">
        {dish.imageUrl ? (
          <div className="relative h-20 w-20 flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dish.imageUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
            <button type="button" onClick={() => onChange({ imageUrl: null })} className="absolute -right-2 -top-2 h-6 w-6 flex items-center justify-center rounded-full bg-gray-800 text-white"><X size={12} /></button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="h-20 w-20 flex-shrink-0 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700">
            {uploading ? <span className="text-xs">…</span> : <ImagePlus size={20} />}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
        <div className="flex-1 space-y-2">
          <input value={dish.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Dish name" className={inputCls} />
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400">₹</span>
            <input type="number" value={dish.price} onChange={(e) => onChange({ price: e.target.value })} placeholder="Price" className={inputCls} />
          </div>
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} className="h-8 w-8 flex items-center justify-center self-start text-gray-400 dark:text-gray-500 hover:text-red-600"><Trash2 size={16} /></button>
        )}
      </div>
      <input value={dish.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="Short description (optional)" className={inputCls} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
