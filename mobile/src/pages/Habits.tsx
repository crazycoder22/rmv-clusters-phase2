import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

// ── Types ──────────────────────────────────────────────────────────────────

interface OwnedHabit {
  id: string;
  role: "owner";
  title: string;
  emoji: string | null;
  targetMinutes: number | null;
  startDate: string;
  endDate: string;
  active: boolean;
  todayDone: boolean;
  currentStreak: number;
  longestStreak: number;
  totalDone: number;
  completionPct: number;
  partner: { id: string; name: string; status: string } | null;
}

interface PartnerHabit {
  id: string;
  role: "partner";
  title: string;
  emoji: string | null;
  startDate: string;
  endDate: string;
  active: boolean;
  todayDone: boolean;
  currentStreak: number;
  longestStreak: number;
  completionPct: number;
  owner: { name: string; block: number; flatNumber: string };
  canNudge: boolean;
  nextNudgeAt: string | null;
}

interface Invite {
  id: string;
  title: string;
  emoji: string | null;
  ownerName: string;
  ownerBlock: number;
  ownerFlat: string;
}

interface ResidentHit {
  id: string;
  name: string;
  block: number | null;
  flatNumber: string;
}

const EMOJIS = ["🧘", "📖", "🏃", "💪", "🧉", "🥗", "💧", "😴", "🪥", "📝", "🎯", "🧹", "🌱", "🙏", "🚴", "🎵"];

// ── Page ───────────────────────────────────────────────────────────────────

