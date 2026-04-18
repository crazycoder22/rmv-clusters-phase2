"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/useRole";
import {
  ArrowLeft,
  Trophy,
  Trash2,
  Award,
  Coins,
  Search,
  Check,
} from "lucide-react";
import clsx from "clsx";

// ── Types ──────────────────────────────────────────────────────────────────

type MedalTier = "GOLD" | "SILVER" | "BRONZE";

interface Resident {
  id: string;
  name: string;
  block: number;
  flatNumber: string;
}

interface MedalAward {
  id: string;
  game: string;
  tier: MedalTier;
  coins: number;
  reason: string | null;
  createdAt: string;
  recipient: Resident;
  awardedBy: { id: string; name: string };
}

// ── Constants ──────────────────────────────────────────────────────────────

const KNOWN_GAMES = [
  "Wordle",
  "Sudoku",
  "Crossword",
  "Memory",
  "2048",
  "Quiz",
  "Tambola",
  "Fantasy Cricket",
  "Other",
] as const;

const TIER_CONFIG: Record<MedalTier, { label: string; emoji: string; defaultCoins: number; chipBg: string }> = {
  GOLD: { label: "Gold", emoji: "🥇", defaultCoins: 100, chipBg: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  SILVER: { label: "Silver", emoji: "🥈", defaultCoins: 50, chipBg: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" },
  BRONZE: { label: "Bronze", emoji: "🥉", defaultCoins: 25, chipBg: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
};

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminMedalsPage() {
  const { canManageAnnouncements, isLoading: roleLoading } = useRole();
  const router = useRouter();

  // Form state
  const [residents, setResidents] = useState<Resident[]>([]);
  const [residentQuery, setResidentQuery] = useState("");
  const [recipientId, setRecipientId] = useState<string>("");
  const [game, setGame] = useState<string>("Wordle");
  const [otherGame, setOtherGame] = useState("");
  const [tier, setTier] = useState<MedalTier>("GOLD");
  const [coins, setCoins] = useState<number>(TIER_CONFIG.GOLD.defaultCoins);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [justAwarded, setJustAwarded] = useState(false);
  const [error, setError] = useState("");

  // Awards table state
  const [awards, setAwards] = useState<MedalAward[]>([]);
  const [loadingAwards, setLoadingAwards] = useState(true);

  // ── Auth gate ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!roleLoading && !canManageAnnouncements()) router.replace("/");
  }, [roleLoading, canManageAnnouncements, router]);

  // ── Fetch residents (for picker) ────────────────────────────────────────
  useEffect(() => {
    fetch("/api/admin/residents")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.residents ?? []).map((r: Resident) => ({
          id: r.id,
          name: r.name,
          block: r.block,
          flatNumber: r.flatNumber,
        }));
        // Sort by block then name for predictable ordering
        list.sort((a: Resident, b: Resident) =>
          a.block - b.block || a.name.localeCompare(b.name)
        );
        setResidents(list);
      })
      .catch(() => {});
  }, []);

  // ── Fetch awards ────────────────────────────────────────────────────────
  const fetchAwards = () => {
    setLoadingAwards(true);
    fetch("/api/medals?limit=50")
      .then((r) => r.json())
      .then((d) => setAwards(d.awards ?? []))
      .finally(() => setLoadingAwards(false));
  };
  useEffect(fetchAwards, []);

  // Auto-fill coins when tier changes (admin can still override)
  useEffect(() => {
    setCoins(TIER_CONFIG[tier].defaultCoins);
  }, [tier]);

  // Filtered resident list for the picker
  const filteredResidents = useMemo(() => {
    const q = residentQuery.trim().toLowerCase();
    if (!q) return residents.slice(0, 12);
    return residents
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.flatNumber.toLowerCase().includes(q) ||
          `block ${r.block}`.includes(q) ||
          `b${r.block}`.includes(q)
      )
      .slice(0, 12);
  }, [residentQuery, residents]);

  const selectedResident = residents.find((r) => r.id === recipientId);

  // ── Submit ──────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setError("");
    if (!recipientId) return setError("Please pick a recipient.");
    const finalGame = game === "Other" ? otherGame.trim() : game;
    if (!finalGame) return setError("Please specify the game/event.");
    if (coins < 0) return setError("Coins cannot be negative.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/medals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId,
          game: finalGame,
          tier,
          coins,
          reason: reason.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to award medal.");
        return;
      }
      // Reset form, refresh table, flash success
      setRecipientId("");
      setResidentQuery("");
      setReason("");
      setOtherGame("");
      setJustAwarded(true);
      setTimeout(() => setJustAwarded(false), 2500);
      fetchAwards();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(awardId: string) {
    if (!confirm("Delete this award? The recipient's notification will remain in their bell as a record but will no longer link to anything.")) {
      return;
    }
    const res = await fetch(`/api/medals/${awardId}`, { method: "DELETE" });
    if (res.ok) {
      setAwards((prev) => prev.filter((a) => a.id !== awardId));
    } else {
      alert("Failed to delete.");
    }
  }

  if (roleLoading) {
    return (
      <div className="py-12 text-center text-gray-400 dark:text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-primary-400 mb-5"
        >
          <ArrowLeft size={14} /> Back home
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
            <Trophy size={20} className="text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Medals & Coins
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Recognise game winners and community contributions
            </p>
          </div>
        </div>

        {/* Award form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Award size={18} className="text-primary-600 dark:text-primary-400" />
            Award a Medal
          </h2>

          {/* Recipient picker */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Recipient
            </label>
            {selectedResident ? (
              <div className="flex items-center justify-between p-3 border-2 border-primary-300 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {selectedResident.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Block {selectedResident.block} · Flat {selectedResident.flatNumber}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setRecipientId("");
                    setResidentQuery("");
                  }}
                  className="text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    value={residentQuery}
                    onChange={(e) => setResidentQuery(e.target.value)}
                    placeholder="Search by name, block, or flat..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                {filteredResidents.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredResidents.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setRecipientId(r.id);
                          setResidentQuery("");
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-primary-50 dark:hover:bg-gray-700 text-sm"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {r.name}
                        </span>
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          Block {r.block} · {r.flatNumber}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {residents.length === 0 && (
                  <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    Loading residents...
                  </p>
                )}
              </>
            )}
          </div>

          {/* Game */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Game / Event
            </label>
            <select
              value={game}
              onChange={(e) => setGame(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {KNOWN_GAMES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            {game === "Other" && (
              <input
                value={otherGame}
                onChange={(e) => setOtherGame(e.target.value)}
                placeholder="e.g. Best Diwali Decoration"
                className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            )}
          </div>

          {/* Tier */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Medal Tier
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["GOLD", "SILVER", "BRONZE"] as MedalTier[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={clsx(
                    "flex items-center justify-center gap-2 py-3 rounded-lg border-2 text-sm font-medium transition-colors",
                    tier === t
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200"
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                  )}
                >
                  <span className="text-xl">{TIER_CONFIG[t].emoji}</span>
                  {TIER_CONFIG[t].label}
                </button>
              ))}
            </div>
          </div>

          {/* Coins */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <Coins size={14} className="text-amber-500" />
              Coins
            </label>
            <input
              type="number"
              min={0}
              value={coins}
              onChange={(e) => setCoins(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Defaults: Gold 100 · Silver 50 · Bronze 25 (you can override)
            </p>
          </div>

          {/* Reason */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reason <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Won Sunday Bollywood Quiz Night"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || !recipientId}
            className={clsx(
              "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors",
              justAwarded
                ? "bg-green-600 text-white"
                : "bg-primary-600 text-white hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
            )}
          >
            {justAwarded ? (
              <>
                <Check size={16} /> Awarded!
              </>
            ) : (
              <>
                <Trophy size={16} />
                {submitting ? "Awarding..." : "Award Medal"}
              </>
            )}
          </button>
        </div>

        {/* Recent awards table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Recent Awards
          </h2>

          {loadingAwards ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
              Loading...
            </p>
          ) : awards.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
              No awards yet. Award the first one above! 🏆
            </p>
          ) : (
            <div className="space-y-2">
              {awards.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg">{TIER_CONFIG[a.tier].emoji}</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {a.recipient.name}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        Block {a.recipient.block} · {a.recipient.flatNumber}
                      </span>
                      <span
                        className={clsx(
                          "text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded",
                          TIER_CONFIG[a.tier].chipBg
                        )}
                      >
                        {TIER_CONFIG[a.tier].label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      {a.game} · {a.coins} coins
                      {a.reason && ` · ${a.reason}`}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                      Awarded by {a.awardedBy.name} ·{" "}
                      {new Date(a.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    title="Delete award"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
