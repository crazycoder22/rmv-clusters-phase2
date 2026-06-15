import { Link } from "react-router-dom";
import { Browser } from "@capacitor/browser";
import Icon from "../components/Icon";
import { SITE_INFO } from "../data/site";

export default function Info() {
  const openExternal = (url: string) => {
    Browser.open({ url }).catch(() => window.open(url, "_blank"));
  };

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="flex items-center gap-3 py-3">
        <Link to="/" className="flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={23} style={{ color: "var(--text-2)" }} />
        </Link>
        <h1 className="text-[25px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>About</h1>
      </header>

      {/* Hero */}
      <div className="rounded-[20px] p-[26px_20px_24px] text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="text-[40px] leading-none">🏘️</div>
        <h2 className="mt-3 text-[25px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>{SITE_INFO.name}</h2>
        <p className="mt-1.5 text-[15px]" style={{ color: "var(--text-3)" }}>{SITE_INFO.tagline}</p>
      </div>

      {/* Address */}
      <SectionLabel>ADDRESS</SectionLabel>
      <button
        onClick={() => openExternal(SITE_INFO.address.mapsUrl)}
        className="flex w-full gap-3.5 rounded-[18px] p-4 text-left active:opacity-80"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <Icon name="location_on" size={23} fill style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} />
        <div className="min-w-0 flex-1">
          <div className="text-[15.5px] leading-relaxed" style={{ color: "var(--text)" }}>
            {SITE_INFO.address.lines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
          <div className="mt-3 text-[14.5px] font-bold" style={{ color: "var(--accent)" }}>Open in Maps ›</div>
        </div>
      </button>

      {/* Contact */}
      <SectionLabel>CONTACT</SectionLabel>
      <div className="overflow-hidden rounded-[18px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <a
          href={`tel:${SITE_INFO.contact.phone.replace(/[^\d+]/g, "")}`}
          className="flex items-center gap-3.5 p-4 active:opacity-80"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <ContactIcon name="call" />
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-bold" style={{ color: "var(--text)" }}>{SITE_INFO.contact.phone}</p>
            <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-3)" }}>{SITE_INFO.contact.officeHours}</p>
          </div>
        </a>
        <a href={`mailto:${SITE_INFO.contact.email}`} className="flex items-center gap-3.5 p-4 active:opacity-80">
          <ContactIcon name="mail" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold" style={{ color: "var(--text)" }}>{SITE_INFO.contact.email}</p>
            <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-3)" }}>Email the office</p>
          </div>
        </a>
      </div>

      {/* Follow */}
      <SectionLabel>FOLLOW</SectionLabel>
      <div className="flex gap-2.5">
        <SocialTile label="Website" onClick={() => openExternal(SITE_INFO.social.website)}>
          <Icon name="language" size={25} style={{ color: "var(--accent)" }} />
        </SocialTile>
        <SocialTile label="Instagram" onClick={() => openExternal(SITE_INFO.social.instagram)}>
          <span className="text-[23px] leading-none">📷</span>
        </SocialTile>
        <SocialTile label="YouTube" onClick={() => openExternal(SITE_INFO.social.youtube)}>
          <span className="text-[23px] leading-none">▶️</span>
        </SocialTile>
      </div>

      <p className="mt-auto pb-2 pt-6 text-center text-[13px]" style={{ color: "var(--text-3)" }}>
        RMV Clusters Phase 2 · v1.0
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="one-mono mb-3 mt-6 px-1 text-[11px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.14em" }}>
      {children}
    </p>
  );
}

function ContactIcon({ name }: { name: string }) {
  return (
    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "var(--accent-soft)" }}>
      <Icon name={name} size={22} fill style={{ color: "var(--accent)" }} />
    </div>
  );
}

function SocialTile({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-2.5 rounded-[16px] p-[18px_8px] active:opacity-80"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {children}
      <span className="flex items-center gap-1 text-[14px] font-bold" style={{ color: "var(--text)" }}>
        {label}
        <Icon name="open_in_new" size={14} style={{ color: "var(--text-3)" }} />
      </span>
    </button>
  );
}
