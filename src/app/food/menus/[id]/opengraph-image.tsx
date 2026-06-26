import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

// Per-stall social-share image: the first item photo (full-bleed, with the
// stall name overlaid), or a themed fallback card when the stall has no photos.
// Shared Food/Bazaar links thus preview with the stall instead of the RMV logo.
export const alt = "RMV Bazaar / Food stall";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const menu = await prisma.foodMenu.findUnique({
    where: { id },
    select: {
      title: true,
      kind: true,
      chef: { select: { name: true } },
      items: {
        where: { imageUrl: { not: null } },
        select: { imageUrl: true },
        orderBy: { sortOrder: "asc" },
        take: 1,
      },
    },
  });

  const isMarket = menu?.kind === "MARKET";
  const label = isMarket ? "RMV BAZAAR" : "RMV KITCHEN";
  const accentA = isMarket ? "#16a34a" : "#f59e0b";
  const accentB = isMarket ? "#15803d" : "#ea580c";
  const title = menu?.title ?? (isMarket ? "Bazaar" : "Kitchen");
  const by = menu?.chef?.name ? `by ${menu.chef.name}` : "";
  const photo = menu?.items?.[0]?.imageUrl ?? null;

  // Storefront / bowl glyph for the fallback (avoid color-emoji rendering issues).
  const glyph = isMarket
    ? "M2 7l1-4h18l1 4M3 7h18v3a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V7zm1 5v8h16v-8"
    : "M3 11h18M5 11a7 7 0 0 1 14 0M4 16h16M7 20h10";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: `linear-gradient(135deg, ${accentA}, ${accentB})`,
          fontFamily: "sans-serif",
        }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="240" height="240" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d={glyph} />
            </svg>
          </div>
        )}

        {/* Bottom gradient + text overlay */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            padding: "64px 64px 56px",
            background: "linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.78))",
            color: "#ffffff",
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 3, opacity: 0.9 }}>{label}</div>
          <div style={{ fontSize: 70, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05, marginTop: 10 }}>{title}</div>
          {by && <div style={{ fontSize: 32, fontWeight: 600, marginTop: 12, opacity: 0.92 }}>{by}</div>}
        </div>
      </div>
    ),
    { ...size }
  );
}
