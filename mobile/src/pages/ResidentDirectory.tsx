import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type ResidentHit = {
  id: string;
  name: string;
  block: number | null;
  flatNumber: string;
  googleImage: string | null;
};
type RosterResident = {
  id: string;
  name: string;
  flatNumber: string;
  residentType: string;
  googleImage: string | null;
};
type BlockInfo = { block: number; count: number };
type Mode = "search" | "buildings" | "residents";

// Owner-ish roles get the accent tag; tenant-ish stay neutral. Message-only —
// no phone numbers or vehicles are ever shown here.
function roleTag(t: string): { label: string; owner: boolean } {
  if (t === "OWNER") return { label: "OWNER", owner: true };
  if (t === "OWNER_FAMILY") return { label: "OWNER FAMILY", owner: true };
  if (t === "TENANT_FAMILY") return { label: "TENANT FAMILY", owner: false };
  if (t === "MULTI_TENANT") return { label: "MULTI-TENANT", owner: false };
  return { label: "TENANT", owner: false };
}

export default function ResidentDirectory() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("search");

  // Search
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ResidentHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Browse
  const [blocks, setBlocks] = useState<BlockInfo[]>([]);
  const [blocksLoaded, setBlocksLoaded] = useState(false);
  const [activeBlock, setActiveBlock] = useState<number | null>(null);
  const [roster, setRoster] = useState<RosterResident[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const term = q.trim();
    if (term.length < 1) {
      setResults([]);
      setSearched(false);
      return;
    }
    if (!token) return;
    debounce.current = setTimeout(() => {
      setSearching(true);
      apiFetch(`/api/residents/search?q=${encodeURIComponent(term)}`, { token })
        .then((r) => (r.ok ? r.json() : { residents: [] }))
        .then((data) => {
          const hits: ResidentHit[] = (data.residents ?? []).filter(
            (h: ResidentHit) => h.id !== user?.id
          );
          setResults(hits);
          setSearched(true);
        })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q, token, user?.id]);

  const loadBlocks = useCallback(async () => {
    if (!token || blocksLoaded) return;
    try {
      const r = await apiFetch("/api/residents/roster", { token });
      if (r.ok) setBlocks((await r.json()).blocks ?? []);
    } finally {
      setBlocksLoaded(true);
    }
  }, [token, blocksLoaded]);

  function goBrowse() {
    setMode("buildings");
    void loadBlocks();
  }

  async function openBlock(block: number) {
    setActiveBlock(block);
    setMode("residents");
    setRosterLoading(true);
    setRoster([]);
    try {
      const r = await apiFetch(`/api/residents/roster?block=${block}`, { token });
      if (r.ok) setRoster((await r.json()).residents ?? []);
    } finally {
      setRosterLoading(false);
    }
  }

  async function message(residentId: string) {
    if (!token || startingId) return;
    setStartingId(residentId);
    try {
      const res = await apiFetch("/api/messages", {
        method: "POST",
        token,
        body: JSON.stringify({ residentId }),
      });
      if (res.ok) {
        const { id } = await res.json();
        navigate(`/messages/${id}`);
      } else {
        window.alert("Couldn't start the chat. Please try again.");
      }
    } catch {
      window.alert("Couldn't start the chat. Check your connection.");
    } finally {
      setStartingId(null);
    }
  }

  // Group roster by flat for the building view.
  const byFlat = roster.reduce<Record<string, RosterResident[]>>((acc, r) => {
    (acc[r.flatNumber] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-6"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="flex items-center gap-3 py-3">
        {mode === "residents" ? (
          <button onClick={goBrowse} className="flex" aria-label="Back to blocks" style={{ color: "var(--text-2)" }}>
            <Icon name="arrow_back" size={22} style={{ color: "var(--text-2)" }} />
          </button>
        ) : (
          <Link to="/community" className="flex" aria-label="Back" style={{ color: "var(--text-2)" }}>
            <Icon name="arrow_back" size={22} style={{ color: "var(--text-2)" }} />
          </Link>
        )}
        <h1 className="flex-1 text-[21px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>
          {mode === "residents" ? `Block ${activeBlock}` : "Resident Directory"}
        </h1>
      </header>

      {/* Mode toggle (hidden inside a building) */}
      {mode !== "residents" && (
        <div
          className="mb-3 flex rounded-[13px] p-1"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <ModeBtn active={mode === "search"} ms="search" onClick={() => setMode("search")}>Search</ModeBtn>
          <ModeBtn active={mode === "buildings"} ms="apartment" onClick={goBrowse}>Browse</ModeBtn>
        </div>
      )}

      {/* ===== SEARCH ===== */}
      {mode === "search" && (
        <>
          <div
            className="mb-3 flex items-center gap-2.5 rounded-[13px] px-3.5"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)" }}
          >
            <Icon name="search" size={20} style={{ color: "var(--text-3)" }} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or flat number…"
              className="flex-1 bg-transparent py-3 text-[15px] outline-none"
              style={{ color: "var(--text)" }}
            />
            {searching && <Loader2 size={15} className="animate-spin" style={{ color: "var(--text-3)" }} />}
          </div>

          {q.trim().length === 0 ? (
            <div
              className="flex flex-col items-center gap-3.5 rounded-[18px] px-6 py-10 text-center"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <Icon name="group" size={40} style={{ color: "var(--text-3)" }} />
              <p className="text-[14px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                Search for a neighbour by name or flat number, then message them directly.
              </p>
            </div>
          ) : searched && results.length === 0 && !searching ? (
            <p className="rounded-[18px] px-4 py-9 text-center text-[14px]" style={{ border: "1px solid var(--border)", color: "var(--text-3)" }}>
              No residents match that search.
            </p>
          ) : (
            <div className="overflow-hidden rounded-[16px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              {results.map((h, i) => (
                <PersonRow
                  key={h.id}
                  name={h.name}
                  imageUrl={h.googleImage}
                  sub={`Block ${h.block ?? "—"} · Flat ${h.flatNumber}`}
                  last={i === results.length - 1}
                  starting={startingId === h.id}
                  onMessage={() => void message(h.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== BROWSE: BUILDINGS ===== */}
      {mode === "buildings" && (
        <div className="flex-1">
          <Eyebrow>Blocks</Eyebrow>
          {!blocksLoaded ? (
            <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin" style={{ color: "var(--text-3)" }} /></div>
          ) : blocks.length === 0 ? (
            <p className="rounded-[18px] px-4 py-9 text-center text-[14px]" style={{ border: "1px solid var(--border)", color: "var(--text-3)" }}>No blocks found.</p>
          ) : (
            <div className="overflow-hidden rounded-[16px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              {blocks.map((b, i) => (
                <button
                  key={b.block}
                  onClick={() => void openBlock(b.block)}
                  className="flex w-full items-center gap-3.5 px-3.5 py-4 text-left active:opacity-80"
                  style={i < blocks.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}
                >
                  <span className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px]" style={{ background: "var(--accent-soft)" }}>
                    <Icon name="apartment" size={21} style={{ color: "var(--accent)" }} />
                  </span>
                  <span className="flex-1 text-[16px] font-bold" style={{ color: "var(--text)" }}>Block {b.block}</span>
                  <span className="text-[12px]" style={{ color: "var(--text-3)" }}>{b.count}</span>
                  <Icon name="chevron_right" size={22} style={{ color: "var(--text-3)" }} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== BROWSE: RESIDENTS OF BUILDING ===== */}
      {mode === "residents" && (
        <div className="flex-1">
          {rosterLoading ? (
            <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin" style={{ color: "var(--text-3)" }} /></div>
          ) : roster.length === 0 ? (
            <p className="rounded-[18px] px-4 py-9 text-center text-[14px]" style={{ border: "1px solid var(--border)", color: "var(--text-3)" }}>No residents in this block yet.</p>
          ) : (
            <div className="flex flex-col">
              {Object.entries(byFlat).map(([flat, people]) => (
                <div key={flat}>
                  <div
                    className="one-mono py-2 text-[12px] font-semibold"
                    style={{ color: "var(--text-2)", borderBottom: "1px solid var(--border)" }}
                  >
                    {activeBlock} · {flat}
                  </div>
                  {people.map((p) => {
                    const tag = roleTag(p.residentType);
                    return (
                      <PersonRow
                        key={p.id}
                        name={p.name}
                        imageUrl={p.googleImage}
                        eyebrow={tag.label}
                        eyebrowOwner={tag.owner}
                        starting={startingId === p.id}
                        onMessage={p.id === user?.id ? undefined : () => void message(p.id)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModeBtn({ active, ms, onClick, children }: { active: boolean; ms: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[14px] font-bold"
      style={active
        ? { background: "var(--surface-3)", color: "var(--text)", boxShadow: "0 1px 5px rgba(0,0,0,0.18)" }
        : { background: "transparent", color: "var(--text-3)" }}
    >
      <Icon name={ms} size={18} style={{ color: active ? "var(--text)" : "var(--text-3)" }} />
      {children}
    </button>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="one-mono mb-2.5 text-[10px] font-medium uppercase" style={{ color: "var(--text-3)", letterSpacing: "0.14em" }}>
      {children}
    </div>
  );
}

// One person row — accent-soft avatar + name (+ optional role eyebrow / sub) +
// a Message button. `last` controls the divider in card lists. Self has no button.
function PersonRow({
  name,
  imageUrl,
  sub,
  eyebrow,
  eyebrowOwner,
  last,
  starting,
  onMessage,
}: {
  name: string;
  imageUrl: string | null;
  sub?: string;
  eyebrow?: string;
  eyebrowOwner?: boolean;
  last?: boolean;
  starting?: boolean;
  onMessage?: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-3.5 py-3"
      style={last === false ? { borderBottom: "1px solid var(--border)" } : undefined}
    >
      <DirAvatar name={name} imageUrl={imageUrl} />
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <div className="one-mono text-[10px] font-semibold uppercase" style={{ color: eyebrowOwner ? "var(--accent)" : "var(--text-3)", letterSpacing: "0.08em" }}>
            {eyebrow}
          </div>
        )}
        <p className="truncate text-[15px] font-bold" style={{ color: "var(--text)" }}>{name}</p>
        {sub && <p className="text-[12px]" style={{ color: "var(--text-3)" }}>{sub}</p>}
      </div>
      {onMessage && (
        <button
          onClick={onMessage}
          disabled={starting}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-[11px] px-3 py-2 text-[12px] font-bold text-white active:opacity-90 disabled:opacity-60"
          style={{ background: "var(--accent-strong)" }}
        >
          {starting ? <Loader2 size={14} className="animate-spin" /> : <Icon name="chat" size={14} style={{ color: "#fff" }} />}
          Message
        </button>
      )}
    </div>
  );
}

function DirAvatar({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  if (imageUrl) {
    return <img src={imageUrl} alt="" className="h-10 w-10 flex-shrink-0 rounded-full object-cover" style={{ border: "1px solid var(--border)" }} />;
  }
  return (
    <div
      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold"
      style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
    >
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}
