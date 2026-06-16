import { useEffect, useRef, useState, type ReactNode } from "react";
import { apiFetch } from "../lib/api";

export interface CommentMention {
  id: string;
  name: string;
}

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
    if (ch === "\n") return null;
    i--;
  }
  return null;
}

function pruneMentions(text: string, mentions: CommentMention[]): CommentMention[] {
  return mentions.filter((m) => text.includes(`@${m.name}`));
}

/**
 * A textarea with @-mention autocomplete (mobile / OneRMV). Controlled by the
 * parent via onChange(value, mentions). Searches residents through
 * /api/residents/search with the bearer token.
 */
export default function MentionTextarea({
  value,
  mentions,
  onChange,
  token,
  placeholder,
  rows = 3,
  className,
  style,
  autoFocus,
  dropUp,
}: {
  value: string;
  mentions: CommentMention[];
  onChange: (value: string, mentions: CommentMention[]) => void;
  token: string | null;
  placeholder?: string;
  rows?: number;
  className?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
  dropUp?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tok, setTok] = useState<{ start: number; query: string } | null>(null);
  const [hits, setHits] = useState<ResidentHit[]>([]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = tok?.query.trim();
    if (!q) { setHits([]); return; }
    debounce.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/residents/search?q=${encodeURIComponent(q)}`, { token });
        if (res.ok) setHits(((await res.json()).residents ?? []).slice(0, 8));
      } catch {
        setHits([]);
      }
    }, 200);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [tok?.query, token]);

  function recompute(newValue: string) {
    const el = ref.current;
    const caret = el ? el.selectionStart : newValue.length;
    onChange(newValue, pruneMentions(newValue, mentions));
    setTok(activeQuery(newValue, caret));
  }

  function pick(hit: ResidentHit) {
    if (!tok) return;
    const el = ref.current;
    const caret = el ? el.selectionStart : value.length;
    const next = `${value.slice(0, tok.start)}@${hit.name} ${value.slice(caret)}`;
    const nextMentions = mentions.some((m) => m.id === hit.id)
      ? mentions
      : [...mentions, { id: hit.id, name: hit.name }];
    onChange(next, pruneMentions(next, nextMentions));
    setTok(null);
    setHits([]);
    requestAnimationFrame(() => {
      if (el) {
        const pos = tok.start + hit.name.length + 2;
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
        onKeyUp={(e) => setTok(activeQuery(e.currentTarget.value, e.currentTarget.selectionStart))}
        onClick={(e) => setTok(activeQuery(e.currentTarget.value, e.currentTarget.selectionStart))}
        onBlur={() => setTimeout(() => setTok(null), 150)}
        className={className}
        style={style}
      />
      {tok && tok.query.trim().length >= 1 && hits.length > 0 && (
        <div
          className={`absolute left-0 right-0 z-20 max-h-56 overflow-y-auto rounded-[12px] ${dropUp ? "bottom-full mb-1" : "top-full mt-1"}`}
          style={{ background: "var(--surface)", border: "1px solid var(--border-strong)", boxShadow: "0 12px 30px rgba(0,0,0,0.25)" }}
        >
          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(h); }}
              className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left active:opacity-80"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <span className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>{h.name}</span>
              <span className="one-mono text-[11px]" style={{ color: "var(--text-3)" }}>B{h.block ?? "—"} · {h.flatNumber}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Render comment text with @mentions highlighted (accent-colored). */
export function renderWithMentions(content: string, mentions: CommentMention[]): ReactNode {
  if (!mentions || mentions.length === 0) return content;
  const names = [...mentions].map((m) => m.name).sort((a, b) => b.length - a.length);
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`@(?:${escaped.join("|")})`, "g");
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) out.push(content.slice(last, m.index));
    out.push(
      <span key={`m${k++}`} style={{ color: "var(--accent)", fontWeight: 700 }}>{m[0]}</span>
    );
    last = m.index + m[0].length;
  }
  if (last < content.length) out.push(content.slice(last));
  return out;
}
