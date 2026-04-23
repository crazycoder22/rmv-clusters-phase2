import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronDown, ExternalLink } from "lucide-react";
import clsx from "clsx";
import { Browser } from "@capacitor/browser";
import { apiFetch } from "../lib/api";
import { formatRichText } from "../lib/format-text";
import { API_BASE_URL } from "../config";

type Category =
  | "maintenance"
  | "event"
  | "sports"
  | "general"
  | "urgent"
  | "all";

type EventConfig = {
  rsvpDeadline: string;
  mealType: string | null;
};

type SportsConfig = {
  registrationDeadline: string;
};

type Announcement = {
  id: string;
  title: string;
  summary: string;
  body: string;
  category: Exclude<Category, "all">;
  priority: string;
  date: string;
  author: string;
  imageUrl: string | null;
  emoji: string | null;
  link: string | null;
  linkText: string | null;
  eventConfig: EventConfig | null;
  sportsConfig: SportsConfig | null;
};

const CATEGORIES: Category[] = [
  "all",
  "urgent",
  "event",
  "maintenance",
  "sports",
  "general",
];

const CATEGORY_THEMES: Record<Exclude<Category, "all">, string> = {
  urgent: "bg-red-500/20 text-red-300 border-red-500/30",
  event: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  maintenance: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  sports: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  general: "bg-slate-700 text-slate-300 border-slate-600",
};

export default function News() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [active, setActive] = useState<Category>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/announcements")
      .then((r) => (r.ok ? r.json() : { announcements: [] }))
      .then((data) => {
        if (!cancelled) setItems(data.announcements ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const list =
      active === "all" ? items : items.filter((a) => a.category === active);
    return [...list].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [items, active]);

  return (
    <div className="flex flex-1 flex-col px-4 pt-[max(2rem,env(safe-area-inset-top,0px))]">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          News
        </h1>
        <p className="mt-0.5 text-xs text-slate-400">
          Latest announcements from the community
        </p>
      </header>

      <div className="mb-4 -mx-4 overflow-x-auto px-4">
        <div className="flex gap-2 pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={clsx(
                "flex-shrink-0 rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                active === c
                  ? "border-indigo-500 bg-indigo-500 text-white"
                  : "border-slate-700 bg-slate-800 text-slate-400"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">
          No announcements in this category.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <AnnouncementCard key={a.id} announcement={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const [expanded, setExpanded] = useState(false);
  const theme = CATEGORY_THEMES[announcement.category];
  const ec = announcement.eventConfig;
  const sc = announcement.sportsConfig;
  const rsvpClosed = ec ? new Date() > new Date(ec.rsvpDeadline) : false;
  const sportsClosed = sc
    ? new Date() > new Date(sc.registrationDeadline)
    : false;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60">
      {announcement.imageUrl && (
        <img
          src={announcement.imageUrl}
          alt=""
          className="h-44 w-full object-cover"
        />
      )}
      <div className="p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className={clsx(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              theme
            )}
          >
            {announcement.emoji && (
              <span className="mr-1">{announcement.emoji}</span>
            )}
            {announcement.category}
          </span>
          <span className="text-[11px] text-slate-500">
            {formatDate(announcement.date)}
          </span>
          <span className="text-[11px] text-slate-600">
            · {announcement.author}
          </span>
        </div>

        <h2 className="text-base font-semibold leading-snug text-white">
          {announcement.title}
        </h2>

        <div
          className="mobile-rich mt-2 text-sm leading-relaxed text-slate-300"
          dangerouslySetInnerHTML={{
            __html: formatRichText(announcement.summary),
          }}
        />

        {expanded && announcement.body && (
          <div
            className="mobile-rich mt-3 border-t border-slate-700 pt-3 text-sm leading-relaxed text-slate-300"
            dangerouslySetInnerHTML={{
              __html: formatRichText(announcement.body),
            }}
          />
        )}

        <ActionButtons
          announcement={announcement}
          expanded={expanded}
          rsvpClosed={rsvpClosed}
          sportsClosed={sportsClosed}
        />

        {announcement.body && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-3 flex items-center gap-1 text-xs font-medium text-indigo-400 active:text-indigo-300"
          >
            {expanded ? "Show less" : "Read more"}
            <ChevronDown
              size={14}
              className={clsx(
                "transition-transform",
                expanded && "rotate-180"
              )}
            />
          </button>
        )}
      </div>
    </article>
  );
}

function ActionButtons({
  announcement,
  expanded,
  rsvpClosed,
  sportsClosed,
}: {
  announcement: Announcement;
  expanded: boolean;
  rsvpClosed: boolean;
  sportsClosed: boolean;
}) {
  const ec = announcement.eventConfig;
  const sc = announcement.sportsConfig;
  const hasAny = ec || sc || announcement.link;
  if (!hasAny || !expanded) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {ec &&
        (rsvpClosed ? (
          <span className="text-xs italic text-slate-500">RSVP closed</span>
        ) : (
          <ActionLink
            href={`${API_BASE_URL}/events/${announcement.id}/rsvp`}
            className="bg-green-500 active:bg-green-600"
          >
            <Calendar size={14} />
            RSVP
          </ActionLink>
        ))}
      {sc &&
        (sportsClosed ? (
          <span className="text-xs italic text-slate-500">
            Registration closed
          </span>
        ) : (
          <ActionLink
            href={`${API_BASE_URL}/events/${announcement.id}/sports`}
            className="bg-orange-500 active:bg-orange-600"
          >
            <Calendar size={14} />
            Register for Sports
          </ActionLink>
        ))}
      {announcement.link && (
        <ActionLink
          href={announcement.link}
          className="bg-indigo-500 active:bg-indigo-600"
        >
          <ExternalLink size={14} />
          {announcement.linkText || "View Link"}
        </ActionLink>
      )}
    </div>
  );
}

function ActionLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const open = () => {
    Browser.open({ url: href }).catch(() => {
      // Fallback if plugin not ready (e.g. running in browser dev)
      window.open(href, "_blank");
    });
  };
  return (
    <button
      type="button"
      onClick={open}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white",
        className
      )}
    >
      {children}
    </button>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
