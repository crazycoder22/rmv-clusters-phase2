"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { isAdmin } from "@/lib/roles";
import { Scale, Plus, Search, X, IndianRupee } from "lucide-react";

type DebtStatus = "OWED" | "PAID" | "WAIVED";

interface Debt {
  id: string;
  residentId: string;
  residentName: string;
  block: number;
  flatNumber: string;
  amount: number;
  reason: string;
  status: DebtStatus;
  sourceType: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  paidAt: string | null;
}

interface ListResponse {
  debts: Debt[];
  totals: Record<DebtStatus, number>;
  counts: Record<DebtStatus, number>;
  grandTotal: number;
}

interface ResidentHit {
  id: string;
  name: string;
  block: number;
  flatNumber: string;
}

const FILTERS: { label: string; value: "" | DebtStatus }[] = [
  { label: "All", value: "" },
  { label: "Owed", value: "OWED" },
  { label: "Paid", value: "PAID" },
  { label: "Waived", value: "WAIVED" },
];

export default function AdminAccountabilityDebtsPage() {
  const { data: session } = useSession();
  const hasAccess = isAdmin(session?.user?.roles ?? []);

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"" | DebtStatus>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = filter ? `?status=${filter}` : "";
    const r = await fetch(`/api/admin/accountability-debts${qs}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    if (hasAccess) void load();
  }, [hasAccess, load]);

  const setStatus = useCallback(
    async (id: string, status: DebtStatus) => {
      setBusyId(id);
      try {
        const r = await fetch(`/api/admin/accountability-debts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (r.ok) await load();
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!confirm("Delete this debt line item?")) return;
      setBusyId(id);
      try {
        const r = await fetch(`/api/admin/accountability-debts/${id}`, { method: "DELETE" });
        if (r.ok) await load();
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  if (!hasAccess) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-sm text-gray-500">
        You don&apos;t have access to this page.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <Scale size={22} /> Accountability Debts
          </h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Per-resident pledges owed from community initiatives
          </p>
        </div>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-semibold text-white dark:text-gray-900"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Totals */}
      {data && (
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <TotalCard label="Outstanding" amount={data.totals.OWED} count={data.counts.OWED} accent="amber" />
          <TotalCard label="Paid" amount={data.totals.PAID} count={data.counts.PAID} accent="emerald" />
          <TotalCard label="Waived" amount={data.totals.WAIVED} count={data.counts.WAIVED} accent="gray" />
          <TotalCard label="Grand total" amount={data.grandTotal} accent="slate" />
        </div>
      )}

      {showAdd && <AddDebtForm onAdded={() => { setShowAdd(false); void load(); }} />}

      {/* Filters */}
      <div className="mt-6 flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              filter === f.value
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <p className="mt-6 text-sm text-gray-400">Loading…</p>
      ) : !data || data.debts.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No debts here.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {data.debts.map((d) => (
            <div
              key={d.id}
              className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {d.residentName}{" "}
                    <span className="font-normal text-gray-400">
                      · {d.block}-{d.flatNumber}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">{d.reason}</p>
                </div>
                <span className="w-20 flex-shrink-0 text-right font-mono text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  ₹{d.amount.toLocaleString("en-IN")}
                </span>
                <StatusBadge status={d.status} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 border-t border-gray-100 dark:border-gray-700 pt-2">
                {d.status !== "PAID" && (
                  <ActionBtn disabled={busyId === d.id} onClick={() => setStatus(d.id, "PAID")}>
                    Mark paid
                  </ActionBtn>
                )}
                {d.status !== "WAIVED" && (
                  <ActionBtn disabled={busyId === d.id} onClick={() => setStatus(d.id, "WAIVED")}>
                    Waive
                  </ActionBtn>
                )}
                {d.status !== "OWED" && (
                  <ActionBtn disabled={busyId === d.id} onClick={() => setStatus(d.id, "OWED")}>
                    Re-open
                  </ActionBtn>
                )}
                <ActionBtn disabled={busyId === d.id} onClick={() => remove(d.id)} danger>
                  Delete
                </ActionBtn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TotalCard({
  label,
  amount,
  count,
  accent,
}: {
  label: string;
  amount: number;
  count?: number;
  accent: "amber" | "emerald" | "gray" | "slate";
}) {
  const ring = {
    amber: "from-amber-50 to-amber-100/40 dark:from-amber-900/20 dark:to-amber-900/10",
    emerald: "from-emerald-50 to-emerald-100/40 dark:from-emerald-900/20 dark:to-emerald-900/10",
    gray: "from-gray-50 to-gray-100/40 dark:from-gray-800 dark:to-gray-800/50",
    slate: "from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-800/50",
  }[accent];
  return (
    <div className={`rounded-xl border border-gray-100 dark:border-gray-700 bg-gradient-to-br ${ring} p-3`}>
      <p className="text-[11px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-0.5 flex items-center text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
        <IndianRupee size={16} className="mt-0.5" />
        {amount.toLocaleString("en-IN")}
      </p>
      {count !== undefined && <p className="text-[11px] text-gray-400">{count} item{count === 1 ? "" : "s"}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: DebtStatus }) {
  const map = {
    OWED: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
    PAID: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
    WAIVED: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300",
  };
  const label = { OWED: "Owed", PAID: "Paid", WAIVED: "Waived" }[status];
  return (
    <span className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[status]}`}>
      {label}
    </span>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-40 ${
        danger
          ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
          : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

function AddDebtForm({ onAdded }: { onAdded: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ResidentHit[]>([]);
  const [picked, setPicked] = useState<ResidentHit | null>(null);
  const [amount, setAmount] = useState("300");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    if (q.trim().length < 2) return;
    const r = await fetch(`/api/admin/residents?search=1&q=${encodeURIComponent(q.trim())}`);
    if (r.ok) {
      const d = await r.json();
      setHits((d.residents ?? d ?? []).slice(0, 8));
    }
  }, [q]);

  const submit = async () => {
    setError(null);
    if (!picked) return setError("Pick a resident");
    const amt = Math.round(Number(amount));
    if (!Number.isFinite(amt) || amt <= 0) return setError("Enter a valid amount");
    if (!reason.trim()) return setError("Enter a reason");
    setSaving(true);
    try {
      const r = await fetch("/api/admin/accountability-debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ residentId: picked.id, amount: amt, reason: reason.trim() }),
      });
      if (r.ok) onAdded();
      else setError((await r.json().catch(() => ({})))?.error || "Failed to add");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Add a debt line item</p>
      {picked ? (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 font-medium">
            {picked.name} · {picked.block}-{picked.flatNumber}
          </span>
          <button onClick={() => setPicked(null)} className="text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Search resident by name…"
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm"
            />
            <button onClick={search} className="rounded-lg bg-gray-200 dark:bg-gray-700 px-3 text-sm">
              <Search size={16} />
            </button>
          </div>
          {hits.length > 0 && (
            <div className="mt-1 max-h-40 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              {hits.map((h) => (
                <button
                  key={h.id}
                  onClick={() => { setPicked(h); setHits([]); setQ(""); }}
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {h.name} <span className="text-gray-400">· {h.block}-{h.flatNumber}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="numeric"
          className="w-24 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm"
          placeholder="Amount"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="flex-1 min-w-[12rem] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm"
          placeholder="Reason (e.g. Reading challenge — not completed)"
        />
        <button
          onClick={submit}
          disabled={saving}
          className="rounded-lg bg-gray-900 dark:bg-gray-100 px-4 py-1.5 text-sm font-semibold text-white dark:text-gray-900 disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
