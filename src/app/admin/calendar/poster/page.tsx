"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRole } from "@/hooks/useRole";
import { toPng } from "html-to-image";
import Link from "next/link";
import { ArrowLeft, Download, ChevronLeft, ChevronRight, X } from "lucide-react";

interface PosterEvent {
  id: string;
  title: string;
  date: string;
  emoji: string;
  source: "calendar" | "announcement";
}

interface PosterMonth {
  month: number;
  name: string;
  events: PosterEvent[];
}

const EMOJI_OPTIONS = [
  "🪔", "🎨", "🎄", "🎉", "🎆", "🌙", "🌾", "💃", "🇮🇳", "🐘",
  "🏳️", "📋", "🗳️", "🤝", "🍲", "🔥", "🎬", "🎵", "🎤", "🧘",
  "💪", "👟", "🚶", "🏏", "🏐", "🏸", "⚽", "🎾", "🏊", "🏅",
  "🏆", "🎯", "👶", "⭐", "🎭", "🔧", "🧹", "💧", "⚡", "🌿",
  "🔒", "🍳", "🍽️", "☕", "🎂", "🍦", "🛠️", "🎓", "🚌", "🏥",
  "📢", "📝", "🙏", "🎀", "👋", "🙌", "📌", "🥳", "❤️", "🌟",
  "🚨", "🎊", "🏖️", "⛺",
];

