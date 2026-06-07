import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Phone, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import { EMERGENCY_CONTACTS } from "../lib/emergencyContacts";

export default function Emergency() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-8">
      <header className="flex items-center gap-2 py-4">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold text-white">Emergency</h1>
      </header>

      {/* Emergency contacts */}
      <section className="mb-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Emergency Contacts
        </h2>
        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60">
          {EMERGENCY_CONTACTS.map((c, i) => {
            const Icon = c.icon;
            const primaryPhone = c.phone.split(",")[0].trim();
            return (
              <a
                key={c.name}
                href={`tel:${primaryPhone.replace(/\s+/g, "")}`}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 active:bg-slate-800",
                  i < EMERGENCY_CONTACTS.length - 1 && "border-b border-slate-700"
                )}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-300">
                  <Icon size={17} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-100">{c.name}</p>
                  <p className="text-[11px] text-slate-500">{c.phone}</p>
                </div>
                <Phone size={14} className="text-slate-500" />
              </a>
            );
          })}
        </div>
      </section>

      {/* SOS Warriors */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Community Help
        </h2>
        <Link
          to="/sos-warriors"
          className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3.5 active:bg-slate-800"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-300">
            <ShieldCheck size={18} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">SOS Warriors</p>
            <p className="text-[11px] text-slate-500">
              Trained resident volunteers — tap to call
            </p>
          </div>
          <ChevronRight size={16} className="text-slate-500" />
        </Link>
      </section>
    </div>
  );
}
