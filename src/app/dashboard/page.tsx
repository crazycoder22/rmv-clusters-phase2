"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import siteData from "@/data/site.json";
import { formatDate } from "@/lib/utils";
import NewsFeed from "@/components/news/NewsFeed";
import Icon from "@/components/ui/Icon";

// Emergency contact icon → Material Symbol name.
const emergencyMs: Record<string, string> = {
  shield: "shield",
  "heart-pulse": "cardiology",
  siren: "emergency",
  phone: "call",
};

interface SearchResult {
  name: string;
  block: number;
  flatNumber: string;
}

interface RsvpRegistration {
  id: string;
  announcementId: string;
  eventTitle: string;
  eventDate: string;
  mealType: string;
  totalPlates: number;
  paid: boolean;
}

interface ActivePoll {
  id: string;
  title: string;
  type: string;
  deadline: string;
  _count: { votes: number };
}

interface ActiveSurvey {
  id: string;
  title: string;
  deadline: string;
  _count: { polls: number };
}

interface SportsRegistration {
  id: string;
  announcementId: string;
  eventTitle: string;
  eventDate: string;
  participantCount: number;
  sports: string[];
}

const quickLinks = [
  { href: "/guidelines", label: "Guidelines", ms: "gavel" },
  { href: "/gallery", label: "Gallery", ms: "photo_library" },
  { href: "/faq", label: "FAQ", ms: "help" },
  { href: "/contact", label: "Contact", ms: "call" },
  { href: "/news", label: "News", ms: "newspaper" },
  { href: "/issues", label: "Issues", ms: "build" },
  { href: "/tasks", label: "Tasks", ms: "checklist" },
  { href: "/marketplace", label: "Marketplace", ms: "storefront" },
  { href: "/domestic-help", label: "Domestic Help", ms: "cleaning_services" },
];

