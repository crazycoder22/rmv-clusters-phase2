"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

// How long each ad stays visible before rotating to the next.
const ROTATION_MS = 30_000;
// Fade-out duration in ms — must match the Tailwind `duration-300` class below.
const FADE_MS = 300;

export default function AdBanner({ page, placement }: AdBannerProps) {
  const [ads, setAds] = useState<AdData[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const pausedRef = useRef(false); // paused by hover or when tab hidden

  // Fetch the full ad list once. Pick a random starting index so different
  // page visits don't always lead with the same ad; rotation from there is
  // deterministic so every ad still gets equal airtime over the session.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ads?page=${page}&placement=${placement}`)
      .then((r) => (r.ok ? r.json() : { ads: [] }))
      .then((d) => {
        if (cancelled) return;
        const list: AdData[] = d.ads ?? [];
        setAds(list);
        if (list.length > 0) {
          setIndex(Math.floor(Math.random() * list.length));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [page, placement]);

  // Respect prefers-reduced-motion — swap without fade when the user opts out.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Pause rotation when the tab is in the background — no point burning
  // interval ticks on a banner nobody can see.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      pausedRef.current = document.hidden;
    };
    pausedRef.current = document.hidden;
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Rotation timer. Only runs when there are 2+ ads.
  useEffect(() => {
    if (ads.length <= 1) return;
    const id = setInterval(() => {
      if (pausedRef.current) return;
      if (reducedMotion) {
        setIndex((i) => (i + 1) % ads.length);
        return;
      }
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % ads.length);
        setVisible(true);
      }, FADE_MS);
    }, ROTATION_MS);
    return () => clearInterval(id);
  }, [ads.length, reducedMotion]);

  const onMouseEnter = useCallback(() => {
    pausedRef.current = true;
  }, []);
  const onMouseLeave = useCallback(() => {
    pausedRef.current = typeof document !== "undefined" && document.hidden;
  }, []);

  const ad = ads[index] ?? null;
  if (!ad) return null;

  async function handleClick() {
    if (!ad) return;
    // Track click (fire-and-forget)
    fetch(`/api/ads/${ad.id}/click`, { method: "POST" }).catch(() => {});
    window.open(ad.linkUrl, "_blank", "noopener,noreferrer");
  }

  const fadeClasses = reducedMotion
    ? ""
    : `transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`;

  return (
    <div
      className={`group relative cursor-pointer rounded-xl border border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-800 overflow-hidden hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 ${
        placement === "top" ? "mb-4" : "mt-4"
      } ${fadeClasses}`}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="banner"
      aria-live="polite"
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