export default function Habits() {
  const { token } = useAuth();

  const [owned, setOwned] = useState<OwnedHabit[]>([]);
  const [partnering, setPartnering] = useState<PartnerHabit[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/habits", { token });
      if (!res.ok) {
        setError(res.status === 401 ? "Sign in required" : "Could not load");
        return;
      }
      const data = await res.json();
      setOwned(data.owned ?? []);
      setPartnering(data.partnering ?? []);
      setInvites(data.invites ?? []);
      setError(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function respondInvite(inviteId: string, action: "accept" | "decline") {
    setBusyId(inviteId);
    try {
      const res = await apiFetch(`/api/habits/${inviteId}/partner-response`, {
        method: "POST",
        token,
        body: JSON.stringify({ action }),
      });
      if (res.ok) await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function nudge(h: PartnerHabit) {
    setBusyId(h.id);
    try {
      const res = await apiFetch(`/api/habits/${h.id}/nudge`, { method: "POST", token });
      if (res.ok || res.status === 429) {
        setPartnering((prev) => prev.map((x) => (x.id === h.id ? { ...x, canNudge: false } : x)));
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <header className="flex items-start gap-3.5 py-3">
        <Link to="/community" className="mt-0.5 flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={24} style={{ color: "var(--text)" }} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight" style={{ color: "var(--text)" }}>Habits</h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-3)" }}>Build a routine, stay accountable</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-bold"
          style={showNew
            ? { background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }
            : { background: "var(--accent-strong)", color: "var(--on-accent)", boxShadow: "0 6px 16px var(--accent-soft)" }}
        >
          <Icon name={showNew ? "close" : "add"} size={18} weight={600} style={{ color: showNew ? "var(--text)" : "#fff" }} />
          {showNew ? "Close" : "New"}
        </button>
      </header>

      {showNew && (
        <NewHabitForm
          token={token}
          onCreated={async () => {
            setShowNew(false);
            await refresh();
          }}
        />
      )}

      {error && (
        <p className="mb-3 rounded-[12px] px-4 py-2.5 text-[13px]" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>{error}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin" style={{ color: "var(--text-3)" }} /></div>
      ) : (
        <div className="flex-1 space-y-5">
          {/* Pending invites */}
          {invites.length > 0 && (
            <section>
              <h2 className="one-mono mb-2.5 inline-flex items-center gap-1.5 text-[11px]" style={{ color: "var(--warning)", letterSpacing: "0.12em" }}>
                <Icon name="notifications" size={13} style={{ color: "var(--warning)" }} /> PARTNER INVITES
              </h2>
              <ul className="space-y-2.5">
                {invites.map((inv) => (
                  <li key={inv.id} className="rounded-[16px] p-3.5" style={{ background: "var(--warning-soft)", border: "1px solid color-mix(in srgb, var(--warning) 40%, transparent)" }}>
                    <p className="text-[14px] leading-snug" style={{ color: "var(--text)" }}>
                      <span className="font-bold">{inv.ownerName}</span> (B{inv.ownerBlock} · {inv.ownerFlat}) wants you as their partner for{" "}
                      <span className="font-bold">{inv.emoji ? `${inv.emoji} ` : ""}{inv.title}</span>
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <button type="button" onClick={() => respondInvite(inv.id, "accept")} disabled={busyId === inv.id} className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-[13px] font-bold text-white disabled:opacity-50" style={{ background: "var(--success)" }}>
                        {busyId === inv.id ? <Loader2 size={12} className="animate-spin" /> : <Icon name="check" size={14} style={{ color: "#fff" }} />} Accept
                      </button>
                      <button type="button" onClick={() => respondInvite(inv.id, "decline")} disabled={busyId === inv.id} className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-[13px] font-bold disabled:opacity-50" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-2)" }}>
                        <Icon name="close" size={14} style={{ color: "var(--text-2)" }} /> Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* My habits */}
          <section>
            <h2 className="one-mono mb-3 text-[11px]" style={{ color: "var(--text-3)", letterSpacing: "0.14em" }}>MY HABITS</h2>
            {owned.length === 0 ? (
              <div className="flex flex-col items-center gap-3.5 rounded-[18px] px-6 py-10 text-center" style={{ border: "1.5px dashed var(--border-strong)" }}>
                <Icon name="target" size={40} style={{ color: "var(--text-3)" }} />
                <p className="text-[15px]" style={{ color: "var(--text-3)" }}>No habits yet. Tap <span className="font-bold" style={{ color: "var(--accent)" }}>New</span> to start one.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {owned.map((h) => (
                  <li key={h.id}>
                    <Link to={`/habits/${h.id}`} className="flex items-center gap-3.5 rounded-[18px] px-4 py-3.5 active:opacity-90" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
                      <div
                        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
                        style={{ background: `conic-gradient(var(--accent) ${h.completionPct * 3.6}deg, var(--surface-3) 0)` }}
                      >
                        <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-[18px]" style={{ background: "var(--surface)" }}>
                          {h.emoji || "🎯"}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[17px] font-bold" style={{ color: "var(--text)" }}>{h.title}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[13px]">
                          <span className="inline-flex items-center gap-1 font-bold" style={{ color: "var(--flame)" }}>
                            <Icon name="local_fire_department" size={16} style={{ color: "var(--flame)" }} />{h.currentStreak}d streak
                          </span>
                          <span style={{ color: "var(--text-3)" }}>·</span>
                          <span className="font-semibold" style={{ color: "var(--text-2)" }}>{h.completionPct}%</span>
                          {h.partner && (
                            <>
                              <span style={{ color: "var(--text-3)" }}>·</span>
                              <span className="inline-flex items-center gap-1" style={{ color: "var(--text-2)" }}>
                                <Icon name="group_add" size={15} style={{ color: "var(--accent)" }} />
                                {h.partner.status === "accepted" ? h.partner.name : h.partner.status === "pending" ? "invite sent" : "no partner"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <Icon name="chevron_right" size={22} style={{ color: "var(--text-3)" }} className="flex-shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Habits I'm partnering */}
          {partnering.length > 0 && (
            <section>
              <h2 className="one-mono mb-3 text-[11px]" style={{ color: "var(--text-3)", letterSpacing: "0.14em" }}>KEEPING ACCOUNTABLE</h2>
              <ul className="space-y-3">
                {partnering.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 rounded-[16px] p-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[18px]" style={{ background: h.todayDone ? "var(--success-soft)" : "var(--surface-2)" }}>
                      {h.emoji ?? "🎯"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold" style={{ color: "var(--text)" }}>{h.title}</p>
                      <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-3)" }}>
                        {h.owner.name} · <span style={{ color: "var(--flame)" }}>{h.currentStreak}d</span> ·{" "}
                        <span style={{ color: h.todayDone ? "var(--success)" : "var(--text-3)" }}>{h.todayDone ? "done today" : "not yet today"}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => nudge(h)}
                      disabled={busyId === h.id || !h.canNudge}
                      className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold"
                      style={h.canNudge ? { background: "var(--accent-strong)", color: "#fff" } : { background: "var(--surface-2)", color: "var(--text-3)" }}
                    >
                      {busyId === h.id ? <Loader2 size={11} className="animate-spin" /> : <Icon name="notifications" size={13} style={{ color: h.canNudge ? "#fff" : "var(--text-3)" }} />}
                      {h.canNudge ? "Nudge" : "Sent"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ── New habit form ──────────────────────────────────────────────────────────

function NewHabitForm({
  token,
  onCreated,
}: {
  token: string | null;
  onCreated: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [targetMinutes, setTargetMinutes] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(addDays(todayIso(), 30));
  const [partner, setPartner] = useState<ResidentHit | null>(null);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<ResidentHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (partner) {
      setHits([]);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    const q = search.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/residents/search?q=${encodeURIComponent(q)}`, { token });
        if (res.ok) {
          const data = await res.json();
          setHits((data.residents ?? []).slice(0, 12));
        }
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [search, partner, token]);

  async function submit() {
    setErr(null);
    if (!title.trim()) {
      setErr("Give your habit a name");
      return;
    }
    if (endDate < startDate) {
      setErr("End date must be after start date");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch("/api/habits", {
        method: "POST",
        token,
        body: JSON.stringify({
          title: title.trim(),
          emoji: emoji.trim() || null,
          targetMinutes: targetMinutes ? parseInt(targetMinutes, 10) : null,
          startDate,
          endDate,
          partnerResidentId: partner?.id ?? null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErr(data?.error ?? "Could not create");
        return;
      }
      await onCreated();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  const canCreate = title.trim().length > 0;
  const mono = "one-mono text-[11px]";
  const monoStyle = { color: "var(--text-3)", letterSpacing: "0.12em" } as const;
  const field = "one-input mt-2 w-full rounded-[13px] px-3.5 py-3.5 text-[16px]";
  const dateField = "mt-2 w-full min-w-0 appearance-none rounded-[13px] px-3.5 py-3.5 text-[14px] outline-none";
  const dateStyle = { background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" } as const;

  return (
    <div className="mb-4 rounded-[20px] p-[18px]" style={{ background: "var(--surface)", border: "1px solid color-mix(in srgb, var(--accent) 45%, var(--border))", boxShadow: "var(--shadow)" }}>
      {/* Emoji */}
      <p className={mono} style={monoStyle}>EMOJI</p>
      <button type="button" onClick={() => setEmojiOpen((v) => !v)} className="mt-2 flex h-14 w-full items-center justify-center rounded-[13px] text-[28px]" style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)" }}>
        {emoji}
      </button>
      {emojiOpen && (
        <div className="mt-2 flex flex-wrap gap-1.5 rounded-[13px] p-2.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          {EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => { setEmoji(e); setEmojiOpen(false); }} className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] text-[21px]" style={{ background: e === emoji ? "var(--accent-soft)" : "transparent" }}>
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Habit */}
      <p className={`${mono} mt-[18px]`} style={monoStyle}>HABIT</p>
      <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Read everyday 10 pages" />

      {/* Dates */}
      <div className="mt-[18px] flex gap-3">
        <div className="min-w-0 flex-1">
          <p className={mono} style={monoStyle}>START</p>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={dateField} style={dateStyle} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={mono} style={monoStyle}>END</p>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={dateField} style={dateStyle} />
        </div>
      </div>

      {/* Mins */}
      <p className={`${mono} mt-[18px]`} style={monoStyle}>MINS/DAY</p>
      <input className={field} type="number" inputMode="numeric" value={targetMinutes} onChange={(e) => setTargetMinutes(e.target.value)} placeholder="30" />

      {/* Partner */}
      <p className={`${mono} mt-[18px]`} style={monoStyle}>ACCOUNTABILITY PARTNER (OPTIONAL)</p>
      {partner ? (
        <div className="mt-2 flex items-center gap-2 rounded-[13px] px-3.5 py-3" style={{ background: "var(--success-soft)", border: "1px solid color-mix(in srgb, var(--success) 45%, transparent)" }}>
          <span className="text-[16px] font-bold" style={{ color: "var(--text)" }}>{partner.name}</span>
          <span className="text-[14px]" style={{ color: "var(--text-3)" }}>B{partner.block ?? "—"} · {partner.flatNumber}</span>
          <div className="flex-1" />
          <button type="button" onClick={() => { setPartner(null); setSearch(""); setShowSearch(false); }} aria-label="Clear partner">
            <Icon name="close" size={20} style={{ color: "var(--text-3)" }} />
          </button>
        </div>
      ) : showSearch ? (
        <>
          <div className="mt-2 flex items-center gap-2 rounded-[13px] px-3.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)" }}>
            <Icon name="search" size={18} style={{ color: "var(--text-3)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a resident to invite…" autoFocus className="flex-1 bg-transparent py-3 text-[15px] outline-none" style={{ color: "var(--text)" }} />
            {searching && <Loader2 size={13} className="animate-spin" style={{ color: "var(--text-3)" }} />}
          </div>
          {hits.length > 0 && (
            <ul className="mt-1.5 max-h-48 space-y-1 overflow-y-auto rounded-[13px] p-1" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button type="button" onClick={() => setPartner(hit)} className="flex w-full items-center justify-between gap-2 rounded-[10px] px-2.5 py-2 text-left active:opacity-80">
                    <span className="flex items-center gap-1.5 text-[14px]" style={{ color: "var(--text)" }}>
                      <Icon name="person_add" size={14} style={{ color: "var(--accent)" }} />{hit.name}
                    </span>
                    <span className="one-mono text-[11px]" style={{ color: "var(--text-3)" }}>B{hit.block ?? "—"} · {hit.flatNumber}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <button type="button" onClick={() => setShowSearch(true)} className="mt-2 flex w-full items-center gap-2.5 rounded-[13px] px-3.5 py-3 text-[15px] font-semibold" style={{ background: "var(--surface-2)", border: "1px dashed var(--border-strong)", color: "var(--text-2)" }}>
          <Icon name="person_add" size={20} style={{ color: "var(--accent)" }} /> Add a neighbour
        </button>
      )}
      <p className="mt-2.5 text-[12.5px] leading-relaxed" style={{ color: "var(--text-3)" }}>They'll get a request and can see your progress once they accept.</p>

      {err && <p className="mt-3 rounded-[10px] px-3 py-2 text-[12px]" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>{err}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !canCreate}
        className="mt-[18px] flex w-full items-center justify-center gap-2.5 rounded-[15px] py-4 text-[17px] font-bold"
        style={canCreate ? { background: "var(--accent-strong)", color: "var(--on-accent)", boxShadow: "0 8px 20px var(--accent-soft)" } : { background: "var(--surface-3)", color: "var(--text-3)" }}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Icon name="check" size={21} style={{ color: canCreate ? "#fff" : "var(--text-3)" }} />}
        Create habit
      </button>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
