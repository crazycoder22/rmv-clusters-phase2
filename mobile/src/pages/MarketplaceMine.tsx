import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
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
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-8">
      <header className="flex items-center gap-2 py-3">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-semibold text-white">My listings</h1>
      </header>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-500" size={22} /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-10 text-center">
          <p className="text-sm text-slate-400">You haven't posted anything yet.</p>
          <Link to="/marketplace/new" className="mt-3 inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"><Plus size={14} /> Post a listing</Link>
        </div>
      ) : (
        <div className="space-y-2">{items.map((l) => <ListingCard key={l.id} l={l} />)}</div>
      )}
    </div>
  );
}
