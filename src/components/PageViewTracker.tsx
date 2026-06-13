"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { track, useDwell } from "@/lib/track-client";
import { derivePage } from "@/lib/page-key";

// Mounted once in the root layout — records a view + dwell time for every route
// change automatically (anonymous/untracked routes are no-ops). Pages already
// instrumented by hand (initiatives, food) are skipped by derivePage's SKIP set.
export default function PageViewTracker() {
  const pathname = usePathname();
  const page = useMemo(() => derivePage(pathname ?? "/"), [pathname]);

  useEffect(() => {
    if (page) track(page.feature, page.pageKey, page.entityId);
  }, [page]);

  useDwell(page?.feature ?? "", page?.pageKey ?? "", page?.entityId, !!page);

  return null;
}
