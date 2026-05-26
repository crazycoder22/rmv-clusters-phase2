import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  CalendarCheck,
  ChevronRight,
  CircleDot,
  EyeOff,
  Loader2,
  Megaphone,
  Plus,
  Trophy,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { canManageAnnouncements } from "../lib/roles";

// ── Types ───────────────────────────────────────────────────────────────────

type Category = "maintenance" | "event" | "general" | "urgent" | "sports";
type Priority = "low" | "normal" | "high";

interface Announcement {
  id: string;
  title: string;
  summary: string;
  body: string;
  date: string;
  category: Category;
  priority: Priority;
  author: string;
  emoji: string | null;
  imageUrl: string | null;
  link: string | null;
  linkText: string | null;
  published: boolean;
  eventConfig: { id: string; rsvpDeadline: string } | null;
  sportsConfig: { id: string; registrationDeadline: string } | null;
  createdAt: string;
  updatedAt: string;
}

type Filter = "all" | "published" | "drafts";

// ── Category meta (matches resident News.tsx) ───────────────────────────────

const CAT_META: Record<
  Category,
  { label: string; icon: LucideIcon; tint: string }
> = {
  urgent: {
    label: "Urgent",
    icon: Zap,
    tint: "bg-red-500/20 text-red-300 border-red-500/30",
  },
  event: {
    label: "Event",
    icon: Calendar,
    tint: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  },
  maintenance: {
    label: "Maintenance",
    icon: Wrench,
    tint: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
  sports: {
    label: "Sports",
    icon: Trophy,
    tint: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
  general: {
    label: "General",
    icon: CircleDot,
    tint: "bg-slate-700 text-slate-300 border-slate-600",
  },
};

// ── Page ────────────────────────────────────────────────────────────────────

export default function AdminAnnouncements() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // Role gate
  useEffect(() => {
    if (user && !canManageAnnouncements(user.roles)) {
      navigate("/more", { replace: true });
    }
  }, [user, navigate]);

  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/announcements", { token });
      if (!res.ok) {
        setError(res.status === 403 ? "Not authorised" : "Could not load");
        return;
      }
      const data = await res.json();
      setItems(data.announcements ?? []);
      setError(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (filter === "published") return items.filter((a) => a.published);
    if (filter === "drafts") return items.filter((a) => !a.published);
    return items;
  }, [items, filter]);

  const counts = useMemo(
    () => ({
      total: items.length,
      drafts: items.filter((a) => !a.published).length,
    }),
    [items]
  );

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/more"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-white">Announcements</h1>
          <p className="truncate text-[11px] text-slate-500">
            {counts.total} total
            {counts.drafts > 0 ? ` · ${counts.drafts} draft${counts.drafts !== 1 ? "s" : ""}` : ""}
          </p>
        </div>
        <Link
          to="/admin/announcements/new"
          className="flex h-9 items-center gap-1 rounded-full bg-indigo-500 px-3 text-sm font-medium text-white active:bg-indigo-600"
        >
          <Plus size={14} />
          New
        </Link>
      </header>

      {/* Filter chips */}
      <section className="mb-3 flex gap-1.5">
        {(["all", "published", "drafts"] as Filter[]).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setFilter(opt)}
            className={clsx(
              "rounded-full px-3 py-1.5 text-xs font-medium capitalize",
              filter === opt
                ? "bg-indigo-500 text-white"
                : "bg-slate-900 text-slate-300 active:bg-slate-800"
            )}
          >
            {opt}
          </button>
        ))}
      </section>

      <section className="flex-1 pb-4">
        {loading ? (
          <div className="flex justify-center py-10 text-slate-500">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : error ? (
          <p className="rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-3 text-xs text-red-200">
            {error}
          </p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
            {items.length === 0 ? (
              <>
                <Megaphone size={28} className="mx-auto mb-2 text-slate-600" />
                No announcements yet.
                <br />
                Tap{" "}
                <span className="text-indigo-300">New</span> to post the first
                one.
              </>
            ) : (
              "Nothing matches this filter."
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((a) => (
              <AnnouncementCard key={a.id} a={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function AnnouncementCard({ a }: { a: Announcement }) {
  const meta = CAT_META[a.category];
  const Icon = meta.icon;
  const date = new Date(a.date).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Link
      to={`/admin/announcements/${a.id}`}
      className={clsx(
        "flex items-start gap-3 rounded-2xl border p-3 active:bg-slate-800",
        a.published
          ? "border-slate-700 bg-slate-800/60"
          : "border-dashed border-slate-700 bg-slate-800/30"
      )}
    >
      <div
        className={clsx(
          "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border",
          meta.tint
        )}
      >
        {a.emoji ? (
          <span className="text-base leading-none">{a.emoji}</span>
        ) : (
          <Icon size={16} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-white">
            {a.title}
          </h3>
          <div className="flex shrink-0 items-center gap-1">
            {!a.published && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">
                <EyeOff size={9} />
                DRAFT
              </span>
            )}
            {a.priority === "high" && (
              <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-300">
                HIGH
              </span>
            )}
          </div>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">
          {a.summary}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
          <span className="capitalize">{meta.label}</span>
          <span className="text-slate-600">·</span>
          <span>{date}</span>
          <span className="text-slate-600">·</span>
          <span>{a.author}</span>
          {a.eventConfig && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-medium text-indigo-200">
              <CalendarCheck size={9} /> RSVP
            </span>
          )}
          {a.sportsConfig && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-200">
              <Trophy size={9} /> Sports
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={16} className="mt-1 flex-shrink-0 text-slate-500" />
    </Link>
  );
}

