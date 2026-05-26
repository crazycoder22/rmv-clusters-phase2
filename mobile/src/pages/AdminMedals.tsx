import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  Check,
  Coins,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { canIssueMedals, canManageAnnouncements } from "../lib/roles";

// ── Types ───────────────────────────────────────────────────────────────────

type Tier = "GOLD" | "SILVER" | "BRONZE";

interface Award {
  id: string;
  recipientId: string;
  game: string;
  tier: Tier;
  coins: number;
  reason: string | null;
  createdAt: string;
  recipient: {
    id: string;
    name: string;
    block: number | null;
    flatNumber: string;
  };
  awardedBy: {
    id: string;
    name: string;
  };
}

interface ResidentHit {
  id: string;
  name: string;
  block: number | null;
  flatNumber: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const TIER_DEFAULTS: Record<Tier, number> = {
  GOLD: 100,
  SILVER: 50,
  BRONZE: 25,
};

const TIER_LABEL: Record<Tier, string> = {
  GOLD: "Gold",
  SILVER: "Silver",
  BRONZE: "Bronze",
};

const TIER_EMOJI: Record<Tier, string> = {
  GOLD: "🥇",
  SILVER: "🥈",
  BRONZE: "🥉",
};

const COMMON_GAMES = [
  "Quiz Night",
  "Tambola",
  "Wordle",
  "Sudoku",
  "Crossword",
  "Memory",
  "2048",
  "Fantasy Cricket",
  "Anagram",
];

// ── Page ────────────────────────────────────────────────────────────────────

export default function AdminMedals() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // Role gate
  useEffect(() => {
    if (user && !canIssueMedals(user.roles)) {
      navigate("/more", { replace: true });
    }
  }, [user, navigate]);

  const canDelete = canManageAnnouncements(user?.roles);

