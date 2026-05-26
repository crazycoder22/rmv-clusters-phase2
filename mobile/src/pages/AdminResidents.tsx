import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Crown,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { canManageResidents, isAdmin, isSuperAdmin } from "../lib/roles";

// ── Types ──────────────────────────────────────────────────────────────────

type ResidentType =
  | "OWNER"
  | "OWNER_FAMILY"
  | "TENANT"
  | "TENANT_FAMILY"
  | "MULTI_TENANT";

const RESIDENT_TYPE_LABELS: Record<ResidentType, string> = {
  OWNER: "Owner",
  OWNER_FAMILY: "Owner Family",
  TENANT: "Tenant",
  TENANT_FAMILY: "Tenant Family",
  MULTI_TENANT: "Multi Tenant",
};

const RESIDENT_TYPES: ResidentType[] = [
  "OWNER",
  "OWNER_FAMILY",
  "TENANT",
  "TENANT_FAMILY",
  "MULTI_TENANT",
];

interface Resident {
  id: string;
  name: string;
  email: string;
  phone: string;
  block: number | null;
  flatNumber: string;
  residentType?: string;
  isApproved: boolean;
  isSosWarrior?: boolean;
  roles: { name: string }[];
  createdAt?: string;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminResidents() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !canManageResidents(user.roles)) {
      navigate("/more", { replace: true });
    }
  }, [user, navigate]);

  const canEditDetails = isAdmin(user?.roles);

  const [pending, setPending] = useState<Resident[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<Resident[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Fetch pending list once on mount and after every approve/reject.
  const refreshPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const res = await apiFetch("/api/admin/residents?pending=true", {
        token,
      });
      if (!res.ok) {
        setPendingError(
          res.status === 403 ? "Not authorised" : "Could not load"
        );
        return;
      }
      const data = await res.json();
      setPending(data.residents ?? []);
      setPendingError(null);
    } catch {
      setPendingError("Network error");
    } finally {
      setPendingLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

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
          setSearchError(
            res.status === 403 ? "Not authorised" : "Search failed"
          );
          setHits([]);
          return;
        }
        const data = await res.json();
        setHits((data.residents ?? []) as Resident[]);
        setSearchError(null);
      } catch {
        setSearchError("Network error");
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, token]);

  async function approveReject(r: Resident, action: "approve" | "reject") {
    if (
      action === "reject" &&
      !confirm(`Reject ${r.name}? Their pending account will be deleted.`)
    ) {
      return;
    }
    setBusyId(r.id);
    try {
      const res = await apiFetch("/api/admin/residents", {
        method: "PATCH",
        token,
        body: JSON.stringify({ residentId: r.id, action }),
      });
      if (res.ok) {
        await refreshPending();
        // If the resident was in the search hits, refresh that view too.
        if (hits.some((h) => h.id === r.id)) {
          setSearch((s) => s); // triggers re-search
        }
      }
    } finally {
      setBusyId(null);
    }
  }

  async function saveResident(
    r: Resident,
    patch: Partial<{
      name: string;
      phone: string;
      block: number;
      flatNumber: string;
      residentType: string;
      isApproved: boolean;
    }>
  ): Promise<boolean> {
    setBusyId(r.id);
    try {
      const res = await apiFetch("/api/admin/residents", {
        method: "PUT",
        token,
        body: JSON.stringify({ residentId: r.id, ...patch }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      const updated: Resident = data.resident;
      setHits((prev) => prev.map((h) => (h.id === r.id ? updated : h)));
      setPending((prev) => prev.map((h) => (h.id === r.id ? updated : h)));
      return true;
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = pending.length;
  const searching2 = search.trim().length >= 2;

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
          <h1 className="text-lg font-semibold text-white">Residents</h1>
          <p className="truncate text-[11px] text-slate-500">
            {pendingCount > 0
              ? `${pendingCount} pending approval${pendingCount !== 1 ? "s" : ""}`
              : "No pending approvals"}
          </p>
        </div>
      </header>

      {/* Pending approvals */}
      <section className="mb-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Pending approval
        </h2>
        {pendingLoading ? (
          <div className="flex justify-center py-6 text-slate-500">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : pendingError ? (
          <p className="rounded-xl border border-red-700/60 bg-red-900/20 px-3 py-2 text-xs text-red-200">
            {pendingError}
          </p>
        ) : pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-700 px-3 py-4 text-center text-[11px] text-slate-500">
            Inbox is empty — all caught up.
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-amber-700/40 bg-amber-900/10 p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">
                    <Clock size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-white">
                        {r.name}
                      </p>
                      <span className="shrink-0 font-mono text-[11px] text-slate-400">
                        B{r.block ?? "—"} · {r.flatNumber}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-400">
                      {r.email}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {r.phone}
                      {r.residentType && (
                        <>
                          <span className="text-slate-600"> · </span>
                          {RESIDENT_TYPE_LABELS[r.residentType as ResidentType] ?? r.residentType}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => approveReject(r, "approve")}
                    disabled={busyId === r.id}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-500 py-2 text-[12px] font-semibold text-white active:bg-emerald-600 disabled:opacity-50"
                  >
                    {busyId === r.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => approveReject(r, "reject")}
                    disabled={busyId === r.id}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-red-700/60 bg-red-900/30 py-2 text-[12px] font-semibold text-red-200 active:bg-red-900/50 disabled:opacity-50"
                  >
                    <X size={12} />
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Search */}
      <section className="mb-3">
        <label className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 px-3">
          <Search size={14} className="text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search residents (name, email, phone, flat)…"
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
        {searchError && (
          <p className="mt-1 text-[11px] text-red-300">{searchError}</p>
        )}
      </section>

      <section className="flex-1 pb-4">
        {!searching2 ? (
          <p className="rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-center text-[11px] text-slate-500">
            Type at least 2 characters to find a resident.
          </p>
        ) : !searching && hits.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-center text-[11px] text-slate-500">
            No residents match.
          </p>
        ) : (
          <ul className="space-y-2">
            {hits.map((r) => (
              <ResidentRow
                key={r.id}
                resident={r}
                expanded={expandedId === r.id}
                canEditDetails={canEditDetails}
                isSuperViewer={isSuperAdmin(user?.roles)}
                busy={busyId === r.id}
                onToggleExpand={() =>
                  setExpandedId((cur) => (cur === r.id ? null : r.id))
                }
                onSave={(patch) => saveResident(r, patch)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ResidentRow({
  resident,
  expanded,
  canEditDetails,
  isSuperViewer,
  busy,
  onToggleExpand,
  onSave,
}: {
  resident: Resident;
  expanded: boolean;
  canEditDetails: boolean;
  isSuperViewer: boolean;
  busy: boolean;
  onToggleExpand: () => void;
  onSave: (
    patch: Partial<{
      name: string;
      phone: string;
      block: number;
      flatNumber: string;
      residentType: string;
      isApproved: boolean;
    }>
  ) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(resident.name);
  const [phone, setPhone] = useState(resident.phone);
  const [block, setBlock] = useState<string>(String(resident.block ?? ""));
  const [flatNumber, setFlatNumber] = useState(resident.flatNumber);
  const [residentType, setResidentType] = useState(
    resident.residentType ?? "OWNER"
  );
  const [err, setErr] = useState<string | null>(null);

  // Sync local state if parent updates resident via save.
  useEffect(() => {
    setName(resident.name);
    setPhone(resident.phone);
    setBlock(String(resident.block ?? ""));
    setFlatNumber(resident.flatNumber);
    setResidentType(resident.residentType ?? "OWNER");
  }, [resident]);

  async function save() {
    setErr(null);
    const blockNum = parseInt(block, 10);
    if (![1, 2, 3, 4].includes(blockNum)) {
      setErr("Block must be 1, 2, 3, or 4");
      return;
    }
    if (!flatNumber.trim()) {
      setErr("Flat number required");
      return;
    }
    const ok = await onSave({
      name: name.trim(),
      phone: phone.trim(),
      block: blockNum,
      flatNumber: flatNumber.trim(),
      residentType,
    });
    if (ok) {
      setEditing(false);
    } else {
      setErr("Could not save (flat may not exist)");
    }
  }

  const isSuper = resident.roles.some((r) => r.name === "SUPERADMIN");
  const otherRoles = resident.roles
    .map((r) => r.name)
    .filter((n) => n !== "SUPERADMIN" && n !== "RESIDENT");

  return (
    <li className="rounded-2xl border border-slate-700 bg-slate-800/60">
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-start gap-3 px-3 py-3 text-left"
      >
        <div
          className={clsx(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full",
            !resident.isApproved
              ? "bg-amber-500/20 text-amber-300"
              : isSuper
                ? "bg-purple-500/20 text-purple-300"
                : "bg-slate-700 text-slate-300"
          )}
        >
          {!resident.isApproved ? (
            <Clock size={16} />
          ) : isSuper ? (
            <Crown size={16} />
          ) : (
            <ShieldCheck size={16} />
          )}
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
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {!resident.isApproved && (
              <Pill color="amber" icon={Clock}>
                Pending
              </Pill>
            )}
            {resident.residentType && (
              <Pill color="slate">
                {RESIDENT_TYPE_LABELS[
                  resident.residentType as ResidentType
                ] ?? resident.residentType}
              </Pill>
            )}
            {isSuper && (
              <Pill color="purple" icon={Crown}>
                SUPERADMIN
              </Pill>
            )}
            {otherRoles.map((r) => (
              <Pill key={r} color="indigo" icon={Sparkles}>
                {r.replace(/_/g, " ")}
              </Pill>
            ))}
          </div>
        </div>
        {expanded ? (
          <ChevronDown size={14} className="mt-1 flex-shrink-0 text-slate-500" />
        ) : (
          <ChevronRight size={14} className="mt-1 flex-shrink-0 text-slate-500" />
        )}
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-slate-700 px-3 py-3">
          {/* Contact actions */}
          <div className="flex gap-1.5">
            <a
              href={`tel:${resident.phone}`}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-200 active:bg-slate-800"
            >
              <Phone size={11} />
              {resident.phone || "—"}
            </a>
            <a
              href={`mailto:${resident.email}`}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-200 active:bg-slate-800"
            >
              <Mail size={11} />
              Email
            </a>
          </div>

          {canEditDetails && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-300 active:bg-slate-800"
            >
              <Pencil size={11} />
              Edit details
            </button>
          )}

          {editing && (
            <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-900/40 p-3">
              <Field label="Name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Phone">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <div className="grid grid-cols-[80px,1fr] gap-2">
                <Field label="Block">
                  <select
                    value={block}
                    onChange={(e) => setBlock(e.target.value)}
                    className={inputCls}
                  >
                    {["1", "2", "3", "4"].map((b) => (
                      <option key={b} value={b}>
                        B{b}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Flat">
                  <input
                    value={flatNumber}
                    onChange={(e) => setFlatNumber(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="Resident type">
                <div className="flex flex-wrap gap-1.5">
                  {RESIDENT_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setResidentType(t)}
                      className={clsx(
                        "rounded-full px-3 py-1 text-[11px] font-medium",
                        residentType === t
                          ? "bg-indigo-500 text-white"
                          : "bg-slate-900 text-slate-300 active:bg-slate-800"
                      )}
                    >
                      {RESIDENT_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </Field>
              {err && (
                <p className="rounded-lg border border-red-700/60 bg-red-900/20 px-2.5 py-1.5 text-[11px] text-red-200">
                  {err}
                </p>
              )}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 py-1.5 text-[12px] font-medium text-slate-300 active:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-indigo-500 py-1.5 text-[12px] font-semibold text-white active:bg-indigo-600 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Check size={11} />
                  )}
                  Save
                </button>
              </div>
            </div>
          )}

          {isSuperViewer && (
            <Link
              to="/admin/roles"
              className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/40 px-3 py-2 text-[11px] text-slate-300 active:bg-slate-800"
            >
              <span className="inline-flex items-center gap-1.5">
                <Crown size={11} />
                Edit roles (Manage roles screen)
              </span>
              <span className="text-slate-500">→</span>
            </Link>
          )}
        </div>
      )}
    </li>
  );
}

function Pill({
  color,
  icon: Icon,
  children,
}: {
  color: "amber" | "slate" | "purple" | "indigo";
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  const cls = {
    amber: "bg-amber-500/20 text-amber-200 border-amber-700/40",
    slate: "bg-slate-700 text-slate-300 border-slate-600",
    purple: "bg-purple-500/20 text-purple-200 border-purple-700/40",
    indigo: "bg-indigo-500/20 text-indigo-200 border-indigo-700/40",
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1.5 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none";
