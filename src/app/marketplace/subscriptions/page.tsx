"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, ArrowLeft, Loader2, Check } from "lucide-react";
import clsx from "clsx";
import {
  MARKETPLACE_CATEGORIES,
  getCategoryBadgeColor,
} from "@/lib/marketplace-categories";

export default function SubscriptionsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [subscribedCategories, setSubscribedCategories] = useState<string[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (authStatus !== "loading" && !session?.user?.isApproved) {
      router.replace("/");
    }
  }, [authStatus, session, router]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    setLoading(true);
    fetch("/api/marketplace/subscriptions")
      .then((res) => (res.ok ? res.json() : { categories: [] }))
      .then((data) => setSubscribedCategories(data.categories || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authStatus]);

  const toggleCategory = (value: string) => {
    setSaved(false);
    setSubscribedCategories((prev) =>
      prev.includes(value)
        ? prev.filter((c) => c !== value)
        : [...prev, value]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/marketplace/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: subscribedCategories }),
      });
      if (res.ok) {
        setSaved(true);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
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

      <div className="flex items-center gap-2 mb-2">
        <Bell size={24} className="text-primary-600" />
        <h1 className="text-2xl font-bold text-primary-800">
          Listing Notifications
        </h1>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Get notified when new items are listed in these categories
      </p>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6">
            {MARKETPLACE_CATEGORIES.map((cat) => {
              const isActive = subscribedCategories.includes(cat.value);
              return (
                <button
                  key={cat.value}
                  onClick={() => toggleCategory(cat.value)}
                  className={clsx(
                    "relative px-4 py-3 rounded-xl text-sm font-medium border-2 transition-all text-center",
                    isActive
                      ? "border-primary-600 bg-primary-50 text-primary-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  )}
                >
                  {cat.label}
                  {isActive && (
                    <span className="absolute top-1.5 right-1.5">
                      <Check size={14} className="text-primary-600" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? "Saving..." : "Save Preferences"}
            </button>
            {saved && (
              <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                <Check size={16} />
                Preferences saved!
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
