import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Ban,
  Check,
  Crown,
  KeyRound,
  Loader2,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { isSuperAdmin } from "../lib/roles";

// ── Types ──────────────────────────────────────────────────────────────────

type AssignableRole =
  | "ADMIN"
  | "COMMUNITY_ADMIN"
  | "EVENT_MANAGER"
  | "FACILITY_MANAGER"
  | "SECURITY";

interface ResidentHit {
  id: string;
  name: string;
  email: string;
  block: number | null;
  flatNumber: string;
  roles: { name: string }[];
  deactivatedAt?: string | null;
}

// ── Role meta ──────────────────────────────────────────────────────────────

const ASSIGNABLE: { value: AssignableRole; label: string; icon: LucideIcon }[] =
  [
    { value: "ADMIN", label: "Admin", icon: ShieldCheck },
    { value: "COMMUNITY_ADMIN", label: "Community Admin", icon: Sparkles },
    { value: "EVENT_MANAGER", label: "Event Mgr", icon: KeyRound },
    { value: "FACILITY_MANAGER", label: "Facility Mgr", icon: Wrench },
    { value: "SECURITY", label: "Security", icon: ShieldAlert },
  ];

// Background colours for the active state of each role chip.
const ROLE_TINT: Record<AssignableRole, string> = {
  ADMIN: "bg-green-500 text-white",
  COMMUNITY_ADMIN: "bg-indigo-500 text-white",
  EVENT_MANAGER: "bg-teal-500 text-white",
  FACILITY_MANAGER: "bg-orange-500 text-white",
  SECURITY: "bg-blue-500 text-white",
};

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminRoles() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // SUPERADMIN-only — mirrors the server.
  useEffect(() => {
    if (user && !isSuperAdmin(user.roles)) {
      navigate("/more", { replace: true });
    }
  }, [user, navigate]);

  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<ResidentHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Debounced search.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const q = search.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setHits([]);
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
          setError(res.status === 403 ? "Not authorised" : "Search failed");
          setHits([]);
          return;
        }
        const data = await res.json();
        setHits((data.residents ?? []) as ResidentHit[]);
        setError(null);
      } catch {
        setError("Network error");
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, token]);

  // Toggle a single role for a resident. Sends the *full* new role array
  // because the server uses `roles: { set: ... }` — anything missing gets
  // removed. We do the calculation client-side and reconcile from the
  // response.
  const toggleRole = useCallback(
    async (resident: ResidentHit, role: AssignableRole) => {
      if (residentIsSuperAdmin(resident)) return; // protected
      setBusyId(resident.id);
      setError(null);

      const currentAssignable = resident.roles
        .map((r) => r.name)
        .filter((n): n is AssignableRole =>
          ASSIGNABLE.some((opt) => opt.value === n)
        );
      const has = currentAssignable.includes(role);
      const nextRoles = has
        ? currentAssignable.filter((r) => r !== role)
        : [...currentAssignable, role];

      // Optimistic UI update.
      setHits((prev) =>
        prev.map((h) =>
          h.id === resident.id
            ? {
                ...h,
                roles: nextRoles.map((name) => ({ name })),
              }
            : h
        )
      );

      try {
        const res = await apiFetch("/api/admin/roles", {
          method: "PATCH",
          token,
          body: JSON.stringify({
            residentId: resident.id,
            roles: nextRoles,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error ?? "Could not update");
          // Roll back by re-searching.
          await refreshOne(resident.id);
          return;
        }
        const data = await res.json();
        if (data?.resident) {
          setHits((prev) =>
            prev.map((h) =>
              h.id === resident.id
                ? { ...h, roles: data.resident.roles }
                : h
            )
          );
        }
      } catch {
        setError("Network error");
        await refreshOne(resident.id);
      } finally {
        setBusyId(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token]
  );

  // Deactivate / reactivate a resident (soft delete).
  const setActive = useCallback(
    async (resident: ResidentHit, deactivate: boolean) => {
      if (residentIsSuperAdmin(resident) || resident.id === user?.id) return;
      const verb = deactivate ? "Deactivate" : "Reactivate";
      if (!window.confirm(`${verb} ${resident.name}? ${deactivate ? "They will be signed out and can't use the app until reactivated." : "They'll be able to sign in again."}`)) return;
      setBusyId(resident.id);
      setError(null);
      try {
        const res = await apiFetch("/api/admin/roles", {
          method: "PATCH",
          token,
          body: JSON.stringify({ residentId: resident.id, action: deactivate ? "deactivate" : "reactivate" }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setError(data?.error ?? "Could not update");
          return;
        }
        setHits((prev) =>
          prev.map((h) =>
            h.id === resident.id ? { ...h, deactivatedAt: data?.resident?.deactivatedAt ?? (deactivate ? new Date().toISOString() : null) } : h
          )
        );
      } catch {
        setError("Network error");
      } finally {
        setBusyId(null);
      }
    },
    [token, user?.id]
  );

  // Permanently delete a resident (hard delete).
  const deleteResident = useCallback(
    async (resident: ResidentHit) => {
      if (residentIsSuperAdmin(resident) || resident.id === user?.id) return;
      if (!window.confirm(`PERMANENTLY delete ${resident.name}? This removes their account and data and cannot be undone.\n\nIf they have posts or bookings this will fail — deactivate them instead.`)) return;
      setBusyId(resident.id);
      setError(null);
      try {
        const res = await apiFetch("/api/admin/roles", {
          method: "DELETE",
          token,
          body: JSON.stringify({ residentId: resident.id }),
        });
        if (res.ok) {
          setHits((prev) => prev.filter((h) => h.id !== resident.id));
          return;
        }
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Could not delete resident.");
      } catch {
        setError("Network error");
      } finally {
        setBusyId(null);
      }
    },
    [token, user?.id]
  );

  // Re-fetch the latest roles for one resident (used to undo optimistic
  // updates on failure).
  async function refreshOne(residentId: string) {
    try {
      const res = await apiFetch(
        `/api/admin/residents?search=true&q=${encodeURIComponent(search.trim())}`,
        { token }
      );
      if (!res.ok) return;
      const data = await res.json();
      const fresh: ResidentHit | undefined = (data.residents ?? []).find(
        (r: ResidentHit) => r.id === residentId
      );
      if (fresh) {
        setHits((prev) =>
          prev.map((h) => (h.id === residentId ? fresh : h))
        );
      }
    } catch {
      /* swallow */
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
          <h1 className="text-lg font-semibold text-white">Manage roles</h1>
          <p className="truncate text-[11px] text-slate-500">
            SUPERADMIN only · tap a role to assign / remove
          </p>
        </div>
      </header>

      {/* Search */}
      <section className="mb-3">
        <label className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 px-3">
          <Search size={14} className="text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, flat…"
            className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          {searching ? (
            <Loader2 size={14} className="animate-spin text-slate-500" />
          ) : search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-slate-500"
              aria-label="Clear"
            >
              <X size={14} />
            </button>
          ) : null}
        </label>
      </section>

      {error && (
        <p className="mb-3 rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-2.5 text-xs text-red-200">
          {error}
        </p>
      )}

      {/* Results */}
      <section className="flex-1 pb-4">
        {search.trim().length < 2 ? (
          <EmptyHint />
        ) : !searching && hits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
            No residents match.
          </div>
        ) : (
          <ul className="space-y-2">
            {hits.map((r) => (
              <ResidentRow
                key={r.id}
                resident={r}
                isSelf={r.id === user?.id}
                busy={busyId === r.id}
                expanded={expandedId === r.id}
                onToggleExpand={() =>
                  setExpandedId((cur) => (cur === r.id ? null : r.id))
                }
                onToggleRole={(role) => toggleRole(r, role)}
                onSetActive={(deactivate) => setActive(r, deactivate)}
                onDelete={() => deleteResident(r)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function EmptyHint() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
      <Search size={22} className="mx-auto mb-2 text-slate-600" />
      Type at least 2 characters to search residents.
    </div>
  );
}

function ResidentRow({
  resident,
  isSelf,
  busy,
  expanded,
  onToggleExpand,
  onToggleRole,
  onSetActive,
  onDelete,
}: {
  resident: ResidentHit;
  isSelf: boolean;
  busy: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleRole: (role: AssignableRole) => void;
  onSetActive: (deactivate: boolean) => void;
  onDelete: () => void;
}) {
  const isSuper = residentIsSuperAdmin(resident);
  const isDeactivated = !!resident.deactivatedAt;
  const activeAssignable = new Set(
    resident.roles
      .map((r) => r.name)
      .filter((n): n is AssignableRole =>
        ASSIGNABLE.some((opt) => opt.value === n)
      )
  );

  return (
    <li
      className={clsx(
        "rounded-2xl border bg-slate-800/60",
        isSuper ? "border-purple-700/50" : "border-slate-700"
      )}
    >
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-start gap-3 px-3 py-3 text-left"
      >
        <div
          className={clsx(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full",
            isSuper ? "bg-purple-500/20 text-purple-300" : "bg-slate-700 text-slate-300"
          )}
        >
          {isSuper ? <Crown size={16} /> : <ShieldCheck size={16} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-semibold text-white">
              {resident.name}
            </p>
            <span className="shrink-0 font-mono text-[11px] text-slate-400">
              B{resident.block ?? "—"} · {resident.flatNumber}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {resident.email}
          </p>
          {/* Current role badges */}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {isDeactivated && (
              <Badge color="red" icon={Ban}>
                Deactivated
              </Badge>
            )}
            {isSuper && (
              <Badge color="purple" icon={Crown}>
                SUPERADMIN
              </Badge>
            )}
            {Array.from(activeAssignable).map((role) => (
              <Badge key={role} color={badgeColor(role)}>
                {labelFor(role)}
              </Badge>
            ))}
            {activeAssignable.size === 0 && !isSuper && (
              <span className="text-[10px] text-slate-500">Resident</span>
            )}
          </div>
        </div>
      </button>

      {/* Expanded chip grid */}
      {expanded && (
        <div className="border-t border-slate-700 px-3 py-3">
          {isSuper ? (
            <div className="rounded-xl border border-purple-700/40 bg-purple-900/20 px-3 py-2 text-[11px] text-purple-200">
              <Crown size={11} className="-mt-0.5 mr-1 inline" />
              SUPERADMIN is protected — manage in the DB directly.
            </div>
          ) : (
            <>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Tap to assign / remove
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {ASSIGNABLE.map((opt) => {
                  const Icon = opt.icon;
                  const active = activeAssignable.has(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onToggleRole(opt.value)}
                      disabled={busy}
                      className={clsx(
                        "inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors",
                        active
                          ? ROLE_TINT[opt.value]
                          : "bg-slate-900 text-slate-300 active:bg-slate-700",
                        busy && "opacity-50"
                      )}
                    >
                      {active ? <Check size={12} /> : <Icon size={12} />}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {busy && (
                <p className="mt-2 inline-flex items-center gap-1 text-[10px] text-slate-500">
                  <Loader2 size={10} className="animate-spin" /> saving…
                </p>
              )}

              {/* Danger zone — deactivate / hard delete */}
              {!isSelf && (
                <div className="mt-3 border-t border-slate-700 pt-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-red-400/80">
                    Danger zone
                  </p>
                  <div className="flex gap-1.5">
                    {isDeactivated ? (
                      <button
                        type="button"
                        onClick={() => onSetActive(false)}
                        disabled={busy}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-700/50 bg-emerald-900/20 px-3 py-2 text-xs font-semibold text-emerald-200 active:bg-emerald-900/40 disabled:opacity-50"
                      >
                        <RotateCcw size={13} /> Reactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSetActive(true)}
                        disabled={busy}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-xs font-semibold text-amber-200 active:bg-amber-900/40 disabled:opacity-50"
                      >
                        <Ban size={13} /> Deactivate
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onDelete}
                      disabled={busy}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-700/50 bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-200 active:bg-red-900/40 disabled:opacity-50"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                    Deactivate blocks sign-in (reversible). Delete is permanent and
                    only works if they have no posts/bookings.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

function Badge({
  color,
  icon: Icon,
  children,
}: {
  color: "green" | "indigo" | "teal" | "orange" | "blue" | "purple" | "slate" | "red";
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  const cls = {
    green: "bg-green-500/20 text-green-200 border-green-700/40",
    indigo: "bg-indigo-500/20 text-indigo-200 border-indigo-700/40",
    teal: "bg-teal-500/20 text-teal-200 border-teal-700/40",
    orange: "bg-orange-500/20 text-orange-200 border-orange-700/40",
    blue: "bg-blue-500/20 text-blue-200 border-blue-700/40",
    purple: "bg-purple-500/20 text-purple-200 border-purple-700/40",
    slate: "bg-slate-700 text-slate-300 border-slate-600",
    red: "bg-red-500/20 text-red-200 border-red-700/40",
  }[color];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
        cls
      )}
    >
      {Icon && <Icon size={9} />}
      {children}
    </span>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function residentIsSuperAdmin(r: ResidentHit): boolean {
  return r.roles.some((rl) => rl.name === "SUPERADMIN");
}

function labelFor(role: AssignableRole): string {
  return ASSIGNABLE.find((o) => o.value === role)?.label ?? role;
}

function badgeColor(
  role: AssignableRole
): "green" | "indigo" | "teal" | "orange" | "blue" {
  switch (role) {
    case "ADMIN":
      return "green";
    case "COMMUNITY_ADMIN":
      return "indigo";
    case "EVENT_MANAGER":
      return "teal";
    case "FACILITY_MANAGER":
      return "orange";
    case "SECURITY":
      return "blue";
  }
}
