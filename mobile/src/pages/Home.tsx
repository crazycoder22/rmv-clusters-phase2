import { Link } from "react-router-dom";
import { Brain, LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";

export default function Home() {
  const { user, signOut } = useAuth();

  return (
    <div className="flex flex-1 flex-col px-6 pt-[max(2.5rem,env(safe-area-inset-top,0px))] pb-[env(safe-area-inset-bottom,0px)]">
      <header className="mb-6 flex items-center justify-between">
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
            <p className="text-sm font-medium text-white">
              Hi, {user?.name?.split(" ")[0] ?? "friend"}
            </p>
            <p className="text-[11px] text-slate-500">{user?.email}</p>
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

      <section className="mb-6 text-center">
        <div className="text-5xl">🏘️</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
          RMV Clusters
        </h1>
        <p className="mt-1 text-xs text-slate-400">Phase 2 community app</p>
      </section>

      <div className="grid gap-3">
        <GameTile
          to="/memory"
          icon="🧠"
          title="Memory Match"
          subtitle="Daily 5×4 card challenge"
        />
        <GameTile
          to="/wordle"
          icon="🔤"
          title="Wordle"
          subtitle="Guess the 5-letter word"
        />
        <GameTile
          to="/sudoku"
          icon="🔢"
          title="Sudoku"
          subtitle="Daily 9×9 number puzzle"
        />
        <GameTile
          to="/2048"
          icon="🎯"
          title="2048"
          subtitle="Swipe to merge tiles"
        />
      </div>

      <div className="mt-auto pt-10 text-center text-xs text-slate-500">
        More games and features coming soon.
      </div>
    </div>
  );
}

function GameTile({
  to,
  icon,
  title,
  subtitle,
}: {
  to: string;
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 active:scale-[0.98] active:bg-slate-800"
    >
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-2xl">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-indigo-400" />
          <h2 className="text-base font-semibold text-white">{title}</h2>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
      </div>
      <span className="text-slate-500">›</span>
    </Link>
  );
}