// OneRMV reusable styles (token-driven; responds to light/dark).
const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" };
const rowBorder: React.CSSProperties = { border: "1px solid var(--border)" };

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Registration state
  const [rsvps, setRsvps] = useState<RsvpRegistration[]>([]);
  const [sportsRegs, setSportsRegs] = useState<SportsRegistration[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(true);

  // Active polls & surveys
  const [activePolls, setActivePolls] = useState<ActivePoll[]>([]);
  const [activeSurveys, setActiveSurveys] = useState<ActiveSurvey[]>([]);
  const [loadingPolls, setLoadingPolls] = useState(true);

  // Auth guard
  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("google", {
        callbackUrl:
          typeof window !== "undefined"
            ? window.location.pathname + window.location.search
            : "/dashboard",
      });
      return;
    }
    if (status === "authenticated" && !session?.user?.isRegistered) {
      router.replace("/register");
    }
  }, [status, session, router]);

  // Fetch my registrations
  useEffect(() => {
    if (status === "authenticated" && session?.user?.isRegistered) {
      fetch("/api/residents/my-registrations")
        .then((res) => (res.ok ? res.json() : { rsvps: [], sportsRegistrations: [] }))
        .then((data) => {
          setRsvps(data.rsvps || []);
          setSportsRegs(data.sportsRegistrations || []);
        })
        .catch(() => {})
        .finally(() => setLoadingRegs(false));
    }
  }, [status, session]);

  // Fetch active polls & surveys
  useEffect(() => {
    if (status === "authenticated" && session?.user?.isRegistered) {
      Promise.all([
        fetch("/api/polls/active").then((res) =>
          res.ok ? res.json() : { polls: [] }
        ),
        fetch("/api/surveys?status=ACTIVE").then((res) =>
          res.ok ? res.json() : { surveys: [] }
        ),
      ])
        .then(([pollsData, surveysData]) => {
          setActivePolls(pollsData.polls || []);
          setActiveSurveys(surveysData.surveys || []);
        })
        .catch(() => {})
        .finally(() => setLoadingPolls(false));
    }
  }, [status, session]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/residents/search?q=${encodeURIComponent(searchQuery.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.residents);
        }
      } catch {
        // silently fail
      } finally {
        setSearching(false);
        setHasSearched(true);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // Loading / redirect states
  if (status === "loading") {
    return (
      <div className="one-surface min-h-screen flex items-center justify-center" style={{ background: "var(--bg)", color: "var(--text-3)" }}>
        <p>Loading…</p>
      </div>
    );
  }

  if (!session?.user?.isRegistered) {
    return null; // will redirect
  }

  const firstName = session.user.name?.split(" ")[0] || "Resident";

  return (
    <div className="one-surface min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Identity header */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-extrabold shrink-0"
          style={{ background: "var(--accent-soft)", border: "2px solid var(--accent)", color: "var(--accent)" }}
        >
          {firstName[0]?.toUpperCase()}
        </div>
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight leading-none" style={{ color: "var(--text)" }}>
            Welcome back, {firstName}
          </h1>
          <p className="one-mono text-[11px] mt-1.5 uppercase" style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}>
            Your resident dashboard
          </p>
        </div>
      </div>

      {/* Section 1: Resident Directory Search */}
      <div className="rounded-[20px] p-6 mb-6" style={card}>
        <SectionHead ms="groups" title="Resident Directory" />
        <div className="flex items-center gap-2.5 px-4 rounded-[12px]" style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)" }}>
          <Icon name="search" size={21} style={{ color: "var(--text-3)" }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, block, or flat number…"
            className="flex-1 py-3 bg-transparent text-[15px] outline-none"
            style={{ color: "var(--text)" }}
          />
        </div>

        {searching && <p className="text-sm mt-3" style={{ color: "var(--text-3)" }}>Searching…</p>}

        {!searching && hasSearched && searchResults.length === 0 && (
          <p className="text-sm mt-3 italic" style={{ color: "var(--text-3)" }}>
            No residents found for &quot;{searchQuery}&quot;
          </p>
        )}

        {searchResults.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left one-mono text-[11px] uppercase" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-3)", letterSpacing: "0.08em" }}>
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Block</th>
                  <th className="pb-2 font-medium">Flat</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((r, i) => (
                  <tr key={`${r.block}-${r.flatNumber}-${i}`} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-2.5 pr-4 font-semibold" style={{ color: "var(--text)" }}>{r.name}</td>
                    <td className="py-2.5 pr-4" style={{ color: "var(--text-2)" }}>Block {r.block}</td>
                    <td className="py-2.5" style={{ color: "var(--text-2)" }}>{r.flatNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2 + 3: Emergency Contacts + Quick Links (side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Emergency Contacts */}
        <div className="rounded-[20px] p-6" style={card}>
          <SectionHead ms="emergency" title="Emergency Contacts" danger />
          <div className="space-y-1">
            {siteData.emergencyContacts.map((contact) => (
              <a
                key={contact.name}
                href={`tel:${contact.phone.split(",")[0].trim()}`}
                className="flex items-center gap-3 p-3 rounded-[12px] transition-colors hover:[background:var(--surface-2)]"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--danger-soft)" }}>
                  <Icon name={emergencyMs[contact.icon] || "call"} size={20} style={{ color: "var(--danger)" }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>{contact.name}</p>
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>{contact.phone}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div className="rounded-[20px] p-6" style={card}>
          <SectionHead ms="apps" title="Quick Links" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex flex-col items-center gap-2.5 p-4 rounded-[14px] transition-all hover:shadow-sm"
                style={{ background: "var(--surface-2)", ...rowBorder }}
              >
                <div className="w-11 h-11 rounded-[13px] flex items-center justify-center" style={{ background: "var(--accent-soft)" }}>
                  <Icon name={link.ms} size={23} style={{ color: "var(--accent)" }} />
                </div>
                <span className="text-[13px] font-semibold text-center" style={{ color: "var(--text)" }}>{link.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Section 4: My Upcoming Registrations */}
      <div className="rounded-[20px] p-6 mb-6" style={card}>
        <SectionHead ms="event" title="My Upcoming Registrations" />

        {loadingRegs ? (
          <p className="text-sm" style={{ color: "var(--text-3)" }}>Loading…</p>
        ) : rsvps.length === 0 && sportsRegs.length === 0 ? (
          <p className="text-sm italic" style={{ color: "var(--text-3)" }}>
            No upcoming registrations. Check the news feed for events!
          </p>
        ) : (
          <div className="space-y-2.5">
            {rsvps.map((r) => (
              <Link key={r.id} href={`/events/${r.announcementId}/rsvp`} className="flex items-center justify-between p-3.5 rounded-[14px] transition-all hover:shadow-sm" style={{ background: "var(--surface-2)", ...rowBorder }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Pill tone="accent" capitalize>{r.mealType}</Pill>
                    <Pill tone={r.paid ? "success" : "danger"}>{r.paid ? "Paid" : "Unpaid"}</Pill>
                  </div>
                  <p className="text-[15px] font-semibold truncate" style={{ color: "var(--text)" }}>{r.eventTitle}</p>
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>{formatDate(r.eventDate)} · {r.totalPlates} plate{r.totalPlates !== 1 ? "s" : ""}</p>
                </div>
                <Icon name="chevron_right" size={20} style={{ color: "var(--text-3)" }} />
              </Link>
            ))}

            {sportsRegs.map((sr) => (
              <Link key={sr.id} href={`/events/${sr.announcementId}/sports`} className="flex items-center justify-between p-3.5 rounded-[14px] transition-all hover:shadow-sm" style={{ background: "var(--surface-2)", ...rowBorder }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1"><Pill tone="warning">Sports</Pill></div>
                  <p className="text-[15px] font-semibold truncate" style={{ color: "var(--text)" }}>{sr.eventTitle}</p>
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>{formatDate(sr.eventDate)} · {sr.participantCount} participant{sr.participantCount !== 1 ? "s" : ""} · {sr.sports.join(", ")}</p>
                </div>
                <Icon name="chevron_right" size={20} style={{ color: "var(--text-3)" }} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Section 5: Active Polls & Surveys */}
      {!loadingPolls && (activePolls.length > 0 || activeSurveys.length > 0) && (
        <div className="rounded-[20px] p-6 mb-6" style={card}>
          <div className="flex items-center justify-between mb-4">
            <SectionHead ms="bar_chart_4_bars" title="Active Polls & Surveys" noMargin />
            <Link href="/polls" className="text-[13px] font-semibold" style={{ color: "var(--accent)" }}>View all</Link>
          </div>
          <div className="space-y-2.5">
            {activeSurveys.map((survey) => (
              <Link key={`survey-${survey.id}`} href={`/surveys/${survey.id}`} className="flex items-center justify-between p-3.5 rounded-[14px] transition-all hover:shadow-sm" style={{ background: "var(--surface-2)", ...rowBorder }}>
                <div className="min-w-0">
                  <div className="mb-1"><Pill tone="accent">Survey</Pill></div>
                  <p className="text-[15px] font-semibold truncate" style={{ color: "var(--text)" }}>{survey.title}</p>
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>{survey._count.polls} question{survey._count.polls !== 1 ? "s" : ""} · Ends {new Date(survey.deadline).toLocaleDateString()}</p>
                </div>
                <Icon name="chevron_right" size={20} style={{ color: "var(--text-3)" }} />
              </Link>
            ))}
            {activePolls.map((poll) => (
              <Link key={`poll-${poll.id}`} href={`/polls/${poll.id}`} className="flex items-center justify-between p-3.5 rounded-[14px] transition-all hover:shadow-sm" style={{ background: "var(--surface-2)", ...rowBorder }}>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold truncate" style={{ color: "var(--text)" }}>{poll.title}</p>
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>{poll._count.votes} vote{poll._count.votes !== 1 ? "s" : ""} · Ends {new Date(poll.deadline).toLocaleDateString()}</p>
                </div>
                <Icon name="chevron_right" size={20} style={{ color: "var(--text-3)" }} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Section 6: News Feed */}
      <div>
        <SectionHead ms="newspaper" title="Latest News" />
        <NewsFeed sinceWeeks={2} />
      </div>
    </div>
    </div>
  );
}

// ── OneRMV helpers ───────────────────────────────────────────────────────────

function SectionHead({ ms, title, danger, noMargin }: { ms: string; title: string; danger?: boolean; noMargin?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${noMargin ? "" : "mb-4"}`}>
      <div
        className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
        style={{ background: danger ? "var(--danger-soft)" : "var(--accent-soft)" }}
      >
        <Icon name={ms} size={19} style={{ color: danger ? "var(--danger)" : "var(--accent)" }} />
      </div>
      <h2 className="text-[19px] font-bold tracking-tight" style={{ color: "var(--text)" }}>{title}</h2>
    </div>
  );
}

const pillTone: Record<string, { bg: string; fg: string }> = {
  accent: { bg: "var(--accent-soft)", fg: "var(--accent)" },
  success: { bg: "var(--success-soft)", fg: "var(--success)" },
  danger: { bg: "var(--danger-soft)", fg: "var(--danger)" },
  warning: { bg: "var(--warning-soft)", fg: "var(--warning)" },
};
function Pill({ tone, capitalize, children }: { tone: keyof typeof pillTone; capitalize?: boolean; children: React.ReactNode }) {
  const t = pillTone[tone];
  return (
    <span className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full ${capitalize ? "capitalize" : ""}`} style={{ background: t.bg, color: t.fg }}>
      {children}
    </span>
  );
}
