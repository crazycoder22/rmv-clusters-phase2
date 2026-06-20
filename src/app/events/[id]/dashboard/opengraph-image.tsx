import { ImageResponse } from "next/og";

// Step-Up themed social-share image for the event dashboard link. Overrides the
// site-wide default (the RMV logo) so WhatsApp/social previews show a running
// motif instead. Generated at request time (dynamic [id] route).
export const alt = "Step-Up Challenge — RMV Clusters Phase 2";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
          padding: "0 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 196,
            height: 196,
            borderRadius: 48,
            background: "rgba(255,255,255,0.18)",
            marginBottom: 44,
          }}
        >
          <svg width="128" height="128" viewBox="0 0 24 24" fill="#ffffff">
            <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z" />
          </svg>
        </div>
        <div
          style={{
            fontSize: 78,
            fontWeight: 800,
            letterSpacing: -2,
            lineHeight: 1.05,
            textAlign: "center",
          }}
        >
          Step-Up Challenge
        </div>
        <div
          style={{
            fontSize: 34,
            fontWeight: 600,
            marginTop: 22,
            opacity: 0.92,
            textAlign: "center",
          }}
        >
          RMV Clusters Phase 2 · Live Leaderboard
        </div>
      </div>
    ),
    { ...size }
  );
}
