import { Link } from "react-router-dom";
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  Car,
  ChevronRight,
  Coins,
  Crown,
  Dices,
  HelpCircle,
  Image as ImageIcon,
  Info,
  LifeBuoy,
  LogOut,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  ShieldCheck,
  Target,
  TrendingUp,
  UtensilsCrossed,
  Users,
  Video,
  Vote,
  Wrench,
  ListChecks,
  ShoppingBag,
  Sparkles,
  Store,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import {
  canIssueMedals,
  canIssueStickers,
  canManageAnnouncements,
  canManageIssues,
  canManageResidents,
  isAdmin,
  isSuperAdmin,
} from "../lib/roles";

export default function MorePage() {
  const { user, signOut } = useAuth();
  const showStickerAdmin = canIssueStickers(user?.roles);
  const showEventAdmin = canManageAnnouncements(user?.roles);
  const showMedalAdmin = canIssueMedals(user?.roles);
  const showIssueAdmin = canManageIssues(user?.roles);
  const showVisitAdmin = isAdmin(user?.roles);
  const showResidentAdmin = canManageResidents(user?.roles);
  const showRoleAdmin = isSuperAdmin(user?.roles);
  const showAdmin =
    showStickerAdmin ||
    showEventAdmin ||
    showMedalAdmin ||
    showIssueAdmin ||
    showVisitAdmin ||
    showResidentAdmin ||
    showRoleAdmin;

  return (
    <div className="flex flex-1 flex-col px-4 pt-[max(2rem,env(safe-area-inset-top,0px))]">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          More
        </h1>
        <p className="mt-0.5 text-xs text-slate-400">
          Community info, rules, and settings
        </p>
      </header>

      <ItemGroup
        title="Preferences"
        items={[
          { to: "/settings", icon: SettingsIcon, title: "Settings", subtitle: "Senior-friendly mode & other preferences" },
        ]}
      />

      {showAdmin && (
        <ItemGroup
          title="Admin"
          items={[
            { to: "/admin/announcements", icon: Megaphone, title: "Announcements", subtitle: "Post & edit news, drafts, RSVPs", show: showEventAdmin },
            { to: "/admin/calendar", icon: CalendarDays, title: "Manage calendar", subtitle: "Add holidays, festivals, key dates", show: showEventAdmin },
            { to: "/admin/stickers", icon: ShieldCheck, title: "Sticker requests", subtitle: "Review submissions, mark issued", show: showStickerAdmin },
            { to: "/admin/events", icon: CalendarDays, title: "Event registrations", subtitle: "Mark paid, review attendees", show: showEventAdmin },
            { to: "/admin/videos", icon: Video, title: "Video library", subtitle: "Playlists & YouTube videos", show: showEventAdmin },
            { to: "/admin/ads", icon: ImageIcon, title: "Banner ads", subtitle: "Sponsor placements & schedules", show: showVisitAdmin },
            { to: "/admin/medals", icon: Award, title: "Medals & coins", subtitle: "Award medals from your phone", show: showMedalAdmin },
            { to: "/admin/issues", icon: Wrench, title: "Issues", subtitle: "Triage and close maintenance issues", show: showIssueAdmin },
            { to: "/admin/mygate-complaints", icon: BarChart3, title: "MyGate Complaints", subtitle: "Imported Help Desk complaints + analytics", show: showIssueAdmin },
            { to: "/admin/visits", icon: TrendingUp, title: "Visitor approvals", subtitle: "Daily / weekly approval % per block", show: showVisitAdmin },
            { to: "/admin/residents", icon: Users, title: "Residents", subtitle: "Approve, edit flat / phone / type", show: showResidentAdmin },
            { to: "/admin/occupancy", icon: BarChart3, title: "Occupancy", subtitle: "Owner vs tenant breakdown per block", show: showVisitAdmin },
            { to: "/admin/usage", icon: TrendingUp, title: "App & Website Usage", subtitle: "Who's active, by platform", show: showVisitAdmin },
            { to: "/admin/sos", icon: LifeBuoy, title: "SOS acceptance", subtitle: "Warrior promotion + guideline acceptances", show: showEventAdmin },
            { to: "/admin/tambola", icon: Dices, title: "Tambola host", subtitle: "Create session, draw numbers, track prizes", show: showEventAdmin },
            { to: "/admin/quiz", icon: HelpCircle, title: "Quiz host", subtitle: "Launch a saved quiz, advance questions", show: showEventAdmin },
            { to: "/admin/roles", icon: Crown, title: "Manage roles", subtitle: "Assign admin, event mgr, security, etc.", show: showRoleAdmin },
          ]}
        />
      )}

      <ItemGroup
        title="Community"
        items={[
          { to: "/messages", icon: MessagesSquare, title: "Messages", subtitle: "Private 1:1 chat with neighbours" },
          { to: "/residents", icon: Users, title: "Resident Directory", subtitle: "Find a neighbour & message them" },
          { to: "/groups", icon: Users, title: "Groups", subtitle: "Sports & activity groups — join and vote" },
          { to: "/calendar", icon: CalendarDays, title: "Calendar", subtitle: "Events, festivals, maintenance dates" },
          { to: "/community", icon: MessageCircle, title: "Community Feed", subtitle: "Posts, likes, comments — share with neighbours" },
          { to: "/polls", icon: BarChart3, title: "Polls", subtitle: "Vote and see what residents think" },
          { to: "/visits", icon: Users, title: "Visitors", subtitle: "Who came to your flat (from MyGate)" },
          { to: "/my-steps", icon: Activity, title: "My steps", subtitle: "Daily activity from Apple Health" },
          { to: "/rewards", icon: Coins, title: "My rewards", subtitle: "Coins & medals you've won" },
          { to: "/habits", icon: Target, title: "Habits", subtitle: "Build routines with an accountability partner" },
          { to: "/food", icon: UtensilsCrossed, title: "Food & Bazaar", subtitle: "Home kitchens & produce — order or sell" },
          { to: "/vendors", icon: Store, title: "Food Vendors", subtitle: "Outside kitchens — menus & rates" },
          { to: "/parking", icon: Car, title: "Parking", subtitle: "Book a neighbour's slot by the hour" },
          { to: "/vehicles", icon: Car, title: "My Vehicles", subtitle: "View your registered vehicles" },
          { to: "/amenities", icon: CalendarDays, title: "Amenities", subtitle: "Book the clubhouse, courts, gym & more" },
          { to: "/marketplace", icon: ShoppingBag, title: "Marketplace", subtitle: "Buy, sell, give away & rent within RMV" },
          { to: "/domestic-help", icon: Sparkles, title: "Domestic Help", subtitle: "Maids, cooks, drivers — rated by neighbours" },
          { to: "/initiatives", icon: Megaphone, title: "Initiatives", subtitle: "Share feedback on community initiatives" },
          { to: "/referendums", icon: Vote, title: "Referendums", subtitle: "Vote on community decisions" },
          { to: "/duties", icon: ListChecks, title: "My duties", subtitle: "Your daily duty checklist" },
          { to: "/issues", icon: Wrench, title: "Issues", subtitle: "Report a maintenance problem" },
          { to: "/faq", icon: HelpCircle, title: "FAQ", subtitle: "Common questions, topic-wise" },
          { to: "/gallery", icon: ImageIcon, title: "Gallery", subtitle: "Blocks, play areas, surroundings" },
          { to: "/videos", icon: Video, title: "Videos", subtitle: "Community playlists and events" },
        ]}
      />

      <ItemGroup
        title="Services"
        items={[
          { to: "/stickers", icon: Car, title: "Vehicle stickers", subtitle: "Request RMV stickers for cars / bikes" },
        ]}
      />

      <ItemGroup
        title="Rules & safety"
        items={[
          { to: "/guidelines", icon: BookOpen, title: "Community Guidelines", subtitle: "Parking, maintenance, waste, visitors" },
          { to: "/sos-guidelines", icon: LifeBuoy, title: "SOS Guidelines", subtitle: "When and how to use the SOS group" },
          { to: "/sos-warriors", icon: ShieldCheck, title: "SOS Warriors", subtitle: "Trained volunteers, tap to call" },
        ]}
      />

      <ItemGroup
        title="App"
        items={[
          { to: "/info", icon: Info, title: "About", subtitle: "Address, contact, socials" },
        ]}
      />

      {user && (
        <button
          onClick={() => void signOut()}
          className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-left text-sm text-red-300 active:bg-slate-800"
        >
          <LogOut size={16} />
          Sign out
        </button>
      )}

      <p className="mt-auto pb-4 pt-6 text-center text-[11px] text-slate-500">
        RMV Clusters Phase 2 · v1.0
      </p>
    </div>
  );
}

interface Item {
  to: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  show?: boolean; // default true; omitted/true items always render
}

// Renders a section with its rows sorted alphabetically by title (case-
// insensitive), after dropping any items gated off by `show: false`.
function ItemGroup({ title, items }: { title: string; items: Item[] }) {
  const visible = items
    .filter((it) => it.show !== false)
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  if (visible.length === 0) return null;
  return (
    <Group title={title}>
      {visible.map((it) => (
        <Row key={it.to} to={it.to} icon={it.icon} title={it.title} subtitle={it.subtitle} />
      ))}
    </Group>
  );
}

function Group({
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
      <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60">
        {children}
      </div>
    </section>
  );
}

function Row({
  to,
  icon: Icon,
  title,
  subtitle,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 border-b border-slate-700 px-4 py-3 last:border-0 active:bg-slate-800"
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
        <Icon size={16} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-[11px] text-slate-500">{subtitle}</p>
      </div>
      <ChevronRight size={16} className="text-slate-500" />
    </Link>
  );
}
