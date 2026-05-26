import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  IndianRupee,
  Loader2,
  MessageSquare,
  Phone,
  Search,
  Users,
  X,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { canManageAnnouncements } from "../lib/roles";

interface Registration {
  position: number;
  id: string;
  name: string;
  phone: string;
  email: string | null;
  block: number | null;
  flatNumber: string | null;
  contributionAmount: number | null;
  paid: boolean;
  paidAt: string | null;
  adminNote: string | null;
  createdAt: string;
}

interface EventMeta {
  id: string;
  slug: string;
  title: string;
}

interface PublicEventMeta {
  slug: string;
  startAt: string;
  endAt: string | null;
  venue: string | null;
  contributionEnabled: boolean;
  targetAmount: number | null;
}

type PaidFilter = "all" | "paid" | "unpaid";

const fmtMoney = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));

export default function AdminEventDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !canManageAnnouncements(user.roles)) {
      navigate("/more", { replace: true });
    }
  }, [user, navigate]);

  const [event, setEvent] = useState<EventMeta | null>(null);
  const [publicMeta, setPublicMeta] = useState<PublicEventMeta | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [paidFilter, setPaidFilter] = useState<PaidFilter>("all");

  // Fetch the admin registrations payload AND, for contribution events,
  // the public event meta which has contributionEnabled/targetAmount.
  // Two parallel calls so the page renders fast.
  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const regsRes = await apiFetch(
        `/api/admin/public-events/${id}/registrations`,
        { token }
      );
      if (!regsRes.ok) {
        setError(regsRes.status === 403 ? "Not authorised" : "Could not load");
        return;
      }
      const regsData = await regsRes.json();
      setEvent(regsData.event ?? null);
      setRegistrations(regsData.registrations ?? []);
      setError(null);

      // Use the slug from the registrations response to grab contribution meta.
      // Public endpoint, no token needed.
      if (regsData.event?.slug) {
        const evRes = await apiFetch(`/api/public-events/${regsData.event.slug}`);
        if (evRes.ok) {
          const evData = await evRes.json();
          setPublicMeta(evData.event);
        }
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Toggle paid — optimistic, rollback via refetch on failure.
  async function togglePaid(reg: Registration) {
    if (!id) return;
    setBusyId(reg.id);
    const next = !reg.paid;
    setRegistrations((prev) =>
      prev.map((r) =>
        r.id === reg.id
          ? { ...r, paid: next, paidAt: next ? new Date().toISOString() : null }
          : r
      )
    );
    try {
      const res = await apiFetch(`/api/admin/public-events/${id}/registrations`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ registrationId: reg.id, paid: next }),
      });
      if (!res.ok) await refresh();
    } catch {
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function saveNote(reg: Registration, adminNote: string) {
    if (!id) return;
    setBusyId(reg.id);
    setRegistrations((prev) =>
      prev.map((r) => (r.id === reg.id ? { ...r, adminNote } : r))
    );
    try {
      const res = await apiFetch(`/api/admin/public-events/${id}/registrations`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ registrationId: reg.id, adminNote }),
      });
      if (!res.ok) await refresh();
    } catch {
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  // Filter + search the registrations.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return registrations.filter((r) => {
      if (paidFilter === "paid" && !r.paid) return false;
      if (paidFilter === "unpaid" && r.paid) return false;
      if (q) {
        const hay = `${r.name} ${r.flatNumber ?? ""} ${r.phone}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [registrations, search, paidFilter]);

  // Totals across ALL registrations (not just filtered) so the stat row
  // doesn't shift around when the admin types in the search box.
  const totals = useMemo(() => {
    const flats = registrations.length;
    const pledged = registrations.reduce(
      (s, r) => s + (r.contributionAmount ?? 0),
      0
    );
    const paid = registrations.reduce(
      (s, r) => s + (r.paid ? r.contributionAmount ?? 0 : 0),
      0
    );
    return { flats, pledged, paid };
  }, [registrations]);

  const contributionEnabled = publicMeta?.contributionEnabled ?? false;

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/admin/events"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-lg font-semibold text-white">
            {event?.title ?? "…"}
          </h1>
          {publicMeta?.startAt && (
            <p className="truncate text-[11px] text-slate-500">
              {fmtDate(publicMeta.startAt)}
              {publicMeta.venue ? ` · ${publicMeta.venue}` : ""}
            </p>
          )}
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-10 text-slate-500">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : error ? (
        <p className="rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-3 text-xs text-red-200">
          {error}
        </p>
      ) : (
        <>
          {/* Stats row — adapts to contribution vs simple registration events */}
          <section
            className={clsx(
              "mb-3 grid gap-2",
              contributionEnabled ? "grid-cols-3" : "grid-cols-1"
            )}
          >
            <Stat icon={Users} value={String(totals.flats)} label="registered" tint="bg-indigo-500/15 text-indigo-200" />
            {contributionEnabled && (
              <>
                <Stat
                  icon={IndianRupee}
                  value={fmtMoney(totals.pledged)}
                  label={
                    publicMeta?.targetAmount
                      ? `of ${fmtMoney(publicMeta.targetAmount)}`
                      : "pledged"
                  }
                  tint="bg-amber-500/15 text-amber-200"
                />
                <Stat
                  icon={Check}
                  value={fmtMoney(totals.paid)}
                  label="received"
                  tint="bg-emerald-500/15 text-emerald-200"
                />
              </>
            )}
          </section>

          {/* Search */}
          <section className="mb-3 flex gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 px-3">
              <Search size={14} className="text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, flat, phone"
                className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-slate-500"
                  aria-label="Clear"
                >
                  <X size={14} />
                </button>
              )}
            </label>
          </section>

          {/* Paid filter — only meaningful for contribution events */}
          {contributionEnabled && (
            <section className="mb-3 flex gap-1.5">
              {(["all", "unpaid", "paid"] as PaidFilter[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setPaidFilter(opt)}
                  className={clsx(
                    "rounded-full px-3 py-1.5 text-xs font-medium capitalize",
                    paidFilter === opt
                      ? "bg-indigo-500 text-white"
                      : "bg-slate-900 text-slate-300 active:bg-slate-800"
                  )}
                >
                  {opt}
                </button>
              ))}
            </section>
          )}

          {/* Registration cards */}
          <section className="flex-1 pb-4">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
                {registrations.length === 0
                  ? "No registrations yet."
                  : "No registrations match these filters."}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((r) => (
                  <RegistrationCard
                    key={r.id}
                    reg={r}
                    contributionEnabled={contributionEnabled}
                    busy={busyId === r.id}
                    onTogglePaid={() => togglePaid(r)}
                    onSaveNote={(note) => saveNote(r, note)}
                  />
                ))}
                <p className="pt-2 text-center text-[11px] text-slate-500">
                  {filtered.length} of {registrations.length}
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function Stat({
  icon: Icon,
  value,
  label,
  tint,
}: {
  icon: typeof Users;
  value: string;
  label: string;
  tint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
      <div className={clsx("mb-1 flex h-7 w-7 items-center justify-center rounded-full", tint)}>
        <Icon size={14} />
      </div>
      <p className="text-base font-bold leading-tight tabular-nums text-white">
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </p>
    </div>
  );
}

function RegistrationCard({
  reg,
  contributionEnabled,
  busy,
  onTogglePaid,
  onSaveNote,
}: {
  reg: Registration;
  contributionEnabled: boolean;
  busy: boolean;
  onTogglePaid: () => void;
  onSaveNote: (note: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState(reg.adminNote ?? "");
  const showPaidToggle = contributionEnabled;

  return (
    <article
      className={clsx(
        "rounded-2xl border p-3",
        reg.paid && contributionEnabled
          ? "border-emerald-700/50 bg-emerald-900/10"
          : "border-slate-700 bg-slate-800/60"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Paid toggle (only for contribution events) */}
        {showPaidToggle ? (
          <button
            type="button"
            onClick={onTogglePaid}
            disabled={busy}
            aria-label={reg.paid ? "Mark as unpaid" : "Mark as paid"}
            className={clsx(
              "mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors",
              reg.paid
                ? "bg-emerald-500 text-white active:bg-emerald-600"
                : "border border-slate-600 bg-slate-900 text-slate-500 active:bg-slate-800",
              busy && "opacity-50"
            )}
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : reg.paid ? (
              <CheckCircle2 size={18} />
            ) : (
              <Circle size={18} />
            )}
          </button>
        ) : (
          // Non-contribution event: show a position chip instead of toggle.
          <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-slate-400">
            #{reg.position}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-white">
              {reg.name}
            </h3>
            {reg.block != null && reg.flatNumber && (
              <span className="shrink-0 text-[11px] font-mono text-slate-400">
                B{reg.block} · {reg.flatNumber}
              </span>
            )}
          </div>

          {/* Phone (tap to call) + email */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
            <a
              href={`tel:${reg.phone}`}
              className="inline-flex items-center gap-1 text-indigo-300 active:underline"
            >
              <Phone size={11} />
              {reg.phone}
            </a>
            {reg.email && (
              <>
                <span className="text-slate-600">·</span>
                <span className="truncate text-slate-400">{reg.email}</span>
              </>
            )}
          </div>

          {/* Contribution amount + paid-at badge */}
          {contributionEnabled && reg.contributionAmount && (
            <div className="mt-1.5 flex items-center gap-2 text-[12px]">
              <span className="font-semibold text-white tabular-nums">
                {fmtMoney(reg.contributionAmount)}
              </span>
              {reg.paid && reg.paidAt && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-700/50 bg-emerald-900/30 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                  <Check size={10} />
                  Paid {fmtDate(reg.paidAt)}
                </span>
              )}
            </div>
          )}

          {/* Admin note */}
          {editing ? (
            <div className="mt-2 space-y-1.5">
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Note (visible to admins only)"
                className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[12px] text-white placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onSaveNote(noteDraft.trim());
                    setEditing(false);
                  }}
                  disabled={busy}
                  className="rounded-lg bg-indigo-500 px-2.5 py-1 text-[11px] font-semibold text-white active:bg-indigo-600 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNoteDraft(reg.adminNote ?? "");
                    setEditing(false);
                  }}
                  className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 active:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : reg.adminNote ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-2 flex w-full items-start gap-1.5 rounded-lg bg-slate-900/60 px-2.5 py-1.5 text-left text-[11px] text-slate-300 active:bg-slate-800"
            >
              <MessageSquare size={11} className="mt-0.5 flex-shrink-0 text-slate-500" />
              <span className="flex-1">{reg.adminNote}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-500 active:text-slate-300"
            >
              <MessageSquare size={11} />
              Add admin note
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
