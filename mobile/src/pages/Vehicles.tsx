import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

interface Vehicle {
  id: string;
  vehicleNumber: string;
  vehicleType: "Car" | "Two Wheeler";
  isEV: boolean;
  parkingName: string | null;
}

// Per-type icon + ring gradient (OneRMV Vehicles.dc.html).
function vIcon(v: Vehicle): string {
  return v.vehicleType === "Car" ? "directions_car" : "two_wheeler";
}
function vGrad(v: Vehicle): string {
  if (v.isEV) return "linear-gradient(140deg,#10b981,#34d399)";
  return v.vehicleType === "Car"
    ? "linear-gradient(140deg,#6366f1,#8b8df7)"
    : "linear-gradient(140deg,#06b6d4,#3b82f6)";
}

export default function Vehicles() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [flat, setFlat] = useState<{ block: number; flatNumber: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/vehicles", { token });
      if (res.ok) {
        const data = await res.json();
        const list: Vehicle[] = data.vehicles ?? [];
        setVehicles(list);
        setFlat(data.flat ?? null);
        setSelectedId((prev) => prev ?? list[0]?.id ?? null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sel = useMemo(
    () => vehicles.find((v) => v.id === selectedId) ?? vehicles[0] ?? null,
    [vehicles, selectedId]
  );

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      {/* Header */}
      <header className="flex items-start gap-3 py-3">
        <button onClick={() => navigate(-1)} className="mt-0.5 flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={23} style={{ color: "var(--text-2)" }} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-extrabold leading-none tracking-tight" style={{ color: "var(--text)" }}>
            My vehicles
          </h1>
          {flat && (
            <p className="mt-[3px] text-[13px]" style={{ color: "var(--text-3)" }}>
              Block {flat.block} · Flat {flat.flatNumber}
            </p>
          )}
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin" size={24} style={{ color: "var(--text-3)" }} />
        </div>
      ) : vehicles.length === 0 ? (
        <div
          className="mt-2 flex flex-col items-center gap-2 rounded-[18px] px-6 py-14 text-center"
          style={{ border: "1.5px dashed var(--border-strong)" }}
        >
          <Icon name="directions_car" size={34} style={{ color: "var(--text-3)" }} />
          <p className="text-[15px] font-bold" style={{ color: "var(--text)" }}>No vehicles registered</p>
          <p className="max-w-[260px] text-[13px] leading-relaxed" style={{ color: "var(--text-3)" }}>
            Register your vehicles on the MyGate app and they'll appear here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          {/* ── Digital gate pass (selected vehicle) ── */}
          {sel && <GatePass v={sel} flat={flat} />}

          {/* ── All vehicles ── */}
          <p
            className="one-mono mb-3 mt-6 px-1 text-[11px] font-semibold"
            style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}
          >
            ALL VEHICLES · {vehicles.length}
          </p>

          <div className="flex flex-col gap-2.5">
            {vehicles.map((v) => {
              const on = v.id === sel?.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  className="flex items-center gap-3 rounded-[16px] p-3.5 text-left active:opacity-90"
                  style={{
                    background: "var(--surface)",
                    border: `1.5px solid ${on ? "var(--accent)" : "var(--border)"}`,
                    boxShadow: on ? "0 6px 18px var(--accent-soft)" : "none",
                  }}
                >
                  <div
                    className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-[13px]"
                    style={{ background: vGrad(v) }}
                  >
                    <Icon name={vIcon(v)} size={24} style={{ color: "#fff" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[16px] font-bold tracking-tight" style={{ color: "var(--text)" }}>
                        {v.vehicleType}
                      </span>
                      {on && (
                        <span
                          className="rounded-[6px] px-[7px] py-[2px] text-[10px] font-extrabold"
                          style={{ letterSpacing: "0.06em", color: "var(--accent)", background: "var(--accent-soft)" }}
                        >
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="one-mono mt-1 text-[13px]" style={{ color: "var(--text-3)" }}>
                      {v.vehicleNumber}
                      {v.parkingName ? ` · ${v.parkingName}` : ""}
                    </div>
                  </div>
                  {v.isEV ? (
                    <span
                      className="flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold"
                      style={{ background: "var(--success-soft)", color: "var(--success)" }}
                    >
                      <Icon name="bolt" size={14} style={{ color: "var(--success)" }} />EV
                    </span>
                  ) : (
                    <span
                      className="flex-shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-bold"
                      style={{ background: "var(--surface-3)", color: "var(--text-2)" }}
                    >
                      Registered
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-center text-[12px] leading-relaxed" style={{ color: "var(--text-3)" }}>
            Vehicles are tied to your flat and synced from MyGate. Show this pass at the gate when asked.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Digital gate pass card — always a dark "pass" object (like a transit card),
// regardless of app theme. Uses real vehicle data only. ──────────────────────
function GatePass({ v, flat }: { v: Vehicle; flat: { block: number; flatNumber: string } | null }) {
  return (
    <div
      className="overflow-hidden rounded-[22px]"
      style={{
        border: "1px solid rgba(255,255,255,0.16)",
        background: "linear-gradient(155deg,#1d2a52 0%,#15203c 55%,#101a30 100%)",
      }}
    >
      <div className="p-4 pb-3.5">
        <div className="flex items-center justify-between">
          <span
            className="one-mono text-[11px] font-semibold"
            style={{ letterSpacing: "0.16em", color: "#9fb8d9" }}
          >
            VEHICLE GATE PASS
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-[12px] font-bold"
            style={{ background: "rgba(255,255,255,0.08)", color: v.isEV ? "#34d399" : "#9fb8d9" }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
            {v.isEV ? "Electric" : "Registered"}
          </span>
        </div>

        {/* Indian number plate */}
        <div className="my-3.5 flex justify-center">
          <div className="flex items-stretch overflow-hidden rounded-[8px]" style={{ boxShadow: "0 4px 14px rgba(0,0,0,0.3)" }}>
            <div
              className="flex flex-col items-center justify-center gap-0.5 px-[7px]"
              style={{ background: "#1d4ed8", color: "#fff" }}
            >
              <span
                className="h-[9px] w-[13px] rounded-[1px]"
                style={{ background: "linear-gradient(180deg,#ff9933 33%,#ffffff 33% 66%,#138808 66%)" }}
              />
              <span className="one-mono text-[8px] font-bold" style={{ letterSpacing: "0.5px" }}>IND</span>
            </div>
            <div
              className="one-mono px-3.5 py-2.5 text-[22px] font-bold"
              style={{ background: "#f6f6ef", color: "#0e1116", letterSpacing: "1.5px" }}
            >
              {v.vehicleNumber}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2.5">
          <Icon name={vIcon(v)} size={20} style={{ color: "#bccceb" }} />
          <span className="text-[16px] font-bold" style={{ color: "#fff" }}>{v.vehicleType}</span>
          <span className="text-[13px]" style={{ color: "#8fa3c9" }}>· {v.isEV ? "Electric" : "Registered"}</span>
        </div>
      </div>

      {/* footer: slot/flat + QR of the plate */}
      <div
        className="flex items-center gap-3.5 px-4 py-3.5"
        style={{ borderTop: "1px dashed rgba(255,255,255,0.16)", background: "rgba(0,0,0,0.16)" }}
      >
        <div className="flex flex-1 flex-col gap-2.5">
          <div>
            <div className="text-[11px] font-semibold" style={{ letterSpacing: "0.06em", color: "#8fa3c9" }}>PARKING SLOT</div>
            <div className="one-mono mt-[3px] text-[17px] font-bold" style={{ color: "#fff" }}>{v.parkingName ?? "—"}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold" style={{ letterSpacing: "0.06em", color: "#8fa3c9" }}>FLAT</div>
            <div className="one-mono mt-[3px] text-[14px] font-bold" style={{ color: "#cdd9ef" }}>
              {flat ? `B${flat.block} · ${flat.flatNumber}` : "—"}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex h-[78px] w-[78px] items-center justify-center rounded-[12px]" style={{ background: "#fff" }}>
            <QRCodeSVG value={v.vehicleNumber} size={64} bgColor="#ffffff" fgColor="#0e1116" level="M" />
          </div>
          <span className="text-[10.5px] font-semibold" style={{ color: "#8fa3c9" }}>Scan at gate</span>
        </div>
      </div>
    </div>
  );
}
