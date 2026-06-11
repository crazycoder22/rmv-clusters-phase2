import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, Search, Store, Truck } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { formatUnitPrice } from "../lib/market";

interface VendorCard {
  id: string;
  name: string;
  description: string | null;
  deliveryInfo: string | null;
  photoUrl: string | null;
  itemCount: number;
  minPrice: number;
  sections: string[];
}

function sectionClass(s: string): string {
  const l = s.toLowerCase();
  if (l.startsWith("veg")) return "bg-emerald-500/20 text-emerald-300";
  if (l.startsWith("non")) return "bg-red-500/20 text-red-300";
  return "bg-slate-600/40 text-slate-300";
}

export default function Vendors() {
  const { token } = useAuth();
  const [items, setItems] = useState<VendorCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await apiFetch(`/api/vendors${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ""}`, { token });
      if (r.ok) setItems((await r.json()).vendors ?? []);
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(load, 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [load]);

  return (
    <div className="flex flex-1 flex-col px-4 pt-[max(2rem,env(safe-area-inset-top,0px))] pb-8">
      <header className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Food Vendors</h1>
        <Link to="/vendors/new" className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white active:bg-indigo-700">
          <Plus size={15} /> Add
        </Link>
      </header>
      <p className="mb-3 text-xs text-slate-400">Outside kitchens &amp; caterers — order over WhatsApp.</p>

      <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3">
        <Search size={16} className="text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vendors…"
          className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
        />
      </div>

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-500" size={22} /></div>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-10 text-center text-sm text-slate-400">No vendors yet. Know a good one? Tap Add.</p>
        ) : (
          items.map((v) => (
            <Link key={v.id} to={`/vendors/${v.id}`} className="block overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60 active:bg-slate-700">
              {v.photoUrl && <img src={v.photoUrl} alt="" className="h-28 w-full object-cover" />}
              <div className="flex items-center gap-3 px-4 py-3">
                {!v.photoUrl && <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-300"><Store size={18} /></div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{v.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {v.sections.map((s) => (
                      <span key={s} className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${sectionClass(s)}`}>{s}</span>
                    ))}
                    <span className="text-[11px] text-slate-500">{v.itemCount} item{v.itemCount !== 1 ? "s" : ""}{v.minPrice > 0 && ` · from ${formatUnitPrice(v.minPrice, null)}`}</span>
                  </div>
                  {v.deliveryInfo && <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-500"><Truck size={11} /> {v.deliveryInfo}</p>}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
