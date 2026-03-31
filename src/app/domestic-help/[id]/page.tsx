"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Clock,
  Star,
  Trash2,
  User,
} from "lucide-react";
import clsx from "clsx";
import { useRole } from "@/hooks/useRole";
import {
  getCategoryLabel,
  getCategoryBadgeColor,
} from "@/lib/domestic-help-categories";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  residentId: string;
  resident: { id: string; name: string; block: number; flatNumber: string };
  createdAt: string;
}

interface WorkerDetail {
  id: string;
  name: string;
  phone: string;
  categories: string[];
  description: string | null;
  availability: string | null;
  avgRating: number;
  reviewCount: number;
  addedBy: { id: string; name: string; block: number; flatNumber: string };
  reviews: Review[];
  createdAt: string;
}

export default function WorkerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const { canManageDomesticHelp } = useRole();

  const [worker, setWorker] = useState<WorkerDetail | null>(null);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Review form state
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (authStatus !== "loading" && !session?.user?.isApproved) {
      router.replace("/");
    }
  }, [authStatus, session, router]);

  const fetchWorker = () => {
    fetch(`/api/domestic-help/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data) => {
        setWorker(data.worker);
        setMyReview(data.myReview);
        if (data.myReview) {
          setRating(data.myReview.rating);
          setComment(data.myReview.comment || "");
        }
      })
      .catch(() => setError("Worker not found"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    fetchWorker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, id]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setReviewError("Please select a rating");
      return;
    }
    setSubmittingReview(true);
    setReviewError("");
    try {
      const res = await fetch(`/api/domestic-help/${id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        setReviewError(data.error || "Failed to submit review");
        return;
      }
      // Refresh worker data
      setLoading(true);
      fetchWorker();
    } catch {
      setReviewError("Something went wrong");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm("Delete this review?")) return;
    try {
      const res = await fetch(
        `/api/domestic-help/${id}/reviews/${reviewId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setLoading(true);
        if (myReview?.id === reviewId) {
          setMyReview(null);
          setRating(0);
          setComment("");
        }
        fetchWorker();
      }
    } catch {
      // silently fail
    }
  };

  const handleDeleteWorker = async () => {
    if (!confirm("Delete this worker? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/domestic-help/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/domestic-help");
      }
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
    }
  };

  if (loading || authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error && !worker) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <p className="text-gray-500">{error}</p>
        <Link
          href="/domestic-help"
          className="text-primary-600 hover:underline text-sm mt-2 inline-block"
        >
          Back to Directory
        </Link>
      </div>
    );
  }

  if (!worker) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/domestic-help"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-6"
      >
        <ArrowLeft size={16} />
        Back to Directory
      </Link>

      {/* Worker Info */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">
              {worker.name}
            </h1>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {worker.categories.map((cat) => (
                <span
                  key={cat}
                  className={clsx(
                    "inline-block px-2 py-0.5 text-xs font-medium rounded-full",
                    getCategoryBadgeColor(cat)
                  )}
                >
                  {getCategoryLabel(cat)}
                </span>
              ))}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={18}
                  className={
                    s <= Math.round(worker.avgRating)
                      ? "text-amber-400 fill-amber-400"
                      : "text-gray-200"
                  }
                />
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {worker.avgRating > 0
                ? `${worker.avgRating.toFixed(1)} avg`
                : "No ratings"}{" "}
              &middot; {worker.reviewCount} review
              {worker.reviewCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <a
            href={`tel:${worker.phone}`}
            className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            <Phone size={15} />
            {worker.phone}
          </a>
          {worker.availability && (
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <Clock size={15} />
              {worker.availability}
            </p>
          )}
          {worker.description && (
            <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap">
              {worker.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
          <User size={13} />
          Added by {worker.addedBy.name} (Block {worker.addedBy.block},{" "}
          {worker.addedBy.flatNumber}) &middot;{" "}
          {new Date(worker.createdAt).toLocaleDateString()}
        </div>

        {/* Admin controls */}
        {canManageDomesticHelp() && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={handleDeleteWorker}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              <Trash2 size={15} />
              {deleting ? "Deleting..." : "Delete Worker"}
            </button>
          </div>
        )}
      </div>

      {/* Write Review */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          {myReview ? "Update Your Review" : "Write a Review"}
        </h2>
        <form onSubmit={handleSubmitReview} className="space-y-4">
          {/* Star rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rating
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseEnter={() => setHoverRating(s)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(s)}
                  className="p-0.5"
                >
                  <Star
                    size={28}
                    className={clsx(
                      "transition-colors",
                      s <= (hoverRating || rating)
                        ? "text-amber-400 fill-amber-400"
                        : "text-gray-200 hover:text-amber-200"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comment <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Share your experience..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>

          {reviewError && (
            <p className="text-sm text-red-600">{reviewError}</p>
          )}

          <button
            type="submit"
            disabled={submittingReview || rating === 0}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submittingReview
              ? "Submitting..."
              : myReview
              ? "Update Review"
              : "Submit Review"}
          </button>
        </form>
      </div>

      {/* Reviews List */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Reviews ({worker.reviews.length})
        </h2>
        {worker.reviews.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            No reviews yet. Be the first to review!
          </p>
        ) : (
          <div className="space-y-4">
            {worker.reviews.map((review) => (
              <div
                key={review.id}
                className="border-b border-gray-50 pb-4 last:border-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-800">
                        {review.resident.name}
                      </p>
                      <span className="text-xs text-gray-400">
                        Block {review.resident.block},{" "}
                        {review.resident.flatNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 mb-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={14}
                          className={
                            s <= review.rating
                              ? "text-amber-400 fill-amber-400"
                              : "text-gray-200"
                          }
                        />
                      ))}
                      <span className="text-xs text-gray-400 ml-1">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-gray-600 mt-1">
                        {review.comment}
                      </p>
                    )}
                  </div>
                  {(canManageDomesticHelp() ||
                    review.residentId === myReview?.residentId) && (
                    <button
                      onClick={() => handleDeleteReview(review.id)}
                      className="p-1 text-gray-400 hover:text-red-500 shrink-0"
                      title="Delete review"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
