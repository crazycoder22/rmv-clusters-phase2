import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { isAdmin } from "../lib/roles";
import { formatPrice, getCategoryLabel } from "../lib/marketplace";

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

const stripe =
  "repeating-linear-gradient(45deg, var(--surface-2), var(--surface-2) 7px, var(--surface-3) 7px, var(--surface-3) 14px)";

function typeTone(t: string): { bg: string; fg: string } {
  if (t === "GIVEAWAY") return { bg: "var(--success-soft)", fg: "var(--success)" };
  if (t === "RENT") return { bg: "var(--warning-soft)", fg: "var(--warning)" };
  return { bg: "var(--accent-soft)", fg: "var(--accent)" };
}

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
    return (
      <div className="flex flex-1 items-center justify-center" style={{ background: "var(--bg)" }}>
        <Loader2 className="animate-spin" size={22} style={{ color: "var(--text-3)" }} />
      </div>
    );
  }
  if (notFound || !listing) {
    return (
      <div className="one-surface flex flex-1 flex-col px-[18px] pt-[max(2rem,env(safe-area-inset-top,0px))]" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-1.5 text-[14px]" style={{ color: "var(--text-3)" }}>
          <Icon name="arrow_back" size={18} style={{ color: "var(--text-3)" }} /> Back
        </button>
        <p className="rounded-[16px] px-4 py-8 text-center text-[14px]" style={{ border: "1px solid var(--border)", color: "var(--text-3)" }}>This listing isn't available.</p>
      </div>
    );
  }

  const canDelete = isOwner || isAdmin(user?.roles);
  const tone = typeTone(listing.listingType);
  const isFree = listing.listingType === "GIVEAWAY";
  const waLink = `https://wa.me/91${listing.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, I'm interested in your listing: ${listing.title}`)}`;

  return (
    <div className="one-surface flex flex-1 flex-col pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <header className="flex items-center gap-2 px-[18px] pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-3">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full active:opacity-70" style={{ color: "var(--text-2)" }}>
          <Icon name="arrow_back" size={22} style={{ color: "var(--text-2)" }} />
        </button>
        <span className="truncate text-[15px] font-semibold" style={{ color: "var(--text-2)" }}>{listing.seller.name}</span>
      </header>

      <div className="px-[18px]">
        {listing.status === "SOLD" && (
          <div className="mb-3 rounded-[12px] py-2 text-center text-[13px] font-bold" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>SOLD</div>
        )}

        {/* Images */}
        {listing.images.length > 0 ? (
          <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 [&::-webkit-scrollbar]:hidden">
            {listing.images.map((img, i) => (
              <img key={i} src={img} alt="" className="h-[230px] w-auto flex-shrink-0 rounded-[16px] object-cover" style={{ border: "1px solid var(--border)" }} />
            ))}
          </div>
        ) : (
          <div className="mb-4 flex h-[230px] items-center justify-center rounded-[16px]" style={{ background: stripe, border: "1px solid var(--border)", color: "var(--text-3)" }}>
            <Icon name="shopping_bag" size={56} style={{ color: "var(--text-3)" }} />
          </div>
        )}

        <p className="text-[30px] font-extrabold tracking-tight" style={{ color: isFree ? "var(--success)" : "var(--accent)" }}>
          {formatPrice(listing.price, listing.listingType, listing.rentPeriod)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full px-2.5 py-0.5 text-[12px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
            {isFree ? "Giveaway" : listing.listingType.charAt(0) + listing.listingType.slice(1).toLowerCase()}
          </span>
          <span className="rounded-full px-2.5 py-0.5 text-[12px]" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-2)" }}>{getCategoryLabel(listing.category)}</span>
        </div>

        <h1 className="mt-3 text-[22px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>{listing.title}</h1>
        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed" style={{ color: "var(--text-2)" }}>{listing.description}</p>

        {/* Listed by */}
        <div className="mt-5 flex items-center gap-3 rounded-[16px] p-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[16px] font-bold" style={{ background: "var(--accent-soft)", border: "2px solid var(--accent)", color: "var(--accent)" }}>
            {listing.seller.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Listed by</p>
            <p className="truncate text-[15px] font-bold" style={{ color: "var(--text)" }}>{listing.seller.name}</p>
            <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Block {listing.seller.block ?? "—"}, {listing.seller.flatNumber}</p>
          </div>
        </div>

        {isOwner && listing.status !== "SOLD" && (
          <button onClick={() => void markSold()} disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-2.5 text-[14px] font-semibold disabled:opacity-60" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>
            <Icon name="check_circle" size={18} style={{ color: "var(--warning)" }} /> Mark as sold
          </button>
        )}
        {canDelete && (
          <button onClick={() => void remove()} disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-2.5 text-[14px] font-semibold disabled:opacity-60" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
            <Icon name="delete" size={18} style={{ color: "var(--danger)" }} /> Delete listing
          </button>
        )}
      </div>

      {/* Action bar */}
      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center gap-2.5 px-[18px] pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3" style={{ background: "var(--bg)", borderTop: "1px solid var(--border)" }}>
        {listing.status !== "SOLD" && (
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-[14px] px-4 py-3.5 text-[15px] font-bold text-white active:opacity-90"
            style={{ background: "var(--whatsapp)" }}
          >
            <Icon name="chat" size={19} style={{ color: "#fff" }} /> Contact on WhatsApp
          </a>
        )}
        <button
          onClick={() => void toggleWishlist()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-[14px] px-4 py-3.5 text-[15px] font-bold disabled:opacity-60"
          style={wishlisted
            ? { background: "var(--danger-soft)", color: "var(--danger)" }
            : { background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-2)" }}
        >
          <Icon name="favorite" size={19} fill={wishlisted} style={{ color: wishlisted ? "var(--danger)" : "var(--text-2)" }} /> {count}
        </button>
      </div>
    </div>
  );
}
