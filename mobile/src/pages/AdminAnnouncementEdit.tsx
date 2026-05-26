import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  CalendarCheck,
  Check,
  CircleDot,
  Eye,
  EyeOff,
  ExternalLink,
  Info,
  Loader2,
  Trash2,
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

interface AnnouncementResp {
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
}

const CATEGORY_OPTIONS: { value: Category; label: string; icon: LucideIcon }[] =
  [
    { value: "general", label: "General", icon: CircleDot },
    { value: "urgent", label: "Urgent", icon: Zap },
    { value: "event", label: "Event", icon: Calendar },
    { value: "maintenance", label: "Maintenance", icon: Wrench },
    { value: "sports", label: "Sports", icon: Trophy },
  ];

const PRIORITY_OPTIONS: Priority[] = ["low", "normal", "high"];

// ── Page ────────────────────────────────────────────────────────────────────

export default function AdminAnnouncementEdit() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // Role gate
  useEffect(() => {
    if (user && !canManageAnnouncements(user.roles)) {
      navigate("/more", { replace: true });
    }
  }, [user, navigate]);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [priority, setPriority] = useState<Priority>("normal");
  const [emoji, setEmoji] = useState("");
  const [link, setLink] = useState("");
  const [linkText, setLinkText] = useState("");
  const [date, setDate] = useState<string>(todayIsoDate());
  const [published, setPublished] = useState(true);

  // Server-side flags preserved (we don't allow mobile editing of these)
  const [hasEventConfig, setHasEventConfig] = useState(false);
  const [hasSportsConfig, setHasSportsConfig] = useState(false);

  // Default author to current user on new announcements.
  useEffect(() => {
    if (isNew && user?.name && !author) setAuthor(user.name);
  }, [isNew, user, author]);

  // Fetch the existing announcement (edit mode). The admin GET returns all
  // of them, so we filter — there's no single-resource GET on the admin route.
  const fetchOne = useCallback(async () => {
    if (isNew || !id) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/announcements", { token });
      if (!res.ok) {
        setError(res.status === 403 ? "Not authorised" : "Could not load");
        return;
      }
      const data = await res.json();
      const a: AnnouncementResp | undefined = (data.announcements ?? []).find(
        (x: AnnouncementResp) => x.id === id
      );
      if (!a) {
        setError("Announcement not found");
        return;
      }
      setTitle(a.title);
      setSummary(a.summary);
      setBody(a.body);
      setAuthor(a.author);
      setCategory(a.category);
      setPriority(a.priority);
      setEmoji(a.emoji ?? "");
      setLink(a.link ?? "");
      setLinkText(a.linkText ?? "");
      setDate(a.date.slice(0, 10));
      setPublished(a.published);
      setHasEventConfig(!!a.eventConfig);
      setHasSportsConfig(!!a.sportsConfig);
      setError(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [id, isNew, token]);

  useEffect(() => {
    void fetchOne();
  }, [fetchOne]);

  async function submit(publishNow: boolean) {
    setError(null);
    if (!title.trim() || !summary.trim() || !body.trim() || !author.trim()) {
      setError("Title, summary, body and author are all required.");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        summary: summary.trim(),
        body: body.trim(),
        author: author.trim(),
        category,
        priority,
        date: new Date(date).toISOString(),
        link: link.trim() || null,
        linkText: linkText.trim() || null,
        emoji: emoji.trim() || null,
        published: publishNow,
      };

      const url = isNew
        ? "/api/admin/announcements"
        : `/api/admin/announcements/${id}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await apiFetch(url, {
        method,
        token,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Could not save");
        return;
      }
      // Bounce back to the list.
      navigate("/admin/announcements", { replace: true });
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (isNew || !id) return;
    if (
      !confirm(
        `Delete this announcement? This also removes any RSVP / sports registrations and notifications — it can't be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/admin/announcements/${id}`, {
        method: "DELETE",
        token,
      });
      if (res.ok) {
        navigate("/admin/announcements", { replace: true });
      } else {
        setError("Could not delete");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/admin/announcements"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-white">
            {isNew ? "New announcement" : "Edit announcement"}
          </h1>
          {!isNew && (
            <p className="truncate text-[11px] text-slate-500">
              {published ? "Published" : "Draft"} · tap save to update
            </p>
          )}
        </div>
        {!isNew && (
          <button
            type="button"
            onClick={remove}
            disabled={deleting || saving}
            aria-label="Delete announcement"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-500 active:bg-slate-800 active:text-red-300"
          >
            {deleting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
          </button>
        )}
      </header>

      {loading ? (
        <div className="flex justify-center py-10 text-slate-500">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(published);
          }}
          className="flex flex-1 flex-col space-y-4 pb-4"
        >
          {/* Warn if event/sports RSVP config is attached — mobile MVP can't
              edit those — to prevent accidental wipes. */}
          {(hasEventConfig || hasSportsConfig) && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-700/50 bg-amber-900/15 px-3 py-2.5 text-xs text-amber-200">
              <Info size={14} className="mt-0.5 flex-shrink-0" />
              <p>
                {hasEventConfig && "Event RSVP "}
                {hasEventConfig && hasSportsConfig && "and "}
                {hasSportsConfig && "Sports registration "}
                {hasEventConfig && hasSportsConfig ? "are " : "is "}
                configured for this announcement. Edit those on the web
                dashboard — saving from here keeps them intact but won't
                change RSVP settings.
              </p>
            </div>
          )}

          {/* Title */}
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder="e.g. Water tank cleaning on Sunday"
              className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
            />
          </Field>

          {/* Emoji + author + date row */}
          <div className="grid grid-cols-[64px,1fr] gap-3">
            <Field label="Emoji">
              <input
                value={emoji}
                onChange={(e) =>
                  // Limit to one or two glyphs — emoji-only field.
                  setEmoji(Array.from(e.target.value).slice(0, 2).join(""))
                }
                placeholder="🚰"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-2 py-2.5 text-center text-lg text-white placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
              />
            </Field>
            <Field label="Author">
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Your name or committee"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
              />
            </Field>
          </div>

          {/* Category chips */}
          <Field label="Category">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const sel = category === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCategory(opt.value)}
                    className={clsx(
                      "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium",
                      sel
                        ? "bg-indigo-500 text-white"
                        : "bg-slate-900 text-slate-300 active:bg-slate-800"
                    )}
                  >
                    <Icon size={11} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Priority + date row */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <div className="flex gap-1.5">
                {PRIORITY_OPTIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={clsx(
                      "flex-1 rounded-full px-2 py-1.5 text-[11px] font-medium capitalize",
                      priority === p
                        ? p === "high"
                          ? "bg-red-500 text-white"
                          : p === "normal"
                            ? "bg-indigo-500 text-white"
                            : "bg-slate-700 text-white"
                        : "bg-slate-900 text-slate-300 active:bg-slate-800"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white focus:border-indigo-400 focus:outline-none"
              />
            </Field>
          </div>

          {/* Summary */}
          <Field
            label="Summary"
            hint="One short line shown in the news list."
          >
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={280}
              rows={2}
              placeholder="A one-liner residents see before they tap in."
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
            />
          </Field>

          {/* Body */}
          <Field label="Body" hint="Full text. Plain text only on mobile.">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Full message…"
              className="w-full resize-y rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm leading-relaxed text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
            />
          </Field>

          {/* Optional link */}
          <Field label="Link" hint="Optional external URL — e.g. a doc.">
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-3">
                <ExternalLink size={14} className="text-slate-500" />
                <input
                  type="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://…"
                  className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                />
              </div>
              <input
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder='Link label (e.g. "View schedule")'
                className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </Field>

          {/* Published toggle */}
          <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-800/60 px-3 py-3">
            <div className="flex items-center gap-3">
              <div
                className={clsx(
                  "flex h-9 w-9 items-center justify-center rounded-full",
                  published
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-slate-900 text-slate-500"
                )}
              >
                {published ? <Eye size={16} /> : <EyeOff size={16} />}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {published ? "Published" : "Draft"}
                </p>
                <p className="text-[11px] text-slate-500">
                  {published
                    ? "Visible in News and triggers notifications."
                    : "Only visible to admins. No notifications sent."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPublished((v) => !v)}
              className={clsx(
                "relative h-6 w-11 flex-shrink-0 rounded-full transition-colors",
                published ? "bg-emerald-500" : "bg-slate-700"
              )}
              aria-label="Toggle published"
            >
              <span
                className={clsx(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                  published ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </button>
          </div>

          {error && (
            <p className="rounded-xl border border-red-700/60 bg-red-900/20 px-3 py-2.5 text-xs text-red-200">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => void submit(false)}
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-3 text-sm font-semibold text-slate-200 active:bg-slate-700 disabled:opacity-50"
            >
              <EyeOff size={14} />
              Save as draft
            </button>
            <button
              type="button"
              onClick={() => void submit(true)}
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white active:bg-indigo-600 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              {isNew ? "Publish" : "Save & publish"}
            </button>
          </div>

          {!isNew && hasEventConfig && (
            <Link
              to="/admin/events"
              className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/40 px-3 py-2.5 text-xs text-slate-400 active:bg-slate-800"
            >
              <span className="inline-flex items-center gap-1.5">
                <CalendarCheck size={12} /> View RSVPs for this event
              </span>
              <span className="text-slate-500">→</span>
            </Link>
          )}
        </form>
      )}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        {hint && (
          <span className="text-[10px] normal-case text-slate-500">{hint}</span>
        )}
      </label>
      {children}
    </div>
  );
}

function todayIsoDate(): string {
  // YYYY-MM-DD in local timezone — what <input type="date"> expects.
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
