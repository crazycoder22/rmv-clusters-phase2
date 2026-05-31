"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ListChecks, Plus, Sun, Moon, Trash2, Pencil, X, Search, CheckCircle2,
  Circle, ClipboardList, Settings2,
} from "lucide-react";

type Wave = "MORNING" | "EVENING";

interface Owner { residentId: string; name: string; block: number | null; flatNumber: string }
interface ChecklistRow {
  id: string;
  title: string;
  description: string | null;
  reminderWave: Wave;
  active: boolean;
  itemCount: number;
  owners: Owner[];
}
interface StatusItem { id: string; title: string; done: boolean; doneBy: string | null; doneAt: string | null }
interface StatusRow {
  id: string;
  title: string;
  reminderWave: Wave;
  owners: string[];
  items: StatusItem[];
  doneCount: number;
  totalCount: number;
}

export default function AdminDutiesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<"board" | "config">("board");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [checklists, setChecklists] = useState<ChecklistRow[]>([]);
  const [board, setBoard] = useState<StatusRow[]>([]);
  const [boardDate, setBoardDate] = useState(todayIso());
  const [editing, setEditing] = useState<ChecklistRow | "new" | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const loadConfig = useCallback(async () => {
    const res = await fetch("/api/admin/duty-checklists");
    if (res.status === 403) { setForbidden(true); return; }
    if (res.ok) setChecklists((await res.json()).checklists ?? []);
  }, []);

  const loadBoard = useCallback(async (date: string) => {
    const res = await fetch(`/api/admin/duty-checklists/status?date=${date}`);
    if (res.status === 403) { setForbidden(true); return; }
    if (res.ok) setBoard((await res.json()).checklists ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadConfig(), loadBoard(boardDate)]);
      setLoading(false);
    })();
  }, [loadConfig, loadBoard, boardDate]);

  if (forbidden) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-500 dark:text-gray-400">You don&apos;t have access to staff duties.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <ListChecks className="text-blue-600" /> Staff duties
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Configure duty checklists and track daily completion</p>
          </div>
          {tab === "config" && (
            <button type="button" onClick={() => setEditing("new")} className="inline-flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700">
              <Plus size={16} /> New checklist
            </button>
          )}
        </div>

        <div className="flex gap-1 mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 w-fit">
          <TabBtn active={tab === "board"} onClick={() => setTab("board")} icon={ClipboardList}>Today&apos;s board</TabBtn>
          <TabBtn active={tab === "config"} onClick={() => setTab("config")} icon={Settings2}>Configure</TabBtn>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : tab === "board" ? (
          <Board board={board} boardDate={boardDate} setBoardDate={setBoardDate} />
        ) : (
          <Config checklists={checklists} onEdit={setEditing} onChanged={loadConfig} />
        )}
      </div>

      {editing && (
        <ChecklistEditor
          existing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await Promise.all([loadConfig(), loadBoard(boardDate)]); }}
        />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof ListChecks; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium ${active ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}`}>
      <Icon size={15} />{children}
    </button>
  );
}

function Board({ board, boardDate, setBoardDate }: { board: StatusRow[]; boardDate: string; setBoardDate: (d: string) => void }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <label className="text-sm text-gray-600 dark:text-gray-300">Date</label>
        <input type="date" value={boardDate} max={todayIso()} onChange={(e) => setBoardDate(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm" />
      </div>
      {board.length === 0 ? (
        <Empty text="No active duty checklists yet." />
      ) : (
        <div className="space-y-3">
          {board.map((cl) => {
            const allDone = cl.totalCount > 0 && cl.doneCount === cl.totalCount;
            return (
              <div key={cl.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                      {cl.reminderWave === "MORNING" ? <Sun size={15} className="text-amber-500" /> : <Moon size={15} className="text-indigo-500" />}
                      {cl.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Owners: {cl.owners.length ? cl.owners.join(", ") : "—"}</p>
                  </div>
                  <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${allDone ? "text-green-700 bg-green-100" : cl.doneCount === 0 ? "text-red-700 bg-red-100" : "text-amber-700 bg-amber-100"}`}>
                    {cl.doneCount}/{cl.totalCount} done
                  </span>
                </div>
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {cl.items.map((it) => (
                    <li key={it.id} className="flex items-center gap-3 px-4 py-2.5">
                      {it.done ? <CheckCircle2 size={18} className="text-green-600 shrink-0" /> : <Circle size={18} className="text-gray-300 dark:text-gray-600 shrink-0" />}
                      <span className={`flex-1 text-sm ${it.done ? "text-gray-500 dark:text-gray-400" : "text-gray-800 dark:text-gray-200"}`}>{it.title}</span>
                      {it.done && it.doneBy && <span className="text-xs text-green-600">{it.doneBy} · {it.doneAt ? fmtTime(it.doneAt) : ""}</span>}
                      {!it.done && <span className="text-xs text-red-500">missed</span>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Config({ checklists, onEdit, onChanged }: { checklists: ChecklistRow[]; onEdit: (c: ChecklistRow) => void; onChanged: () => void }) {
  async function del(id: string, title: string) {
    if (!confirm(`Delete "${title}" and its history?`)) return;
    const res = await fetch(`/api/admin/duty-checklists/${id}`, { method: "DELETE" });
    if (res.ok) onChanged();
  }
  async function toggleActive(c: ChecklistRow) {
    const res = await fetch(`/api/admin/duty-checklists/${c.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !c.active }),
    });
    if (res.ok) onChanged();
  }
  if (checklists.length === 0) return <Empty text="No checklists yet. Click “New checklist” to create one." />;
  return (
    <div className="space-y-3">
      {checklists.map((c) => (
        <div key={c.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                {c.reminderWave === "MORNING" ? <Sun size={15} className="text-amber-500" /> : <Moon size={15} className="text-indigo-500" />}
                {c.title}
                {!c.active && <span className="text-xs font-normal text-gray-400 dark:text-gray-500">(paused)</span>}
              </h3>
              {c.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.description}</p>}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{c.itemCount} item{c.itemCount !== 1 ? "s" : ""} · {c.reminderWave === "MORNING" ? "morning" : "evening"} reminder · owners: {c.owners.map((o) => o.name).join(", ") || "none"}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={() => toggleActive(c)} className="text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-700">{c.active ? "Pause" : "Resume"}</button>
              <button type="button" onClick={() => onEdit(c)} className="text-gray-400 dark:text-gray-500 hover:text-blue-600"><Pencil size={17} /></button>
              <button type="button" onClick={() => del(c.id, c.title)} className="text-gray-400 dark:text-gray-500 hover:text-red-600"><Trash2 size={17} /></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChecklistEditor({ existing, onClose, onSaved }: { existing: ChecklistRow | null; onClose: () => void; onSaved: () => void }) {
  const editing = !!existing;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [reminderWave, setReminderWave] = useState<Wave>(existing?.reminderWave ?? "MORNING");
  const [items, setItems] = useState<string[]>([""]);
  const [owners, setOwners] = useState<Owner[]>(existing?.owners ?? []);
  const [loadingItems, setLoadingItems] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // owner search
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Owner[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!existing) return;
    (async () => {
      const res = await fetch(`/api/admin/duty-checklists/${existing.id}`);
      if (res.ok) {
        const d = await res.json();
        setItems((d.items ?? []).map((i: { title: string }) => i.title));
        setOwners(d.owners ?? []);
      }
      setLoadingItems(false);
    })();
  }, [existing]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const term = q.trim();
    if (term.length < 2) { setHits([]); return; }
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/residents/search?q=${encodeURIComponent(term)}`);
      if (res.ok) {
        const found: Owner[] = ((await res.json()).residents ?? []).map((r: { id: string; name: string; block: number | null; flatNumber: string }) => ({ residentId: r.id, name: r.name, block: r.block, flatNumber: r.flatNumber }));
        setHits(found.filter((h) => !owners.some((o) => o.residentId === h.residentId)));
      }
    }, 250);
  }, [q, owners]);

  async function save() {
    setErr(null);
    const cleanItems = items.map((i) => i.trim()).filter(Boolean);
    if (!title.trim()) { setErr("Give the checklist a name"); return; }
    if (cleanItems.length === 0) { setErr("Add at least one item"); return; }
    setBusy(true);
    try {
      const payload = { title: title.trim(), description: description.trim() || null, reminderWave, items: cleanItems, ownerIds: owners.map((o) => o.residentId) };
      const res = editing
        ? await fetch(`/api/admin/duty-checklists/${existing!.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/admin/duty-checklists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { setErr((await res.json().catch(() => null))?.error ?? "Could not save"); return; }
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-gray-100">{editing ? "Edit checklist" : "New checklist"}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600"><X size={18} /></button>
        </div>

        {loadingItems ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Security — morning round" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span></label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reminder wave</label>
              <div className="flex gap-2">
                <WaveBtn active={reminderWave === "MORNING"} onClick={() => setReminderWave("MORNING")} icon={Sun} label="Morning (~7am)" />
                <WaveBtn active={reminderWave === "EVENING"} onClick={() => setReminderWave("EVENING")} icon={Moon} label="Evening (~7pm)" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duty items</label>
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={it} onChange={(e) => setItems((p) => p.map((x, idx) => (idx === i ? e.target.value : x)))} placeholder={`Item ${i + 1} — e.g. Switch off corridor lights`} className={inputCls} />
                    {items.length > 1 && <button type="button" onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))} className="text-gray-400 dark:text-gray-500 hover:text-red-600 shrink-0"><Trash2 size={16} /></button>}
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setItems((p) => [...p, ""])} className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"><Plus size={14} /> Add item</button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assigned staff</label>
              {owners.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {owners.map((o) => (
                    <span key={o.residentId} className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 rounded-full pl-2.5 pr-1 py-0.5 text-xs">
                      {o.name}
                      <button type="button" onClick={() => setOwners((p) => p.filter((x) => x.residentId !== o.residentId))} className="text-blue-400 hover:text-blue-700"><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg px-3">
                <Search size={15} className="text-gray-400 dark:text-gray-500" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search staff to assign…" className="flex-1 py-2 text-sm bg-transparent dark:text-gray-100 focus:outline-none" />
              </div>
              {hits.length > 0 && (
                <div className="mt-1.5 border border-gray-200 dark:border-gray-700 rounded-lg divide-y max-h-44 overflow-y-auto">
                  {hits.map((h) => (
                    <button key={h.residentId} type="button" onClick={() => { setOwners((p) => [...p, h]); setQ(""); setHits([]); }} className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                      <span>{h.name}</span><span className="text-xs text-gray-400 dark:text-gray-500">B{h.block ?? "—"}, {h.flatNumber}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {err && <p className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{err}</p>}
            <button type="button" onClick={save} disabled={busy} className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50">{busy ? "Saving…" : editing ? "Save changes" : "Create checklist"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function WaveBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Sun; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium ${active ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700" : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}>
      <Icon size={15} /> {label}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 py-16 text-center text-gray-500 dark:text-gray-400">
      <ListChecks size={32} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

const inputCls = "w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
function todayIso(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function fmtTime(iso: string): string { return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }); }
