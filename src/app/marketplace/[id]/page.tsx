"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Heart,
  Trash2,
  CheckCircle2,
  Loader2,
  ShoppingBag,
} from "lucide-react";
import clsx from "clsx";
import {
  getCategoryLabel,
  getCategoryBadgeColor,
  getListingTypeBadgeColor,
  formatPrice,
} from "@/lib/marketplace-categories";
import { useRole } from "@/hooks/useRole";

interface ListingDetail {
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
  seller: {
    id: string;
    name: string;
    block: number;
    flatNumber: string;
  };
  isOwner: boolean;
  isWishlisted: boolean;
  wishlistCount: number;
  createdAt: string;
}

export default function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const { canManageMarketplace } = useRole();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [togglingWishlist, setTogglingWishlist] = useState(false);
  const [markingSold, setMarkingSold] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (authStatus !== "loading" && !session?.user?.isApproved) {
      router.replace("/");
    }
  }, [authStatus, session, router]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    setLoading(true);
    fetch(`/api/marketplace/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setListing(data);
          setWishlisted(data.isWishlisted);
          setWishlistCount(data.wishlistCount);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authStatus, id]);

  const toggleWishlist = async () => {
    if (togglingWishlist) return;
    setTogglingWishlist(true);
    try {
      const method = wishlisted ? "DELETE" : "POST";
      const res = await fetch(`/api/marketplace/${id}/wishlist`, { method });
      if (res.ok) {
        setWishlisted(!wishlisted);
        setWishlistCount((c) => (wishlisted ? c - 1 : c + 1));
      }
    } catch {
      // ignore
    } finally {
      setTogglingWishlist(false);
    }
  };

  const markAsSold = async () => {
    if (markingSold) return;
    setMarkingSold(true);
    try {
      const res = await fetch(`/api/marketplace/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SOLD" }),
      });
      if (res.ok) {
        setListing((prev) => (prev ? { ...prev, status: "SOLD" } : prev));
      }
    } catch {
      // ignore
    } finally {
      setMarkingSold(false);
    }
  };

  const deleteListing = async () => {
    if (!confirm("Are you sure you want to delete this listing?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/marketplace/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/marketplace");
      }
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  if (authStatus === "loading" || !session?.user?.isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 mb-6"
        >
          <ArrowLeft size={16} />
          Back to Marketplace
        </Link>
        <p className="text-gray-500">Listing not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 mb-6"
      >
        <ArrowLeft size={16} />
        Back to Marketplace
      </Link>

      {/* SOLD banner */}
      {listing.status === "SOLD" && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-center">
          <span className="text-red-700 font-bold text-lg">SOLD</span>
        </div>
      )}

      {/* Image gallery */}
      {listing.images.length > 1 ? (
        <div className="flex gap-3 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
          {listing.images.map((img, idx) => (
            <img
              key={idx}
              src={img}
              alt={`${listing.title} - ${idx + 1}`}
              className="h-64 w-auto rounded-xl object-cover flex-shrink-0"
            />
          ))}
        </div>
      ) : listing.images.length === 1 ? (
        <div className="mb-6">
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="w-full max-h-96 object-cover rounded-xl"
          />
        </div>
      ) : (
        <div className="mb-6 aspect-video bg-gray-100 rounded-xl flex items-center justify-center">
          <ShoppingBag size={64} className="text-gray-300" />
        </div>
      )}

      {/* Listing info */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {listing.title}
        </h1>
        <p className="text-2xl font-bold text-primary-700 mb-3">
          {formatPrice(listing.price, listing.listingType, listing.rentPeriod)}
        </p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          <span
            className={clsx(
              "inline-block px-2.5 py-0.5 text-xs font-medium rounded-full",
              getCategoryBadgeColor(listing.category)
            )}
          >
            {getCategoryLabel(listing.category)}
          </span>
          <span
            className={clsx(
              "inline-block px-2.5 py-0.5 text-xs font-medium rounded-full",
              getListingTypeBadgeColor(listing.listingType)
            )}
          >
            {listing.listingType}
          </span>
        </div>
        <p className="text-sm text-gray-600 whitespace-pre-wrap">
          {listing.description}
        </p>
      </div>

      {/* Seller info */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-4">
        <p className="text-sm text-gray-600">
          Listed by{" "}
          <span className="font-semibold text-gray-800">
            {listing.seller.name}
          </span>{" "}
          &mdash; Block {listing.seller.block}, {listing.seller.flatNumber}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        {/* WhatsApp button */}
        <a
          href={`https://wa.me/91${listing.whatsappNumber}?text=Hi, I'm interested in your listing: ${encodeURIComponent(listing.title)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          Contact on WhatsApp
        </a>

        {/* Wishlist toggle */}
        <button
          onClick={toggleWishlist}
          disabled={togglingWishlist}
          className={clsx(
            "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border",
            wishlisted
              ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          )}
        >
          <Heart
            size={16}
            className={clsx(wishlisted && "fill-red-500 text-red-500")}
          />
          {wishlistCount}
        </button>

        {/* Owner actions */}
        {listing.isOwner && listing.status !== "SOLD" && (
          <button
            onClick={markAsSold}
            disabled={markingSold}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
          >
            {markingSold ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            Mark as Sold
          </button>
        )}

        {(listing.isOwner || canManageMarketplace()) && (
          <button
            onClick={deleteListing}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
          >
            {deleting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
            Delete Listing
          </button>
        )}
      </div>
    </div>
  );
}
