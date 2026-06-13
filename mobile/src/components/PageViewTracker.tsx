import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { track, useDwell } from "../lib/track";
import { useAuth } from "../auth/AuthProvider";
import { derivePage } from "../lib/page-key";

// Mounted once inside the Router — records a view + dwell time for every route
// change automatically. Pages already instrumented by hand (initiatives, food)
// are skipped by derivePage's SKIP set.
export default function PageViewTracker() {
  const { pathname } = useLocation();
  const { token } = useAuth();
  const page = useMemo(() => derivePage(pathname), [pathname]);

  useEffect(() => {
    if (page && token) track(token, page.feature, page.pageKey, page.entityId);
  }, [page, token]);

  useDwell(token, page?.feature ?? "", page?.pageKey ?? "", page?.entityId, !!page && !!token);

  return null;
}
