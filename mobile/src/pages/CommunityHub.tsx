import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import { useAuth } from "../auth/AuthProvider";
import {
  canAccessTasks,
  canIssueMedals,
  canIssueStickers,
  canManageAnnouncements,
  canManageIssues,
  canManageResidents,
  isAdmin,
  isSuperAdmin,
} from "../lib/roles";

// OneRMV "Community" hub — a sectioned icon launcher (the redesign of the old
// "More" page). Admin Tools is a highlighted block shown only to admins. Layout
// + icons follow OneRMV Community.dc.html.

interface Tile {
  to: string;
  ms: string; // Material Symbol name
  label: string;
  danger?: boolean; // red treatment (SOS rules)
}

const COMMUNITY: Tile[] = [
  { to: "/amenities", ms: "fitness_center", label: "Amenities" },
  { to: "/calendar", ms: "calendar_month", label: "Calendar" },
  { to: "/community/feed", ms: "forum", label: "Community Feed" },
  { to: "/domestic-help", ms: "cleaning_services", label: "Domestic Help" },
  { to: "/faq", ms: "help", label: "FAQ" },
  { to: "/food", ms: "restaurant", label: "Food & Bazaar" },
  { to: "/gallery", ms: "photo_library", label: "Gallery" },
  { to: "/groups", ms: "diversity_3", label: "Groups" },
  { to: "/habits", ms: "track_changes", label: "Habits" },
  { to: "/initiatives", ms: "lightbulb", label: "Initiatives" },
  { to: "/issues", ms: "build", label: "Issues" },
  { to: "/marketplace", ms: "storefront", label: "Marketplace" },
  { to: "/messages", ms: "chat", label: "Messages" },
  { to: "/duties", ms: "checklist", label: "My Duties" },
  { to: "/rewards", ms: "emoji_events", label: "My Rewards" },
  { to: "/my-steps", ms: "directions_walk", label: "My Steps" },
  { to: "/vehicles", ms: "directions_car", label: "My Vehicles" },
  { to: "/parking", ms: "local_parking", label: "Parking" },
  { to: "/polls", ms: "poll", label: "Polls" },
  { to: "/referendums", ms: "how_to_vote", label: "Referendums" },
  { to: "/residents", ms: "contacts", label: "Directory" },
  { to: "/videos", ms: "smart_display", label: "Videos" },
  { to: "/visits", ms: "how_to_reg", label: "Visitors" },
];

const SERVICES: Tile[] = [
  { to: "/stickers", ms: "local_offer", label: "Vehicle Stickers" },
];

const RULES: Tile[] = [
  { to: "/guidelines", ms: "menu_book", label: "Guidelines" },
  { to: "/sos-guidelines", ms: "support", label: "SOS Guidelines", danger: true },
  { to: "/sos-warriors", ms: "verified_user", label: "SOS Warriors", danger: true },
];

const APP: Tile[] = [{ to: "/info", ms: "info", label: "About" }];

