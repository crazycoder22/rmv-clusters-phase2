import { useEffect, useMemo, useState } from "react";
import { Browser } from "@capacitor/browser";
import Icon from "../components/Icon";
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

// OneRMV category badge — Material Symbol + soft-tinted pill per category.
const CATEGORY_META: Record<Exclude<Category, "all">, { ms: string; fg: string; bg: string }> = {
  urgent: { ms: "priority_high", fg: "var(--danger)", bg: "var(--danger-soft)" },
  event: { ms: "directions_run", fg: "var(--accent)", bg: "var(--accent-soft)" },
  maintenance: { ms: "build", fg: "var(--warning)", bg: "var(--warning-soft)" },
  sports: { ms: "sports_tennis", fg: "var(--info)", bg: "var(--info-soft)" },
  general: { ms: "campaign", fg: "var(--text-2)", bg: "var(--surface-3)" },
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
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[max(1.5rem,env(safe-area-inset-top,0px))]"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="mb-3.5">
        <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>
          News
        </h1>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-3)" }}>
          Latest announcements from the community
        </p>
      </header>

      {/* Filter chips */}
      <div className="mb-3.5 -mx-[18px] overflow-x-auto px-[18px] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2 pb-1">
          {CATEGORIES.map((c) => {
            const on = active === c;
            return (
              <button
                key={c}
                onClick={() => setActive(c)}
                className="flex-shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-bold capitalize transition-colors"
                style={on
                  ? { background: "var(--accent)", color: "#fff" }
                  : { background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border)" }}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-[14px]" style={{ color: "var(--text-3)" }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-[14px]" style={{ color: "var(--text-3)" }}>
          No announcements in this category.
        </p>
      ) : (
        <div className="flex flex-col gap-3.5 pb-4">
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
  const meta = CATEGORY_META[announcement.category];
  const ec = announcement.eventConfig;
  const sc = announcement.sportsConfig;
  const rsvpClosed = ec ? new Date() > new Date(ec.rsvpDeadline) : false;
  const sportsClosed = sc
    ? new Date() > new Date(sc.registrationDeadline)
    : false;

  return (
    <article className="overflow-hidden rounded-[18px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {announcement.imageUrl && (
        <img
          src={announcement.imageUrl}
          alt=""
          className="h-44 w-full object-cover"
        />
      )}
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase"
            style={{ background: meta.bg, color: meta.fg, letterSpacing: "0.05em" }}
          >
            <Icon name={meta.ms} size={14} style={{ color: meta.fg }} />
            {announcement.category}
          </span>
          <span className="text-[12px]" style={{ color: "var(--text-3)" }}>
            {formatDate(announcement.date)} · {announcement.author}
          </span>
        </div>

        <h2 className="mt-3 text-[19px] font-extrabold leading-tight tracking-tight" style={{ color: "var(--text)" }}>
          {announcement.title}
        </h2>

        <div
          className="mobile-rich mt-2 text-[15px] leading-relaxed"
          style={{ color: "var(--text-2)" }}
          dangerouslySetInnerHTML={{
            __html: formatRichText(announcement.summary),
          }}
        />

        {expanded && announcement.body && (
          <div
            className="mobile-rich mt-3 pt-3 text-[15px] leading-relaxed"
            style={{ color: "var(--text-2)", borderTop: "1px solid var(--border)" }}
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
            className="mt-3 flex w-fit items-center gap-1 text-[14px] font-bold active:opacity-80"
            style={{ color: "var(--accent)" }}
          >
            {expanded ? "Show less" : "Read more"}
            <Icon
              name="expand_more"
              size={18}
              className="transition-transform"
              style={{ color: "var(--accent)", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
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
          <span className="text-[12px] italic" style={{ color: "var(--text-3)" }}>RSVP closed</span>
        ) : (
          <ActionLink href={`${API_BASE_URL}/events/${announcement.id}/rsvp`} bg="var(--success)" ms="event">
            RSVP
          </ActionLink>
        ))}
      {sc &&
        (sportsClosed ? (
          <span className="text-[12px] italic" style={{ color: "var(--text-3)" }}>
            Registration closed
          </span>
        ) : (
          <ActionLink href={`${API_BASE_URL}/events/${announcement.id}/sports`} bg="var(--warning)" ms="sports_tennis">
            Register for Sports
          </ActionLink>
        ))}
      {announcement.link && (
        <ActionLink href={announcement.link} bg="var(--accent-strong)" ms="open_in_new">
          {announcement.linkText || "View Link"}
        </ActionLink>
      )}
    </div>
  );
}

function ActionLink({
  href,
  bg,
  ms,
  children,
}: {
  href: string;
  bg: string;
  ms: string;
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
      className="inline-flex items-center gap-1.5 rounded-[11px] px-4 py-2.5 text-[14px] font-bold text-white active:opacity-90"
      style={{ background: bg }}
    >
      <Icon name={ms} size={15} style={{ color: "#fff" }} />
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
