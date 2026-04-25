import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Phone, ShieldCheck } from "lucide-react";
import { apiFetch } from "../lib/api";

type Warrior = {
  id: string;
  name: string;
  phone: string;
  block: number;
  flatNumber: string;
};

export default function SosWarriorsPage() {
  const [warriors, setWarriors] = useState<Warrior[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/sos-warriors")
      .then((r) => (r.ok ? r.json() : { warriors: [] }))
      .then((data) => {
        if (!cancelled) setWarriors(data.warriors ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byBlock = useMemo(() => {
    const map = new Map<number, Warrior[]>();
    for (const w of warriors) {
      const list = map.get(w.block) ?? [];
      list.push(w);
      map.set(w.block, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [warriors]);

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/more"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">SOS Warriors</h1>
      </header>

      <p className="mb-5 text-xs leading-relaxed text-slate-400">
        Trained volunteers from the community who can respond to medical and
        fire emergencies. Tap any name to call.
      </p>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
      ) : warriors.length === 0 ? (
        <div className="py-16 text-center">
          <ShieldCheck size={32} className="mx-auto mb-2 text-slate-600" />
          <p className="text-sm text-slate-400">No warriors listed yet.</p>
        </div>
      ) : (
        <div className="space-y-4 pb-4">
          {byBlock.map(([block, list]) => (
            <section key={block}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Block {block} · {list.length} warrior
                {list.length === 1 ? "" : "s"}
              </h2>
              <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60">
                {list.map((w, i) => (
                  <a
                    key={w.id}
                    href={`tel:${w.phone.replace(/\s+/g, "")}`}
                    className={
                      "flex items-center gap-3 px-4 py-3 active:bg-slate-800" +
                      (i < list.length - 1 ? " border-b border-slate-700" : "")
                    }
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-300">
                      <ShieldCheck size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-100">
                        {w.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Block {w.block}, {w.flatNumber} · {w.phone}
                      </p>
                    </div>
                    <Phone size={14} className="text-slate-500" />
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
