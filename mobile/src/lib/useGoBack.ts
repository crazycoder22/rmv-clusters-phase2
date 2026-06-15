import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

// Back navigation that returns to wherever the user came from — Home/Explore,
// the Community hub, More, etc. — instead of a hardcoded destination. Falls
// back to a default (Home) when there's no in-app history to pop, e.g. the
// page was opened directly from a push-notification deep link.
export function useGoBack(fallback = "/"): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback);
  }, [navigate, fallback]);
}