export default function CommunityHub() {
  const { user } = useAuth();
  const [q, setQ] = useState("");

  // Admin tiles, each gated by the role that controls it (mirrors More.tsx).
  const adminTiles = useMemo<Tile[]>(() => {
    const r = user?.roles;
    const event = canManageAnnouncements(r);
    const all: (Tile & { show: boolean })[] = [
      { to: "/admin/announcements", ms: "campaign", label: "Announcements", show: event },
      { to: "/admin/usage", ms: "trending_up", label: "App & Web Usage", show: isAdmin(r) },
      { to: "/admin/ads", ms: "image", label: "Banner Ads", show: isAdmin(r) },
      { to: "/admin/events", ms: "event_available", label: "Event Regs", show: event },
      { to: "/admin/issues", ms: "handyman", label: "Issues", show: canManageIssues(r) },
      { to: "/admin/calendar", ms: "edit_calendar", label: "Manage Calendar", show: event },
      { to: "/admin/roles", ms: "admin_panel_settings", label: "Manage Roles", show: isSuperAdmin(r) },
      { to: "/admin/medals", ms: "workspace_premium", label: "Medals & Coins", show: canIssueMedals(r) },
      { to: "/admin/mygate-complaints", ms: "report", label: "MyGate Complaints", show: canManageIssues(r) },
      { to: "/admin/occupancy", ms: "pie_chart", label: "Occupancy", show: isAdmin(r) },
      { to: "/admin/quiz", ms: "quiz", label: "Quiz Host", show: event },
      { to: "/admin/residents", ms: "manage_accounts", label: "Residents", show: canManageResidents(r) },
      { to: "/admin/sos", ms: "verified", label: "SOS Acceptance", show: event },
      { to: "/admin/stickers", ms: "approval", label: "Sticker Requests", show: canIssueStickers(r) },
      { to: "/admin/tambola", ms: "casino", label: "Tambola Host", show: event },
      { to: "/admin/videos", ms: "video_library", label: "Video Library", show: event },
      { to: "/admin/visits", ms: "fact_check", label: "Visitor Approvals", show: isAdmin(r) },
    ];
    return all.filter((t) => t.show);
  }, [user?.roles]);

  const needle = q.trim().toLowerCase();
  const match = (t: Tile) => !needle || t.label.toLowerCase().includes(needle);
  // "My Duties" is staff-only — mirror the web nav gate (canAccessTasks).
  const canDuties = canAccessTasks(user?.roles);
  const admin = adminTiles.filter(match);
  const community = COMMUNITY.filter(match).filter((t) => t.to !== "/duties" || canDuties);
  const services = SERVICES.filter(match);
  const rules = RULES.filter(match);
  const app = APP.filter(match);

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[max(1.5rem,env(safe-area-inset-top,0px))]"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      {/* Header */}
      <div className="pb-3">
        <h1 className="text-[26px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>
          Community
        </h1>
        <p className="mt-px text-[13px]" style={{ color: "var(--text-3)" }}>
          {user?.block ? `Block ${user.block} · ` : ""}everything in one place
        </p>
      </div>

      {/* Search */}
      <div className="pb-3">
        <div
          className="flex items-center gap-2.5 rounded-[13px] px-3.5"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <Icon name="search" size={20} style={{ color: "var(--text-3)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search features…"
            className="flex-1 bg-transparent py-3 text-[14px] outline-none"
            style={{ color: "var(--text)" }}
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Clear search">
              <Icon name="close" size={18} style={{ color: "var(--text-3)" }} />
            </button>
          )}
        </div>
      </div>

      {/* Admin Tools — admins only */}
      {admin.length > 0 && (
        <div
          className="mb-1.5 rounded-[18px] p-3.5"
          style={{
            background: "var(--accent-soft)",
            border: "1px solid color-mix(in srgb, var(--accent) 35%, var(--border))",
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="shield_person" size={19} fill style={{ color: "var(--accent)" }} />
              <span
                className="one-mono text-[11px] font-semibold uppercase"
                style={{ color: "var(--accent)", letterSpacing: "0.12em" }}
              >
                Admin Tools
              </span>
            </div>
            <span
              className="flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[10px] font-bold"
              style={{
                background: "var(--surface)",
                border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                color: "var(--accent)",
              }}
            >
              <Icon name="lock" size={13} style={{ color: "var(--accent)" }} />
              Only admins see this
            </span>
          </div>
          <TileGrid tiles={admin} adminStyle />
        </div>
      )}

      {community.length > 0 && (
        <Section title="Community">
          <TileGrid tiles={community} />
        </Section>
      )}
      {services.length > 0 && (
        <Section title="Services">
          <TileGrid tiles={services} />
        </Section>
      )}
      {rules.length > 0 && (
        <Section title="Rules & Safety">
          <TileGrid tiles={rules} />
        </Section>
      )}
      {app.length > 0 && (
        <Section title="App">
          <TileGrid tiles={app} />
        </Section>
      )}

      {admin.length +
        community.length +
        services.length +
        rules.length +
        app.length ===
        0 && (
        <p className="py-10 text-center text-[13px]" style={{ color: "var(--text-3)" }}>
          No features match “{q}”.
        </p>
      )}

      <div
        className="one-mono mt-6 pb-4 text-center text-[10px]"
        style={{ color: "var(--text-3)" }}
      >
        RMV Clusters Phase 2 · v1.0
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-[22px] first:mt-2">
      <div
        className="one-mono text-[10px] font-medium uppercase"
        style={{ color: "var(--text-3)", letterSpacing: "0.14em" }}
      >
        {title}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function TileGrid({ tiles, adminStyle }: { tiles: Tile[]; adminStyle?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-x-1.5 gap-y-4">
      {tiles.map((t) => (
        <TileLink key={t.to} tile={t} adminStyle={adminStyle} />
      ))}
    </div>
  );
}

function TileLink({ tile, adminStyle }: { tile: Tile; adminStyle?: boolean }) {
  const fg = tile.danger ? "var(--danger)" : "var(--accent)";
  // Admin tiles sit on a surface chip (the block already has the accent tint);
  // resident tiles use an accent-soft chip; SOS rules use a danger-soft chip.
  const chipBg = adminStyle
    ? "var(--surface)"
    : tile.danger
      ? "var(--danger-soft)"
      : "var(--accent-soft)";
  const chipBorder = adminStyle ? "1px solid var(--border)" : "none";
  return (
    <Link to={tile.to} className="flex flex-col items-center gap-[7px] active:opacity-80">
      <span
        className="flex h-[50px] w-[50px] items-center justify-center rounded-[15px]"
        style={{ background: chipBg, border: chipBorder }}
      >
        <Icon name={tile.ms} size={24} style={{ color: fg }} />
      </span>
      <span
        className="text-center text-[11px] font-semibold leading-[1.2]"
        style={{ color: "var(--text)" }}
      >
        {tile.label}
      </span>
    </Link>
  );
}
