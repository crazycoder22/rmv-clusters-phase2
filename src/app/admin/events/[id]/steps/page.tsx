"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useRole } from "@/hooks/useRole";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Mail,
  Upload,
  AlertTriangle,
  Search,
} from "lucide-react";

function parseGoal(value: string): number {
  if (!value) return 0;
  const cleaned = value.trim().toUpperCase();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*K$/);
  if (match) return Math.round(parseFloat(match[1]) * 1000);
  return parseInt(cleaned) || 0;
}

interface StepParticipant {
  rsvpId: string | null;
  guestRsvpId: string | null;
  isGuest: boolean;
  name: string;
  block: number;
  flatNumber: string;
  dailyGoal: string;
  steps: number | null;
}

// ── Fuzzy matching helpers ──────────────────────────────

function normalize(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(name: string): string[] {
  return normalize(name).split(" ").filter(Boolean);
}

function matchScore(csvName: string, participantName: string): number {
  const normCsv = normalize(csvName);
  const normPart = normalize(participantName);

  // Exact match
  if (normCsv === normPart) return 100;

  const csvTokens = tokenize(csvName);
  const partTokens = tokenize(participantName);

  // Check how many tokens overlap
  let matches = 0;
  for (const ct of csvTokens) {
    for (const pt of partTokens) {
      if (ct === pt) {
        matches++;
        break;
      }
      // Partial: one starts with the other (handles "piu" vs "piyush" etc.)
      if (ct.length >= 3 && pt.length >= 3) {
        if (ct.startsWith(pt) || pt.startsWith(ct)) {
          matches += 0.7;
          break;
        }
      }
    }
  }

  const maxTokens = Math.max(csvTokens.length, partTokens.length);
  if (maxTokens === 0) return 0;

  let score = (matches / maxTokens) * 80;

  // Bonus: first name matches
  if (csvTokens.length > 0 && partTokens.length > 0 && csvTokens[0] === partTokens[0]) {
    score += 10;
  }

  // Bonus: last name matches
  if (
    csvTokens.length > 1 &&
    partTokens.length > 1 &&
    csvTokens[csvTokens.length - 1] === partTokens[partTokens.length - 1]
  ) {
    score += 10;
  }

  // Bonus: contains match
  if (normCsv.includes(normPart) || normPart.includes(normCsv)) {
    score = Math.max(score, 60);
  }

  return Math.min(score, 100);
}

interface CsvRow {
  name: string;
  steps: number;
}

interface MatchResult {
  csvName: string;
  csvSteps: number;
  matchedKey: string | null; // participant key (r-xxx or g-xxx) or null
  matchedName: string | null;
  confidence: number;
  alternatives: { key: string; name: string; score: number }[];
}

function findBestMatches(
  csvRows: CsvRow[],
  participants: StepParticipant[],
  getKey: (p: StepParticipant) => string
): MatchResult[] {
  // Score all CSV names against all participants
  const scoreMatrix: { csvIdx: number; pKey: string; pName: string; score: number }[] = [];

  for (let ci = 0; ci < csvRows.length; ci++) {
    for (const p of participants) {
      const score = matchScore(csvRows[ci].name, p.name);
      if (score > 0) {
        scoreMatrix.push({ csvIdx: ci, pKey: getKey(p), pName: p.name, score });
      }
    }
  }

  // Sort by score descending for greedy assignment
  scoreMatrix.sort((a, b) => b.score - a.score);

  // Greedy 1:1 assignment — highest-scoring pairs assigned first
  const csvAssigned = new Map<number, { pKey: string; pName: string; score: number }>();
  const usedKeys = new Set<string>();

  for (const s of scoreMatrix) {
    if (csvAssigned.has(s.csvIdx) || usedKeys.has(s.pKey)) continue;
    if (s.score >= 40) {
      csvAssigned.set(s.csvIdx, { pKey: s.pKey, pName: s.pName, score: s.score });
      usedKeys.add(s.pKey);
    }
  }

  // Build results
  return csvRows.map((row, ci) => {
    const alts = participants
      .map((p) => ({ key: getKey(p), name: p.name, score: matchScore(row.name, p.name) }))
      .filter((a) => a.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const assigned = csvAssigned.get(ci);

    return {
      csvName: row.name,
      csvSteps: row.steps,
      matchedKey: assigned?.pKey ?? null,
      matchedName: assigned?.pName ?? null,
      confidence: assigned?.score ?? 0,
      alternatives: alts,
    };
  });
}

// ── CSV parsing ────────────────────────────────────────

function parseCsv(text: string): { rows: CsvRow[]; date: string | null } {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return { rows: [], date: null };

  const headers = lines[0].split(",").map((h) => h.trim());

  // Try to find a date column (last column usually)
  let date: string | null = null;
  for (let i = headers.length - 1; i >= 0; i--) {
    const m = headers[i].match(/^(\d{4}-\d{2}-\d{2})$/);
    if (m) { date = m[1]; break; }
  }

  // Find the Name column and a steps column
  const nameIdx = headers.findIndex((h) => h.toLowerCase() === "name");

  // Prefer the date column for daily steps, fallback to "Total Steps"
  let stepsIdx = -1;
  if (date) {
    stepsIdx = headers.findIndex((h) => h.trim() === date);
  }
  if (stepsIdx < 0) {
    stepsIdx = headers.findIndex(
      (h) => h.toLowerCase().replace(/\s/g, "") === "totalsteps"
    );
  }

  if (nameIdx < 0 || stepsIdx < 0) return { rows: [], date };

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const name = cols[nameIdx];
    const steps = parseInt(cols[stepsIdx]) || 0;
    if (name && steps > 0) {
      rows.push({ name, steps });
    }
  }

  return { rows, date };
}

// ── Component ──────────────────────────────────────────

export default function AdminStepsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { isAdmin, isSuperAdmin, isLoading: roleLoading } = useRole();

  const [eventTitle, setEventTitle] = useState("");
  const [participants, setParticipants] = useState<StepParticipant[]>([]);
  const [stepValues, setStepValues] = useState<Record<string, string>>({});
  const [savedValues, setSavedValues] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"" | "saved" | "error">("");
  const [emailing, setEmailing] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{
    sent: number;
    failed: number;
    skipped: number;
    total: number;
  } | null>(null);
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);
  const [emailTarget, setEmailTarget] = useState<string | null>(null);

  // CSV Import state
  const [showImport, setShowImport] = useState(false);
  const [importMatches, setImportMatches] = useState<MatchResult[]>([]);
  const [importDate, setImportDate] = useState<string | null>(null);
  const [importSearch, setImportSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getKey = (p: StepParticipant) =>
    p.rsvpId ? `r-${p.rsvpId}` : `g-${p.guestRsvpId}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setSaveStatus("");
    try {
      const res = await fetch(
        `/api/admin/events/${id}/steps?date=${selectedDate}`
      );
      if (res.ok) {
        const data = await res.json();
        setEventTitle(data.eventTitle);
        setParticipants(data.participants);
        const vals: Record<string, string> = {};
        for (const p of data.participants) {
          const key = p.rsvpId ? `r-${p.rsvpId}` : `g-${p.guestRsvpId}`;
          vals[key] = p.steps !== null ? String(p.steps) : "";
        }
        setStepValues(vals);
        setSavedValues({ ...vals });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id, selectedDate]);

  useEffect(() => {
    if (!roleLoading && (isAdmin() || isSuperAdmin())) {
      fetchData();
    }
  }, [roleLoading, isAdmin, isSuperAdmin, fetchData]);

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("");
    try {
      const entries = participants.map((p) => {
        const key = getKey(p);
        const val = parseInt(stepValues[key] || "0") || 0;
        return {
          rsvpId: p.rsvpId || undefined,
          guestRsvpId: p.guestRsvpId || undefined,
          steps: val,
        };
      });

      const res = await fetch(`/api/admin/events/${id}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, entries }),
      });

      if (res.ok) {
        setSaveStatus("saved");
        setSavedValues({ ...stepValues });
        setTimeout(() => setSaveStatus(""), 3000);
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const handleEmailStats = async (participantKey?: string) => {
    setEmailing(true);
    setEmailStatus(null);
    try {
      const body: { participantIds?: string[] } = {};
      if (participantKey) body.participantIds = [participantKey];
      const res = await fetch(`/api/admin/events/${id}/steps/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setEmailStatus(data);
      } else {
        const data = await res.json().catch(() => ({}));
        setEmailStatus({ sent: 0, failed: 1, skipped: 0, total: 1 });
        if (data.error) console.error("Email error:", data.error);
      }
    } catch {
      setEmailStatus({ sent: 0, failed: 1, skipped: 0, total: 1 });
    } finally {
      setEmailing(false);
      setShowEmailConfirm(false);
      setEmailTarget(null);
    }
  };

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const hasChanges = Object.keys(stepValues).some(
    (k) => stepValues[k] !== savedValues[k]
  );

  // ── CSV Import handlers ────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows, date } = parseCsv(text);

      if (rows.length === 0) {
        alert("Could not parse CSV. Make sure it has 'Name' and steps columns.");
        return;
      }

      const matches = findBestMatches(rows, participants, getKey);
      setImportMatches(matches);
      setImportDate(date);
      setImportSearch("");
      setShowImport(true);
    };
    reader.readAsText(file);

    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleMatchChange = (csvIdx: number, newKey: string) => {
    setImportMatches((prev) =>
      prev.map((m, i) => {
        if (i !== csvIdx) return m;
        if (newKey === "__none__") {
          return { ...m, matchedKey: null, matchedName: null, confidence: 0 };
        }
        const participant = participants.find((p) => getKey(p) === newKey);
        return {
          ...m,
          matchedKey: newKey,
          matchedName: participant?.name ?? null,
          confidence: participant ? matchScore(m.csvName, participant.name) : 0,
        };
      })
    );
  };

  const handleImportConfirm = () => {
    // If CSV had a date, switch to that date first
    if (importDate && importDate !== selectedDate) {
      setSelectedDate(importDate);
    }

    // Populate step values for matched entries
    const newValues = { ...stepValues };
    for (const match of importMatches) {
      if (match.matchedKey && match.csvSteps > 0) {
        newValues[match.matchedKey] = String(match.csvSteps);
      }
    }
    setStepValues(newValues);
    setShowImport(false);
    setImportMatches([]);
  };

  const matchedCount = importMatches.filter((m) => m.matchedKey).length;
  const unmatchedCount = importMatches.length - matchedCount;
  const highConfCount = importMatches.filter(
    (m) => m.matchedKey && m.confidence >= 70
  ).length;
  const lowConfCount = importMatches.filter(
    (m) => m.matchedKey && m.confidence < 70
  ).length;

  // Filter import matches by search
  const filteredMatches = importSearch
    ? importMatches.filter(
        (m) =>
          m.csvName.toLowerCase().includes(importSearch.toLowerCase()) ||
          (m.matchedName &&
            m.matchedName.toLowerCase().includes(importSearch.toLowerCase()))
      )
    : importMatches;

  // ── Render ────────────────────────────────────────

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!isAdmin() && !isSuperAdmin()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-500">
            You do not have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Link
        href={`/admin/events/${id}/rsvps`}
        className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium mb-6"
      >
        <ArrowLeft size={16} />
        Back to RSVP Tracking
      </Link>

      <h1 className="text-2xl font-bold text-primary-800 mb-1">
        Step Tracking
      </h1>
      <p className="text-gray-500 mb-6">{eventTitle}</p>

      {/* Date picker with nav + Import button */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button
          onClick={() => shiftDate(-1)}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <button
          onClick={() => shiftDate(1)}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
        <span className="text-sm text-gray-500">
          {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </span>

        {/* Import CSV button */}
        {participants.length > 0 && (
          <div className="ml-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Upload size={16} />
              Import CSV
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading...</p>
      ) : participants.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No participants found.
        </p>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600 bg-gray-50">
                  <th className="py-3 px-4 font-medium w-10">#</th>
                  <th className="py-3 px-4 font-medium">Name</th>
                  <th className="py-3 px-4 font-medium">Block / Flat</th>
                  <th className="py-3 px-4 font-medium">Goal</th>
                  <th className="py-3 px-4 font-medium w-32">Steps</th>
                  <th className="py-3 px-4 font-medium w-16 text-center">
                    Met
                  </th>
                  <th className="py-3 px-2 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p, index) => {
                  const key = getKey(p);
                  const val = stepValues[key] || "";
                  const stepsNum = parseInt(val) || 0;
                  const goalNum = parseGoal(p.dailyGoal);
                  const metGoal =
                    stepsNum > 0 && goalNum > 0 && stepsNum >= goalNum;
                  const isChanged = val !== (savedValues[key] || "");
                  return (
                    <tr
                      key={key}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-2 px-4 text-gray-400 text-xs">
                        {index + 1}
                      </td>
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {p.name}
                          </span>
                          {p.isGuest && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-100 text-purple-700">
                              Guest
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-gray-600">
                        B{p.block} - {p.flatNumber}
                      </td>
                      <td className="py-2 px-4 text-gray-600">
                        {p.dailyGoal || "\u2014"}
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={val}
                          onChange={(e) =>
                            setStepValues((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          placeholder="0"
                          className={`w-full px-2 py-1.5 border rounded text-sm text-right focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                            isChanged
                              ? "border-blue-400 bg-blue-50"
                              : "border-gray-300"
                          }`}
                        />
                      </td>
                      <td className="py-2 px-4 text-center">
                        {stepsNum > 0 ? (
                          metGoal ? (
                            <Check
                              size={16}
                              className="inline text-green-600"
                            />
                          ) : (
                            <X size={16} className="inline text-red-400" />
                          )
                        ) : (
                          <span className="text-gray-300">&mdash;</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <button
                          onClick={() => {
                            setEmailTarget(key);
                            setShowEmailConfirm(true);
                          }}
                          disabled={emailing}
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-primary-600 transition-colors disabled:opacity-50"
                          title={`Email stats to ${p.name}`}
                        >
                          <Mail size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Action buttons */}
          <div className="sticky bottom-4 mt-4 flex items-center justify-end gap-3">
            {saveStatus === "saved" && (
              <span className="text-sm text-green-600 font-medium">
                Saved successfully!
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-sm text-red-500 font-medium">
                Failed to save
              </span>
            )}
            {emailStatus && (
              <span
                className={`text-sm font-medium ${
                  emailStatus.failed > 0 ? "text-amber-600" : "text-green-600"
                }`}
              >
                Emails sent: {emailStatus.sent}/{emailStatus.total}
                {emailStatus.failed > 0 &&
                  ` (${emailStatus.failed} failed)`}
                {emailStatus.skipped > 0 &&
                  ` (${emailStatus.skipped} skipped)`}
              </span>
            )}
            <button
              onClick={() => {
                setEmailTarget(null);
                setShowEmailConfirm(true);
              }}
              disabled={emailing || participants.length === 0}
              className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors text-sm shadow-lg flex items-center gap-2"
            >
              <Mail size={16} />
              {emailing ? "Sending..." : "Email Stats"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors text-sm shadow-lg"
            >
              {saving ? "Saving..." : "Save All"}
            </button>
          </div>
        </>
      )}

      {/* Email confirmation modal */}
      {showEmailConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => !emailing && setShowEmailConfirm(false)}
        >
          <div
            className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-blue-100 rounded-full p-2">
                <Mail size={20} className="text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                Email Step Stats
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              {emailTarget
                ? `Send step statistics email to:`
                : `Send step statistics email to all participants with step data.`}
            </p>
            {emailTarget && (
              <p className="text-sm font-medium text-gray-900 mb-1">
                {participants.find((p) => getKey(p) === emailTarget)?.name}
              </p>
            )}
            <p className="text-xs text-gray-500 mb-5">
              Each email includes their rank, stats summary, and a daily
              progress chart.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowEmailConfirm(false);
                  setEmailTarget(null);
                }}
                disabled={emailing}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleEmailStats(emailTarget || undefined)
                }
                disabled={emailing}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {emailing ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Sending...
                  </>
                ) : (
                  "Send Email"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Mapping Modal */}
      {showImport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowImport(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Upload size={20} className="text-primary-600" />
                  Import CSV — Review Mappings
                </h3>
              </div>
              {importDate && (
                <p className="text-sm text-gray-500 mt-1">
                  Date from CSV:{" "}
                  <span className="font-medium text-gray-700">
                    {new Date(importDate + "T12:00:00").toLocaleDateString(
                      "en-IN",
                      { day: "numeric", month: "long", year: "numeric" }
                    )}
                  </span>
                  {importDate !== selectedDate && (
                    <span className="text-amber-600 ml-1">
                      (will switch from current date)
                    </span>
                  )}
                </p>
              )}

              {/* Summary badges */}
              <div className="flex gap-3 mt-3">
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  {highConfCount} high match
                </span>
                {lowConfCount > 0 && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                    {lowConfCount} low match
                  </span>
                )}
                {unmatchedCount > 0 && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    {unmatchedCount} unmatched
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  {importMatches.length} total in CSV
                </span>
              </div>

              {/* Search */}
              {importMatches.length > 10 && (
                <div className="mt-3 relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={importSearch}
                    onChange={(e) => setImportSearch(e.target.value)}
                    placeholder="Search names..."
                    className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              )}
            </div>

            {/* Mapping table */}
            <div className="flex-1 overflow-y-auto px-6 py-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs uppercase tracking-wider">
                    <th className="pb-2 pr-3 font-medium">CSV Name</th>
                    <th className="pb-2 pr-3 font-medium">Steps</th>
                    <th className="pb-2 pr-3 font-medium">Matched Participant</th>
                    <th className="pb-2 font-medium w-20 text-center">Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMatches.map((match, idx) => {
                    const realIdx = importMatches.indexOf(match);
                    return (
                      <tr
                        key={idx}
                        className="border-t border-gray-100 align-top"
                      >
                        <td className="py-2.5 pr-3">
                          <span className="font-medium text-gray-900">
                            {match.csvName}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-gray-600 tabular-nums">
                          {match.csvSteps.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5 pr-3">
                          <select
                            value={match.matchedKey || "__none__"}
                            onChange={(e) =>
                              handleMatchChange(realIdx, e.target.value)
                            }
                            className={`w-full px-2 py-1.5 border rounded text-sm ${
                              !match.matchedKey
                                ? "border-red-300 bg-red-50 text-red-700"
                                : match.confidence >= 70
                                ? "border-green-300 bg-green-50"
                                : "border-yellow-300 bg-yellow-50"
                            }`}
                          >
                            <option value="__none__">
                              — Skip (no match) —
                            </option>
                            {/* Show best alternatives first */}
                            {match.alternatives.length > 0 && (
                              <optgroup label="Best matches">
                                {match.alternatives.map((alt) => (
                                  <option key={alt.key} value={alt.key}>
                                    {alt.name} ({Math.round(alt.score)}%)
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {/* Show all participants */}
                            <optgroup label="All participants">
                              {participants.map((p) => {
                                const key = getKey(p);
                                if (
                                  match.alternatives.some(
                                    (a) => a.key === key
                                  )
                                )
                                  return null;
                                return (
                                  <option key={key} value={key}>
                                    {p.name} (B{p.block}-{p.flatNumber})
                                  </option>
                                );
                              })}
                            </optgroup>
                          </select>
                        </td>
                        <td className="py-2.5 text-center">
                          {match.matchedKey ? (
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                match.confidence >= 70
                                  ? "bg-green-100 text-green-700"
                                  : match.confidence >= 40
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {Math.round(match.confidence)}%
                            </span>
                          ) : (
                            <AlertTriangle
                              size={16}
                              className="inline text-red-400"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
              <p className="text-sm text-gray-500">
                {matchedCount} of {importMatches.length} entries will be
                imported. Review and adjust mappings above.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowImport(false);
                    setImportMatches([]);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportConfirm}
                  disabled={matchedCount === 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  Import {matchedCount} Entries
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
