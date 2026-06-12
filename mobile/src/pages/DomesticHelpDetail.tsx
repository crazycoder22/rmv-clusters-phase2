import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { getCategoryLabel, categoryTagClass } from "../lib/domesticHelp";

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
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onPick}
          onClick={() => onPick?.(n)}
          className={onPick ? "active:scale-90" : "cursor-default"}
        >
          <Icon name="star" size={size} fill={n <= value} style={{ color: n <= value ? "var(--star)" : "var(--text-3)" }} />
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
    return <div className="flex flex-1 items-center justify-center" style={{ background: "var(--bg)" }}><Loader2 className="animate-spin" size={22} style={{ color: "var(--text-3)" }} /></div>;
  }
  if (notFound || !w) {
    return (
      <div className="one-surface flex flex-1 flex-col px-[18px] pt-[max(2rem,env(safe-area-inset-top,0px))]" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-1.5 text-[14px]" style={{ color: "var(--text-3)" }}>
          <Icon name="arrow_back" size={18} style={{ color: "var(--text-3)" }} /> Back
        </button>
        <p className="rounded-[16px] px-4 py-8 text-center text-[14px]" style={{ border: "1px solid var(--border)", color: "var(--text-3)" }}>This listing isn't available.</p>
      </div>
    );
  }

  const canSave = myRating >= 1;

  return (
    <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <header className="flex items-center gap-3.5 py-3">
        <button onClick={() => navigate(-1)} className="flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={24} style={{ color: "var(--text)" }} />
        </button>
        <h1 className="truncate text-[24px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>{w.name}</h1>
      </header>

      {/* Review summary */}
      <p className="text-[14px]" style={{ color: "var(--text-3)" }}>
        {w.reviewCount > 0 ? `${w.avgRating.toFixed(1)} ★ · ${w.reviewCount} review${w.reviewCount !== 1 ? "s" : ""}` : "No reviews yet"}
      </p>

      {/* Tags */}
      <div className="mt-3 flex flex-wrap gap-2">
        {w.categories.map((c) => (
          <span key={c} className={categoryTagClass(c)}>{getCategoryLabel(c)}</span>
        ))}
      </div>

      {/* Availability */}
      {w.availability && (
        <div className="mt-4 flex items-center gap-2.5">
          <Icon name="schedule" size={20} style={{ color: "var(--text-2)" }} />
          <span className="text-[16px] font-medium" style={{ color: "var(--text)" }}>{w.availability}</span>
        </div>
      )}
      {w.description && <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed" style={{ color: "var(--text-2)" }}>{w.description}</p>}
      <p className="mt-3.5 text-[13px]" style={{ color: "var(--text-3)" }}>
        Added by {w.addedBy.name} · Block {w.addedBy.block ?? "—"}, {w.addedBy.flatNumber}
      </p>

      {/* Call */}
      <a
        href={`tel:${w.phone.replace(/\s+/g, "")}`}
        className="mt-[18px] flex items-center justify-center gap-2.5 rounded-[16px] px-4 py-4 active:opacity-90"
        style={{ background: "var(--call)", boxShadow: "0 8px 20px rgba(22,163,74,0.28)" }}
      >
        <Icon name="call" size={22} fill style={{ color: "#fff" }} />
        <span className="text-[17px] font-bold text-white">Call {w.name.split(" ")[0]} · {w.phone}</span>
      </a>

      {/* Your review */}
      <div className="mt-[18px] rounded-[18px] p-[18px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="one-mono text-[11px]" style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}>YOUR REVIEW</p>
        <div className="mt-3.5">
          <Stars value={myRating} onPick={setMyRating} size={34} />
        </div>
        <textarea
          value={myComment}
          onChange={(e) => setMyComment(e.target.value)}
          rows={2}
          placeholder="Share your experience (optional)"
          className="mt-3.5 w-full resize-none rounded-[13px] px-3.5 py-3 text-[14px] leading-relaxed outline-none"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
        />
        <button
          onClick={() => void submitReview()}
          disabled={busy || !canSave}
          className="mt-3.5 w-full rounded-[13px] px-4 py-3.5 text-[16px] font-bold"
          style={canSave ? { background: "var(--accent-strong)", color: "#fff" } : { background: "var(--surface-3)", color: "var(--text-3)" }}
        >
          {busy ? "Saving…" : "Save review"}
        </button>
      </div>

      {/* Reviews */}
      <p className="one-mono mt-6 text-[11px]" style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}>REVIEWS</p>
      {w.reviews.length === 0 ? (
        <p className="mt-3 rounded-[16px] px-4 py-6 text-center text-[14px]" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-3)" }}>
          Be the first to review.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {w.reviews.map((rv) => (
            <div key={rv.id} className="rounded-[16px] px-4 py-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2.5">
                <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold" style={{ background: "var(--accent-soft)", border: "2px solid var(--accent)", color: "var(--accent)" }}>
                  {rv.resident.name[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold" style={{ color: "var(--text)" }}>{rv.resident.name}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-3)" }}>Block {rv.resident.block ?? "—"}, {rv.resident.flatNumber} · {fmtDate(rv.createdAt)}</p>
                </div>
                <span className="flex-shrink-0 tracking-wide" style={{ color: "var(--star)" }}>
                  {"★".repeat(rv.rating)}
                </span>
              </div>
              {rv.comment && <p className="mt-2.5 text-[14px] leading-relaxed" style={{ color: "var(--text-2)" }}>{rv.comment}</p>}
              {(rv.residentId === user?.id || canManage) && (
                <button onClick={() => void deleteReview(rv.id)} className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: "var(--danger)" }}>
                  <Icon name="delete" size={13} style={{ color: "var(--danger)" }} /> Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {(isOwner || canManage) && (
        <button
          onClick={() => void deleteWorker()}
          className="mt-[22px] flex w-full items-center justify-center gap-2 rounded-[16px] px-4 py-3.5 text-[16px] font-bold"
          style={{ background: "var(--danger-soft)", border: "1px solid color-mix(in srgb, var(--danger) 45%, transparent)", color: "var(--danger)" }}
        >
          <Icon name="delete" size={20} style={{ color: "var(--danger)" }} /> Delete listing
        </button>
      )}
    </div>
  );
}
