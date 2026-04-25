import { Link } from "react-router-dom";
import {
  Ambulance,
  ArrowLeft,
  CheckCircle,
  Flame,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import sosData from "../data/sos-guidelines.json";

type ScopeSection = { id: string; icon: string; title: string; items: string[] };
type Rule = { type: "forbidden" | "penalties"; items: string[] };
type SosGuidelines = {
  version: string;
  lastUpdated: string;
  scope: ScopeSection[];
  howItWorks: string[];
  rules: Rule[];
  emergencyExamples: string[];
  nonEmergencyExamples: string[];
};

const ICONS: Record<string, LucideIcon> = {
  ambulance: Ambulance,
  flame: Flame,
};

export default function SosGuidelinesPage() {
  const data = sosData as SosGuidelines;
  const forbidden = data.rules.find((r) => r.type === "forbidden");
  const penalties = data.rules.find((r) => r.type === "penalties");

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/more"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">SOS Guidelines</h1>
      </header>

      <p className="mb-5 text-xs text-slate-500">
        Version {data.version} · Last updated{" "}
        {new Date(data.lastUpdated).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </p>

      <Section title="When to use the SOS group">
        <div className="space-y-3">
          {data.scope.map((s) => {
            const Icon = ICONS[s.icon] ?? Ambulance;
            return (
              <div
                key={s.id}
                className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-300">
                    <Icon size={14} />
                  </div>
                  <h3 className="text-sm font-semibold text-white">
                    {s.title}
                  </h3>
                </div>
                <ul className="space-y-1 text-sm text-slate-300">
                  {s.items.map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-slate-600">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="How it works">
        <ol className="space-y-2 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-sm leading-relaxed text-slate-300">
          {data.howItWorks.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-[11px] font-bold text-indigo-300">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Section>

      {forbidden && (
        <Section title="Please avoid">
          <div className="space-y-1 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
            {forbidden.items.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm text-red-200"
              >
                <XCircle size={14} className="flex-shrink-0 text-red-400" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {penalties && (
        <Section title="Penalties for misuse">
          <div className="space-y-1 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            {penalties.items.map((item, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-amber-400">•</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Real emergencies — do post">
        <ExampleList items={data.emergencyExamples} positive />
      </Section>

      <Section title="Not emergencies — don't post">
        <ExampleList items={data.nonEmergencyExamples} />
      </Section>
    </div>
  );
}

function Section({
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
      {children}
    </section>
  );
}

function ExampleList({
  items,
  positive,
}: {
  items: string[];
  positive?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-2 border-b border-slate-700 px-4 py-2.5 text-sm last:border-0"
        >
          {positive ? (
            <CheckCircle
              size={14}
              className="flex-shrink-0 text-green-400"
            />
          ) : (
            <XCircle size={14} className="flex-shrink-0 text-slate-500" />
          )}
          <span className="text-slate-200">{item}</span>
        </div>
      ))}
    </div>
  );
}
