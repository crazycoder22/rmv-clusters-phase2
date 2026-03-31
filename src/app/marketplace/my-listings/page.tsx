"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Package,
  ArrowLeft,
  ShoppingBag,
  Heart,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import clsx from "clsx";
import {
  getCategoryLabel,
  getCategoryBadgeColor,
  getListingTypeBadgeColor,
  formatPrice,
} from "@/lib/marketplace-categories";

interface Listing {
  id: string;
  title: string;
  description: string;
  images: string[];
  category: string;
  listingType: string;
  price: number;
  rentPeriod: string | null;
  status: string;
  seller: {
    id: string;
    name: string;
    block: number;
    flatNumber: string;
  };
  wishlistCount: number;
  createdAt: string;
}

export default function MyListingsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingSoldId, setMarkingSoldId] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus !== "loading" && !session?.user?.isApproved) {
      router.replace("/");
    }
  }, [authStatus, session, router]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    setLoading(true);
    fetch("/api/marketplace/my-listings")
      .then((res) => (res.ok ? res.json() : { listings: [] }))
      .then((data) => setListings(data.listings || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authStatus]);

  const markAsSold = async (listingId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (markingSoldId) return;
    setMarkingSoldId(listingId);
    try {
      const res = await fetch(`/api/marketplace/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SOLD" }),
      });
      if (res.ok) {
        setListings((prev) =>
          prev.map((l) =>
            l.id === listingId ? { ...l, status: "SOLD" } : l
          )
        );
      }
    } catch {
      // ignore
    } finally {
      setMarkingSoldId(null);
    }
  };

  if (authStatus === "loading" || !session?.user?.isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
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

      <div className="flex items-center gap-2 mb-6">
        <Package size={24} className="text-primary-600" />
        <h1 className="text-2xl font-bold text-primary-800">My Listings</h1>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : listings.length === 0 ? (
        <div className="text-center py-16">
          <Package size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400">You haven&apos;t listed anything yet</p>
          <Link
            href="/marketplace/new"
            className="inline-block mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Create your first listing
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              href={`/marketplace/${listing.id}`}
              className="block bg-white rounded-xl shadow-sm border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all overflow-hidden relative"
            >
              {listing.status === "SOLD" && (
                <div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center">
                  <span className="bg-red-600 text-white text-lg font-bold px-6 py-2 rounded-lg -rotate-12">
                    SOLD
                  </span>
                </div>
              )}

              <div className="aspect-[4/3] bg-gray-100 relative">
                {listing.images.length > 0 ? (
                  <img
                    src={listing.images[0]}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag size={40} className="text-gray-300" />
                  </div>
                )}
                {/* Status badge */}
                <span
                  className={clsx(
                    "absolute top-2 right-2 px-2.5 py-0.5 text-xs font-bold rounded-full z-20",
                    listing.status === "SOLD"
                      ? "bg-red-600 text-white"
                      : "bg-green-100 text-green-700"
                  )}
                >
                  {listing.status === "SOLD" ? "SOLD" : "ACTIVE"}
                </span>
              </div>

              <div className="p-4">
                <h3 className="text-base font-semibold text-gray-800 mb-1 line-clamp-1">
                  {listing.title}
                </h3>
                <p className="text-lg font-bold text-primary-700 mb-2">
                  {formatPrice(
                    listing.price,
                    listing.listingType,
                    listing.rentPeriod
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span
                    className={clsx(
                      "inline-block px-2 py-0.5 text-xs font-medium rounded-full",
                      getCategoryBadgeColor(listing.category)
                    )}
                  >
                    {getCategoryLabel(listing.category)}
                  </span>
                  <span
                    className={clsx(
                      "inline-block px-2 py-0.5 text-xs font-medium rounded-full",
                      getListingTypeBadgeColor(listing.listingType)
                    )}
                  >
                    {listing.listingType}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Heart size={12} />
                    {listing.wishlistCount}
                  </span>
                  {listing.status !== "SOLD" && (
                    <button
                      onClick={(e) => markAsSold(listing.id, e)}
                      disabled={markingSoldId === listing.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-xs font-medium hover:bg-amber-100 transition-colors z-20 relative"
                    >
                      {markingSoldId === listing.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={12} />
                      )}
                      Mark Sold
                    </button>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
