import { Browser } from "@capacitor/browser";
import Icon from "./Icon";

/** Extract the 11-char video id from any common YouTube URL (or null). */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

/**
 * A tappable YouTube thumbnail that opens the video in the in-app browser
 * (SFSafariViewController on iOS) — the app's standard mobile YouTube pattern.
 * Renders nothing if the URL isn't a recognizable YouTube link.
 */
export default function YouTubeCard({ url, className }: { url: string | null; className?: string }) {
  const vid = youtubeId(url);
  if (!vid) return null;
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        Browser.open({ url: url! }).catch(() => window.open(url!, "_blank"));
      }}
      className={`relative block aspect-video w-full overflow-hidden active:opacity-95 ${className ?? ""}`}
      style={{ background: "#0b1220" }}
      aria-label="Play video"
    >
      <img src={`https://img.youtube.com/vi/${vid}/hqdefault.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-[7px] px-2 py-1" style={{ background: "rgba(0,0,0,0.62)" }}>
        <Icon name="smart_display" size={16} fill style={{ color: "#ff0033" }} />
        <span className="text-[11px] font-bold text-white">YouTube</span>
      </span>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-[45px] w-[64px] items-center justify-center rounded-[13px]" style={{ background: "#ff0033", boxShadow: "0 8px 22px rgba(255,0,51,0.45)" }}>
          <Icon name="play_arrow" size={30} fill style={{ color: "#fff" }} />
        </span>
      </span>
    </button>
  );
}
