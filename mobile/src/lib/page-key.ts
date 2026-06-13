// Derive a (feature, pageKey, entityId) tracking key from a route path. Powers
// the auto page-view tracker so every page is tracked without per-page calls.
// Mirrors src/lib/page-key.ts on the web.
//
// SKIP: admin/auth/internal routes, plus features already manually instrumented
// (initiatives, food, bazaar) so we don't double-count.
const SKIP = new Set(["admin", "login", "logout", "signin", "api", "initiatives", "food", "bazaar"]);

const clean = (s: string): string => s.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);

function isId(s: string): boolean {
  return (
    /^\d+$/.test(s) ||
    /^c[a-z0-9]{20,}$/i.test(s) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s) ||
    s.length >= 20
  );
}

export type PageKey = { feature: string; pageKey: string; entityId?: string };

export function derivePage(pathname: string): PageKey | null {
  const segs = (pathname || "/").split(/[?#]/)[0].split("/").filter(Boolean);
  if (segs.length === 0) return { feature: "home", pageKey: "index" };
  if (SKIP.has(segs[0].toLowerCase())) return null;

  const feature = clean(segs[0]);
  if (!feature) return null;

  const last = segs[segs.length - 1];
  if (segs.length >= 2 && isId(last)) {
    const before = segs[segs.length - 2];
    const pageKey = before && before !== segs[0] ? clean(before) || "detail" : "detail";
    return { feature, pageKey, entityId: last };
  }
  if (segs.length === 1) return { feature, pageKey: "list" };
  return { feature, pageKey: clean(last) || "list" };
}
