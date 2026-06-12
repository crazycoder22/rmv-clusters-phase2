import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Check,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import clsx from "clsx";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { API_BASE_URL } from "../config";
import { useAuth } from "../auth/AuthProvider";
import { type FoodKind, KIND_LABELS, MARKET_UNITS, MARKET_UNIT_VALUES } from "../lib/market";

// ── Types ──────────────────────────────────────────────────────────────────

interface DishDraft {
  id?: string; // present when editing an existing dish
  name: string;
  description: string;
  price: string;
  unit: string | null;
  imageUrl: string | null;
  soldOut?: boolean;
}

interface Manager {
  id: string;
  name: string;
  block: number;
  flatNumber: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ── Page ───────────────────────────────────────────────────────────────────

export default function FoodMenuEdit({ kind: kindProp = "KITCHEN" }: { kind?: FoodKind }) {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== "new";
  // Create mode → kind from the prop (which create route). Edit mode → kind of
  // the loaded menu, so one /food edit route serves kitchens and stalls.
  const [loadedKind, setLoadedKind] = useState<FoodKind | null>(null);
  const kind: FoodKind = isEdit ? (loadedKind ?? kindProp) : kindProp;
  const isMarket = kind === "MARKET";
  const L = KIND_LABELS[kind];
  const { token } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayIso());
  const [orderByAt, setOrderByAt] = useState(""); // datetime-local string
  const [pickupInfo, setPickupInfo] = useState("");
  const [dishes, setDishes] = useState<DishDraft[]>([
    { name: "", description: "", price: "", unit: isMarket ? "kg" : null, imageUrl: null },
  ]);
  const [managers, setManagers] = useState<Manager[]>([]);
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
  }, [id, isEdit, token]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateDish(i: number, patch: Partial<DishDraft>) {
    setDishes((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  function addDish() {
    setDishes((prev) => [...prev, { name: "", description: "", price: "", unit: isMarket ? "kg" : null, imageUrl: null }]);
  }
  function removeDish(i: number) {
    setDishes((prev) => prev.filter((_, idx) => idx !== i));
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
        navigate(`${L.sectionPath}/menus/${id}`, { replace: true });
      } else {
        const res = await apiFetch("/api/food/menus", {
          method: "POST",
          token,
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            date,
            kind,
            orderByAt: orderByAt ? new Date(orderByAt).toISOString() : null,
            pickupInfo: pickupInfo.trim() || null,
            items: cleanDishes,
            managerIds: managers.map((m) => m.id),
          }),
        });
        if (!res.ok) {
          setErr((await res.json().catch(() => null))?.error ?? "Could not create");
          return;
        }
        const data = await res.json();
        navigate(`${L.sectionPath}/menus/${data.id}`, { replace: true });
      }
    } catch {
      setErr("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="one-surface flex flex-1 items-center justify-center" style={{ background: "var(--bg)", color: "var(--text-3)" }}>
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)]" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <header className="flex items-center gap-3 py-3">
        <Link to={isEdit ? `${L.sectionPath}/menus/${id}` : L.sectionPath} className="flex" style={{ color: "var(--text-2)" }}>
          <Icon name="arrow_back" size={24} style={{ color: "var(--text-2)" }} />
        </Link>
        <h1 className="text-[21px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>
          {isEdit ? `Edit ${L.listing}` : L.newCta}
        </h1>
      </header>

      <div className="flex-1 space-y-3 pb-4">
        <Field label={`${cap(L.listing)} title`}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isMarket ? "e.g. Fresh from my terrace garden" : "e.g. Today's Lunch — South Indian"} className={inputCls} />
        </Field>
        <Field label="Description (optional)">
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={isMarket ? "A line about your goods" : "A line about today's food"} className={inputCls} />
        </Field>
        <div className="space-y-3">
          <Field label="For date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isEdit} className={clsx(inputCls, "min-w-0 appearance-none", isEdit && "opacity-60")} />
          </Field>
          <Field label="Order by (optional)">
            <input type="datetime-local" value={orderByAt} onChange={(e) => setOrderByAt(e.target.value)} className={clsx(inputCls, "min-w-0 appearance-none")} />
          </Field>
        </div>
        <Field label="Pickup / delivery info (optional)">
          <input value={pickupInfo} onChange={(e) => setPickupInfo(e.target.value)} placeholder="e.g. Pickup from B2-304 after 12:30" className={inputCls} />
        </Field>

        {/* Items */}
        <div>
          <p className="one-mono mb-2 text-[10px] font-medium uppercase" style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}>{cap(L.itemPlural)}</p>
          <div className="space-y-2.5">
            {dishes.map((d, i) => (
              <DishRow
                key={i}
                dish={d}
                token={token}
                isMarket={isMarket}
                itemLabel={L.item}
                onChange={(patch) => updateDish(i, patch)}
                onRemove={dishes.length > 1 ? () => removeDish(i) : undefined}
              />
            ))}
          </div>
          <button type="button" onClick={addDish} className="mt-3 flex w-full items-center justify-center gap-2 rounded-[12px] py-3 text-[14px] font-semibold active:opacity-80" style={{ border: "1.5px dashed var(--border-strong)", color: "var(--text-2)" }}>
            <Plus size={16} /> Add another {L.item}
          </button>
        </div>

        {/* Co-managers — only on create (added from the detail page once it exists). */}
        {!isEdit && <ManagersField L={L} managers={managers} setManagers={setManagers} token={token} />}

        {err && <p className="rounded-[11px] px-3.5 py-2.5 text-[13px]" style={{ background: "var(--danger-soft)", border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)", color: "var(--danger)" }}>{err}</p>}

        <button type="button" onClick={save} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-[13px] py-3.5 text-[16px] font-bold text-white active:opacity-90 disabled:opacity-50" style={{ background: "var(--accent-strong)" }}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {isEdit ? `Save ${L.listing}` : L.publishCta}
        </button>
      </div>
    </div>
  );
}

