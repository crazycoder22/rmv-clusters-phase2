import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpDown,
  Heart,
  Loader2,
  Plus,
  Search,
  ShoppingBag,
  Tag,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import {
  MARKETPLACE_CATEGORIES,
  LISTING_TYPES,
  formatPrice,
  getCategoryLabel,
  TYPE_BADGE,
} from "../lib/marketplace";

export type Listing = {
  id: string;
  title: string;
  description: string;
  images: string[];
  category: string;
  listingType: string;
  price: number;
  rentPeriod: string | null;
  status: string;
  seller: { name: string; block: number | null; flatNumber: string };
  _count?: { wishlistedBy: number };
  wishlistedBy?: { id: string }[];
  createdAt: string;
};

export function ListingCard({ l }: { l: Listing }) {
  return (
    <Link
      to={`/marketplace/${l.id}`}
      className="flex gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-2.5 active:bg-slate-700"
    >
      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-slate-900">
        {l.images?.[0] ? (
          <img src={l.images[0]} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-600">
            <ShoppingBag size={24} />
          </div>
        )}
        {l.status === "SOLD" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55">
            <span className="text-[11px] font-bold text-red-300">SOLD</span>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{l.title}</p>
        <p className="mt-0.5 text-sm font-bold text-indigo-300">
          {formatPrice(l.price, l.listingType, l.rentPeriod)}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${TYPE_BADGE[l.listingType] ?? "bg-slate-700 text-slate-300"}`}>
            {l.listingType === "GIVEAWAY" ? "Free" : l.listingType.charAt(0) + l.listingType.slice(1).toLowerCase()}
          </span>
          <span className="text-[10px] text-slate-500">{getCategoryLabel(l.category)}</span>
        </div>
        <p className="mt-0.5 text-[10px] text-slate-500">
          Block {l.seller.block ?? "—"}, {l.seller.flatNumber}
          {l._count ? ` · ♥ ${l._count.wishlistedBy}` : ""}
        </p>
      </div>
    </Link>
  );
}

const SORTS = ["recent", "price_asc", "price_desc"] as const;
const SORT_LABEL: Record<string, string> = {
  recent: "Recent",
  price_asc: "Price ↑",
  price_desc: "Price ↓",
};

export default function Marketplace() {
  const { token } = useAuth();
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState<(typeof SORTS)[number]>("recent");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const p = new URLSearchParams();
    if (category) p.set("category", category);
    if (type) p.set("type", type);
    if (search.trim()) p.set("search", search.trim());
    p.set("sort", sort);
    try {
      const r = await apiFetch(`/api/marketplace?${p}`, { token });
      if (r.ok) setItems((await r.json()).listings ?? []);
    } finally {
      setLoading(false);
    }
  }, [token, category, type, search, sort]);

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
        <h1 className="text-2xl font-semibold tracking-tight text-white">Marketplace</h1>
        <Link
          to="/marketplace/new"
          className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white active:bg-indigo-700"
        >
          <Plus size={15} /> Post
        </Link>
      </header>

      <div className="mb-3 flex gap-2">
        <Link to="/marketplace/mine" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-200 active:bg-slate-700">
          <Tag size={14} /> My listings
        </Link>
        <Link to="/marketplace/wishlist" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-200 active:bg-slate-700">
          <Heart size={14} /> Wishlist
        </Link>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3">
        <Search size={16} className="text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search listings…"
          className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
        />
      </div>

      {/* Type pills + sort */}
      <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
        <button onClick={() => setType("")} className={pill(type === "")}>All</button>
        {LISTING_TYPES.map((t) => (
          <button key={t.value} onClick={() => setType(t.value)} className={pill(type === t.value)}>{t.label}</button>
        ))}
        <button
          onClick={() => setSort(SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length])}
          className="ml-auto flex flex-shrink-0 items-center gap-1 rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-[11px] text-slate-300"
        >
          <ArrowUpDown size={12} /> {SORT_LABEL[sort]}
        </button>
      </div>

      {/* Category select */}
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white"
      >
        <option value="">All categories</option>
        {MARKETPLACE_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>

      {/* List */}
      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-500" size={22} /></div>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-10 text-center text-sm text-slate-400">No listings found.</p>
        ) : (
          items.map((l) => <ListingCard key={l.id} l={l} />)
        )}
      </div>
    </div>
  );
}

function pill(active: boolean): string {
  return (
    "flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium " +
    (active ? "bg-indigo-600 text-white" : "border border-slate-700 bg-slate-800/60 text-slate-300")
  );
}
