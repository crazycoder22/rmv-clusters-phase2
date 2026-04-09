"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  Megaphone,
  BarChart3,
  MousePointerClick,
} from "lucide-react";

interface Ad {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  linkUrl: string;
  placement: string;
  pages: string[];
  startDate: string;
  endDate: string;
  active: boolean;
  impressions: number;
  clicks: number;
  createdAt: string;
}

function getTodayIST(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

function getStatus(ad: Ad): { label: string; color: string } {
  if (!ad.active) return { label: "Inactive", color: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400" };
  const today = getTodayIST();
  if (ad.startDate > today) return { label: "Scheduled", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" };
  if (ad.endDate < today) return { label: "Expired", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" };
  return { label: "Active", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" };
}

export default function AdminAdsPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAds = useCallback(async () => {
    const res = await fetch("/api/admin/ads");
    if (res.ok) {
      const data = await res.json();
      setAds(data.ads);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  async function handleToggleActive(ad: Ad) {
    await fetch(`/api/admin/ads/${ad.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !ad.active }),
    });
    fetchAds();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this ad? This cannot be undone.")) return;
    await fetch(`/api/admin/ads/${id}`, { method: "DELETE" });
    fetchAds();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }

  const totalImpressions = ads.reduce((s, a) => s + a.impressions, 0);
  const totalClicks = ads.reduce((s, a) => s + a.clicks, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <Megaphone className="text-primary-600" size={24} />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Banner Ads
            </h1>
          </div>
          <Link
            href="/admin/ads/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} />
            Create Ad
          </Link>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <Megaphone className="mx-auto text-primary-500 mb-1" size={20} />
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{ads.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Ads</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <BarChart3 className="mx-auto text-blue-500 mb-1" size={20} />
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalImpressions.toLocaleString()}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Impressions</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <MousePointerClick className="mx-auto text-green-500 mb-1" size={20} />
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalClicks.toLocaleString()}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Clicks</p>
          </div>
        </div>

        {/* Ad List */}
        {ads.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Megaphone className="mx-auto text-gray-300 dark:text-gray-600 mb-3" size={48} />
            <p className="text-gray-500 dark:text-gray-400">No ads yet.</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Create your first banner ad to start earning revenue.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {ads.map((ad) => {
              const status = getStatus(ad);
              const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : "0.0";
              return (
                <div
                  key={ad.id}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    {/* Thumbnail */}
                    <div className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                      <Image
                        src={ad.imageUrl}
                        alt={ad.title}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {ad.title}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>{ad.startDate} → {ad.endDate}</span>
                        <span className="capitalize">{ad.placement}</span>
                        <span>{ad.pages.join(", ")}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <span className="text-gray-500 dark:text-gray-400">
                          {ad.impressions.toLocaleString()} views
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {ad.clicks.toLocaleString()} clicks
                        </span>
                        <span className="font-medium text-primary-600 dark:text-primary-400">
                          {ctr}% CTR
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleToggleActive(ad)}
                        className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title={ad.active ? "Deactivate" : "Activate"}
                      >
                        {ad.active ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <Link
                        href={`/admin/ads/${ad.id}/edit`}
                        className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Edit"
                      >
                        <Edit3 size={16} />
                      </Link>
                      <button
                        onClick={() => handleDelete(ad.id)}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
