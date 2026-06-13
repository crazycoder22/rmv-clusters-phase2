import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import {
  DOMESTIC_HELP_CATEGORIES,
  getCategoryLabel,
  categoryTagClass,
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
      className="flex items-center gap-3.5 rounded-[18px] px-4 py-3.5 active:opacity-90"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
    >
      <div
        className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-full text-[20px] font-extrabold"
        style={{ background: "var(--accent-soft)", border: "2px solid var(--accent)", color: "var(--accent)" }}
      >
        {w.name[0]?.toUpperCase() ?? "?"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-bold" style={{ color: "var(--text)" }}>{w.name}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {w.categories.slice(0, 3).map((c) => (
            <span key={c} className={categoryTagClass(c)}>{getCategoryLabel(c)}</span>
          ))}
        </div>
      </div>
      <div className="flex flex-shrink-0 flex-col items-end">
        {w.reviewCount > 0 ? (
          <span className="flex items-center gap-1 text-[14px] font-bold" style={{ color: "var(--star)" }}>
            <Icon name="star" size={15} fill style={{ color: "var(--star)" }} />{w.avgRating.toFixed(1)}
          </span>
        ) : (
          <span className="text-[13px]" style={{ color: "var(--text-3)" }}>No reviews</span>
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

  const filtered = !loading && items.length === 0;
  const emptyMsg =
    search.trim() || category
      ? "No matches. Try a different name or category."
      : "No domestic help listed yet. Tap Add to share a trusted contact with your neighbours.";

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-8"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="mb-3.5 flex items-center gap-3">
        <Link to="/community" className="flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={24} style={{ color: "var(--text-2)" }} />
        </Link>
        <h1 className="flex-1 text-[26px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Domestic Help</h1>
        <Link
          to="/domestic-help/new"
          className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[14px] font-bold text-white active:opacity-90"
          style={{ background: "var(--accent-strong)" }}
        >
          <Icon name="add" size={19} weight={600} style={{ color: "#fff" }} /> Add
        </Link>
      </header>

      {/* Search + sort */}
      <div className="flex items-center gap-2.5 rounded-[13px] px-3.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <Icon name="search" size={20} style={{ color: "var(--text-3)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="flex-1 bg-transparent py-3 text-[14px] outline-none"
          style={{ color: "var(--text)" }}
        />
        <button
          onClick={() => setSort(sort === "rating" ? "recent" : "rating")}
          className="flex flex-shrink-0 items-center gap-1.5 text-[13px] font-semibold"
          style={{ color: "var(--text-2)" }}
        >
          <Icon name="swap_vert" size={18} style={{ color: "var(--text-2)" }} /> {sort === "rating" ? "Top rated" : "Recent"}
        </button>
      </div>

      {/* Category select */}
      <div className="relative mt-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full appearance-none rounded-[13px] px-4 py-3.5 text-[15px] font-semibold outline-none"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
        >
          <option value="">All categories</option>
          {DOMESTIC_HELP_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <Icon name="unfold_more" size={20} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
      </div>

      {/* Listing cards */}
      <div className="mt-4 flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin" size={22} style={{ color: "var(--text-3)" }} /></div>
        ) : filtered ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex h-[60px] w-[60px] items-center justify-center rounded-[18px]" style={{ background: "var(--accent-soft)" }}>
              <Icon name="cleaning_services" size={30} style={{ color: "var(--accent)" }} />
            </div>
            <p className="text-[14px] leading-relaxed" style={{ color: "var(--text-3)" }}>{emptyMsg}</p>
          </div>
        ) : (
          items.map((w) => <WorkerCard key={w.id} w={w} />)
        )}
      </div>
    </div>
  );
}
