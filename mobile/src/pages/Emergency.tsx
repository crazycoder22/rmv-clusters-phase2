import { Link, useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import { EMERGENCY_CONTACTS } from "../lib/emergencyContacts";

export default function Emergency() {
  const navigate = useNavigate();

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="flex items-center gap-3 py-3">
        <button onClick={() => navigate(-1)} className="flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={23} style={{ color: "var(--text-2)" }} />
        </button>
        <h1 className="text-[25px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Emergency</h1>
      </header>

      {/* Emergency contacts */}
      <p className="one-mono mb-3 mt-1.5 px-1 text-[11px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.14em" }}>
        EMERGENCY CONTACTS
      </p>
      <div className="overflow-hidden rounded-[18px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {EMERGENCY_CONTACTS.map((c, i) => {
          const primaryPhone = c.phone.split(",")[0].trim();
          const tel = `tel:${primaryPhone.replace(/\s+/g, "")}`;
          return (
            <div
              key={c.name}
              className="flex items-center gap-3 px-[15px] py-3.5"
              style={{ borderBottom: i < EMERGENCY_CONTACTS.length - 1 ? "1px solid var(--border)" : "none" }}
            >
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "var(--danger-soft)" }}>
                <Icon name={c.ms} size={22} style={{ color: "var(--danger)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold leading-tight tracking-tight" style={{ color: "var(--text)" }}>{c.name}</p>
                <p className="one-mono mt-0.5 text-[12.5px]" style={{ color: "var(--text-3)" }}>{c.phone}</p>
              </div>
              <a
                href={tel}
                aria-label={`Call ${c.name}`}
                className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full active:opacity-80"
                style={{ background: "var(--accent-soft)" }}
              >
                <Icon name="call" size={21} fill style={{ color: "var(--accent)" }} />
              </a>
            </div>
          );
        })}
      </div>

      {/* Community help */}
      <p className="one-mono mb-3 mt-[26px] px-1 text-[11px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.14em" }}>
        COMMUNITY HELP
      </p>
      <Link
        to="/sos-warriors"
        className="flex items-center gap-3 rounded-[18px] p-[15px] active:opacity-80"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "var(--danger-soft)" }}>
          <Icon name="verified_user" size={22} fill style={{ color: "var(--danger)" }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold tracking-tight" style={{ color: "var(--text)" }}>SOS Warriors</p>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-3)" }}>Trained resident volunteers — tap to call</p>
        </div>
        <Icon name="chevron_right" size={22} style={{ color: "var(--text-3)" }} />
      </Link>

      {/* Info note */}
      <div className="mt-5 flex items-start gap-2.5 px-1 text-[12.5px]" style={{ color: "var(--text-3)" }}>
        <Icon name="info" size={17} style={{ color: "var(--text-3)" }} />
        <p className="leading-relaxed">
          Tapping a contact places a call from your phone. Save these numbers offline in case of network issues.
        </p>
      </div>
    </div>
  );
}
