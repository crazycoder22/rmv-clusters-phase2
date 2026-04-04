"use client";

import { useEffect, useState } from "react";

const BLOCKS = [1, 2, 3, 4];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ── Types ──────────────────────────────────────────────────────────────────

interface Staff {
  id: string;
  name: string;
  active: boolean;
}

interface Assignment {
  id: string;
  block: number;
  staffId: string;
  staff: Staff;
}

interface FeedbackEntry {
  id: string;
  block: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  resident: { name: string; block: number; flatNumber: string } | null;
  guestName: string | null;
  guestFlat: string | null;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StaffTab() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function load() {
    const res = await fetch("/api/admin/housekeeping/staff");
    if (res.ok) setStaffList((await res.json()).staff);
  }

  useEffect(() => { load(); }, []);

  async function addStaff() {
    if (!newName.trim()) return;
    await fetch("/api/admin/housekeeping/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    setNewName("");
    load();
  }

  async function toggleActive(s: Staff) {
    await fetch(`/api/admin/housekeeping/staff/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !s.active }),
    });
    load();
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    await fetch(`/api/admin/housekeeping/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    setEditId(null);
    load();
  }

  async function deleteStaff(id: string) {
    if (!confirm("Delete this staff member?")) return;
    await fetch(`/api/admin/housekeeping/staff/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-5">
      {/* Add */}
      <div className="flex gap-2">
        <input
          value={newName} onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addStaff()}
          placeholder="Staff name" className="border rounded px-3 py-1.5 text-sm flex-1"
        />
        <button onClick={addStaff} className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded hover:bg-blue-700">Add</button>
      </div>

      {/* List */}
      <table className="w-full text-sm border rounded overflow-hidden">
        <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
          <tr>
            <th className="text-left px-4 py-2">Name</th>
            <th className="text-left px-4 py-2">Status</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {staffList.map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-2">
                {editId === s.id ? (
                  <input
                    value={editName} onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit(s.id)}
                    className="border rounded px-2 py-1 text-sm w-full"
                    autoFocus
                  />
                ) : (
                  <span className={s.active ? "" : "text-gray-400 line-through"}>{s.name}</span>
                )}
              </td>
              <td className="px-4 py-2">
                <button
                  onClick={() => toggleActive(s)}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                >
                  {s.active ? "Active" : "Inactive"}
                </button>
              </td>
              <td className="px-4 py-2 text-right space-x-2">
                {editId === s.id ? (
                  <>
                    <button onClick={() => saveEdit(s.id)} className="text-blue-600 hover:underline text-xs">Save</button>
                    <button onClick={() => setEditId(null)} className="text-gray-400 hover:underline text-xs">Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditId(s.id); setEditName(s.name); }} className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button onClick={() => deleteStaff(s.id)} className="text-red-500 hover:underline text-xs">Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {staffList.length === 0 && (
            <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-400 text-sm">No staff added yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AssignmentsTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Record<number, string>>({});

  async function loadAssignments() {
    const res = await fetch(`/api/admin/housekeeping/assignments?month=${month}&year=${year}`);
    if (res.ok) setAssignments((await res.json()).assignments);
  }

  async function loadStaff() {
    const res = await fetch("/api/admin/housekeeping/staff");
    if (res.ok) setAllStaff((await res.json()).staff.filter((s: Staff) => s.active));
  }

  useEffect(() => { loadStaff(); }, []);
  useEffect(() => { loadAssignments(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [month, year]);

  async function assign(block: number) {
    const staffId = selectedStaff[block];
    if (!staffId) return;
    const res = await fetch("/api/admin/housekeeping/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId, block, month, year }),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error ?? "Failed to assign");
      return;
    }
    setSelectedStaff((prev) => ({ ...prev, [block]: "" }));
    loadAssignments();
  }

  async function removeAssignment(id: string) {
    await fetch(`/api/admin/housekeeping/assignments/${id}`, { method: "DELETE" });
    loadAssignments();
  }

  return (
    <div className="space-y-5">
      {/* Month picker */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Month:</label>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="border rounded px-3 py-1.5 text-sm">
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m} {year}</option>)}
        </select>
      </div>

      {/* Per-block grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {BLOCKS.map((block) => {
          const blockAssignments = assignments.filter((a) => a.block === block);
          const canAdd = blockAssignments.length < 2;
          return (
            <div key={block} className="border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Block {block}</h3>
              <ul className="space-y-1">
                {blockAssignments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                      {a.staff.name}
                    </span>
                    <button onClick={() => removeAssignment(a.id)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                  </li>
                ))}
                {blockAssignments.length === 0 && <li className="text-xs text-gray-400">No staff assigned</li>}
              </ul>
              {canAdd && (
                <div className="flex gap-2">
                  <select
                    value={selectedStaff[block] ?? ""}
                    onChange={(e) => setSelectedStaff((prev) => ({ ...prev, [block]: e.target.value }))}
                    className="border rounded px-2 py-1 text-sm flex-1"
                  >
                    <option value="">Select staff…</option>
                    {allStaff
                      .filter((s) => !blockAssignments.some((a) => a.staffId === s.id))
                      .map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button
                    onClick={() => assign(block)}
                    disabled={!selectedStaff[block]}
                    className="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-40"
                  >
                    Assign
                  </button>
                </div>
              )}
              {!canAdd && <p className="text-xs text-gray-400">2 staff assigned (max reached)</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FeedbackTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());
  const [blockFilter, setBlockFilter] = useState<number | "">("");
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, blockFilter]);

  async function loadFeedback() {
    setLoading(true);
    const params = new URLSearchParams({ month: String(month), year: String(year) });
    if (blockFilter) params.set("block", String(blockFilter));
    const res = await fetch(`/api/admin/housekeeping/feedback?${params}`);
    if (res.ok) setFeedbackList((await res.json()).feedback);
    setLoading(false);
  }

  const avgRating = feedbackList.length
    ? (feedbackList.reduce((sum, f) => sum + f.rating, 0) / feedbackList.length).toFixed(1)
    : null;

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Month:</label>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="border rounded px-3 py-1.5 text-sm">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m} {year}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Block:</label>
          <select value={blockFilter} onChange={(e) => setBlockFilter(e.target.value ? Number(e.target.value) : "")} className="border rounded px-3 py-1.5 text-sm">
            <option value="">All</option>
            {BLOCKS.map((b) => <option key={b} value={b}>Block {b}</option>)}
          </select>
        </div>
        {avgRating && (
          <span className="ml-auto text-sm text-gray-600">
            Avg rating: <span className="font-semibold text-yellow-500">{avgRating} ★</span> ({feedbackList.length} reviews)
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : feedbackList.length === 0 ? (
        <p className="text-sm text-gray-400">No feedback for this period.</p>
      ) : (
        <div className="space-y-3">
          {feedbackList.map((f) => {
            const name = f.resident?.name ?? f.guestName ?? "Anonymous";
            const flat = f.resident?.flatNumber ?? f.guestFlat ?? "";
            return (
              <div key={f.id} className="bg-white border rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {name}{flat ? ` · Flat ${flat}` : ""} · Block {f.block}
                    </p>
                    {f.comment && <p className="text-sm text-gray-600 mt-1">{f.comment}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(f.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <span className="text-yellow-400 text-sm shrink-0">{"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

type Tab = "staff" | "assignments" | "feedback";

export default function AdminHousekeepingPage() {
  const [tab, setTab] = useState<Tab>("staff");

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Housekeeping Management</h1>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {(["staff", "assignments", "feedback"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "staff" && <StaffTab />}
      {tab === "assignments" && <AssignmentsTab />}
      {tab === "feedback" && <FeedbackTab />}
    </div>
  );
}
