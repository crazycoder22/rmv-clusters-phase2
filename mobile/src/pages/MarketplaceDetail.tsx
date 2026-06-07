import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Heart,
  Loader2,
  MessageCircle,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { isAdmin } from "../lib/roles";
import {
  formatPrice,
  getCategoryLabel,
  TYPE_BADGE,
} from "../lib/marketplace";

type Detail = {
  id: string;
  title: string;
  description: string;
  images: string[];
  category: string;
  listingType: string;
  price: number;
  rentPeriod: string | null;
  status: string;
  whatsappNumber: string;
  seller: { id: string; name: string; block: number | null; flatNumber: string };
  _count?: { wishlistedBy: number };
};

export default function MarketplaceDetail() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [listing, setListing] = useState<Detail | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const r = await apiFetch(`/api/marketplace/${id}`, { token });
      if (r.status === 404) {
        setNotFound(true);
        return;
      }
      if (r.ok) {
        const d = await r.json();
        setListing(d.listing);
        setIsOwner(d.isOwner);
        setWishlisted(d.isWishlisted);
        setCount(d.listing?._count?.wishlistedBy ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleWishlist() {
    if (!token || !id || busy) return;
    setBusy(true);
    const next = !wishlisted;
    setWishlisted(next);
    setCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
    try {
      const r = await apiFetch(`/api/marketplace/${id}/wishlist`, {
        method: next ? "POST" : "DELETE",
        token,
      });
      if (!r.ok) throw new Error();
    } catch {
      setWishlisted(!next);
      setCount((c) => (next ? Math.max(0, c - 1) : c + 1));
    } finally {
      setBusy(false);
    }
  }

  async function markSold() {
    if (!token || !id || busy) return;
    setBusy(true);
    try {
      const r = await apiFetch(`/api/marketplace/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status: "SOLD" }),
      });
      if (r.ok) setListing((p) => (p ? { ...p, status: "SOLD" } : p));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!token || !id || busy) return;
    if (!window.confirm("Delete this listing? This cannot be undone.")) return;
    setBusy(true);
    try {
      const r = await apiFetch(`/api/marketplace/${id}`, { method: "DELETE", token });
      if (r.ok) navigate("/marketplace");
      else window.alert("Could not delete.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="flex flex-1 items-center justify-center"><Loader2 className="animate-spin text-slate-500" size={22} /></div>;
  }
  if (notFound || !listing) {
    return (
      <div className="flex flex-1 flex-col px-4 pt-[max(2rem,env(safe-area-inset-top,0px))]">
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-1.5 text-sm text-slate-400 active:text-white"><ArrowLeft size={18} /> Back</button>
        <p className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-8 text-center text-sm text-slate-400">This listing isn't available.</p>
      </div>
    );
  }

  const canDelete = isOwner || isAdmin(user?.roles);
  const waLink = `https://wa.me/91${listing.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, I'm interested in your listing: ${listing.title}`)}`;

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-8">
      <header className="flex items-center gap-2 py-3">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"><ArrowLeft size={20} /></button>
        <h1 className="truncate text-lg font-semibold text-white">{listing.title}</h1>
      </header>

      {listing.status === "SOLD" && (
        <div className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 py-2 text-center text-sm font-bold text-red-300">SOLD</div>
      )}

      {/* Images */}
      {listing.images.length > 0 ? (
        <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1">
          {listing.images.map((img, i) => (
            <img key={i} src={img} alt="" className="h-56 w-auto flex-shrink-0 rounded-2xl object-cover" />
          ))}
        </div>
      ) : (
        <div className="mb-4 flex aspect-video items-center justify-center rounded-2xl bg-slate-800 text-slate-600"><ShoppingBag size={56} /></div>
      )}

      <p className="text-2xl font-bold text-indigo-300">{formatPrice(listing.price, listing.listingType, listing.rentPeriod)}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TYPE_BADGE[listing.listingType] ?? "bg-slate-700 text-slate-300"}`}>
          {listing.listingType.charAt(0) + listing.listingType.slice(1).toLowerCase()}
        </span>
        <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[11px] text-slate-300">{getCategoryLabel(listing.category)}</span>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-200">{listing.description}</p>

      <p className="mt-4 text-xs text-slate-400">
        Listed by <span className="font-medium text-slate-200">{listing.seller.name}</span> — Block {listing.seller.block ?? "—"}, {listing.seller.flatNumber}
      </p>

      {/* Actions */}
      <div className="mt-5 flex flex-wrap gap-2">
        {listing.status !== "SOLD" && (
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 py-3 text-sm font-semibold text-white active:bg-green-700"
          >
            <MessageCircle size={16} /> Contact on WhatsApp
          </a>
        )}
        <button
          onClick={() => void toggleWishlist()}
          disabled={busy}
          className={
            "flex items-center gap-1.5 rounded-2xl border px-4 py-3 text-sm font-semibold disabled:opacity-60 " +
            (wishlisted ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-slate-700 bg-slate-800/60 text-slate-300")
          }
        >
          <Heart size={16} className={wishlisted ? "fill-red-400 text-red-400" : ""} /> {count}
        </button>
      </div>

      {isOwner && listing.status !== "SOLD" && (
        <button onClick={() => void markSold()} disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 active:bg-amber-500/20 disabled:opacity-60">
          <CheckCircle2 size={16} /> Mark as sold
        </button>
      )}
      {canDelete && (
        <button onClick={() => void remove()} disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/40 bg-red-500/5 px-4 py-2.5 text-sm font-semibold text-red-300 active:bg-red-500/15 disabled:opacity-60">
          <Trash2 size={16} /> Delete listing
        </button>
      )}
    </div>
  );
}
