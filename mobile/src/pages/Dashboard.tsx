import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  HeartPulse,
  LogOut,
  Phone,
  Search,
  Shield,
  Siren,
} from "lucide-react";
import { Browser } from "@capacitor/browser";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { API_BASE_URL } from "../config";
import { useAuth } from "../auth/AuthProvider";

const EMERGENCY_CONTACTS: {
  name: string;
  phone: string;
  icon: typeof Shield;
}[] = [
  { name: "Security at MainGate", phone: "9019903594", icon: Shield },
  {
    name: "Kodigehalli Police Station",
    phone: "+91 80 22943703",
    icon: Siren,
  },
  { name: "RMV Hospital", phone: "+91 80 42664366", icon: HeartPulse },
  {
    name: "MS Ramaiah Hospital",
    phone: "+91 80 40502000",
    icon: HeartPulse,
  },
  {
    name: "Helpline (Police / Fire / Ambulance)",
    phone: "112",
    icon: Phone,
  },
];

type ResidentResult = { name: string; block: number; flatNumber: string };

type Rsvp = {
  id: string;
  announcementId: string;
  eventTitle: string;
  eventDate: string;
  mealType: string | null;
  totalPlates: number;
  paid: boolean;
};

type SportsReg = {
  id: string;
  announcementId: string;
  eventTitle: string;
  eventDate: string;
  participantCount: number;
  sports: string[];
};

type ActivePoll = {
  id: string;
  title: string;
  deadline: string;
  _count: { votes: number };
};

