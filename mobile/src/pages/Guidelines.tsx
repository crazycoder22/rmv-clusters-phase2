import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Building,
  Car,
  ChevronDown,
  Trash2,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import guidelinesData from "../data/guidelines.json";

type Rule = { title: string; description: string };
type Section = {
  id: string;
  title: string;
  icon: string;
  rules: Rule[];
};

type Guidelines = {
  lastUpdated: string;
  sections: Section[];
};

const ICONS: Record<string, LucideIcon> = {
  car: Car,
  wrench: Wrench,
  users: Users,
  building: Building,
  "trash-2": Trash2,
};

export default function GuidelinesPage() {
  const data = guidelinesData as Guidelines;
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(data.sections[0] ? [data.sections[0].id] : [])
  );

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">Guidelines</h1>
      </header>

      <p className="mb-4 text-xs text-slate-500">
        Community rules — last updated{" "}
        {new Date(data.lastUpdated).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </p>

      <div className="space-y-3">
        {data.sections.map((section) => {
          const Icon = ICONS[section.icon] ?? Users;
          const isOpen = expanded.has(section.id);
          return (
            <div
              key={section.id}
              className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60"
            >
              <button
                onClick={() => toggle(section.id)}
                className="flex w-full items-center gap-3 px-4 py-3 active:bg-slate-800"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
                  <Icon size={16} />
                </div>
                <span className="flex-1 text-left text-sm font-semibold text-white">
                  {section.title}
                </span>
                <span className="text-[11px] text-slate-500">
                  {section.rules.length}
                </span>
                <ChevronDown
                  size={16}
                  className={clsx(
                    "text-slate-500 transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
              </button>
              {isOpen && (
                <div className="space-y-3 border-t border-slate-700 px-4 py-3">
                  {section.rules.map((rule, i) => (
                    <div
                      key={i}
                      className="border-l-2 border-indigo-500/60 pl-3"
                    >
                      <p className="text-sm font-medium text-slate-100">
                        {rule.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                        {rule.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-6 pb-4 text-center text-[11px] text-slate-500">
        Questions? Contact the office from the About page.
      </p>
    </div>
  );
}
