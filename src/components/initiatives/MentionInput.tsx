"use client";

import { useEffect, useRef, useState } from "react";
import type { CommentMention } from "@/lib/initiatives";

interface ResidentHit {
  id: string;
  name: string;
  block: number | null;
  flatNumber: string;
}

/** Find the active "@query" token immediately before the caret, if any. */
function activeQuery(text: string, caret: number): { start: number; query: string } | null {
  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === "@") {
      const before = i === 0 ? " " : text[i - 1];
      if (i === 0 || /\s/.test(before)) {
        const query = text.slice(i + 1, caret);
        if (query.includes("\n") || query.length > 30) return null;
        return { start: i, query };
      }
      return null;
    }
    if (ch === "\n") return null; // a mention can't span lines
    i--;
  }
  return null;
}

/** Drop mentions whose @name no longer appears in the text. */
function pruneMentions(text: string, mentions: CommentMention[]): CommentMention[] {
  return mentions.filter((m) => text.includes(`@${m.name}`));
}

/**
 * A textarea with @-mention autocomplete. Owns nothing — value + mentions are
 * controlled by the parent via onChange(value, mentions). Searches residents
 * through /api/residents/search (cookie auth on web).
 */
export default function MentionInput({
  value,
  mentions,
  onChange,
  placeholder,
  rows = 3,
  className,
  autoFocus,
}: {
  value: string;
  mentions: CommentMention[];
  onChange: (value: string, mentions: CommentMention[]) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [token, setToken] = useState<{ start: number; query: string } | null>(null);
  const [hits, setHits] = useState<ResidentHit[]>([]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = token?.query.trim();
    if (!q) { setHits([]); return; }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/residents/search?q=${encodeURIComponent(q)}`);
        if (res.ok) setHits(((await res.json()).residents ?? []).slice(0, 8));
      } catch {
        setHits([]);
      }
    }, 200);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [token?.query]);

  function recompute(newValue: string) {
    const el = ref.current;
    const caret = el ? el.selectionStart : newValue.length;
    onChange(newValue, pruneMentions(newValue, mentions));
    setToken(activeQuery(newValue, caret));
  }

  function pick(hit: ResidentHit) {
    if (!token) return;
    const el = ref.current;
    const caret = el ? el.selectionStart : value.length;
    const next = `${value.slice(0, token.start)}@${hit.name} ${value.slice(caret)}`;
    const nextMentions = mentions.some((m) => m.id === hit.id)
      ? mentions
      : [...mentions, { id: hit.id, name: hit.name }];
    onChange(next, pruneMentions(next, nextMentions));
    setToken(null);
    setHits([]);
    // restore focus + caret just after the inserted mention
    requestAnimationFrame(() => {
      if (el) {
        const pos = token.start + hit.name.length + 2;
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        rows={rows}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => recompute(e.target.value)}
        onKeyUp={(e) => setToken(activeQuery(e.currentTarget.value, e.currentTarget.selectionStart))}
        onClick={(e) => setToken(activeQuery(e.currentTarget.value, e.currentTarget.selectionStart))}
        onBlur={() => setTimeout(() => setToken(null), 150)}
        className={className}
      />
      {token && token.query.trim().length >= 1 && hits.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(h); }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{h.name}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">B{h.block ?? "—"} · {h.flatNumber}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Render comment text with @mentions highlighted (accent-colored). */
export function renderWithMentions(content: string, mentions: CommentMention[]): React.ReactNode {
  if (!mentions || mentions.length === 0) return content;
  // Build a regex matching any @Name (longest names first to avoid partial overlap).
  const names = [...mentions].map((m) => m.name).sort((a, b) => b.length - a.length);
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`@(?:${escaped.join("|")})`, "g");
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) out.push(content.slice(last, m.index));
    out.push(
      <span key={`m${k++}`} className="font-semibold text-blue-600 dark:text-blue-400">
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < content.length) out.push(content.slice(last));
  return out;
}
