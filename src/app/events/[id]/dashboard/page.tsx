"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Search,
  Users,
  X,
  TrendingUp,
  Target,
  Calendar,
  Flame,
  CheckCircle,
  BarChart3,
  Share2,
} from "lucide-react";
import type { CustomFieldType } from "@/types";

const ORANGE = "#f59e0b";
const CHALLENGE_DAYS = 14;

interface StepDayEntry {
  date: string;
  steps: number;
}

interface DashboardParticipant {
  id: string;
  name: string;
  block: number;
  flatNumber: string;
  paid: boolean;
  fieldResponses: {
    customFieldId: string;
    customField: { label: string };
    value: string;
  }[];
  createdAt: string;
  totalSteps: number;
  dailyGoal: number;
  daysTracked: number;
  daysGoalMet: number;
  averageDailySteps: number;
  bestDay: StepDayEntry | null;
  dailySteps: StepDayEntry[];
  runs?: {
    k5: { goal: number; done: number };
    k10: { goal: number; done: number };
    k20: { goal: number; done: number };
  } | null;
  partner?: { name: string; status: string } | null;
}

export default function EventDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = useSession();
  const myName = session?.user?.name ?? null;

  const [eventTitle, setEventTitle] = useState("");
  const [eventSummary, setEventSummary] = useState("");
  const [eventDate, setEventDate] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<CustomFieldType[]>([]);
  const [participants, setParticipants] = useState<DashboardParticipant[]>([]);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [hasStepTracking, setHasStepTracking] = useState(false);
  const [stepLeaderboard, setStepLeaderboard] = useState<DashboardParticipant[]>([]);
  const [totalStepTarget, setTotalStepTarget] = useState(0);
  const [totalActualSteps, setTotalActualSteps] = useState(0);
  const [onTrackCount, setOnTrackCount] = useState(0);
  const [totalWithGoal, setTotalWithGoal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"daysMet" | "name" | "total" | "average">("daysMet");
  const [selectedParticipant, setSelectedParticipant] = useState<DashboardParticipant | null>(null);
  const [shareMsg, setShareMsg] = useState("");

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch(`/api/events/${id}/dashboard`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to load dashboard");
          return;
        }
        const data = await res.json();
        setEventTitle(data.announcement.title);
        setEventSummary(data.announcement.summary);
        setEventDate(data.announcement.date ?? null);
        setCustomFields(data.eventConfig.customFields || []);
        setParticipants(data.participants);
        setTotalParticipants(data.totalParticipants);
        setHasStepTracking(data.hasStepTracking);
        setStepLeaderboard(data.stepLeaderboard || []);
        setTotalStepTarget(data.totalStepTarget || 0);
        setTotalActualSteps(data.totalActualSteps || 0);
        setOnTrackCount(data.onTrackCount || 0);
        setTotalWithGoal(data.totalWithGoal || 0);
      } catch {
        setError("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, [id]);

  // Challenge day / live indicator
  const start = eventDate ? new Date(eventDate) : null;
  const dayNum = start
    ? Math.min(CHALLENGE_DAYS, Math.max(1, Math.floor((Date.now() - start.getTime()) / 86400000) + 1))
    : null;
  const isLive = start
    ? Date.now() >= start.getTime() && Date.now() < start.getTime() + CHALLENGE_DAYS * 86400000
    : false;

  // Sort + filter (step path)
  const sortedLeaderboard = [...stepLeaderboard].sort((a, b) => {
    if (sortBy === "name") return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    if (sortBy === "average") return b.averageDailySteps - a.averageDailySteps;
    if (sortBy === "total") return b.totalSteps - a.totalSteps;
    // daysMet (default): most goal-days met first, then alphabetical so the
    // people keeping their promise stay at the top.
    return (b.daysGoalMet - a.daysGoalMet) || a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
  const displayList = hasStepTracking ? sortedLeaderboard : participants;
  const filteredParticipants = searchTerm
    ? displayList.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          `B${p.block}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.flatNumber.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : displayList;

  const topSteps =
    stepLeaderboard.length > 0 ? Math.max(...stepLeaderboard.map((p) => p.totalSteps)) : 0;

  // Logged-in resident's own row (matched by name) — powers the "Your progress" card.
  const me = myName ? stepLeaderboard.find((p) => p.name === myName) ?? null : null;
  const meInitials = me
    ? me.name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
    : "";
  const meDaysMetColor =
    me && me.dailyGoal > 0 && me.daysGoalMet === me.daysTracked && me.daysTracked > 0
      ? "var(--success)"
      : "var(--text)";

  // Build a WhatsApp-friendly text summary of the challenge to share.
  function buildShareSummary(): string {
    const lines: string[] = [];
    const dayTag = hasStepTracking && dayNum !== null ? ` — Day ${dayNum}/${CHALLENGE_DAYS}` : "";
    lines.push(`🏃 ${eventTitle}${dayTag}`);
    lines.push("");
    lines.push(`👥 Participants: ${totalParticipants.toLocaleString("en-IN")}`);
    if (totalStepTarget > 0) lines.push(`🎯 Total goal: ${totalStepTarget.toLocaleString("en-IN")} steps`);
    lines.push(`👟 Total steps: ${totalActualSteps.toLocaleString("en-IN")}`);
    if (totalStepTarget > 0) {
      const pct = Math.round((totalActualSteps / totalStepTarget) * 100);
      lines.push(`📈 Progress: ${pct}% of goal`);
    }
    if (totalWithGoal > 0) lines.push(`✅ On track: ${onTrackCount}/${totalWithGoal}`);

    if (typeof window !== "undefined") {
      lines.push("");
      lines.push(window.location.href);
    }
    return lines.join("\n");
  }

  async function handleShare() {
    const text = buildShareSummary();
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: eventTitle, text });
        return; // native share sheet handled it
      }
    } catch (e) {
      // user dismissed the share sheet — stop, don't also copy
      if ((e as Error).name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareMsg("Summary copied — paste it anywhere to share");
    } catch {
      setShareMsg("Couldn't copy the summary");
    }
    setTimeout(() => setShareMsg(""), 3000);
  }

  if (loading) {
    return (
      <div className="max-w-[1180px] mx-auto px-6 py-12" style={{ color: "var(--text-3)" }}>
        <p className="text-center text-sm">Loading dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1180px] mx-auto px-6 py-12 text-center">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>Dashboard</h1>
        <p className="mb-4" style={{ color: "var(--text-2)" }}>{error}</p>
        <Link href={`/events/${id}/rsvp`} className="text-sm font-medium" style={{ color: "var(--accent)" }}>
          &larr; Back to Event
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-10" style={{ color: "var(--text)" }}>
      {/* Back */}
      <Link
        href={`/events/${id}/rsvp`}
        className="inline-flex items-center gap-2 text-sm font-semibold mb-7"
        style={{ color: "var(--text-2)" }}
      >
        <ArrowLeft size={20} /> Back to Event
      </Link>

      {/* Challenge header */}
      <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
        <div className="max-w-[640px]">
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none">🏃</span>
            <h1 className="text-3xl sm:text-[38px] font-extrabold tracking-tight leading-tight" style={{ color: "var(--text)" }}>
              {eventTitle}
            </h1>
          </div>
          {eventSummary && (
            <p className="mt-3.5 text-base leading-relaxed" style={{ color: "var(--text-2)" }}>{eventSummary}</p>
          )}
          {hasStepTracking && dayNum !== null && (
            <div className="mt-3.5 flex items-center gap-2 font-mono text-xs tracking-wider" style={{ color: "var(--text-3)" }}>
              <span className="inline-flex w-[7px] h-[7px] rounded-full" style={{ background: isLive ? "var(--success)" : "var(--text-3)" }} />
              DAY {dayNum} OF {CHALLENGE_DAYS}{isLive ? " · LIVE" : ""}
            </div>
          )}
        </div>
        {hasStepTracking && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 font-bold text-base px-5 py-3.5 rounded-[13px] whitespace-nowrap"
              style={{ border: "1px solid var(--border-strong)", color: "var(--accent)", background: "var(--surface)" }}
            >
              <Share2 size={19} /> Share
            </button>
            <Link
              href={`/steps/${id}`}
              className="inline-flex items-center gap-2.5 font-bold text-base text-white px-6 py-3.5 rounded-[13px] whitespace-nowrap"
              style={{ background: "var(--accent-strong)", boxShadow: "0 10px 26px var(--accent-soft)" }}
            >
              <span className="text-lg leading-none">🏃</span> Enter my steps
            </Link>
          </div>
        )}
      </div>

      {/* Summary cards */}
      {hasStepTracking ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-9">
          <StatCard icon={<Users size={24} />} tint="var(--accent-soft)" ic="var(--accent)" value={totalParticipants.toLocaleString("en-IN")} label="Participants" />
          <StatCard icon={<Flame size={24} />} tint="rgba(245,158,11,0.16)" ic={ORANGE} value={topSteps.toLocaleString("en-IN")} label="Top Steps" />
          <StatCard icon={<CheckCircle size={24} />} tint="var(--success-soft)" ic="var(--success)" value={`${onTrackCount} / ${totalWithGoal}`} label="On Track" />
          <StatCard icon={<Target size={24} />} tint="var(--accent-soft)" ic="var(--accent)" value={totalStepTarget > 0 ? totalStepTarget.toLocaleString("en-IN") : "—"} label="Total Step Target" />
          <StatCard icon={<TrendingUp size={24} />} tint="var(--accent-soft)" ic="var(--accent)" value={totalActualSteps.toLocaleString("en-IN")} label="Total Actual Steps" />
        </div>
      ) : (
        <div className="mb-8">
          <StatCard icon={<Users size={24} />} tint="var(--accent-soft)" ic="var(--accent)" value={totalParticipants.toLocaleString("en-IN")} label="Participants" />
        </div>
      )}

      {/* Your progress */}
      {hasStepTracking && me && (
        <div
          className="flex flex-wrap items-center justify-between gap-5 sm:gap-6 rounded-[20px] px-5 sm:px-[26px] py-5 sm:py-[22px] mb-8"
          style={{
            background: "linear-gradient(180deg,var(--accent-soft),transparent),var(--surface)",
            border: "1.5px solid var(--accent-strong)",
            boxShadow: "0 14px 40px var(--accent-soft)",
          }}
        >
          <div className="flex items-center gap-4 sm:gap-[18px] min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-[16px] flex items-center justify-center font-extrabold text-lg sm:text-xl text-white flex-shrink-0" style={{ background: "var(--accent-strong)" }}>
              {meInitials}
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[11px] tracking-[0.14em] font-semibold" style={{ color: "var(--accent)" }}>YOUR PROGRESS</div>
              <div className="flex items-center gap-2.5 mt-1">
                <span className="font-extrabold text-xl sm:text-[22px] tracking-tight truncate" style={{ color: "var(--text)" }}>{me.name}</span>
                <span className="text-[10px] font-extrabold tracking-wider text-white px-1.5 py-0.5 rounded-md flex-shrink-0" style={{ background: "var(--accent-strong)" }}>YOU</span>
              </div>
              <div className="font-mono text-[11.5px] mt-1" style={{ color: "var(--text-3)" }}>B{me.block} · {me.flatNumber}</div>
            </div>
          </div>
          <div className="flex items-center gap-6 sm:gap-[30px] flex-wrap">
            <div className="text-center">
              <div className="font-extrabold text-2xl leading-none tracking-tight" style={{ color: "var(--text)" }}>{me.totalSteps.toLocaleString("en-IN")}</div>
              <div className="font-mono text-[10px] tracking-widest mt-1.5" style={{ color: "var(--text-3)" }}>TOTAL</div>
            </div>
            <div className="text-center">
              <div className="font-extrabold text-2xl leading-none tracking-tight" style={{ color: "var(--text)" }}>{me.averageDailySteps.toLocaleString("en-IN")}</div>
              <div className="font-mono text-[10px] tracking-widest mt-1.5" style={{ color: "var(--text-3)" }}>AVG / DAY</div>
            </div>
            <div className="text-center">
              <div className="font-extrabold text-2xl leading-none tracking-tight" style={{ color: meDaysMetColor }}>{me.dailyGoal > 0 ? `${me.daysGoalMet}/${me.daysTracked}` : "—"}</div>
              <div className="font-mono text-[10px] tracking-widest mt-1.5" style={{ color: "var(--text-3)" }}>DAYS MET</div>
            </div>
            <button
              onClick={() => setSelectedParticipant(me)}
              className="inline-flex items-center gap-2 font-bold text-[14.5px] text-white px-5 py-3 rounded-[12px] whitespace-nowrap"
              style={{ background: "var(--accent-strong)" }}
            >
              <BarChart3 size={19} /> View my details
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      {hasStepTracking && stepLeaderboard.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-5 mb-5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold" style={{ color: "var(--text-2)" }}>Sort by</span>
            <div className="flex flex-wrap gap-2">
              <SortPill active={sortBy === "daysMet"} onClick={() => setSortBy("daysMet")}>Days Met</SortPill>
              <SortPill active={sortBy === "name"} onClick={() => setSortBy("name")}>Name</SortPill>
              <SortPill active={sortBy === "total"} onClick={() => setSortBy("total")}>Total Steps</SortPill>
              <SortPill active={sortBy === "average"} onClick={() => setSortBy("average")}>Avg / Day</SortPill>
            </div>
          </div>
          <div className="relative flex-1 min-w-[280px] max-w-[420px]">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, block, or flat…"
              className="w-full rounded-[13px] py-3 pl-12 pr-4 text-sm outline-none"
              style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
            />
          </div>
        </div>
      )}

      {/* Leaderboard / participants */}
      {hasStepTracking ? (
        filteredParticipants.length === 0 ? (
          <div className="rounded-[20px] p-10 text-center text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-3)" }}>
            {searchTerm ? `No participants match “${searchTerm}”.` : "No participants yet."}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block rounded-[20px] overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div
                className="grid items-center px-6 py-4 font-mono text-[11px] tracking-wider"
                style={{ gridTemplateColumns: "1fr 130px 130px 120px 132px", borderBottom: "1px solid var(--border)", color: "var(--text-3)" }}
              >
                <div>PARTICIPANT</div>
                <div className="text-right">TOTAL</div>
                <div className="text-right">AVG / DAY</div>
                <div className="text-center">DAYS MET</div>
                <div />
              </div>
              {filteredParticipants.map((p) => {
                const you = !!myName && p.name === myName;
                return (
                  <div
                    key={p.id}
                    className="grid items-center px-6 py-4"
                    style={{ gridTemplateColumns: "1fr 130px 130px 120px 132px", borderTop: "1px solid var(--border)", background: you ? "var(--accent-soft)" : "transparent" }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-bold text-base truncate" style={{ color: "var(--text)" }}>{p.name}</span>
                      {you && <span className="text-[10px] font-extrabold tracking-wider text-white px-1.5 py-0.5 rounded-md flex-shrink-0" style={{ background: "var(--accent-strong)" }}>YOU</span>}
                      <span className="font-mono text-[11px] flex-shrink-0" style={{ color: "var(--text-3)" }}>B{p.block} · {p.flatNumber}</span>
                    </div>
                    <div className="text-right font-extrabold text-[17px]" style={{ color: "var(--text)" }}>{p.totalSteps.toLocaleString("en-IN")}</div>
                    <div className="text-right font-semibold text-[15px]" style={{ color: "var(--text-2)" }}>{p.averageDailySteps.toLocaleString("en-IN")}</div>
                    <div className="text-center font-bold text-[15px]" style={{ color: p.dailyGoal > 0 && p.daysGoalMet === p.daysTracked && p.daysTracked > 0 ? "var(--success)" : "var(--text-2)" }}>
                      {p.dailyGoal > 0 ? `${p.daysGoalMet}/${p.daysTracked}` : "—"}
                    </div>
                    <div className="text-right">
                      <button onClick={() => setSelectedParticipant(p)} className="font-semibold text-[13.5px] px-4 py-2 rounded-[10px]" style={{ border: "1px solid var(--border-strong)", color: "var(--accent)", background: "transparent" }}>
                        View Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {filteredParticipants.map((p) => {
                const you = !!myName && p.name === myName;
                return (
                  <div key={p.id} className="rounded-[16px] p-4" style={{ background: you ? "var(--accent-soft)" : "var(--surface)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-bold truncate" style={{ color: "var(--text)" }}>{p.name}</p>
                        {you && <span className="text-[10px] font-extrabold text-white px-1.5 py-0.5 rounded-md" style={{ background: "var(--accent-strong)" }}>YOU</span>}
                      </div>
                      <span className="font-mono text-[11px] flex-shrink-0" style={{ color: "var(--text-3)" }}>B{p.block} · {p.flatNumber}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><p className="text-lg font-extrabold" style={{ color: "var(--text)" }}>{p.totalSteps.toLocaleString("en-IN")}</p><p className="text-[10px] uppercase" style={{ color: "var(--text-3)" }}>Total</p></div>
                      <div><p className="text-lg font-bold" style={{ color: "var(--text-2)" }}>{p.averageDailySteps.toLocaleString("en-IN")}</p><p className="text-[10px] uppercase" style={{ color: "var(--text-3)" }}>Avg/Day</p></div>
                      <div><p className="text-lg font-bold" style={{ color: "var(--text-2)" }}>{p.dailyGoal > 0 ? `${p.daysGoalMet}/${p.daysTracked}` : "—"}</p><p className="text-[10px] uppercase" style={{ color: "var(--text-3)" }}>Days Met</p></div>
                    </div>
                    <button onClick={() => setSelectedParticipant(p)} className="w-full mt-3 py-2 text-[13px] font-semibold rounded-[10px]" style={{ border: "1px solid var(--border-strong)", color: "var(--accent)" }}>
                      View Details
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-2 mt-5" style={{ color: "var(--text-3)" }}>
              <Users size={18} />
              <span className="text-[13.5px]">Showing {filteredParticipants.length} of {displayList.length} participants</span>
            </div>
          </>
        )
      ) : (
        <RegistrationTable
          participants={filteredParticipants}
          customFields={customFields}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          showSearch={totalParticipants > 5}
        />
      )}

      {selectedParticipant && (
        <DetailsModal participant={selectedParticipant} onClose={() => setSelectedParticipant(null)} />
      )}

      {shareMsg && (
        <div
          className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[60] px-5 py-3 rounded-[12px] text-sm font-semibold text-white"
          style={{ background: "var(--accent-strong)", boxShadow: "0 12px 30px rgba(0,0,0,0.3)" }}
        >
          {shareMsg}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, tint, ic, value, label }: { icon: React.ReactNode; tint: string; ic: string; value: string; label: string }) {
  return (
    <div className="rounded-[18px] p-5 flex flex-col gap-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="w-[46px] h-[46px] rounded-[13px] flex items-center justify-center" style={{ background: tint, color: ic }}>{icon}</div>
      <div>
        <div className="text-[28px] font-extrabold tracking-tight leading-none" style={{ color: "var(--text)" }}>{value}</div>
        <div className="text-[13.5px] mt-1.5 leading-tight" style={{ color: "var(--text-2)" }}>{label}</div>
      </div>
    </div>
  );
}

function SortPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-[18px] py-2.5 rounded-full font-semibold text-sm"
      style={active
        ? { background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid transparent" }
        : { background: "var(--surface)", color: "var(--text-2)", border: "1px solid var(--border)" }}
    >
      {children}
    </button>
  );
}

function RegistrationTable({
  participants, customFields, searchTerm, setSearchTerm, showSearch,
}: {
  participants: DashboardParticipant[];
  customFields: CustomFieldType[];
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  showSearch: boolean;
}) {
  return (
    <>
      {showSearch && (
        <div className="relative mb-4 max-w-[420px]">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
          <input
            type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, block, or flat…"
            className="w-full rounded-[13px] py-3 pl-12 pr-4 text-sm outline-none"
            style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
          />
        </div>
      )}
      <div className="rounded-[20px] overflow-x-auto" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left font-mono text-[11px] tracking-wider" style={{ color: "var(--text-3)", borderBottom: "1px solid var(--border)" }}>
              <th className="py-4 px-5 font-medium w-10">#</th>
              <th className="py-4 px-5 font-medium">NAME</th>
              <th className="py-4 px-5 font-medium">BLOCK / FLAT</th>
              {customFields.map((cf) => <th key={cf.id} className="py-4 px-5 font-medium uppercase">{cf.label}</th>)}
              <th className="py-4 px-5 font-medium">REGISTERED</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p, index) => (
              <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="py-3.5 px-5 text-xs" style={{ color: "var(--text-3)" }}>{index + 1}</td>
                <td className="py-3.5 px-5 font-semibold" style={{ color: "var(--text)" }}>{p.name}</td>
                <td className="py-3.5 px-5" style={{ color: "var(--text-2)" }}>B{p.block} · {p.flatNumber}</td>
                {customFields.map((cf) => {
                  const r = p.fieldResponses.find((fr) => fr.customFieldId === cf.id);
                  return <td key={cf.id} className="py-3.5 px-5" style={{ color: "var(--text-2)" }}>{r?.value || "—"}</td>;
                })}
                <td className="py-3.5 px-5 text-xs whitespace-nowrap" style={{ color: "var(--text-3)" }}>
                  {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {participants.length === 0 && (
          <p className="py-10 text-center text-sm" style={{ color: "var(--text-3)" }}>
            {searchTerm ? "No participants match your search." : "No participants yet."}
          </p>
        )}
      </div>
    </>
  );
}

function DetailsModal({ participant: p, onClose }: { participant: DashboardParticipant; onClose: () => void }) {
  const scaleMax = Math.max((p.dailyGoal || 1) * 1.12, Math.max(...p.dailySteps.map((d) => d.steps), 1) * 1.08);
  const chartH = 178;
  const goalBottom = p.dailyGoal > 0 ? Math.round((p.dailyGoal / scaleMax) * chartH) : 0;
  const fmtDate = (iso: string, weekday = false) =>
    new Date(iso).toLocaleDateString("en-IN", weekday ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-8" style={{ background: "rgba(5,8,15,0.62)", backdropFilter: "blur(3px)" }} onClick={onClose}>
      <div
        className="w-full sm:max-w-[720px] max-h-[88vh] overflow-y-auto rounded-t-[24px] sm:rounded-[24px]"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 40px 90px rgba(0,0,0,0.45)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-[1] flex items-start justify-between gap-4 px-7 py-5" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
          <div>
            <div className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--text)" }}>{p.name}</div>
            <div className="font-mono text-xs mt-1" style={{ color: "var(--text-3)" }}>B{p.block} · {p.flatNumber}</div>
          </div>
          <button onClick={onClose} className="w-[38px] h-[38px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
            <X size={22} />
          </button>
        </div>

        <div className="px-7 py-6">
          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-3.5">
            <ModalTile bg="var(--accent-soft)" ic="var(--accent-strong)" icon={<TrendingUp size={20} />} label="TOTAL STEPS" value={p.totalSteps.toLocaleString("en-IN")} />
            <ModalTile bg="var(--success-soft)" ic="var(--success)" icon={<Target size={20} />} label="DAYS GOAL MET" value={p.dailyGoal > 0 ? `${p.daysGoalMet} / ${p.daysTracked}` : "—"} />
            <ModalTile bg="var(--accent-soft)" ic="var(--accent)" icon={<Calendar size={20} />} label="AVG / DAY" value={p.averageDailySteps.toLocaleString("en-IN")} />
            <ModalTile bg="rgba(245,158,11,0.12)" ic={ORANGE} icon={<Flame size={20} />} label="BEST DAY" value={p.bestDay ? p.bestDay.steps.toLocaleString("en-IN") : "—"} sub={p.bestDay ? fmtDate(p.bestDay.date) : undefined} />
          </div>

          {/* Run / partner badges */}
          {(p.runs || p.partner) && (
            <div className="flex flex-wrap items-center gap-2.5 mt-4">
              {p.runs && ([["5K", "k5"], ["10K", "k10"], ["20K", "k20"]] as const).map(([lbl, key]) => {
                const r = p.runs![key];
                if (!r.goal && !r.done) return null;
                return (
                  <span key={key} className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13.5px] font-bold" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                    🏃 {lbl} {r.done}/{r.goal}
                  </span>
                );
              })}
              {p.partner && (
                <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13.5px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  🤝 {p.partner.name}{p.partner.status !== "accepted" ? ` (${p.partner.status})` : ""}
                </span>
              )}
            </div>
          )}

          {/* Daily steps chart */}
          {p.dailySteps.length > 0 && (
            <div className="mt-7">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[17px] font-bold" style={{ color: "var(--text)" }}>Daily Steps</div>
                {p.dailyGoal > 0 && <div className="font-mono text-[11px] tracking-wider" style={{ color: "var(--text-3)" }}>GOAL {p.dailyGoal.toLocaleString("en-IN")}</div>}
              </div>
              <div className="relative flex items-end gap-3 sm:gap-[18px] px-1" style={{ height: 210, borderBottom: "1px solid var(--border)" }}>
                {p.dailyGoal > 0 && (
                  <div className="absolute left-0 right-0" style={{ bottom: goalBottom, borderTop: "1.5px dashed var(--text-3)", opacity: 0.55 }} />
                )}
                {p.dailySteps.map((d) => {
                  const met = p.dailyGoal > 0 && d.steps >= p.dailyGoal;
                  const h = Math.max(Math.round((d.steps / scaleMax) * chartH), 2);
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full">
                      <div className="font-bold text-sm mb-1.5" style={{ color: "var(--text)" }}>{d.steps.toLocaleString("en-IN")}</div>
                      <div className="w-full max-w-[120px] rounded-t-lg" style={{ height: h, background: met ? "var(--success)" : "var(--accent)" }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2.5">
                {p.dailySteps.map((d) => (
                  <div key={d.date} className="flex-1 text-center text-[12.5px]" style={{ color: "var(--text-3)" }}>{fmtDate(d.date, true)}</div>
                ))}
              </div>
              <div className="flex items-center gap-5 mt-4 text-[13px]" style={{ color: "var(--text-2)" }}>
                <span className="flex items-center gap-2"><span className="w-[13px] h-[13px] rounded-[3px]" style={{ background: "var(--success)" }} />Met Goal</span>
                <span className="flex items-center gap-2"><span className="w-[13px] h-[13px] rounded-[3px]" style={{ background: "var(--accent)" }} />Below Goal</span>
              </div>
            </div>
          )}

          {/* Daily log */}
          {p.dailySteps.length > 0 && (
            <div className="mt-7">
              <div className="text-[17px] font-bold mb-3.5" style={{ color: "var(--text)" }}>Daily Log</div>
              <div className="rounded-[14px] overflow-hidden" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <div className="grid px-[18px] py-3.5 font-semibold text-sm" style={{ gridTemplateColumns: "1fr 120px 90px", borderBottom: "1px solid var(--border)", color: "var(--text-2)" }}>
                  <div>Date</div><div className="text-right">Steps</div><div className="text-center">Goal</div>
                </div>
                {[...p.dailySteps].reverse().map((d, i) => {
                  const met = p.dailyGoal > 0 && d.steps >= p.dailyGoal;
                  return (
                    <div key={d.date} className="grid items-center px-[18px] py-3.5" style={{ gridTemplateColumns: "1fr 120px 90px", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                      <div className="font-semibold text-[15px]" style={{ color: "var(--text)" }}>{fmtDate(d.date, true)}</div>
                      <div className="text-right font-bold text-[15px]" style={{ color: "var(--text)" }}>{d.steps.toLocaleString("en-IN")}</div>
                      <div className="text-center">
                        {p.dailyGoal > 0 ? (met ? <CheckCircle size={20} style={{ color: "var(--success)", display: "inline" }} /> : <X size={20} style={{ color: "var(--danger)", display: "inline" }} />) : <span style={{ color: "var(--text-3)" }}>—</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {p.dailySteps.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: "var(--text-3)" }}>No step data recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ModalTile({ bg, ic, icon, label, value, sub }: { bg: string; ic: string; icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[16px] p-[18px]" style={{ background: bg, border: "1px solid transparent" }}>
      <div className="flex items-center gap-2" style={{ color: ic }}>
        {icon}
        <span className="font-mono text-[11px] tracking-wider font-semibold">{label}</span>
      </div>
      <div className="text-[34px] font-extrabold tracking-tight mt-2.5 leading-none" style={{ color: "var(--text)" }}>{value}</div>
      {sub && <div className="text-[13px] mt-1.5 font-semibold" style={{ color: ic }}>{sub}</div>}
    </div>
  );
}
