import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Trash2, Loader2 } from "lucide-react";
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

  if (loading) return <Centered><Loader2 size={22} className="animate-spin text-slate-500" /></Centered>;
  if (error || !data) return (
    <Centered>
      <div className="text-center">
        <p className="mb-3 text-red-400">{error ?? "Not found"}</p>
        <button onClick={() => navigate("/messages")} className="text-sm text-blue-400">← Messages</button>
      </div>
    </Centered>
  );

  const myLast = [...data.messages].reverse().find((m) => m.fromMe);
  const seen = myLast && data.otherLastReadAt && new Date(data.otherLastReadAt).getTime() >= new Date(myLast.createdAt).getTime();

  return (
    <div className="flex flex-1 flex-col pt-[env(safe-area-inset-top,0px)]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3">
        <button onClick={() => navigate("/messages")} className="text-slate-400"><ArrowLeft size={20} /></button>
        <Avatar name={data.other.name} imageUrl={data.other.googleImage} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{data.other.name}</p>
          <p className="text-xs text-slate-500">Block {data.other.block ?? "—"}, {data.other.flatNumber}</p>
        </div>
        <button onClick={hideConversation} className="text-slate-500"><Trash2 size={18} /></button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        <div className="space-y-2">
          {data.messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No messages yet. Say hello 👋</p>
          ) : (
            data.messages.map((m, i) => {
              const showDay = i === 0 || !sameDay(data.messages[i - 1].createdAt, m.createdAt);
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="my-3 text-center">
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-500">{dayLabel(m.createdAt)}</span>
                    </div>
                  )}
                  <div className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${m.fromMe ? "rounded-br-sm bg-indigo-600 text-white" : "rounded-bl-sm border border-slate-700 bg-slate-800 text-slate-100"}`}>
                      <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                      <p className={`mt-0.5 text-right text-[10px] ${m.fromMe ? "text-indigo-200" : "text-slate-500"}`}>{fmtTime(m.createdAt)}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {seen && <p className="pr-1 text-right text-[11px] text-slate-500">Seen</p>}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="flex items-end gap-2 border-t border-slate-800 bg-slate-900 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom,0px))]">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          rows={1}
          className="max-h-32 flex-1 resize-none rounded-2xl bg-slate-800 px-4 py-2.5 text-sm text-slate-100 focus:outline-none"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white active:bg-indigo-700 disabled:opacity-40"
        >
          <Send size={17} />
        </button>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 items-center justify-center px-4">{children}</div>;
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
