"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Trash2 } from "lucide-react";
import { Avatar } from "../page";

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

export default function MessageThreadPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [data, setData] = useState<ThreadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const refresh = useCallback(async (silent = false) => {
    try {
      const res = await fetch(`/api/messages/${id}`);
      if (!res.ok) { if (!silent) setError(res.status === 404 ? "Conversation not found" : "Could not load"); return; }
      setData(await res.json());
      setError(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  // initial load + 3s poll
  useEffect(() => {
    if (!id) return;
    void refresh();
    const interval = setInterval(() => void refresh(true), 3000);
    return () => clearInterval(interval);
  }, [id, refresh]);

  // auto-scroll to bottom when new messages arrive (if user is near bottom)
  useEffect(() => {
    if (atBottomRef.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setText("");
    try {
      const res = await fetch(`/api/messages/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (res.ok) {
        atBottomRef.current = true;
        await refresh(true);
      } else {
        setText(body); // restore on failure
        alert((await res.json().catch(() => null))?.error ?? "Could not send");
      }
    } finally {
      setSending(false);
    }
  }

  async function hideConversation() {
    if (!confirm("Remove this conversation from your list? It stays for the other person.")) return;
    const res = await fetch(`/api/messages/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/messages");
  }

  if (loading) return <Centered><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></Centered>;
  if (error || !data) return <Centered><div className="text-center"><p className="text-red-600 mb-3">{error ?? "Not found"}</p><Link href="/messages" className="text-blue-600 text-sm">← Messages</Link></div></Centered>;

  // "Seen": my last message's createdAt <= other's lastReadAt
  const myLast = [...data.messages].reverse().find((m) => m.fromMe);
  const seen = myLast && data.otherLastReadAt && new Date(data.otherLastReadAt).getTime() >= new Date(myLast.createdAt).getTime();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/messages" className="text-gray-500 dark:text-gray-400 hover:text-gray-900"><ArrowLeft size={20} /></Link>
          <Avatar name={data.other.name} image={data.other.googleImage} size={36} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{data.other.name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Block {data.other.block ?? "—"}, {data.other.flatNumber}</p>
          </div>
          <button type="button" onClick={hideConversation} className="text-gray-400 dark:text-gray-500 hover:text-red-600" title="Remove conversation"><Trash2 size={18} /></button>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-2">
          {data.messages.length === 0 ? (
            <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-10">No messages yet. Say hello 👋</p>
          ) : (
            data.messages.map((m, i) => {
              const showDay = i === 0 || !sameDay(data.messages[i - 1].createdAt, m.createdAt);
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="text-center my-3">
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5">{dayLabel(m.createdAt)}</span>
                    </div>
                  )}
                  <div className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 ${m.fromMe ? "bg-blue-600 text-white rounded-br-sm" : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-sm"}`}>
                      <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`text-[10px] mt-0.5 text-right ${m.fromMe ? "text-blue-100" : "text-gray-400 dark:text-gray-500"}`}>{fmtTime(m.createdAt)}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {seen && <p className="text-[11px] text-gray-400 dark:text-gray-500 text-right pr-1">Seen</p>}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-2xl mx-auto px-3 py-2.5 flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder="Type a message…"
            rows={1}
            className="flex-1 resize-none max-h-32 bg-gray-100 dark:bg-gray-900 dark:text-gray-100 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={send}
            disabled={sending || !text.trim()}
            className="shrink-0 h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40"
          >
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">{children}</div>;
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
