import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Crown,
  LifeBuoy,
  Loader2,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  Star,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { canManageAnnouncements, isSuperAdmin } from "../lib/roles";

// ── Types ──────────────────────────────────────────────────────────────────

interface Acceptance {
  id: string;
  name: string;
  email: string;
  phone: string;
  block: number | null;
  flatNumber: string | null;
  residentId: string | null;
  createdAt: string;
  resident: {
    id: string;
    name: string;
    isSosWarrior: boolean;
    isApproved: boolean;
  } | null;
}

type Filter = "all" | "linked" | "guest" | "warriors";

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminSos() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !canManageAnnouncements(user.roles)) {
      navigate("/more", { replace: true });
    }
  }, [user, navigate]);

  const canPromote = isSuperAdmin(user?.roles);

  const [acceptances, setAcceptances] = useState<Acceptance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/sos-acceptances", { token });
      if (!res.ok) {
        setError(res.status === 403 ? "Not authorised" : "Could not load");
        return;
      }
      const data = await res.json();
      setAcceptances(data.acceptances ?? []);
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

  // Toggle isSosWarrior via /api/admin/roles. Only SUPERADMIN can call this
  // server-side; the button is hidden for everyone else.
  async function toggleWarrior(a: Acceptance) {
    if (!a.resident) return;
    if (!canPromote) return;
    setBusyId(a.id);
    const next = !a.resident.isSosWarrior;
    // Optimistic
    setAcceptances((prev) =>
      prev.map((x) =>
        x.id === a.id && x.resident
          ? { ...x, resident: { ...x.resident, isSosWarrior: next } }
          : x
      )
    );
    try {
      const res = await apiFetch("/api/admin/roles", {
        method: "PATCH",
        token,
        body: JSON.stringify({
          residentId: a.resident.id,
          isSosWarrior: next,
        }),
      });
      if (!res.ok) {
        await refresh();
      }
    } catch {
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  const stats = useMemo(() => {
    let linked = 0;
    let warriors = 0;
    for (const a of acceptances) {
      if (a.resident) {
        linked++;
        if (a.resident.isSosWarrior) warriors++;
      }
    }
    return {
      total: acceptances.length,
      linked,
      guest: acceptances.length - linked,
      warriors,
    };
  }, [acceptances]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return acceptances.filter((a) => {
      if (filter === "linked" && !a.resident) return false;
      if (filter === "guest" && a.resident) return false;
      if (filter === "warriors" && !a.resident?.isSosWarrior) return false;
      if (q) {
        const hay =
          `${a.name} ${a.email} ${a.phone} ${a.flatNumber ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [acceptances, search, filter]);

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
          <h1 className="text-lg font-semibold text-white">SOS acceptance</h1>
          <p className="truncate text-[11px] text-slate-500">
            {stats.warriors} warrior{stats.warriors !== 1 ? "s" : ""} ·{" "}
            {stats.total} accepted guidelines
          </p>
        </div>
      </header>

      {/* Summary cards */}
      <section className="mb-3 grid grid-cols-3 gap-2">
        <Stat
          value={stats.total}
          label="accepted"
          icon={CheckCircle2}
          tint="bg-emerald-500/15 text-emerald-200"
        />
        <Stat
          value={stats.warriors}
          label="warriors"
          icon={ShieldCheck}
          tint="bg-amber-500/15 text-amber-200"
        />
        <Stat
          value={stats.guest}
          label="unlinked"
          icon={Users}
          tint="bg-slate-700 text-slate-300"
        />
      </section>

      {/* Search + filters */}
      <section className="mb-3 space-y-2">
        <label className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 px-3">
          <Search size={14} className="text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, flat"
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
        <div className="flex gap-1.5">
          {(
            [
              { value: "all", label: "All" },
              { value: "linked", label: "Linked" },
              { value: "guest", label: "Guest" },
              { value: "warriors", label: "Warriors" },
            ] as { value: Filter; label: string }[]
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={clsx(
                "rounded-full px-3 py-1.5 text-xs font-medium",
                filter === opt.value
                  ? "bg-indigo-500 text-white"
                  : "bg-slate-900 text-slate-300 active:bg-slate-800"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="flex-1 pb-4">
        {loading ? (
          <div className="flex justify-center py-10 text-slate-500">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : error ? (
          <p className="rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-3 text-xs text-red-200">
            {error}
          </p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
            <LifeBuoy size={28} className="mx-auto mb-2 text-slate-600" />
            {acceptances.length === 0
              ? "No SOS acceptances yet."
              : "Nothing matches this filter."}
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((a) => (
              <AcceptanceCard
                key={a.id}
                acceptance={a}
                busy={busyId === a.id}
                canPromote={canPromote}
                onToggle={() => toggleWarrior(a)}
              />
            ))}
          </ul>
        )}
        {!canPromote && (
          <p className="mt-3 text-center text-[10px] text-slate-500">
            Only SUPERADMINs can promote / demote warriors.
          </p>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Stat({
  value,
  label,
  icon: Icon,
  tint,
}: {
  value: number;
  label: string;
  icon: typeof CheckCircle2;
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

function AcceptanceCard({
  acceptance,
  busy,
  canPromote,
  onToggle,
}: {
  acceptance: Acceptance;
  busy: boolean;
  canPromote: boolean;
  onToggle: () => void;
}) {
  const isWarrior = !!acceptance.resident?.isSosWarrior;
  const isLinked = !!acceptance.resident;
  const when = new Date(acceptance.createdAt).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <li
      className={clsx(
        "rounded-2xl border p-3",
        isWarrior
          ? "border-amber-700/50 bg-amber-900/10"
          : "border-slate-700 bg-slate-800/60"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={clsx(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full",
            isWarrior
              ? "bg-amber-500/30 text-amber-200"
              : "bg-slate-700 text-slate-300"
          )}
        >
          {isWarrior ? <ShieldCheck size={16} /> : <UserCheck size={16} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-semibold text-white">
              {acceptance.name}
            </p>
            <span className="shrink-0 font-mono text-[11px] text-slate-400">
              B{acceptance.block ?? "—"} · {acceptance.flatNumber ?? "—"}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {acceptance.email}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {isWarrior && (
              <Badge color="amber" icon={Star}>
                WARRIOR
              </Badge>
            )}
            {isLinked ? (
              <Badge color="emerald" icon={Check}>
                LINKED
              </Badge>
            ) : (
              <Badge color="slate" icon={Users}>
                GUEST
              </Badge>
            )}
            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500">
              <Clock size={9} /> {when}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2 flex gap-1.5">
        <a
          href={`tel:${acceptance.phone}`}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-200 active:bg-slate-800"
        >
          <Phone size={11} />
          Call
        </a>
        <a
          href={`mailto:${acceptance.email}`}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-200 active:bg-slate-800"
        >
          <Mail size={11} />
          Email
        </a>
        {isLinked && canPromote && (
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            className={clsx(
              "inline-flex flex-1 items-center justify-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold",
              isWarrior
                ? "bg-slate-800 text-slate-300 active:bg-slate-700"
                : "bg-amber-500 text-white active:bg-amber-600",
              busy && "opacity-50"
            )}
          >
            {busy ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Star size={11} className={isWarrior ? "" : "fill-current"} />
            )}
            {isWarrior ? "Demote" : "Make warrior"}
          </button>
        )}
        {!isLinked && (
          <span className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-slate-900/40 px-3 py-1.5 text-[10px] text-slate-500">
            <Crown size={10} />
            no resident match
          </span>
        )}
      </div>
    </li>
  );
}

function Badge({
  color,
  icon: Icon,
  children,
}: {
  color: "amber" | "emerald" | "slate";
  icon?: typeof Star;
  children: React.ReactNode;
}) {
  const cls = {
    amber: "bg-amber-500/30 text-amber-200 border-amber-700/40",
    emerald: "bg-emerald-500/20 text-emerald-200 border-emerald-700/40",
    slate: "bg-slate-700 text-slate-300 border-slate-600",
  }[color];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
        cls
      )}
    >
      {Icon && <Icon size={9} />}
      {children}
    </span>
  );
}
