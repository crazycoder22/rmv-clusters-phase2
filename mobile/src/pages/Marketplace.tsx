import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import {
  MARKETPLACE_CATEGORIES,
  LISTING_TYPES,
  formatPrice,
  getCategoryLabel,
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

// Striped "listing photo" placeholder matching OneRMV Marketplace.dc.html.
const stripe =
  "repeating-linear-gradient(45deg, var(--surface-2), var(--surface-2) 7px, var(--surface-3) 7px, var(--surface-3) 14px)";

// SELL → accent, GIVEAWAY → success, RENT → warning.
function typeTone(t: string): { bg: string; fg: string } {
  if (t === "GIVEAWAY") return { bg: "var(--success-soft)", fg: "var(--success)" };
  if (t === "RENT") return { bg: "var(--warning-soft)", fg: "var(--warning)" };
  return { bg: "var(--accent-soft)", fg: "var(--accent)" };
}
function priceColor(t: string): string {
  return t === "GIVEAWAY" ? "var(--success)" : "var(--accent)";
}

export function ListingCard({ l }: { l: Listing }) {
  const tone = typeTone(l.listingType);
  return (
    <Link
      to={`/marketplace/${l.id}`}
      className="flex gap-3 rounded-[16px] p-[13px] active:opacity-90"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="relative h-[74px] w-[74px] flex-shrink-0 overflow-hidden rounded-[12px]"
        style={{ border: "1px solid var(--border)", background: l.images?.[0] ? undefined : stripe }}
      >
        {l.images?.[0] ? (
          <img src={l.images[0]} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ color: "var(--text-3)" }}>
            <Icon name="shopping_bag" size={28} style={{ color: "var(--text-3)" }} />
          </div>
        )}
        {l.status === "SOLD" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55">
            <span className="text-[11px] font-bold" style={{ color: "var(--danger)" }}>SOLD</span>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-bold" style={{ color: "var(--text)" }}>{l.title}</p>
        <p className="mt-px text-[18px] font-extrabold tracking-tight" style={{ color: priceColor(l.listingType) }}>
          {formatPrice(l.price, l.listingType, l.rentPeriod)}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
            {l.listingType === "GIVEAWAY" ? "Giveaway" : l.listingType.charAt(0) + l.listingType.slice(1).toLowerCase()}
          </span>
          <span className="text-[13px]" style={{ color: "var(--text-3)" }}>{getCategoryLabel(l.category)}</span>
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-3)" }}>
          <span>Block {l.seller.block ?? "—"}, {l.seller.flatNumber}</span>
          {l._count && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-0.5">
                <Icon name="favorite" size={14} fill style={{ color: "var(--text-3)" }} />{l._count.wishlistedBy}
              </span>
            </>
          )}
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
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-8"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-[25px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Marketplace</h1>
        <Link
          to="/marketplace/new"
          className="flex items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-bold text-white active:opacity-90"
          style={{ background: "var(--accent-strong)" }}
        >
          <Icon name="add" size={18} style={{ color: "#fff" }} /> Post
        </Link>
      </header>

      <div className="mb-3 grid grid-cols-2 gap-2.5">
        <Link to="/marketplace/mine" className="flex items-center justify-center gap-2 rounded-[12px] py-2.5 text-[14px] font-semibold active:opacity-80" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>
          <Icon name="sell" size={19} style={{ color: "var(--text-2)" }} /> My listings
        </Link>
        <Link to="/marketplace/wishlist" className="flex items-center justify-center gap-2 rounded-[12px] py-2.5 text-[14px] font-semibold active:opacity-80" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>
          <Icon name="favorite" size={19} style={{ color: "var(--text-2)" }} /> Wishlist
        </Link>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2.5 rounded-[13px] px-3.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <Icon name="search" size={20} style={{ color: "var(--text-3)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search listings…"
          className="flex-1 bg-transparent py-3 text-[14px] outline-none"
          style={{ color: "var(--text)" }}
        />
      </div>

      {/* Type chips + sort */}
      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
        <Chip active={type === ""} onClick={() => setType("")}>All</Chip>
        {LISTING_TYPES.map((t) => (
          <Chip key={t.value} active={type === t.value} onClick={() => setType(t.value)}>{t.label}</Chip>
        ))}
        <button
          onClick={() => setSort(SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length])}
          className="ml-auto flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-2)" }}
        >
          <Icon name="swap_vert" size={16} style={{ color: "var(--text-2)" }} /> {SORT_LABEL[sort]}
        </button>
      </div>

      {/* Category select */}
      <div className="mt-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full appearance-none rounded-[12px] px-3.5 py-3 text-[15px]"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
        >
          <option value="">All categories</option>
          {MARKETPLACE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="mt-3.5 space-y-3">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin" size={22} style={{ color: "var(--text-3)" }} /></div>
        ) : items.length === 0 ? (
          <p className="rounded-[16px] px-4 py-10 text-center text-[14px]" style={{ border: "1px solid var(--border)", color: "var(--text-3)" }}>No listings found.</p>
        ) : (
          items.map((l) => <ListingCard key={l.id} l={l} />)
        )}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold"
      style={active
        ? { background: "var(--accent-strong)", color: "#fff", border: "1px solid var(--accent-strong)" }
        : { background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border)" }}
    >
      {children}
    </button>
  );
}
