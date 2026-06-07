import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown, Loader2, Plus, Search, Star } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import {
  DOMESTIC_HELP_CATEGORIES,
  getCategoryLabel,
  CATEGORY_BADGE,
} from "../lib/domesticHelp";

export type Worker = {
  id: string;
  name: string;
  phone: string;
  categories: string[];
  description: string | null;
  availability: string | null;
  avgRating: number;
  reviewCount: number;
  addedBy?: { name: string; block: number | null; flatNumber: string };
};

export function WorkerCard({ w }: { w: Worker }) {
  return (
    <Link
      to={`/domestic-help/${w.id}`}
      className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3 active:bg-slate-700"
    >
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-base font-semibold text-indigo-300">
        {w.name[0]?.toUpperCase() ?? "?"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{w.name}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {w.categories.slice(0, 3).map((c) => (
            <span key={c} className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_BADGE[c] ?? "bg-slate-600/40 text-slate-300"}`}>
              {getCategoryLabel(c)}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1 text-xs text-amber-300">
        {w.reviewCount > 0 ? (
          <>
            <Star size={13} className="fill-amber-300" />
            {w.avgRating.toFixed(1)}
            <span className="text-slate-500">({w.reviewCount})</span>
          </>
        ) : (
          <span className="text-[11px] text-slate-500">No reviews</span>
        )}
      </div>
    </Link>
  );
}

export default function DomesticHelp() {
  const { token } = useAuth();
  const [items, setItems] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<"recent" | "rating">("rating");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const p = new URLSearchParams();
    if (category) p.set("category", category);
    if (search.trim()) p.set("search", search.trim());
    p.set("sort", sort);
    try {
      const r = await apiFetch(`/api/domestic-help?${p}`, { token });
      if (r.ok) setItems((await r.json()).workers ?? []);
    } finally {
      setLoading(false);
    }
  }, [token, category, search, sort]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(load, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [load]);

  return (
    <div className="flex flex-1 flex-col px-4 pt-[max(2rem,env(safe-area-inset-top,0px))] pb-8">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Domestic Help</h1>
        <Link to="/domestic-help/new" className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white active:bg-indigo-700">
          <Plus size={15} /> Add
        </Link>
      </header>

      <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3">
        <Search size={16} className="text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
        />
        <button
          onClick={() => setSort(sort === "rating" ? "recent" : "rating")}
          className="flex flex-shrink-0 items-center gap-1 text-[11px] text-slate-400"
        >
          <ArrowUpDown size={12} /> {sort === "rating" ? "Top rated" : "Recent"}
        </button>
      </div>

      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white"
      >
        <option value="">All categories</option>
        {DOMESTIC_HELP_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-500" size={22} /></div>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-10 text-center text-sm text-slate-400">No domestic help listed yet.</p>
        ) : (
          items.map((w) => <WorkerCard key={w.id} w={w} />)
        )}
      </div>
    </div>
  );
}
