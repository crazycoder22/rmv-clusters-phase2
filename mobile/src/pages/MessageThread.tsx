import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { Avatar } from "./Community";

interface Message {
  id: string;
  body: string;
  createdAt: string;
  fromMe: boolean;
}
interface ThreadData {
  id: string;
  other: { id: string; name: string; block: number | null; flatNumber: string; googleImage: string | null };
  otherLastReadAt: string | null;
  messages: Message[];
  hasMore: boolean;
}

export default function MessageThread() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id = "" } = useParams();

  const [data, setData] = useState<ThreadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const refresh = useCallback(async (silent = false) => {
    try {
      const res = await apiFetch(`/api/messages/${id}`, { token });
      if (!res.ok) { if (!silent) setError(res.status === 404 ? "Conversation not found" : "Could not load"); return; }
      setData(await res.json());
      setError(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    if (!id) return;
    void refresh();
    const interval = setInterval(() => void refresh(true), 3000);
    return () => clearInterval(interval);
  }, [id, refresh]);

  useEffect(() => {
    if (atBottomRef.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setText("");
    try {
      const res = await apiFetch(`/api/messages/${id}/messages`, { method: "POST", token, body: JSON.stringify({ body }) });
      if (res.ok) { atBottomRef.current = true; await refresh(true); }
      else setText(body);
    } finally {
      setSending(false);
    }
  }

  async function hideConversation() {
    if (!confirm("Remove this conversation from your list? It stays for the other person.")) return;
    const res = await apiFetch(`/api/messages/${id}`, { method: "DELETE", token });
    if (res.ok) navigate("/messages");
  }

  if (loading) {
    return <div className="flex flex-1 items-center justify-center" style={{ background: "var(--bg)" }}><Loader2 size={22} className="animate-spin" style={{ color: "var(--text-3)" }} /></div>;
  }
  if (error || !data) {
    return (
      <div className="flex flex-1 items-center justify-center px-4" style={{ background: "var(--bg)" }}>
        <div className="text-center">
          <p className="mb-3" style={{ color: "var(--danger)" }}>{error ?? "Not found"}</p>
          <button onClick={() => navigate("/messages")} className="text-[14px]" style={{ color: "var(--accent)" }}>← Messages</button>
        </div>
      </div>
    );
  }

  const myLast = [...data.messages].reverse().find((m) => m.fromMe);
  const seen = myLast && data.otherLastReadAt && new Date(data.otherLastReadAt).getTime() >= new Date(myLast.createdAt).getTime();

  return (
    <div className="one-surface flex flex-1 flex-col pt-[env(safe-area-inset-top,0px)]" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <button onClick={() => navigate("/messages")} className="flex active:opacity-70" aria-label="Back"><Icon name="arrow_back" size={23} style={{ color: "var(--text-2)" }} /></button>
        <Avatar name={data.other.name} imageUrl={data.other.googleImage} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold" style={{ color: "var(--text)" }}>{data.other.name}</p>
          <p className="text-[11.5px]" style={{ color: "var(--text-3)" }}>Block {data.other.block ?? "—"}, {data.other.flatNumber} · Resident</p>
        </div>
        <button onClick={hideConversation} className="flex active:opacity-70" aria-label="Remove conversation"><Icon name="delete" size={21} style={{ color: "var(--text-2)" }} /></button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        <div className="flex flex-col gap-2">
          {data.messages.length === 0 ? (
            <p className="py-10 text-center text-[14px]" style={{ color: "var(--text-3)" }}>No messages yet. Say hello 👋</p>
          ) : (
            data.messages.map((m, i) => {
              const showDay = i === 0 || !sameDay(data.messages[i - 1].createdAt, m.createdAt);
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="my-2 flex justify-center">
                      <span className="rounded-full px-3 py-1 text-[11.5px] font-semibold" style={{ background: "var(--surface-2)", color: "var(--text-3)" }}>{dayLabel(m.createdAt)}</span>
                    </div>
                  )}
                  <div className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className="max-w-[78%] px-3.5 py-2"
                      style={m.fromMe
                        ? { background: "var(--accent-strong)", color: "#fff", borderRadius: "17px 17px 5px 17px" }
                        : { background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "17px 17px 17px 5px" }}
                    >
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{m.body}</p>
                      <p className="mt-0.5 text-right text-[10.5px]" style={{ color: m.fromMe ? "rgba(255,255,255,0.72)" : "var(--text-3)" }}>{fmtTime(m.createdAt)}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {seen && <p className="pr-1 text-right text-[11px]" style={{ color: "var(--text-3)" }}>Seen</p>}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 pb-[max(0.875rem,env(safe-area-inset-bottom,0px))]" style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="flex flex-1 items-center rounded-full px-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
            }}
            placeholder="Type a message…"
            rows={1}
            className="max-h-32 flex-1 resize-none bg-transparent py-3 text-[14.5px] outline-none"
            style={{ color: "var(--text)" }}
          />
        </div>
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full active:opacity-90 disabled:opacity-50"
          style={{ background: "var(--accent-strong)" }}
          aria-label="Send"
        >
          {sending ? <Loader2 size={17} className="animate-spin text-white" /> : <Icon name="near_me" size={21} fill style={{ color: "#fff" }} />}
        </button>
      </div>
    </div>
  );
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}
function sameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}
function dayLabel(iso: string): string {
  const d = new Date(iso); const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
