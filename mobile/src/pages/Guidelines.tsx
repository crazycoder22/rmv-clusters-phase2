import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import guidelinesData from "../data/guidelines.json";

type Rule = { title: string; description: string };
type Section = { id: string; title: string; icon: string; rules: Rule[] };
type Guidelines = { lastUpdated: string; sections: Section[] };

// JSON icon string → Material Symbol (matches OneRMV Guidelines.dc.html).
const ICONS: Record<string, string> = {
  car: "directions_car",
  wrench: "build",
  users: "security",
  building: "deck",
  "trash-2": "recycling",
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
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)]"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="flex items-center gap-3 py-3">
        <Link to="/community" className="flex" aria-label="Back">
          <Icon name="arrow_back" size={22} style={{ color: "var(--text-2)" }} />
        </Link>
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Guidelines</h1>
          <p className="mt-px text-[12px]" style={{ color: "var(--text-3)" }}>
            Community rules — last updated{" "}
            {new Date(data.lastUpdated).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3.5 pb-6">
        {data.sections.map((section) => {
          const ms = ICONS[section.icon] ?? "rule";
          const isOpen = expanded.has(section.id);
          return (
            <div key={section.id} className="overflow-hidden rounded-[18px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <button onClick={() => toggle(section.id)} className="flex w-full items-center gap-3 p-4 text-left active:opacity-90">
                <span className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[12px]" style={{ background: "var(--accent-soft)" }}>
                  <Icon name={ms} size={22} style={{ color: "var(--accent)" }} />
                </span>
                <span className="flex-1 text-[17px] font-bold" style={{ color: "var(--text)" }}>{section.title}</span>
                <span className="text-[14px]" style={{ color: "var(--text-3)" }}>{section.rules.length}</span>
                <Icon name="expand_more" size={22} className="transition-transform" style={{ color: "var(--text-3)", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
              </button>
              {isOpen && (
                <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--border)" }}>
                  {section.rules.map((rule, i) => (
                    <div key={i} className="mt-4 pl-3.5" style={{ borderLeft: "2px solid var(--accent)" }}>
                      <p className="text-[16px] font-bold" style={{ color: "var(--text)" }}>{rule.title}</p>
                      <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: "var(--text-2)" }}>{rule.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-2 pb-4 text-center text-[12px]" style={{ color: "var(--text-3)" }}>
        Questions? Contact the office from the About page.
      </p>
    </div>
  );
}
