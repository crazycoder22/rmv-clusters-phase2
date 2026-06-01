import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle, Plus, Search, X, Loader2 } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { Avatar } from "./Community";

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

export default function Messages() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiFetch("/api/messages", { token });
      if (res.ok) setConversations((await res.json()).conversations ?? []);
    } catch {
      // ignore
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(true), 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function startChat(residentId: string) {
    const res = await apiFetch("/api/messages", { method: "POST", token, body: JSON.stringify({ residentId }) });
    if (res.ok) {
      const { id } = await res.json();
      navigate(`/messages/${id}`);
    }
  }

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link to="/more" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="flex-1 text-lg font-semibold text-white">Messages</h1>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex h-9 items-center gap-1 rounded-full bg-indigo-500 px-3 text-sm font-medium text-white active:bg-indigo-600"
        >
          <Plus size={14} /> New
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center py-12 text-slate-500"><Loader2 size={22} className="animate-spin" /></div>
      ) : conversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-12 text-center text-sm text-slate-500">
          <MessageCircle size={28} className="mx-auto mb-2 text-slate-600" />
          No conversations yet. Tap “New” to start one.
        </div>
      ) : (
        <div className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60 pb-1">
          {conversations.map((c) => (
            <Link key={c.id} to={`/messages/${c.id}`} className="flex items-center gap-3 px-3 py-3 active:bg-slate-800">
              <Avatar name={c.other.name} imageUrl={c.other.googleImage} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`truncate text-sm ${c.unreadCount > 0 ? "font-bold text-white" : "font-medium text-slate-200"}`}>
                    {c.other.name} <span className="text-[11px] font-normal text-slate-500">B{c.other.block ?? "—"}, {c.other.flatNumber}</span>
                  </p>
                  <span className="shrink-0 text-[11px] text-slate-500">{timeAgo(c.lastMessageAt)}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p className={`truncate text-xs ${c.unreadCount > 0 ? "font-medium text-slate-300" : "text-slate-500"}`}>
                    {c.lastMessage ? (c.lastMessage.fromMe ? "You: " : "") + c.lastMessage.body : "No messages yet"}
                  </p>
                  {c.unreadCount > 0 && (
                    <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
                      {c.unreadCount > 9 ? "9+" : c.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {pickerOpen && <ResidentPicker token={token} onClose={() => setPickerOpen(false)} onPick={startChat} />}
    </div>
  );
}

function ResidentPicker({ token, onClose, onPick }: { token: string | null; onClose: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ResidentHit[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const term = q.trim();
    if (term.length < 1) { setHits([]); return; }
    debounce.current = setTimeout(async () => {
      const res = await apiFetch(`/api/residents/search?q=${encodeURIComponent(term)}`, { token });
      if (res.ok) setHits(((await res.json()).residents ?? []).slice(0, 20));
    }, 250);
  }, [q, token]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[max(3rem,env(safe-area-inset-top,0px))]">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h3 className="font-bold text-white">New message</h3>
          <button type="button" onClick={onClose} className="text-slate-400"><X size={18} /></button>
        </div>
        <div className="p-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3">
            <Search size={15} className="text-slate-500" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or flat…" className="flex-1 bg-transparent py-2 text-sm text-slate-100 focus:outline-none" />
          </div>
          <div className="mt-2 max-h-72 divide-y divide-slate-800 overflow-y-auto">
            {hits.map((h) => (
              <button key={h.id} type="button" onClick={() => onPick(h.id)} className="flex w-full items-center gap-3 rounded px-1 py-2 text-left active:bg-slate-800">
                <Avatar name={h.name} imageUrl={h.googleImage} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-200">{h.name}</p>
                  <p className="text-xs text-slate-500">Block {h.block ?? "—"}, {h.flatNumber}</p>
                </div>
              </button>
            ))}
            {q.trim().length >= 1 && hits.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">No residents found.</p>
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
