import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Flame,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Target,
  UserPlus,
  X,
} from "lucide-react";
import clsx from "clsx";
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

  async function toggleToday(h: OwnedHabit) {
    setBusyId(h.id);
    // Optimistic.
    const next = !h.todayDone;
    setOwned((prev) =>
      prev.map((x) =>
        x.id === h.id
          ? {
              ...x,
              todayDone: next,
              currentStreak: next
                ? x.currentStreak + 1
                : Math.max(0, x.currentStreak - 1),
              totalDone: next ? x.totalDone + 1 : Math.max(0, x.totalDone - 1),
            }
          : x
      )
    );
    try {
      const res = next
        ? await apiFetch(`/api/habits/${h.id}/checkin`, {
            method: "POST",
            token,
            body: JSON.stringify({}),
          })
        : await apiFetch(`/api/habits/${h.id}/checkin`, {
            method: "DELETE",
            token,
          });
      if (!res.ok) await refresh();
      else await refresh(); // re-pull for accurate streak math
    } catch {
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

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
      const res = await apiFetch(`/api/habits/${h.id}/nudge`, {
        method: "POST",
        token,
      });
      if (res.ok) {
        setPartnering((prev) =>
          prev.map((x) => (x.id === h.id ? { ...x, canNudge: false } : x))
        );
      } else if (res.status === 429) {
        setPartnering((prev) =>
          prev.map((x) => (x.id === h.id ? { ...x, canNudge: false } : x))
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/more"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-white">Habits</h1>
          <p className="truncate text-[11px] text-slate-500">
            Build a routine, stay accountable
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className={clsx(
            "flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium",
            showNew
              ? "bg-slate-800 text-slate-300"
              : "bg-indigo-500 text-white active:bg-indigo-600"
          )}
        >
          {showNew ? <X size={14} /> : <Plus size={14} />}
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
        <p className="mb-3 rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-2.5 text-xs text-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-10 text-slate-500">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : (
        <div className="flex-1 space-y-5 pb-4">
          {/* Pending invites */}
          {invites.length > 0 && (
            <section>
              <h2 className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-amber-300">
                <Bell size={11} /> Partner invites
              </h2>
              <ul className="space-y-2">
                {invites.map((inv) => (
                  <li
                    key={inv.id}
                    className="rounded-2xl border border-amber-700/40 bg-amber-900/10 p-3"
                  >
                    <p className="text-sm text-white">
                      <span className="font-semibold">{inv.ownerName}</span>{" "}
                      (B{inv.ownerBlock} · {inv.ownerFlat}) wants you as their
                      partner for{" "}
                      <span className="font-semibold">
                        {inv.emoji ? `${inv.emoji} ` : ""}
                        {inv.title}
                      </span>
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => respondInvite(inv.id, "accept")}
                        disabled={busyId === inv.id}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-500 py-2 text-[12px] font-semibold text-white active:bg-emerald-600 disabled:opacity-50"
                      >
                        {busyId === inv.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Check size={12} />
                        )}
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => respondInvite(inv.id, "decline")}
                        disabled={busyId === inv.id}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-800 py-2 text-[12px] font-semibold text-slate-300 active:bg-slate-700 disabled:opacity-50"
                      >
                        <X size={12} />
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* My habits */}
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              My habits
            </h2>
            {owned.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
                <Target size={28} className="mx-auto mb-2 text-slate-600" />
                No habits yet. Tap{" "}
                <span className="text-indigo-300">New</span> to start one.
              </div>
            ) : (
              <ul className="space-y-2">
                {owned.map((h) => (
                  <li
                    key={h.id}
                    className={clsx(
                      "flex items-center gap-3 rounded-2xl border p-3",
                      h.todayDone
                        ? "border-emerald-700/50 bg-emerald-900/10"
                        : "border-slate-700 bg-slate-800/60"
                    )}
                  >
                    {/* Today toggle */}
                    <button
                      type="button"
                      onClick={() => toggleToday(h)}
                      disabled={busyId === h.id}
                      aria-label={h.todayDone ? "Mark not done" : "Mark done"}
                      className={clsx(
                        "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full",
                        h.todayDone
                          ? "bg-emerald-500 text-white active:bg-emerald-600"
                          : "border border-slate-600 bg-slate-900 text-slate-500 active:bg-slate-800",
                        busyId === h.id && "opacity-50"
                      )}
                    >
                      {busyId === h.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : h.todayDone ? (
                        <CheckCircle2 size={20} />
                      ) : (
                        <Circle size={20} />
                      )}
                    </button>
                    <Link to={`/habits/${h.id}`} className="flex flex-1 min-w-0 items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {h.emoji ? `${h.emoji} ` : ""}
                          {h.title}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                          <span className="inline-flex items-center gap-1 text-orange-300">
                            <Flame size={11} />
                            {h.currentStreak}d streak
                          </span>
                          <span className="text-slate-600">·</span>
                          <span>{h.completionPct}%</span>
                          {h.partner && (
                            <>
                              <span className="text-slate-600">·</span>
                              <span className="inline-flex items-center gap-1">
                                <Sparkles size={10} />
                                {h.partner.status === "accepted"
                                  ? h.partner.name
                                  : h.partner.status === "pending"
                                    ? "invite sent"
                                    : "no partner"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={16} className="flex-shrink-0 text-slate-500" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Habits I'm partnering */}
          {partnering.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Keeping accountable
              </h2>
              <ul className="space-y-2">
                {partnering.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-3"
                  >
                    <div
                      className={clsx(
                        "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg",
                        h.todayDone
                          ? "bg-emerald-500/20"
                          : "bg-slate-900 text-slate-500"
                      )}
                    >
                      {h.emoji ?? "🎯"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {h.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {h.owner.name} ·{" "}
                        <span className="text-orange-300">
                          {h.currentStreak}d
                        </span>{" "}
                        ·{" "}
                        <span
                          className={
                            h.todayDone ? "text-emerald-300" : "text-slate-500"
                          }
                        >
                          {h.todayDone ? "done today" : "not yet today"}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => nudge(h)}
                      disabled={busyId === h.id || !h.canNudge}
                      className={clsx(
                        "flex flex-shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold",
                        h.canNudge
                          ? "bg-indigo-500 text-white active:bg-indigo-600"
                          : "bg-slate-800 text-slate-500"
                      )}
                    >
                      {busyId === h.id ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Bell size={11} />
                      )}
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
  const [emoji, setEmoji] = useState("");
  const [targetMinutes, setTargetMinutes] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(addDays(todayIso(), 30));
  const [partner, setPartner] = useState<ResidentHit | null>(null);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<ResidentHit[]>([]);
  const [searching, setSearching] = useState(false);
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
        const res = await apiFetch(
          `/api/residents/search?q=${encodeURIComponent(q)}`,
          { token }
        );
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

  return (
    <section className="mb-4 space-y-3 rounded-2xl border border-indigo-700/50 bg-slate-800/80 p-3">
      <div className="grid grid-cols-[60px,1fr] gap-2">
        <div>
          <Label>Emoji</Label>
          <input
            value={emoji}
            onChange={(e) =>
              setEmoji(Array.from(e.target.value).slice(0, 2).join(""))
            }
            placeholder="🧘"
            className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-2 py-2.5 text-center text-lg text-white placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
          />
        </div>
        <div>
          <Label>Habit</Label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Yoga every morning"
            className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Start</Label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full min-w-0 appearance-none rounded-xl border border-slate-700 bg-slate-900/60 px-2 py-2.5 text-[12px] text-white focus:border-indigo-400 focus:outline-none"
          />
        </div>
        <div>
          <Label>End</Label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full min-w-0 appearance-none rounded-xl border border-slate-700 bg-slate-900/60 px-2 py-2.5 text-[12px] text-white focus:border-indigo-400 focus:outline-none"
          />
        </div>
      </div>
      <div>
        <Label>Mins/day</Label>
        <input
          type="number"
          inputMode="numeric"
          value={targetMinutes}
          onChange={(e) => setTargetMinutes(e.target.value)}
          placeholder="10"
          className="w-full min-w-0 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
        />
      </div>

      {/* Partner picker */}
      <div>
        <Label>Accountability partner (optional)</Label>
        {partner ? (
          <div className="flex items-center justify-between rounded-xl border border-emerald-700/50 bg-emerald-900/20 px-3 py-2">
            <span className="text-sm text-white">
              {partner.name}{" "}
              <span className="text-[11px] text-slate-400">
                B{partner.block ?? "—"} · {partner.flatNumber}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                setPartner(null);
                setSearch("");
              }}
              className="text-slate-400"
              aria-label="Clear partner"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-3">
              <Search size={14} className="text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search a resident to invite…"
                className="flex-1 bg-transparent py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none"
              />
              {searching && (
                <Loader2 size={13} className="animate-spin text-slate-500" />
              )}
            </label>
            {hits.length > 0 && (
              <ul className="mt-1.5 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/80 p-1">
                {hits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() => setPartner(hit)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left active:bg-slate-800"
                    >
                      <span className="flex items-center gap-1.5 text-sm text-white">
                        <UserPlus size={12} className="text-slate-500" />
                        {hit.name}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        B{hit.block ?? "—"} · {hit.flatNumber}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <p className="mt-1 text-[10px] text-slate-500">
          They'll get a request and can see your progress once they accept.
        </p>
      </div>

      {err && (
        <p className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-1.5 text-[11px] text-red-200">
          {err}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white active:bg-indigo-600 disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        Create habit
      </button>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
      {children}
    </p>
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
