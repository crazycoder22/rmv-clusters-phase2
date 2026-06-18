"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useRequireSignIn } from "@/hooks/useRequireSignIn";
import Link from "next/link";
import { MessageCircle, Plus, Search, X } from "lucide-react";

interface ConversationRow {
  id: string;
  other: { id: string; name: string; block: number | null; flatNumber: string; googleImage: string | null };
  lastMessage: { body: string; createdAt: string; fromMe: boolean } | null;
  lastMessageAt: string;
  unreadCount: number;
}
interface ResidentHit {
  id: string;
  name: string;
  block: number | null;
  flatNumber: string;
  googleImage: string | null;
}

export default function MessagesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  useRequireSignIn(status);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/messages");
      if (res.ok) setConversations((await res.json()).conversations ?? []);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(true), 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <MessageCircle className="text-blue-600" /> Messages
          </h1>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> New message
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 py-16 text-center text-gray-500 dark:text-gray-400">
            <MessageCircle size={32} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">No conversations yet. Tap “New message” to start one.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
            {conversations.map((c) => (
              <Link
                key={c.id}
                href={`/messages/${c.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <Avatar name={c.other.name} image={c.other.googleImage} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm truncate ${c.unreadCount > 0 ? "font-bold text-gray-900 dark:text-gray-100" : "font-medium text-gray-800 dark:text-gray-200"}`}>
                      {c.other.name}
                      <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">B{c.other.block ?? "—"}, {c.other.flatNumber}</span>
                    </p>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0">{timeAgo(c.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className={`text-xs truncate ${c.unreadCount > 0 ? "text-gray-700 dark:text-gray-300 font-medium" : "text-gray-500 dark:text-gray-400"}`}>
                      {c.lastMessage ? (c.lastMessage.fromMe ? "You: " : "") + c.lastMessage.body : "No messages yet"}
                    </p>
                    {c.unreadCount > 0 && (
                      <span className="shrink-0 bg-blue-600 text-white text-[10px] font-bold rounded-full h-[18px] min-w-[18px] flex items-center justify-center px-1">
                        {c.unreadCount > 9 ? "9+" : c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {pickerOpen && <ResidentPicker onClose={() => setPickerOpen(false)} onPick={async (residentId) => {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ residentId }),
        });
        if (res.ok) {
          const { id } = await res.json();
          router.push(`/messages/${id}`);
        } else {
          alert((await res.json().catch(() => null))?.error ?? "Could not start chat");
        }
      }} />}
    </div>
  );
}

export function Avatar({ name, image, size = 40 }: { name: string; image: string | null; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

function ResidentPicker({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ResidentHit[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const term = q.trim();
    if (term.length < 1) { setHits([]); return; }
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/residents/search?q=${encodeURIComponent(term)}`);
      if (res.ok) setHits(((await res.json()).residents ?? []).slice(0, 20));
    }, 250);
  }, [q]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-12">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-gray-100">New message</h3>
          <button type="button" onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-3">
          <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg px-3 bg-gray-50 dark:bg-gray-900">
            <Search size={15} className="text-gray-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a resident by name or flat…" className="flex-1 py-2 text-sm bg-transparent dark:text-gray-100 focus:outline-none" />
          </div>
          <div className="mt-2 max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
            {hits.map((h) => (
              <button key={h.id} type="button" onClick={() => onPick(h.id)} className="w-full flex items-center gap-3 px-1 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded">
                <Avatar name={h.name} image={h.googleImage} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-gray-200">{h.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Block {h.block ?? "—"}, {h.flatNumber}</p>
                </div>
              </button>
            ))}
            {q.trim().length >= 1 && hits.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No residents found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
