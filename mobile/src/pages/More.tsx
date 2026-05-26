import { Link } from "react-router-dom";
import {
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  Car,
  ChevronRight,
  HelpCircle,
  Image as ImageIcon,
  Info,
  LifeBuoy,
  LogOut,
  MessageCircle,
  ShieldCheck,
  Users,
  Video,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import {
  canIssueMedals,
  canIssueStickers,
  canManageAnnouncements,
} from "../lib/roles";

export default function MorePage() {
  const { user, signOut } = useAuth();
  const showStickerAdmin = canIssueStickers(user?.roles);
  const showEventAdmin = canManageAnnouncements(user?.roles);
  const showMedalAdmin = canIssueMedals(user?.roles);
  const showAdmin = showStickerAdmin || showEventAdmin || showMedalAdmin;

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
          {showMedalAdmin && (
            <Row
              to="/admin/medals"
              icon={Award}
              title="Medals & coins"
              subtitle="Award medals from your phone"
            />
          )}
        </Group>
      )}

      <Group title="Community">
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
