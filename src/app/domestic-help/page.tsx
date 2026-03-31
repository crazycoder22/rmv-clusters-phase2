"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Plus, Star, Users2, Phone, ArrowUpDown } from "lucide-react";
import clsx from "clsx";
import {
  DOMESTIC_HELP_CATEGORIES,
  getCategoryLabel,
  getCategoryBadgeColor,
} from "@/lib/domestic-help-categories";

interface Worker {
  id: string;
  name: string;
  phone: string;
  categories: string[];
  description: string | null;
  availability: string | null;
  avgRating: number;
  reviewCount: number;
  addedBy: { name: string; block: number; flatNumber: string };
  createdAt: string;
}

export default function DomesticHelpPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"recent" | "rating">("recent");
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
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    params.set("sort", sort);

    fetch(`/api/domestic-help?${params}`)
      .then((res) => (res.ok ? res.json() : { workers: [] }))
      .then((data) => setWorkers(data.workers || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authStatus, category, debouncedSearch, sort]);

  if (authStatus === "loading" || !session?.user?.isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users2 size={24} className="text-primary-600" />
          <h1 className="text-2xl font-bold text-primary-800">
            Domestic Help Directory
          </h1>
        </div>
        <Link
          href="/domestic-help/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus size={16} />
          Add Worker
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white"
        >
          <option value="">All Categories</option>
          {DOMESTIC_HELP_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => setSort(sort === "recent" ? "rating" : "recent")}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ArrowUpDown size={15} />
          {sort === "rating" ? "Top Rated" : "Recent"}
        </button>
      </div>

      {/* Worker list */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : workers.length === 0 ? (
        <div className="text-center py-16">
          <Users2 size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400">No workers found</p>
          <p className="text-sm text-gray-400 mt-1">
            Be the first to add a domestic help worker!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {workers.map((worker) => (
            <Link
              key={worker.id}
              href={`/domestic-help/${worker.id}`}
              className="block bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">
                    {worker.name}
                  </h3>
                  <div className="flex flex-wrap gap-1.5 mb-2">
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
                  {worker.description && (
                    <p className="text-sm text-gray-500 mb-2 line-clamp-2">
                      {worker.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Phone size={12} />
                      {worker.phone}
                    </span>
                    {worker.availability && (
                      <span>{worker.availability}</span>
                    )}
                    <span>
                      Added by {worker.addedBy.name}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1">
                    <Star
                      size={16}
                      className={
                        worker.avgRating > 0
                          ? "text-amber-400 fill-amber-400"
                          : "text-gray-300"
                      }
                    />
                    <span className="text-sm font-semibold text-gray-700">
                      {worker.avgRating > 0
                        ? worker.avgRating.toFixed(1)
                        : "—"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {worker.reviewCount} review
                    {worker.reviewCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
