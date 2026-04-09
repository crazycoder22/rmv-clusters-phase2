"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ExternalLink } from "lucide-react";

interface AdData {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  linkUrl: string;
  placement: string;
}

interface AdBannerProps {
  page: string;
  placement: "top" | "bottom";
}

export default function AdBanner({ page, placement }: AdBannerProps) {
  const [ad, setAd] = useState<AdData | null>(null);

  useEffect(() => {
    fetch(`/api/ads?page=${page}&placement=${placement}`)
      .then((r) => (r.ok ? r.json() : { ads: [] }))
      .then((d) => {
        const ads: AdData[] = d.ads ?? [];
        if (ads.length > 0) {
          // Pick a random ad if multiple match
          setAd(ads[Math.floor(Math.random() * ads.length)]);
        }
      })
      .catch(() => {});
  }, [page, placement]);

  if (!ad) return null;

  async function handleClick() {
    if (!ad) return;
    // Track click (fire-and-forget)
    fetch(`/api/ads/${ad.id}/click`, { method: "POST" }).catch(() => {});
    window.open(ad.linkUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className={`group relative cursor-pointer rounded-xl border border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-800 overflow-hidden transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 ${
        placement === "top" ? "mb-4" : "mt-4"
      }`}
      onClick={handleClick}
      role="banner"
      aria-label={`Advertisement: ${ad.title}`}
    >
      <div className="flex items-center gap-4 p-3 sm:p-4">
        {/* Ad image */}
        <div className="relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
          <Image
            src={ad.imageUrl}
            alt={ad.title}
            fill
            className="object-cover"
            sizes="80px"
          />
        </div>

        {/* Ad content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="inline-block px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 rounded">
              Sponsored
            </span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
            {ad.title}
          </h3>
          {ad.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
              {ad.description}
            </p>
          )}
        </div>

        {/* Arrow indicator */}
        <ExternalLink
          size={14}
          className="flex-shrink-0 text-gray-300 dark:text-gray-600 group-hover:text-primary-500 transition-colors"
        />
      </div>
    </div>
  );
}