export default function PosterPage() {
  const { isAdmin, isSuperAdmin, isLoading: roleLoading } = useRole();
  const [year, setYear] = useState(new Date().getFullYear());
  const [months, setMonths] = useState<PosterMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PosterEvent | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/calendar/poster?year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setMonths(data.months || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    if (!roleLoading && (isAdmin() || isSuperAdmin())) {
      fetchData();
    }
  }, [roleLoading, isAdmin, isSuperAdmin, fetchData]);

  const handleEmojiChange = async (event: PosterEvent, newEmoji: string) => {
    // Optimistic update
    setMonths((prev) =>
      prev.map((m) => ({
        ...m,
        events: m.events.map((e) =>
          e.id === event.id ? { ...e, emoji: newEmoji } : e
        ),
      }))
    );
    setEditingEvent(null);

    // Persist to DB
    await fetch("/api/admin/calendar/poster/emoji", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: event.id,
        emoji: newEmoji,
        source: event.source,
      }),
    });
  };

  const handleDownload = async () => {
    if (!posterRef.current) return;
    setDownloading(true);
    setEditingEvent(null);
    try {
      const dataUrl = await toPng(posterRef.current, {
        pixelRatio: 2,
        backgroundColor: "#1a1a2e",
      });
      const link = document.createElement("a");
      link.download = `rmv-events-${year}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to generate image. Please try taking a screenshot instead.");
    } finally {
      setDownloading(false);
    }
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!isAdmin() && !isSuperAdmin()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-500">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  // Split months into two columns for poster layout
  const leftMonths = months.filter((_, i) => i % 2 === 0);
  const rightMonths = months.filter((_, i) => i % 2 !== 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Controls — NOT included in the poster export */}
      <Link
        href="/admin/calendar"
        className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium mb-6"
      >
        <ArrowLeft size={16} />
        Back to Calendar
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary-800">Event Poster</h1>
          <p className="text-sm text-gray-500">Generate a shareable poster of community events</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-lg font-bold text-gray-800 min-w-[60px] text-center">
            {year}
          </span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading || loading || months.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors text-sm ml-2"
          >
            <Download size={16} />
            {downloading ? "Generating..." : "Download PNG"}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-4">
        Click any emoji on the poster to change it. Changes are saved automatically.
      </p>

      {/* ====== THE POSTER (this div is exported to PNG) ====== */}
      <div
        ref={posterRef}
        style={{
          background: "linear-gradient(180deg, #2c1810 0%, #3d2317 20%, #4a2c1c 40%, #3d2317 60%, #2c1810 100%)",
          padding: "48px 36px",
          maxWidth: "800px",
          margin: "0 auto",
          borderRadius: "16px",
          position: "relative",
          overflow: "hidden",
          fontFamily: "'Georgia', 'Times New Roman', serif",
        }}
      >
        {/* Subtle background overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.05) 0%, transparent 60%)",
            pointerEvents: "none",
          }}
        />

        {/* Header with building silhouette feel */}
        <div style={{ position: "relative", textAlign: "center", marginBottom: "36px" }}>
          {/* Decorative top elements */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "16px",
              fontSize: "20px",
              opacity: 0.6,
            }}
          >
            <span>🏘️</span>
            <span>🌳</span>
            <span>🏠</span>
            <span>🌳</span>
            <span>🏘️</span>
          </div>
          <h2
            style={{
              fontSize: "30px",
              fontWeight: "800",
              color: "#f5e6d3",
              letterSpacing: "3px",
              textTransform: "uppercase",
              margin: "0 0 4px 0",
              textShadow: "0 2px 4px rgba(0,0,0,0.3)",
              fontFamily: "'Georgia', serif",
            }}
          >
            RMV Clusters Phase 2
          </h2>
          <p
            style={{
              fontSize: "20px",
              fontWeight: "700",
              color: "#d4a574",
              letterSpacing: "4px",
              textTransform: "uppercase",
              margin: 0,
              fontFamily: "'Georgia', serif",
            }}
          >
            {year} Community Events
          </p>
          <div
            style={{
              width: "100px",
              height: "3px",
              background: "linear-gradient(90deg, transparent, #d4a574, transparent)",
              margin: "16px auto 0",
            }}
          />
        </div>

        {/* Month cards grid */}
        {loading ? (
          <p
            style={{
              textAlign: "center",
              color: "rgba(255,255,255,0.4)",
              padding: "48px 0",
              fontSize: "14px",
            }}
          >
            Loading events...
          </p>
        ) : months.length === 0 ? (
          <p
            style={{
              textAlign: "center",
              color: "rgba(255,255,255,0.4)",
              padding: "48px 0",
              fontSize: "14px",
            }}
          >
            No events found for {year}
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              gap: "16px",
              position: "relative",
            }}
          >
            {/* Left column */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
              {leftMonths.map((m) => (
                <MonthCard
                  key={m.month}
                  month={m}
                  onEmojiClick={(event) => setEditingEvent(event)}
                />
              ))}
            </div>
            {/* Right column */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
              {rightMonths.map((m) => (
                <MonthCard
                  key={m.month}
                  month={m}
                  onEmojiClick={(event) => setEditingEvent(event)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            textAlign: "center",
            marginTop: "36px",
            paddingTop: "20px",
            position: "relative",
          }}
        >
          <div
            style={{
              width: "200px",
              height: "1px",
              background: "linear-gradient(90deg, transparent, rgba(212,165,116,0.4), transparent)",
              margin: "0 auto 16px",
            }}
          />
          <p
            style={{
              fontSize: "18px",
              fontWeight: "600",
              color: "#d4a574",
              fontStyle: "italic",
              letterSpacing: "2px",
              margin: 0,
              fontFamily: "'Georgia', serif",
            }}
          >
            Together, We Build RMV
          </p>
        </div>
      </div>

      {/* Emoji Picker Modal */}
      {editingEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setEditingEvent(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Change Emoji</h3>
                <p className="text-xs text-gray-500 mt-0.5">{editingEvent.title}</p>
              </div>
              <button
                onClick={() => setEditingEvent(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-8 gap-1.5">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiChange(editingEvent, emoji)}
                    className={`text-2xl p-1.5 rounded-lg hover:bg-gray-100 transition-colors ${
                      emoji === editingEvent.emoji
                        ? "bg-primary-100 ring-2 ring-primary-500"
                        : ""
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Individual month card within the poster */
function MonthCard({
  month,
  onEmojiClick,
}: {
  month: PosterMonth;
  onEmojiClick: (event: PosterEvent) => void;
}) {
  return (
    <div
      style={{
        background: "rgba(245, 230, 211, 0.12)",
        borderRadius: "12px",
        padding: "16px 18px",
        border: "1px solid rgba(212, 165, 116, 0.15)",
      }}
    >
      {/* Month name */}
      <h3
        style={{
          fontSize: "15px",
          fontWeight: "800",
          color: "#d4a574",
          marginBottom: "10px",
          textTransform: "uppercase",
          letterSpacing: "2px",
          margin: "0 0 10px 0",
          fontFamily: "'Georgia', serif",
          borderBottom: "1px solid rgba(212, 165, 116, 0.15)",
          paddingBottom: "8px",
        }}
      >
        {month.name}
      </h3>

      {/* Events */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {month.events.map((event) => (
          <div
            key={event.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              color: "#f5e6d3",
              lineHeight: "1.5",
            }}
          >
            <span
              onClick={() => onEmojiClick(event)}
              style={{
                cursor: "pointer",
                fontSize: "16px",
                flexShrink: 0,
                transition: "transform 0.15s",
              }}
              title="Click to change emoji"
            >
              {event.emoji}
            </span>
            <span style={{ fontWeight: "600", fontFamily: "'Georgia', serif" }}>
              {event.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
