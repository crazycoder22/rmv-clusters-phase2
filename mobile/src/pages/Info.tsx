import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Globe, Mail, MapPin, Phone } from "lucide-react";
import { Browser } from "@capacitor/browser";
import { SITE_INFO } from "../data/site";

export default function Info() {
  const openExternal = (url: string) => {
    Browser.open({ url }).catch(() => window.open(url, "_blank"));
  };

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">About</h1>
      </header>

      <section className="mb-5 rounded-2xl border border-slate-700 bg-slate-800/60 p-5 text-center">
        <div className="text-4xl">🏘️</div>
        <h2 className="mt-2 text-xl font-bold text-white">
          {SITE_INFO.name}
        </h2>
        <p className="mt-1 text-xs text-slate-400">{SITE_INFO.tagline}</p>
      </section>

      <Section title="Address">
        <button
          onClick={() => openExternal(SITE_INFO.address.mapsUrl)}
          className="flex w-full items-start gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-left active:bg-slate-800"
        >
          <MapPin
            size={18}
            className="mt-0.5 flex-shrink-0 text-indigo-400"
          />
          <div className="flex-1 space-y-0.5 text-sm text-slate-200">
            {SITE_INFO.address.lines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            <div className="pt-1 text-xs font-medium text-indigo-400">
              Open in Maps ›
            </div>
          </div>
        </button>
      </Section>

      <Section title="Contact">
        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60">
          <a
            href={`tel:${SITE_INFO.contact.phone.replace(/[^\d+]/g, "")}`}
            className="flex items-center gap-3 border-b border-slate-700 px-4 py-3 active:bg-slate-800"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
              <Phone size={16} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-100">
                {SITE_INFO.contact.phone}
              </p>
              <p className="text-[11px] text-slate-500">
                {SITE_INFO.contact.officeHours}
              </p>
            </div>
          </a>
          <a
            href={`mailto:${SITE_INFO.contact.email}`}
            className="flex items-center gap-3 px-4 py-3 active:bg-slate-800"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
              <Mail size={16} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-100">
                {SITE_INFO.contact.email}
              </p>
              <p className="text-[11px] text-slate-500">Email the office</p>
            </div>
          </a>
        </div>
      </Section>

      <Section title="Follow">
        <div className="grid grid-cols-3 gap-2">
          <SocialTile
            label="Website"
            emoji={<Globe size={18} />}
            onClick={() => openExternal(SITE_INFO.social.website)}
          />
          <SocialTile
            label="Instagram"
            emoji={<span className="text-lg">📷</span>}
            onClick={() => openExternal(SITE_INFO.social.instagram)}
          />
          <SocialTile
            label="YouTube"
            emoji={<span className="text-lg">▶️</span>}
            onClick={() => openExternal(SITE_INFO.social.youtube)}
          />
        </div>
      </Section>

      <p className="mt-auto pb-4 pt-6 text-center text-[11px] text-slate-500">
        RMV Clusters Phase 2 · v1.0
      </p>
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

function SocialTile({
  label,
  emoji,
  onClick,
}: {
  label: string;
  emoji: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-700 bg-slate-800/60 px-3 py-3 active:bg-slate-800"
    >
      <span className="text-indigo-400">{emoji}</span>
      <span className="flex items-center gap-1 text-xs font-medium text-slate-200">
        {label}
        <ExternalLink size={10} className="text-slate-500" />
      </span>
    </button>
  );
}