export default function Dashboard() {
  const { user, token, signOut } = useAuth();

  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [sportsRegs, setSportsRegs] = useState<SportsReg[]>([]);
  const [regsLoading, setRegsLoading] = useState(true);

  const [polls, setPolls] = useState<ActivePoll[]>([]);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ResidentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch my registrations + active polls once we have a token.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    apiFetch("/api/residents/my-registrations", { token })
      .then((r) => (r.ok ? r.json() : { rsvps: [], sportsRegistrations: [] }))
      .then((data) => {
        if (cancelled) return;
        setRsvps(data.rsvps ?? []);
        setSportsRegs(data.sportsRegistrations ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRegsLoading(false);
      });

    apiFetch("/api/polls/active", { token })
      .then((r) => (r.ok ? r.json() : { polls: [] }))
      .then((data) => {
        if (!cancelled) setPolls(data.polls ?? []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Debounced resident search.
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = search.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      return;
    }
    if (!token) return;
    searchTimerRef.current = setTimeout(() => {
      setSearching(true);
      apiFetch(`/api/residents/search?q=${encodeURIComponent(q)}`, { token })
        .then((r) => (r.ok ? r.json() : { residents: [] }))
        .then((data) => {
          setResults(data.residents ?? []);
          setSearched(true);
        })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search, token]);

  const firstName = useMemo(
    () => user?.name?.split(" ")[0] ?? "friend",
    [user?.name]
  );

  const openLink = (path: string) => {
    const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
    Browser.open({ url }).catch(() => window.open(url, "_blank"));
  };

  return (
    <div className="flex flex-1 flex-col px-4 pt-[max(2rem,env(safe-area-inset-top,0px))]">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt=""
              className="h-10 w-10 rounded-full border border-slate-700 object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-semibold text-indigo-300">
              {user?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div>
            <p className="text-base font-semibold text-white">
              Hi, {firstName}
            </p>
            <p className="text-[11px] text-slate-500">
              Block {user?.block}, {user?.flatNumber}
            </p>
          </div>
        </div>
        <button
          onClick={() => void signOut()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 active:bg-slate-800"
          title="Sign out"
        >
          <LogOut size={18} />
        </button>
      </header>

      {/* Resident search */}
      <section className="mb-5 rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3">
          <Search size={16} className="text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a resident…"
            className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none"
          />
        </div>
        {searching && (
          <p className="mt-3 text-xs text-slate-500">Searching…</p>
        )}
        {!searching && searched && results.length === 0 && (
          <p className="mt-3 text-xs italic text-slate-500">
            No residents found
          </p>
        )}
        {results.length > 0 && (
          <div className="mt-3 divide-y divide-slate-700/60 rounded-lg bg-slate-900/60">
            {results.map((r, i) => (
              <div
                key={`${r.block}-${r.flatNumber}-${i}`}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-100">{r.name}</span>
                <span className="text-xs text-slate-400">
                  Block {r.block}, {r.flatNumber}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Emergency */}
      <Section title="Emergency">
        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60">
          {EMERGENCY_CONTACTS.map((c, i) => {
            const Icon = c.icon;
            const primaryPhone = c.phone.split(",")[0].trim();
            return (
              <a
                key={c.name}
                href={`tel:${primaryPhone.replace(/\s+/g, "")}`}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 active:bg-slate-800",
                  i < EMERGENCY_CONTACTS.length - 1 &&
                    "border-b border-slate-700"
                )}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-300">
                  <Icon size={17} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-100">{c.name}</p>
                  <p className="text-[11px] text-slate-500">{c.phone}</p>
                </div>
                <Phone size={14} className="text-slate-500" />
              </a>
            );
          })}
        </div>
      </Section>

      {/* My registrations */}
      <Section title="My upcoming">
        {regsLoading ? (
          <p className="py-4 text-center text-xs text-slate-500">Loading…</p>
        ) : rsvps.length === 0 && sportsRegs.length === 0 ? (
          <p className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-5 text-center text-xs text-slate-500">
            No upcoming registrations. Check News for events.
          </p>
        ) : (
          <div className="space-y-2">
            {rsvps.map((r) => (
              <button
                key={r.id}
                onClick={() => openLink(`/events/${r.announcementId}/rsvp`)}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-700 bg-slate-800/60 p-3 text-left active:bg-slate-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    {r.mealType && (
                      <Badge className="bg-emerald-500/20 text-emerald-300">
                        {r.mealType}
                      </Badge>
                    )}
                    <Badge
                      className={
                        r.paid
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-red-500/20 text-red-300"
                      }
                    >
                      {r.paid ? "Paid" : "Unpaid"}
                    </Badge>
                  </div>
                  <p className="truncate text-sm font-medium text-slate-100">
                    {r.eventTitle}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {formatDate(r.eventDate)} · {r.totalPlates} plate
                    {r.totalPlates !== 1 ? "s" : ""}
                  </p>
                </div>
                <ChevronRight size={16} className="text-slate-500" />
              </button>
            ))}
            {sportsRegs.map((sr) => (
              <button
                key={sr.id}
                onClick={() => openLink(`/events/${sr.announcementId}/sports`)}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-700 bg-slate-800/60 p-3 text-left active:bg-slate-800"
              >
                <div className="min-w-0 flex-1">
                  <Badge className="mb-1 inline-block bg-orange-500/20 text-orange-300">
                    Sports
                  </Badge>
                  <p className="truncate text-sm font-medium text-slate-100">
                    {sr.eventTitle}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {formatDate(sr.eventDate)} · {sr.participantCount}{" "}
                    participant{sr.participantCount !== 1 ? "s" : ""}
                    {sr.sports.length > 0 && ` · ${sr.sports.join(", ")}`}
                  </p>
                </div>
                <ChevronRight size={16} className="text-slate-500" />
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* Active polls */}
      {polls.length > 0 && (
        <Section title="Active polls">
          <div className="space-y-2">
            {polls.map((p) => (
              <button
                key={p.id}
                onClick={() => openLink(`/polls/${p.id}`)}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-700 bg-slate-800/60 p-3 text-left active:bg-slate-800"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">
                    {p.title}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {p._count.votes} vote{p._count.votes !== 1 ? "s" : ""} ·
                    ends {formatDate(p.deadline)}
                  </p>
                </div>
                <ChevronRight size={16} className="text-slate-500" />
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Quick nav */}
      <Section title="Explore">
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/news"
            className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-3 active:bg-slate-800"
          >
            <span className="text-2xl">📰</span>
            <div>
              <p className="text-sm font-semibold text-white">News</p>
              <p className="text-[10px] text-slate-500">Announcements</p>
            </div>
          </Link>
          <Link
            to="/games"
            className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-3 active:bg-slate-800"
          >
            <span className="text-2xl">🎮</span>
            <div>
              <p className="text-sm font-semibold text-white">Games</p>
              <p className="text-[10px] text-slate-500">7 games</p>
            </div>
          </Link>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
        className
      )}
    >
      {children}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
