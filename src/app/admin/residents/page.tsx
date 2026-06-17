"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Search, Pencil, X, Check, AlertCircle } from "lucide-react";
import { isAdmin } from "@/lib/roles";
import {
  RESIDENT_TYPES,
  RESIDENT_TYPE_LABELS,
  RESIDENT_TYPE_BADGE_CLASSES,
  type ResidentType,
} from "@/lib/resident-types";

interface Resident {
  id: string;
  name: string;
  email: string;
  phone: string;
  block: number;
  flatNumber: string;
  residentType: ResidentType;
  isApproved: boolean;
  roles: { name: string }[];
}

interface Flat {
  id: string;
  block: number;
  flatNumber: string;
}

const BLOCKS = [1, 2, 3, 4];

export default function AdminResidentsPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-12"><div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse" /></div>}>
      <AdminResidentsContent />
    </Suspense>
  );
}

function AdminResidentsContent() {
  const { data: session, status: authStatus } = useSession();
  const searchParams = useSearchParams();
  const roles = session?.user?.roles ?? [];
  const hasAccess = isAdmin(roles);

  const [block, setBlock] = useState<string>(searchParams.get("block") ?? "");
  const [flatNumber, setFlatNumber] = useState(searchParams.get("flatNumber") ?? "");
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Resident | null>(null);

  const [autoApprove, setAutoApprove] = useState<boolean | null>(null);
  const [savingFlag, setSavingFlag] = useState(false);

  useEffect(() => {
    if (!hasAccess) return;
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setAutoApprove(!!d.autoApproveRegistrations); })
      .catch(() => {});
  }, [hasAccess]);

  const toggleAutoApprove = useCallback(async () => {
    if (autoApprove === null || savingFlag) return;
    const next = !autoApprove;
    setSavingFlag(true);
    setAutoApprove(next); // optimistic
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoApproveRegistrations: next }),
      });
      if (res.ok) {
        const d = await res.json();
        setAutoApprove(!!d.autoApproveRegistrations);
      } else {
        setAutoApprove(!next); // rollback
      }
    } catch {
      setAutoApprove(!next);
    } finally {
      setSavingFlag(false);
    }
  }, [autoApprove, savingFlag]);

  const runSearch = useCallback(async () => {
    if (!hasAccess) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ search: "1" });
    if (block) params.set("block", block);
    if (flatNumber.trim()) params.set("flatNumber", flatNumber.trim());
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/admin/residents?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setResidents(data.residents);
      setTruncated(!!data.truncated);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Search failed");
      setResidents([]);
      setTruncated(false);
    }
    setSearched(true);
    setLoading(false);
  }, [hasAccess, block, flatNumber, q]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch();
  }

  // Auto-run search if URL params are present (e.g. linked from visit log flat)
  useEffect(() => {
    if (!hasAccess) return;
    if (searchParams.get("block") || searchParams.get("flatNumber") || searchParams.get("q")) {
      runSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess]);

  function clearAll() {
    setBlock("");
    setFlatNumber("");
    setQ("");
    setResidents([]);
    setSearched(false);
    setTruncated(false);
    setError(null);
  }

  if (authStatus === "loading") {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          You do not have access to this page. Admin role required.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Resident Management
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Search by block, flat, name, email or phone. Click <strong>Edit</strong> to update details.
      </p>

      {/* Registration approval toggle */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Auto-approve new registrations</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
            {autoApprove
              ? "On — new residents are approved instantly and can use the app right away. Admins are still notified."
              : "Off — new residents stay pending until an admin approves them here."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!autoApprove}
          disabled={autoApprove === null || savingFlag}
          onClick={toggleAutoApprove}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${autoApprove ? "bg-green-600" : "bg-gray-300 dark:bg-gray-600"}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${autoApprove ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>

      {/* Search form */}
      <form
        onSubmit={onSubmit}
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Block
            </label>
            <select
              value={block}
              onChange={(e) => setBlock(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-sm"
            >
              <option value="">All</option>
              {BLOCKS.map((b) => (
                <option key={b} value={b}>
                  Block {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Flat
            </label>
            <input
              type="text"
              value={flatNumber}
              onChange={(e) => setFlatNumber(e.target.value)}
              placeholder="e.g. 211 or 007/008"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Name / Email / Phone
            </label>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Vishruth or @gmail.com or 9448"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
          >
            <Search size={16} />
            {loading ? "Searching..." : "Search"}
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Clear
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Results */}
      {searched && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              <strong>{residents.length}</strong> result{residents.length === 1 ? "" : "s"}
              {truncated && (
                <span className="ml-2 text-amber-600 dark:text-amber-400">
                  (capped at 200 — refine your search)
                </span>
              )}
            </p>
          </div>
          {residents.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No residents match your filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Flat</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Phone</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {residents.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                        {r.name}
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-200">
                        B{r.block}-{r.flatNumber}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            RESIDENT_TYPE_BADGE_CLASSES[r.residentType] ?? ""
                          }`}
                        >
                          {RESIDENT_TYPE_LABELS[r.residentType] ?? r.residentType}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-200 break-all">
                        {r.email}
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-200">{r.phone}</td>
                      <td className="px-4 py-2">
                        {r.isApproved ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                            <Check size={12} /> Approved
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 dark:text-amber-400">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => setEditing(r)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded"
                        >
                          <Pencil size={12} />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {editing && (
        <EditResidentModal
          resident={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setResidents((prev) =>
              prev.map((r) => (r.id === updated.id ? updated : r))
            );
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────

function EditResidentModal({
  resident,
  onClose,
  onSaved,
}: {
  resident: Resident;
  onClose: () => void;
  onSaved: (r: Resident) => void;
}) {
  const [name, setName] = useState(resident.name);
  const [email, setEmail] = useState(resident.email);
  const [phone, setPhone] = useState(resident.phone);
  const [block, setBlock] = useState<number>(resident.block);
  const [flatNumber, setFlatNumber] = useState(resident.flatNumber);
  const [residentType, setResidentType] = useState<ResidentType>(resident.residentType);
  const [isApproved, setIsApproved] = useState(resident.isApproved);

  const [flats, setFlats] = useState<Flat[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load flats for the selected block
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/flats?block=${block}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setFlats(data.flats ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [block]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/residents", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        residentId: resident.id,
        name,
        email,
        phone,
        block,
        flatNumber,
        residentType,
        isApproved,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Update failed");
      return;
    }
    onSaved(data.resident);
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Edit resident
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-sm"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-sm"
            />
          </Field>
          <Field label="Phone">
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-sm"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Block">
              <select
                value={block}
                onChange={(e) => {
                  const newBlock = parseInt(e.target.value, 10);
                  setBlock(newBlock);
                  setFlatNumber("");
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-sm"
              >
                {BLOCKS.map((b) => (
                  <option key={b} value={b}>
                    Block {b}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Flat">
              <select
                value={flatNumber}
                onChange={(e) => setFlatNumber(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-sm"
              >
                <option value="">Select flat...</option>
                {flats.map((f) => (
                  <option key={f.id} value={f.flatNumber}>
                    {f.flatNumber}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Resident type">
            <select
              value={residentType}
              onChange={(e) => setResidentType(e.target.value as ResidentType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-sm"
            >
              {RESIDENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {RESIDENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={isApproved}
              onChange={(e) => setIsApproved(e.target.checked)}
            />
            Approved
          </label>

          {error && (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
