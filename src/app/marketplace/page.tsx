"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShoppingBag,
  Plus,
  Search,
  Heart,
  ArrowUpDown,
  Package,
  Bell,
} from "lucide-react";
import clsx from "clsx";
import {
  MARKETPLACE_CATEGORIES,
  LISTING_TYPES,
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
  whatsappNumber: string;
  seller: {
    id: string;
    name: string;
    block: number;
    flatNumber: string;
  };
  wishlistCount: number;
  createdAt: string;
}

export default function MarketplacePage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (authStatus !== "loading" && !session?.user?.isApproved) {
      router.replace("/");
    }
  }, [authStatus, session, router]);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (type) params.set("type", type);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    params.set("sort", sort);

    fetch(`/api/marketplace?${params}`)
      .then((res) => (res.ok ? res.json() : { listings: [] }))
      .then((data) => setListings(data.listings || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authStatus, category, type, debouncedSearch, sort]);

  if (authStatus === "loading" || !session?.user?.isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const sortOptions = [
    { value: "recent", label: "Recent" },
    { value: "price_asc", label: "Price \u2191" },
    { value: "price_desc", label: "Price \u2193" },
  ];

  const nextSort = () => {
    const idx = sortOptions.findIndex((s) => s.value === sort);
    setSort(sortOptions[(idx + 1) % sortOptions.length].value);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ShoppingBag size={24} className="text-primary-600" />
          <h1 className="text-2xl font-bold text-primary-800 dark:text-primary-200">Marketplace</h1>
        </div>
        <Link
          href="/marketplace/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus size={16} />
          Create Listing
        </Link>
      </div>

      {/* Sub-nav links */}
      <div className="flex items-center gap-4 mb-6 text-sm">
        <Link
          href="/marketplace/my-listings"
          className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-700 font-medium"
        >
          <Package size={15} />
          My Listings
        </Link>
        <Link
          href="/marketplace/wishlist"
          className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-700 font-medium"
        >
          <Heart size={15} />
          Wishlist
        </Link>
        <Link
          href="/marketplace/subscriptions"
          className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-700 font-medium"
        >
          <Bell size={15} />
          Notifications
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search listings..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">All Categories</option>
          {MARKETPLACE_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
        <button
          onClick={nextSort}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowUpDown size={15} />
          {sortOptions.find((s) => s.value === sort)?.label}
        </button>
      </div>

      {/* Type pills */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => setType("")}
          className={clsx(
            "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
            type === ""
              ? "bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-300 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          )}
        >
          All
        </button>
        {LISTING_TYPES.map((lt) => (
          <button
            key={lt.value}
            onClick={() => setType(type === lt.value ? "" : lt.value)}
            className={clsx(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              type === lt.value
                ? "bg-white text-primary-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {lt.label}
          </button>
        ))}
      </div>

      {/* Listings grid */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : listings.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBag size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400">No listings found</p>
          <p className="text-sm text-gray-400 mt-1">
            Be the first to list something!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              href={`/marketplace/${listing.id}`}
              className="block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-primary-200 hover:shadow-md transition-all overflow-hidden relative"
            >
              {/* SOLD overlay */}
              {listing.status === "SOLD" && (
                <div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center">
                  <span className="bg-red-600 text-white text-lg font-bold px-6 py-2 rounded-lg -rotate-12">
                    SOLD
                  </span>
                </div>
              )}

              {/* Thumbnail */}
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
              </div>

              {/* Card content */}
              <div className="p-4">
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1 line-clamp-1">
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
                  <span>
                    Block {listing.seller.block}, {listing.seller.flatNumber}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart size={12} />
                    {listing.wishlistCount}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
