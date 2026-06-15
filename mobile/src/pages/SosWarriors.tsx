import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
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
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="flex items-center gap-3 py-3">
        <Link to="/more" className="flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={23} style={{ color: "var(--text-2)" }} />
        </Link>
        <h1 className="text-[24px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>SOS Warriors</h1>
      </header>

      <p className="mb-1 mt-1 px-1 text-[13.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>
        Trained volunteers from the community who can respond to medical and fire emergencies. Tap any name to call.
      </p>

      {loading ? (
        <p className="py-10 text-center text-[14px]" style={{ color: "var(--text-3)" }}>Loading…</p>
      ) : warriors.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Icon name="verified_user" size={32} style={{ color: "var(--text-3)" }} />
          <p className="text-[14px]" style={{ color: "var(--text-2)" }}>No warriors listed yet.</p>
        </div>
      ) : (
        <div className="pb-2">
          {byBlock.map(([block, list]) => (
            <section key={block}>
              <p className="one-mono mb-3 mt-[22px] px-1 text-[11px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.13em" }}>
                BLOCK {block} · {list.length} WARRIOR{list.length === 1 ? "" : "S"}
              </p>
              <div className="overflow-hidden rounded-[18px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                {list.map((w, i) => (
                  <div
                    key={w.id}
                    className="flex items-center gap-3 px-[15px] py-3.5"
                    style={{ borderBottom: i < list.length - 1 ? "1px solid var(--border)" : "none" }}
                  >
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "var(--danger-soft)" }}>
                      <Icon name="verified_user" size={22} fill style={{ color: "var(--danger)" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-bold tracking-tight" style={{ color: "var(--text)" }}>{w.name}</p>
                      <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-3)" }}>
                        Block {w.block}, {w.flatNumber} · {w.phone}
                      </p>
                    </div>
                    <a
                      href={`tel:${w.phone.replace(/\s+/g, "")}`}
                      aria-label={`Call ${w.name}`}
                      className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full active:opacity-80"
                      style={{ background: "var(--accent-soft)" }}
                    >
                      <Icon name="call" size={21} fill style={{ color: "var(--accent)" }} />
                    </a>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
