import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Phone, Star, Trash2 } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { getCategoryLabel, CATEGORY_BADGE } from "../lib/domesticHelp";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  residentId: string;
  resident: { id: string; name: string; block: number | null; flatNumber: string };
};
type Worker = {
  id: string;
  name: string;
  phone: string;
  categories: string[];
  description: string | null;
  availability: string | null;
  avgRating: number;
  reviewCount: number;
  addedBy: { id: string; name: string; block: number | null; flatNumber: string };
  reviews: Review[];
};

function Stars({ value, onPick, size = 16 }: { value: number; onPick?: (n: number) => void; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onPick}
          onClick={() => onPick?.(n)}
          className={onPick ? "active:scale-90" : "cursor-default"}
        >
          <Star size={size} className={n <= value ? "fill-amber-400 text-amber-400" : "text-slate-600"} />
        </button>
      ))}
    </div>
  );
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "2-digit" }).format(new Date(iso));
}

export default function DomesticHelpDetail() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [w, setW] = useState<Worker | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const r = await apiFetch(`/api/domestic-help/${id}`, { token });
      if (r.status === 404) {
        setNotFound(true);
        return;
      }
      if (r.ok) {
        const d = await r.json();
        setW(d.worker);
        setIsOwner(d.isOwner);
        setCanManage(d.canManage);
        if (d.myReview) {
          setMyRating(d.myReview.rating);
          setMyComment(d.myReview.comment ?? "");
        }
      }
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitReview() {
    if (!token || !id || busy || myRating < 1) return;
    setBusy(true);
    try {
      const r = await apiFetch(`/api/domestic-help/${id}/reviews`, {
        method: "POST",
        token,
        body: JSON.stringify({ rating: myRating, comment: myComment.trim() || null }),
      });
      if (r.ok) await load();
      else window.alert((await r.json().catch(() => null))?.error ?? "Could not save review");
    } finally {
      setBusy(false);
    }
  }

  async function deleteReview(reviewId: string) {
    if (!token || !id) return;
    if (!window.confirm("Delete this review?")) return;
    const r = await apiFetch(`/api/domestic-help/${id}/reviews/${reviewId}`, { method: "DELETE", token });
    if (r.ok) {
      if (w?.reviews.find((rv) => rv.id === reviewId)?.residentId === user?.id) {
        setMyRating(0);
        setMyComment("");
      }
      await load();
    }
  }

  async function deleteWorker() {
    if (!token || !id) return;
    if (!window.confirm("Delete this listing? This cannot be undone.")) return;
    const r = await apiFetch(`/api/domestic-help/${id}`, { method: "DELETE", token });
    if (r.ok) navigate("/domestic-help");
  }

  if (loading) {
    return <div className="flex flex-1 items-center justify-center"><Loader2 className="animate-spin text-slate-500" size={22} /></div>;
  }
  if (notFound || !w) {
    return (
      <div className="flex flex-1 flex-col px-4 pt-[max(2rem,env(safe-area-inset-top,0px))]">
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-1.5 text-sm text-slate-400 active:text-white"><ArrowLeft size={18} /> Back</button>
        <p className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-8 text-center text-sm text-slate-400">This listing isn't available.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-8">
      <header className="flex items-center gap-2 py-3">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"><ArrowLeft size={20} /></button>
        <h1 className="truncate text-lg font-semibold text-white">{w.name}</h1>
      </header>

      <div className="flex items-center gap-2">
        {w.reviewCount > 0 ? (
          <>
            <Stars value={Math.round(w.avgRating)} />
            <span className="text-sm font-semibold text-amber-300">{w.avgRating.toFixed(1)}</span>
            <span className="text-xs text-slate-500">({w.reviewCount} review{w.reviewCount !== 1 ? "s" : ""})</span>
          </>
        ) : (
          <span className="text-xs text-slate-500">No reviews yet</span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {w.categories.map((c) => (
          <span key={c} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_BADGE[c] ?? "bg-slate-600/40 text-slate-300"}`}>{getCategoryLabel(c)}</span>
        ))}
      </div>

      {w.availability && <p className="mt-3 text-sm text-slate-300">🕑 {w.availability}</p>}
      {w.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{w.description}</p>}
      <p className="mt-2 text-[11px] text-slate-500">Added by {w.addedBy.name} · Block {w.addedBy.block ?? "—"}, {w.addedBy.flatNumber}</p>

      <a href={`tel:${w.phone.replace(/\s+/g, "")}`} className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 py-3 text-sm font-semibold text-white active:bg-green-700">
        <Phone size={16} /> Call {w.name.split(" ")[0]} · {w.phone}
      </a>

      {/* My review */}
      <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Your review</p>
        <Stars value={myRating} onPick={setMyRating} size={24} />
        <textarea
          value={myComment}
          onChange={(e) => setMyComment(e.target.value)}
          rows={2}
          placeholder="Share your experience (optional)"
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
        />
        <button
          onClick={() => void submitReview()}
          disabled={busy || myRating < 1}
          className="mt-2 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save review"}
        </button>
      </div>

      {/* Reviews list */}
      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Reviews</p>
        {w.reviews.length === 0 ? (
          <p className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-5 text-center text-xs text-slate-500">Be the first to review.</p>
        ) : (
          <div className="space-y-2">
            {w.reviews.map((rv) => (
              <div key={rv.id} className="rounded-2xl border border-slate-700 bg-slate-800/60 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-100">{rv.resident.name}</span>
                  <Stars value={rv.rating} size={12} />
                </div>
                <p className="text-[10px] text-slate-500">Block {rv.resident.block ?? "—"}, {rv.resident.flatNumber} · {fmtDate(rv.createdAt)}</p>
                {rv.comment && <p className="mt-1 text-sm text-slate-300">{rv.comment}</p>}
                {(rv.residentId === user?.id || canManage) && (
                  <button onClick={() => void deleteReview(rv.id)} className="mt-1 inline-flex items-center gap-1 text-[11px] text-red-400">
                    <Trash2 size={11} /> Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {(isOwner || canManage) && (
        <button onClick={() => void deleteWorker()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/40 bg-red-500/5 px-4 py-2.5 text-sm font-semibold text-red-300 active:bg-red-500/15">
          <Trash2 size={16} /> Delete listing
        </button>
      )}
    </div>
  );
}