// ── Co-managers picker (create form) ────────────────────────────────────────

function ManagersField({
  L,
  managers,
  setManagers,
  token,
}: {
  L: (typeof KIND_LABELS)[FoodKind];
  managers: Manager[];
  setManagers: (m: Manager[]) => void;
  token: string | null;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Manager[]>([]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/residents/search?q=${encodeURIComponent(term)}`, { token });
        if (res.ok) {
          const data = await res.json();
          const picked = new Set(managers.map((m) => m.id));
          setResults((data.residents ?? []).filter((r: Manager) => !picked.has(r.id)));
        }
      } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(t);
  }, [q, managers, token]);

  return (
    <div className="pt-3" style={{ borderTop: "1px solid var(--border)" }}>
      <p className="one-mono mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase" style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}>
        <Users size={12} /> Co-managers (optional)
      </p>
      <p className="mb-2.5 text-[12px]" style={{ color: "var(--text-3)" }}>
        Residents who can help run this {L.listing} — edit {L.itemPlural} and manage orders. You stay the owner.
      </p>

      {managers.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {managers.map((m) => (
            <li key={m.id} className="flex items-center justify-between rounded-[11px] px-3.5 py-2.5" style={{ background: "var(--surface-2)" }}>
              <span className="text-[13px]" style={{ color: "var(--text)" }}>{m.name} <span style={{ color: "var(--text-3)" }}>· B{m.block}-{m.flatNumber}</span></span>
              <button type="button" onClick={() => setManagers(managers.filter((x) => x.id !== m.id))} style={{ color: "var(--text-3)" }}><X size={15} /></button>
            </li>
          ))}
        </ul>
      )}

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a resident by name…" className={inputCls} />
      {results.length > 0 && (
        <ul className="mt-1.5 overflow-hidden rounded-[11px]" style={{ border: "1px solid var(--border)" }}>
          {results.map((r) => (
            <li key={r.id} style={{ background: "var(--surface)" }}>
              <button type="button" onClick={() => { setManagers([...managers, r]); setQ(""); setResults([]); }} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] active:opacity-80" style={{ color: "var(--text)" }}>
                <UserPlus size={13} style={{ color: "var(--text-3)" }} /> {r.name} <span style={{ color: "var(--text-3)" }}>· B{r.block}-{r.flatNumber}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Dish row with photo upload ──────────────────────────────────────────────

function DishRow({
  dish,
  token,
  isMarket,
  itemLabel,
  onChange,
  onRemove,
}: {
  dish: DishDraft;
  token: string | null;
  isMarket: boolean;
  itemLabel: string;
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
    <div className="space-y-2.5 rounded-[14px] p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex gap-2.5">
        {/* photo */}
        {dish.imageUrl ? (
          <div className="relative h-[62px] w-[62px] flex-shrink-0">
            <img src={dish.imageUrl} alt="" className="h-[62px] w-[62px] rounded-[11px] object-cover" />
            <button type="button" onClick={() => onChange({ imageUrl: null })} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/80 text-white" aria-label="Remove photo">
              <X size={11} />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex h-[62px] w-[62px] flex-shrink-0 flex-col items-center justify-center rounded-[11px]" style={{ border: "1.5px dashed var(--border-strong)", color: "var(--text-3)" }}>
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={20} />}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
        <div className="flex flex-1 flex-col gap-2">
          <input value={dish.name} onChange={(e) => onChange({ name: e.target.value })} placeholder={`${cap(itemLabel)} name`} className="one-input w-full rounded-[10px] px-3 py-2.5 text-[14px]" />
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold" style={{ color: "var(--text-2)" }}>₹</span>
            <input type="number" value={dish.price} onChange={(e) => onChange({ price: e.target.value })} placeholder="Price" className="one-input w-full rounded-[10px] px-3 py-2.5 text-[14px]" />
            {isMarket && (
              <>
                <span style={{ color: "var(--text-3)" }}>/</span>
                <select value={dish.unit ?? "kg"} onChange={(e) => onChange({ unit: e.target.value })} className="one-input w-[88px] appearance-none rounded-[10px] px-3 py-2.5 text-[14px]">
                  {MARKET_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label="Remove item" className="flex h-7 w-7 flex-shrink-0 items-center justify-center self-start rounded-full" style={{ color: "var(--text-3)" }}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <input value={dish.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="Short description (optional)" className="one-input w-full rounded-[10px] px-3 py-2.5 text-[14px]" />
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
