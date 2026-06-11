"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ImagePlus, Plus, Trash2, UserPlus, Users, X } from "lucide-react";
import { type FoodKind, KIND_LABELS, MARKET_UNITS, MARKET_UNIT_VALUES } from "@/lib/market";

interface Manager {
  id: string;
  name: string;
  block: number;
  flatNumber: string;
}

// Shared create/edit form. Pass menuId to edit an existing menu, and kind to
// drive labels (KITCHEN = dishes/menu | MARKET = items/stall with a unit).
interface DishDraft {
  id?: string;
  name: string;
  description: string;
  price: string;
  unit: string | null;
  imageUrl: string | null;
  soldOut?: boolean;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function MenuForm({ menuId, kind: kindProp = "KITCHEN" }: { menuId?: string; kind?: FoodKind }) {
  const isEdit = !!menuId;
  const router = useRouter();
  // In create mode the kind comes from the prop (which "New" button). In edit
  // mode it's whatever the loaded menu is, so a single /food edit route serves
  // both kitchens and stalls.
  const [loadedKind, setLoadedKind] = useState<FoodKind | null>(null);
  const kind: FoodKind = isEdit ? (loadedKind ?? kindProp) : kindProp;
  const isMarket = kind === "MARKET";
  const L = KIND_LABELS[kind];

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayIso());
  const [orderByAt, setOrderByAt] = useState("");
  const [pickupInfo, setPickupInfo] = useState("");
  const [dishes, setDishes] = useState<DishDraft[]>(() => [
    { name: "", description: "", price: "", unit: isMarket ? "kg" : null, imageUrl: null },
  ]);
  const [managers, setManagers] = useState<Manager[]>([]);
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
      const mk = m.kind === "MARKET";
      setLoadedKind(mk ? "MARKET" : "KITCHEN");
      setTitle(m.title);
      setDescription(m.description ?? "");
      setDate(new Date(m.date).toISOString().slice(0, 10));
      setOrderByAt(m.orderByAt ? toLocalInput(m.orderByAt) : "");
      setPickupInfo(m.pickupInfo ?? "");
      setDishes(
        (m.items ?? []).map((d: { id: string; name: string; description: string | null; price: number; unit: string | null; imageUrl: string | null; soldOut: boolean }) => ({
          id: d.id,
          name: d.name,
          description: d.description ?? "",
          price: String(d.price),
          unit: d.unit ?? (mk ? "kg" : null),
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
      setErr(`Give your ${L.listing} a title`);
      return;
    }
    const cleanDishes = dishes
      .map((d) => ({
        id: d.id,
        name: d.name.trim(),
        description: d.description.trim() || null,
        price: parseFloat(d.price) || 0,
        unit: isMarket ? d.unit : null,
        imageUrl: d.imageUrl,
        soldOut: d.soldOut,
      }))
      .filter((d) => d.name);
    if (cleanDishes.length === 0) {
      setErr(`Add at least one ${L.item} with a name`);
      return;
    }
    if (isMarket && cleanDishes.some((d) => !d.unit || !MARKET_UNIT_VALUES.includes(d.unit))) {
      setErr("Pick a selling unit for each item");
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
        ...(isEdit ? {} : { date, kind, managerIds: managers.map((m) => m.id) }),
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
      router.push(`${L.sectionPath}/menus/${isEdit ? menuId : data.id}`);
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
        <Link href={isEdit ? `${L.sectionPath}/menus/${menuId}` : L.sectionPath} className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900">
          <ArrowLeft size={16} /> Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-3 mb-6">{isEdit ? `Edit ${L.listing}` : L.newCta}</h1>

        <div className="space-y-4">
          <Field label={`${cap(L.listing)} title`}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isMarket ? "e.g. Fresh from my terrace garden" : "e.g. Today's Lunch — South Indian"} className={inputCls} />
          </Field>
          <Field label="Description (optional)">
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={isMarket ? "A line about your goods" : "A line about today's food"} className={inputCls} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="For date">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isEdit} className={`${inputCls} min-w-0`} />
            </Field>
            <Field label="Order by (optional)">
              <input type="datetime-local" value={orderByAt} onChange={(e) => setOrderByAt(e.target.value)} className={`${inputCls} min-w-0`} />
            </Field>
          </div>
          <Field label="Pickup / delivery info (optional)">
            <input value={pickupInfo} onChange={(e) => setPickupInfo(e.target.value)} placeholder="e.g. Pickup from B2-304 after 12:30" className={inputCls} />
          </Field>

          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{cap(L.itemPlural)}</p>
            <div className="space-y-3">
              {dishes.map((d, i) => (
                <DishRow key={i} dish={d} isMarket={isMarket} itemLabel={L.item} onChange={(p) => updateDish(i, p)} onRemove={dishes.length > 1 ? () => setDishes((prev) => prev.filter((_, idx) => idx !== i)) : undefined} />
              ))}
            </div>
            <button type="button" onClick={() => setDishes((p) => [...p, { name: "", description: "", price: "", unit: isMarket ? "kg" : null, imageUrl: null }])} className="mt-3 w-full inline-flex items-center justify-center gap-1 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Plus size={15} /> Add another {L.item}
            </button>
          </div>

          {/* Co-managers can only be added once the listing exists in edit mode
              (from its detail page), so we only offer this on create. */}
          {!isEdit && <ManagersField L={L} managers={managers} setManagers={setManagers} />}

          {err && <p className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{err}</p>}

          <button type="button" onClick={save} disabled={saving} className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving…" : isEdit ? `Save ${L.listing}` : L.publishCta}
          </button>
        </div>
      </div>
    </div>
  );
}

// Optional co-managers picked up-front on the create form. Holds them in local
// state only; the menu POST creates the rows + notifies them on publish.
function ManagersField({
  L,
  managers,
  setManagers,
}: {
  L: (typeof KIND_LABELS)[FoodKind];
  managers: Manager[];
  setManagers: (m: Manager[]) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Manager[]>([]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/residents/search?q=${encodeURIComponent(term)}`);
        if (res.ok) {
          const data = await res.json();
          const picked = new Set(managers.map((m) => m.id));
          setResults((data.residents ?? []).filter((r: Manager) => !picked.has(r.id)));
        }
      } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(t);
  }, [q, managers]);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
      <p className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        <Users size={15} /> Co-managers <span className="text-gray-400 font-normal">(optional)</span>
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
        Residents who can help run this {L.listing} — edit {L.itemPlural} and manage orders. You stay the owner.
      </p>

      {managers.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {managers.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2">
              <span className="text-sm text-gray-800 dark:text-gray-200">{m.name} <span className="text-gray-400">· {m.block}-{m.flatNumber}</span></span>
              <button type="button" onClick={() => setManagers(managers.filter((x) => x.id !== m.id))} className="text-gray-400 hover:text-red-600"><X size={15} /></button>
            </div>
          ))}
        </div>
      )}

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a resident by name…" className={inputCls} />
      {results.length > 0 && (
        <div className="mt-1.5 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { setManagers([...managers, r]); setQ(""); setResults([]); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <UserPlus size={14} className="text-gray-400" /> {r.name} <span className="text-gray-400">· {r.block}-{r.flatNumber}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DishRow({ dish, isMarket, itemLabel, onChange, onRemove }: { dish: DishDraft; isMarket: boolean; itemLabel: string; onChange: (p: Partial<DishDraft>) => void; onRemove?: () => void }) {
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
          <input value={dish.name} onChange={(e) => onChange({ name: e.target.value })} placeholder={`${cap(itemLabel)} name`} className={inputCls} />
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400">₹</span>
            <input type="number" value={dish.price} onChange={(e) => onChange({ price: e.target.value })} placeholder="Price" className={inputCls} />
            {isMarket && (
              <>
                <span className="text-gray-400 dark:text-gray-500">/</span>
                <select value={dish.unit ?? "kg"} onChange={(e) => onChange({ unit: e.target.value })} className={`${inputCls} w-28`}>
                  {MARKET_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </>
            )}
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
    // min-w-0 so the field can shrink inside a grid cell (native date inputs
    // have a wide intrinsic min-width that would otherwise overflow/overlap).
    <div className="min-w-0">
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
