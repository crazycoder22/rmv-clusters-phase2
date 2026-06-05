import { Link } from "react-router-dom";
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  Car,
  ChevronRight,
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

      {showAdmin && (
        <Group title="Admin">
          {showEventAdmin && (
            <Row
              to="/admin/announcements"
              icon={Megaphone}
              title="Announcements"
              subtitle="Post & edit news, drafts, RSVPs"
            />
          )}
          {showEventAdmin && (
            <Row
              to="/admin/calendar"
              icon={CalendarDays}
              title="Manage calendar"
              subtitle="Add holidays, festivals, key dates"
            />
          )}
          {showStickerAdmin && (
            <Row
              to="/admin/stickers"
              icon={ShieldCheck}
              title="Sticker requests"
              subtitle="Review submissions, mark issued"
            />
          )}
          {showEventAdmin && (
            <Row
              to="/admin/events"
              icon={CalendarDays}
              title="Event registrations"
              subtitle="Mark paid, review attendees"
            />
          )}
          {showEventAdmin && (
            <Row
              to="/admin/videos"
              icon={Video}
              title="Video library"
              subtitle="Playlists & YouTube videos"
            />
          )}
          {showVisitAdmin && (
            <Row
              to="/admin/ads"
              icon={ImageIcon}
              title="Banner ads"
              subtitle="Sponsor placements & schedules"
            />
          )}
          {showMedalAdmin && (
            <Row
              to="/admin/medals"
              icon={Award}
              title="Medals & coins"
              subtitle="Award medals from your phone"
            />
          )}
          {showIssueAdmin && (
            <Row
              to="/admin/issues"
              icon={Wrench}
              title="Issues"
              subtitle="Triage and close maintenance issues"
            />
          )}
          {showIssueAdmin && (
            <Row
              to="/admin/mygate-complaints"
              icon={BarChart3}
              title="MyGate Complaints"
              subtitle="Imported Help Desk complaints + analytics"
            />
          )}
          {showVisitAdmin && (
            <Row
              to="/admin/visits"
              icon={TrendingUp}
              title="Visitor approvals"
              subtitle="Daily / weekly approval % per block"
            />
          )}
          {showResidentAdmin && (
            <Row
              to="/admin/residents"
              icon={Users}
              title="Residents"
              subtitle="Approve, edit flat / phone / type"
            />
          )}
          {showEventAdmin && (
            <Row
              to="/admin/sos"
              icon={LifeBuoy}
              title="SOS acceptance"
              subtitle="Warrior promotion + guideline acceptances"
            />
          )}
          {showEventAdmin && (
            <Row
              to="/admin/tambola"
              icon={Dices}
              title="Tambola host"
              subtitle="Create session, draw numbers, track prizes"
            />
          )}
          {showEventAdmin && (
            <Row
              to="/admin/quiz"
              icon={HelpCircle}
              title="Quiz host"
              subtitle="Launch a saved quiz, advance questions"
            />
          )}
          {showRoleAdmin && (
            <Row
              to="/admin/roles"
              icon={Crown}
              title="Manage roles"
              subtitle="Assign admin, event mgr, security, etc."
            />
          )}
        </Group>
      )}

      <Group title="Community">
        <Row
          to="/messages"
          icon={MessagesSquare}
          title="Messages"
          subtitle="Private 1:1 chat with neighbours"
        />
        <Row
          to="/groups"
          icon={Users}
          title="Groups"
          subtitle="Sports & activity groups — join and vote"
        />
        <Row
          to="/calendar"
          icon={CalendarDays}
          title="Calendar"
          subtitle="Events, festivals, maintenance dates"
        />
        <Row
          to="/community"
          icon={MessageCircle}
          title="Community Feed"
          subtitle="Posts, likes, comments — share with neighbours"
        />
        <Row
          to="/polls"
          icon={BarChart3}
          title="Polls"
          subtitle="Vote and see what residents think"
        />
        <Row
          to="/visits"
          icon={Users}
          title="Visitors"
          subtitle="Who came to your flat (from MyGate)"
        />
        <Row
          to="/my-steps"
          icon={Activity}
          title="My steps"
          subtitle="Daily activity from Apple Health"
        />
        <Row
          to="/habits"
          icon={Target}
          title="Habits"
          subtitle="Build routines with an accountability partner"
        />
        <Row
          to="/food"
          icon={UtensilsCrossed}
          title="Food"
          subtitle="Home kitchens — order or sell food"
        />
        <Row
          to="/parking"
          icon={Car}
          title="Parking"
          subtitle="Book a neighbour's slot by the hour"
        />
        <Row
          to="/vehicles"
          icon={Car}
          title="My Vehicles"
          subtitle="View your registered vehicles"
        />
        <Row
          to="/amenities"
          icon={CalendarDays}
          title="Amenities"
          subtitle="Book the clubhouse, courts, gym & more"
        />
        <Row
          to="/initiatives"
          icon={Megaphone}
          title="Initiatives"
          subtitle="Share feedback on community initiatives"
        />
        <Row
          to="/referendums"
          icon={Vote}
          title="Referendums"
          subtitle="Vote on community decisions"
        />
        <Row
          to="/duties"
          icon={ListChecks}
          title="My duties"
          subtitle="Your daily duty checklist"
        />
        <Row
          to="/issues"
          icon={Wrench}
          title="Issues"
          subtitle="Report a maintenance problem"
        />
        <Row
          to="/faq"
          icon={HelpCircle}
          title="FAQ"
          subtitle="Common questions, topic-wise"
        />
        <Row
          to="/gallery"
          icon={ImageIcon}
          title="Gallery"
          subtitle="Blocks, play areas, surroundings"
        />
        <Row
          to="/videos"
          icon={Video}
          title="Videos"
          subtitle="Community playlists and events"
        />
      </Group>

      <Group title="Services">
        <Row
          to="/stickers"
          icon={Car}
          title="Vehicle stickers"
          subtitle="Request RMV stickers for cars / bikes"
        />
      </Group>

      <Group title="Rules & safety">
        <Row
          to="/guidelines"
          icon={BookOpen}
          title="Community Guidelines"
          subtitle="Parking, maintenance, waste, visitors"
        />
        <Row
          to="/sos-guidelines"
          icon={LifeBuoy}
          title="SOS Guidelines"
          subtitle="When and how to use the SOS group"
        />
        <Row
          to="/sos-warriors"
          icon={ShieldCheck}
          title="SOS Warriors"
          subtitle="Trained volunteers, tap to call"
        />
      </Group>

      <Group title="App">
        <Row
          to="/info"
          icon={Info}
          title="About"
          subtitle="Address, contact, socials"
        />
      </Group>

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
