"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import clsx from "clsx";
import {
  MARKETPLACE_CATEGORIES,
  LISTING_TYPES,
  RENT_PERIODS,
} from "@/lib/marketplace-categories";
import ImageUpload from "@/components/community/ImageUpload";

export default function CreateListingPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [category, setCategory] = useState<string>(MARKETPLACE_CATEGORIES[0].value);
  const [listingType, setListingType] = useState("SELL");
  const [price, setPrice] = useState("");
  const [rentPeriod, setRentPeriod] = useState<string>(RENT_PERIODS[0].value);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authStatus !== "loading" && !session?.user?.isApproved) {
      router.replace("/");
    }
  }, [authStatus, session, router]);

  if (authStatus === "loading" || !session?.user?.isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        images,
        category,
        listingType,
        whatsappNumber: whatsappNumber.trim(),
      };

      if (listingType !== "GIVEAWAY") {
        body.price = Number(price);
      }
      if (listingType === "RENT") {
        body.rentPeriod = rentPeriod;
      }

      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create listing");
      }

      const data = await res.json();
      router.push(`/marketplace/${data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 mb-6"
      >
        <ArrowLeft size={16} />
        Back to Marketplace
      </Link>

      <h1 className="text-2xl font-bold text-primary-800 mb-6">
        Create Listing
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="What are you listing?"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
            placeholder="Describe the item, condition, etc."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
        </div>

        {/* Images */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Images
          </label>
          <ImageUpload images={images} onChange={setImages} maxImages={5} />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white"
          >
            {MARKETPLACE_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Listing Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Listing Type
          </label>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {LISTING_TYPES.map((lt) => (
              <button
                key={lt.value}
                type="button"
                onClick={() => setListingType(lt.value)}
                className={clsx(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                  listingType === lt.value
                    ? "bg-white text-primary-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {lt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Price (hidden for GIVEAWAY) */}
        {listingType !== "GIVEAWAY" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              min="0"
              placeholder="0"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>
        )}

        {/* Rent Period (shown only for RENT) */}
        {listingType === "RENT" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rent Period
            </label>
            <select
              value={rentPeriod}
              onChange={(e) => setRentPeriod(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white"
            >
              {RENT_PERIODS.map((rp) => (
                <option key={rp.value} value={rp.value}>
                  {rp.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* WhatsApp Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            WhatsApp Number <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            required
            placeholder="10-digit number"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {submitting ? "Creating..." : "Create Listing"}
        </button>
      </form>
    </div>
  );
}