  const [awards, setAwards] = useState<Award[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/medals?limit=50", { token });
      if (!res.ok) {
        setError(res.status === 403 ? "Not authorised" : "Could not load");
        return;
      }
      const data = await res.json();
      setAwards(data.awards ?? []);
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

  async function deleteAward(award: Award) {
    if (!canDelete) return;
    const who = award.recipient.name;
    if (!confirm(`Undo ${TIER_LABEL[award.tier]} medal for ${who}?`)) return;
    setBusyId(award.id);
    try {
      const res = await apiFetch(`/api/medals/${award.id}`, {
        method: "DELETE",
        token,
      });
      if (res.ok) {
        setAwards((prev) => prev.filter((a) => a.id !== award.id));
      }
    } finally {
      setBusyId(null);
    }
  }

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return awards.filter((a) => new Date(a.createdAt).toDateString() === today)
      .length;
  }, [awards]);

  const totalCoins = useMemo(
    () => awards.reduce((sum, a) => sum + a.coins, 0),
    [awards]
  );

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
          <h1 className="text-lg font-semibold text-white">Medals & coins</h1>
          <p className="truncate text-[11px] text-slate-500">
            {awards.length} recent · {todayCount} today
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className={clsx(
            "flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium",
            formOpen
              ? "bg-slate-800 text-slate-300"
              : "bg-indigo-500 text-white active:bg-indigo-600"
          )}
        >
          {formOpen ? <X size={14} /> : <Plus size={14} />}
          {formOpen ? "Close" : "Issue"}
        </button>
      </header>

      {/* Summary cards */}
      <section className="mb-3 grid grid-cols-2 gap-2">
        <Stat
          value={awards.length}
          label="awards"
          icon={Award}
          tint="bg-amber-500/15 text-amber-200"
        />
        <Stat
          value={totalCoins}
          label="coins given"
          icon={Coins}
          tint="bg-emerald-500/15 text-emerald-200"
        />
      </section>

      {/* Issue form (inline) */}
      {formOpen && (
        <IssueForm
          token={token}
          onIssued={(award) => {
            // Prepend the new award optimistically; full refresh keeps recipient details.
            setAwards((prev) => [award, ...prev]);
            setFormOpen(false);
          }}
        />
      )}

      {/* Recent awards list */}
      <section className="flex-1 pb-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Recent awards
        </h2>
        {loading ? (
          <div className="flex justify-center py-10 text-slate-500">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : error ? (
          <p className="rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-3 text-xs text-red-200">
            {error}
          </p>
        ) : awards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
            No medals awarded yet. Tap{" "}
            <span className="text-indigo-300">Issue</span> to give one.
          </div>
        ) : (
          <div className="space-y-2">
            {awards.map((a) => (
              <AwardCard
                key={a.id}
                award={a}
                busy={busyId === a.id}
                onDelete={canDelete ? () => deleteAward(a) : undefined}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Issue form ──────────────────────────────────────────────────────────────

function IssueForm({
  token,
  onIssued,
}: {
  token: string | null;
  onIssued: (award: Award) => void;
}) {
  const [tier, setTier] = useState<Tier>("GOLD");
  const [coins, setCoins] = useState<number>(TIER_DEFAULTS.GOLD);
  const [coinsTouched, setCoinsTouched] = useState(false);
  const [game, setGame] = useState<string>("Quiz Night");
  const [customGame, setCustomGame] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  const [recipient, setRecipient] = useState<ResidentHit | null>(null);
  const [search, setSearch] = useState("");
  const [searchHits, setSearchHits] = useState<ResidentHit[]>([]);
  const [searching, setSearching] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync coin default when tier changes (unless user has typed a custom value).
  useEffect(() => {
    if (!coinsTouched) setCoins(TIER_DEFAULTS[tier]);
  }, [tier, coinsTouched]);

  // Debounced resident search — only fires while a recipient hasn't been picked.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (recipient) {
      setSearchHits([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = search.trim();
    if (q.length < 2) {
      setSearchHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `/api/admin/residents?search=true&q=${encodeURIComponent(q)}`,
          { token }
        );
        if (!res.ok) {
          setSearchHits([]);
          return;
        }
        const data = await res.json();
        const hits: ResidentHit[] = (data.residents ?? []).map(
          (r: ResidentHit) => ({
            id: r.id,
            name: r.name,
            block: r.block,
            flatNumber: r.flatNumber,
          })
        );
        setSearchHits(hits.slice(0, 15));
      } catch {
        setSearchHits([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, recipient, token]);

  async function submit() {
    setFormError(null);
    if (!recipient) {
      setFormError("Pick a recipient first");
      return;
    }
    const finalGame =
      game === "Other" ? customGame.trim() : game.trim();
    if (!finalGame) {
      setFormError("Game / event is required");
      return;
    }
    if (!Number.isFinite(coins) || coins < 0 || coins > 100000) {
      setFormError("Coins must be 0 – 100,000");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/medals", {
        method: "POST",
        token,
        body: JSON.stringify({
          recipientId: recipient.id,
          game: finalGame,
          tier,
          coins,
          reason: reason.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setFormError(body?.error ?? "Could not issue");
        return;
      }
      const data = await res.json();
      // Synthesise an Award object so the parent list can prepend without
      // requiring a full refresh. createdBy fields are best-effort.
      onIssued({
        id: data.award.id,
        recipientId: recipient.id,
        game: finalGame,
        tier,
        coins,
        reason: reason.trim() || null,
        createdAt: data.award.createdAt ?? new Date().toISOString(),
        recipient: {
          id: recipient.id,
          name: recipient.name,
          block: recipient.block,
          flatNumber: recipient.flatNumber,
        },
        awardedBy: { id: "self", name: "You" },
      });
      // Reset form for the next award (keep tier so quiz nights are fast)
      setRecipient(null);
      setSearch("");
      setReason("");
      setCoinsTouched(false);
    } catch {
      setFormError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mb-3 space-y-3 rounded-2xl border border-indigo-700/50 bg-slate-800/80 p-3">
      {/* Recipient */}
      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Recipient
        </label>
        {recipient ? (
          <div className="flex items-center justify-between rounded-xl border border-emerald-700/50 bg-emerald-900/20 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {recipient.name}
              </p>
              <p className="text-[11px] text-slate-400">
                B{recipient.block ?? "—"} · {recipient.flatNumber}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRecipient(null);
                setSearch("");
              }}
              className="ml-2 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-800"
              aria-label="Change recipient"
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
                placeholder="Search name, flat, phone…"
                className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
              />
              {searching && (
                <Loader2 size={14} className="animate-spin text-slate-500" />
              )}
            </label>
            {searchHits.length > 0 && (
              <ul className="mt-1.5 max-h-60 space-y-1 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/80 p-1">
                {searchHits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() => setRecipient(hit)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left active:bg-slate-800"
                    >
                      <span className="truncate text-sm text-white">
                        {hit.name}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-slate-400">
                        B{hit.block ?? "—"} · {hit.flatNumber}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {search.trim().length >= 2 &&
              !searching &&
              searchHits.length === 0 && (
                <p className="mt-1 text-[11px] text-slate-500">No matches.</p>
              )}
          </>
        )}
      </div>

      {/* Tier */}
      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Tier
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {(["GOLD", "SILVER", "BRONZE"] as Tier[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              className={clsx(
                "flex flex-col items-center gap-0.5 rounded-xl border py-2 text-xs font-medium",
                tier === t
                  ? "border-indigo-400 bg-indigo-500/20 text-white"
                  : "border-slate-700 bg-slate-900 text-slate-300 active:bg-slate-800"
              )}
            >
              <span className="text-lg leading-none">{TIER_EMOJI[t]}</span>
              <span>{TIER_LABEL[t]}</span>
              <span className="text-[9px] text-slate-500">
                {TIER_DEFAULTS[t]} coins
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Coins override */}
      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Coins
        </label>
        <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5">
          <Coins size={14} className="text-amber-300" />
          <input
            type="number"
            value={coins}
            onChange={(e) => {
              setCoins(parseInt(e.target.value, 10) || 0);
              setCoinsTouched(true);
            }}
            min={0}
            max={100000}
            className="flex-1 bg-transparent text-sm text-white focus:outline-none"
          />
          {coinsTouched && (
            <button
              type="button"
              onClick={() => {
                setCoinsTouched(false);
                setCoins(TIER_DEFAULTS[tier]);
              }}
              className="text-[10px] text-slate-500 active:text-slate-300"
            >
              reset
            </button>
          )}
        </div>
      </div>

      {/* Game */}
      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Game / event
        </label>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_GAMES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGame(g)}
              className={clsx(
                "rounded-full px-3 py-1 text-[11px] font-medium",
                game === g
                  ? "bg-indigo-500 text-white"
                  : "bg-slate-900 text-slate-300 active:bg-slate-800"
              )}
            >
              {g}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setGame("Other")}
            className={clsx(
              "rounded-full px-3 py-1 text-[11px] font-medium",
              game === "Other"
                ? "bg-indigo-500 text-white"
                : "bg-slate-900 text-slate-300 active:bg-slate-800"
            )}
          >
            Other
          </button>
        </div>
        {game === "Other" && (
          <input
            value={customGame}
            onChange={(e) => setCustomGame(e.target.value)}
            placeholder="Event name"
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
          />
        )}
      </div>

      {/* Reason */}
      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Reason{" "}
          <span className="ml-1 font-normal normal-case text-slate-500">
            (optional)
          </span>
        </label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder='e.g. "Best costume — Diwali quiz"'
          className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
        />
      </div>

      {formError && (
        <p className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-2 text-[11px] text-red-200">
          {formError}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={submitting || !recipient}
        className={clsx(
          "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold",
          submitting || !recipient
            ? "bg-slate-800 text-slate-500"
            : "bg-indigo-500 text-white active:bg-indigo-600"
        )}
      >
        {submitting ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Check size={16} />
        )}
        {submitting ? "Awarding…" : "Award medal"}
      </button>
    </section>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Stat({
  value,
  label,
  icon: Icon,
  tint,
}: {
  value: number;
  label: string;
  icon: typeof Award;
  tint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
      <div
        className={clsx(
          "mb-1 flex h-7 w-7 items-center justify-center rounded-full",
          tint
        )}
      >
        <Icon size={14} />
      </div>
      <p className="text-lg font-bold leading-tight tabular-nums text-white">
        {value.toLocaleString()}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </p>
    </div>
  );
}

function AwardCard({
  award,
  busy,
  onDelete,
}: {
  award: Award;
  busy: boolean;
  onDelete?: () => void;
}) {
  const when = new Date(award.createdAt).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <article className="flex items-start gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-2xl">
        {TIER_EMOJI[award.tier]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-white">
            {award.recipient.name}
          </h3>
          <span className="shrink-0 font-mono text-[11px] text-slate-400">
            B{award.recipient.block ?? "—"} · {award.recipient.flatNumber}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-slate-400">
          {TIER_LABEL[award.tier]} ·{" "}
          <span className="text-amber-300">+{award.coins} coins</span>{" "}
          <span className="text-slate-600">·</span> {award.game}
        </p>
        {award.reason && (
          <p className="mt-1 inline-flex items-center gap-1 rounded-lg bg-slate-900/60 px-2 py-1 text-[11px] italic text-slate-400">
            <Sparkles size={10} />"{award.reason}"
          </p>
        )}
        <p className="mt-1 text-[10px] text-slate-500">
          By {award.awardedBy.name} · {when}
        </p>
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          aria-label="Undo award"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-600 active:bg-slate-800 active:text-red-300"
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Trash2 size={14} />
          )}
        </button>
      )}
    </article>
  );
}
