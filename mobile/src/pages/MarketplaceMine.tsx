import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { ListingCard, type Listing } from "./Marketplace";

export default function MarketplaceMine() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/marketplace/my-listings", { token })
      .then((r) => (r.ok ? r.json() : { listings: [] }))
      .then((d) => setItems(d.listings ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <header className="flex items-center gap-2 py-3">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full active:opacity-70" style={{ color: "var(--text-2)" }}>
          <Icon name="arrow_back" size={22} style={{ color: "var(--text-2)" }} />
        </button>
        <h1 className="text-[20px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>My listings</h1>
      </header>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin" size={22} style={{ color: "var(--text-3)" }} /></div>
      ) : items.length === 0 ? (
        <div className="rounded-[16px] px-4 py-10 text-center" style={{ border: "1px solid var(--border)" }}>
          <p className="text-[14px]" style={{ color: "var(--text-3)" }}>You haven't posted anything yet.</p>
          <Link to="/marketplace/new" className="mt-3 inline-flex items-center gap-1.5 rounded-[12px] px-3.5 py-2 text-[13px] font-bold text-white" style={{ background: "var(--accent-strong)" }}>
            <Icon name="add" size={16} style={{ color: "#fff" }} /> Post a listing
          </Link>
        </div>
      ) : (
        <div className="space-y-3">{items.map((l) => <ListingCard key={l.id} l={l} />)}</div>
      )}
    </div>
  );
}
