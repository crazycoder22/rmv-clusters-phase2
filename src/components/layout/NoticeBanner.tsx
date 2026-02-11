"use client";

import { useState } from "react";
import { X, Info, AlertTriangle, AlertCircle } from "lucide-react";
import clsx from "clsx";
import type { NoticeBanner as NoticeBannerType } from "@/types";

const bannerStyles = {
  info: "bg-primary-50 text-primary-800 border-primary-200",
  warning: "bg-warm-50 text-yellow-800 border-yellow-200",
  urgent: "bg-red-50 text-red-800 border-red-200",
};

const bannerIcons = {
  info: Info,
  warning: AlertTriangle,
  urgent: AlertCircle,
};

export default function NoticeBanner({
  banner,
}: {
  banner: NoticeBannerType;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (!banner.active || dismissed) return null;

  const Icon = bannerIcons[banner.type];

  return (
    <div className={clsx("border-b px-4 py-2.5", bannerStyles[banner.type])}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon size={16} className="shrink-0" />
          <span>{banner.message}</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-black/5 transition-colors shrink-0"
          aria-label="Dismiss notice"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
