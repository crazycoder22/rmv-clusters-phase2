import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
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
    <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <header className="flex items-center gap-3 py-3">
        <Link to="/community" className="flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={24} style={{ color: "var(--text-2)" }} />
        </Link>
        <h1 className="min-w-0 flex-1 text-[24px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Messages</h1>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-bold text-white active:opacity-90"
          style={{ background: "var(--accent-strong)", boxShadow: "0 6px 16px var(--accent-soft)" }}
        >
          <Icon name="add" size={18} style={{ color: "#fff" }} /> New
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin" style={{ color: "var(--text-3)" }} /></div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[18px] px-6 py-12 text-center" style={{ border: "1.5px dashed var(--border-strong)" }}>
          <Icon name="forum" size={28} style={{ color: "var(--text-3)" }} />
          <p className="text-[14px]" style={{ color: "var(--text-3)" }}>No conversations yet. Tap "New" to start one.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[18px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {conversations.map((c, i) => {
            const unread = c.unreadCount > 0;
            return (
              <Link
                key={c.id}
                to={`/messages/${c.id}`}
                className="relative flex items-center gap-3 p-[13px] active:opacity-90"
                style={i < conversations.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}
              >
                <Avatar name={c.other.name} imageUrl={c.other.googleImage} size={44} />
                <div className="min-w-0 flex-1 pr-7">
                  <div className="flex items-baseline gap-1.5">
                    <span className="truncate text-[15px] font-bold tracking-tight" style={{ color: "var(--text)" }}>{c.other.name}</span>
                    <span className="flex-shrink-0 whitespace-nowrap text-[12.5px]" style={{ color: "var(--text-3)" }}>B{c.other.block ?? "—"}, {c.other.flatNumber}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[14px]" style={{ color: unread ? "var(--text-2)" : "var(--text-3)", fontWeight: unread ? 600 : 400 }}>
                    {c.lastMessage ? (c.lastMessage.fromMe ? "You: " : "") + c.lastMessage.body : "No messages yet"}
                  </p>
                </div>
                <span className="absolute right-3 top-[13px] text-[12px]" style={{ color: "var(--text-3)" }}>{timeAgo(c.lastMessageAt)}</span>
                {unread && (
                  <span className="absolute bottom-[15px] right-3 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: "var(--accent-strong)" }}>
                    {c.unreadCount > 9 ? "9+" : c.unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
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
    <div className="one-surface fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-3.5 pt-[max(3rem,env(safe-area-inset-top,0px))]">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-[20px]" style={{ background: "var(--surface)", border: "1px solid var(--border-strong)", boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}>
        <div className="flex items-center justify-between px-[18px] py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-[19px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>New message</h3>
          <button type="button" onClick={onClose} aria-label="Close"><Icon name="close" size={22} style={{ color: "var(--text-3)" }} /></button>
        </div>
        <div className="px-4 pb-2.5 pt-3.5">
          <div className="flex items-center gap-2.5 rounded-[12px] px-3.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)" }}>
            <Icon name="search" size={20} style={{ color: "var(--text-3)" }} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search residents…" className="flex-1 bg-transparent py-3.5 text-[15px] outline-none" style={{ color: "var(--text)" }} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2.5">
          {hits.map((h) => (
            <button key={h.id} type="button" onClick={() => onPick(h.id)} className="flex w-full items-center gap-3.5 rounded-[12px] p-[11px_10px] text-left active:opacity-80">
              <span className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full text-[16px] font-bold text-white" style={{ background: "var(--accent-strong)" }}>
                {h.name[0]?.toUpperCase() ?? "?"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15.5px] font-semibold" style={{ color: "var(--text)" }}>{h.name}</p>
                <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Block {h.block ?? "—"}, {h.flatNumber}</p>
              </div>
            </button>
          ))}
          {q.trim().length >= 1 && hits.length === 0 && (
            <p className="py-6 text-center text-[14px]" style={{ color: "var(--text-3)" }}>No residents found.</p>
          )}
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
