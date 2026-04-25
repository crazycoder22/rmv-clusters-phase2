import { Link } from "react-router-dom";
import {
  BookOpen,
  ChevronRight,
  Info,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";

export default function MorePage() {
  const { user, signOut } = useAuth();

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

      <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60">
        <Row
          to="/guidelines"
          icon={BookOpen}
          title="Community Guidelines"
          subtitle="Parking, maintenance, waste, visitors"
        />
        <Row
          to="/info"
          icon={Info}
          title="About"
          subtitle="Address, contact, socials"
        />
      </div>

      {user && (
        <button
          onClick={() => void signOut()}
          className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-left text-sm text-red-300 active:bg-slate-800"
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
