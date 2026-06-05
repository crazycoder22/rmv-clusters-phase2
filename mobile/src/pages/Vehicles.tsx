import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { Car, Bike, Zap, ParkingCircle, ChevronLeft, Loader2 } from "lucide-react";

interface Vehicle {
  id: string;
  vehicleNumber: string;
  vehicleType: "Car" | "Two Wheeler";
  isEV: boolean;
  parkingName: string | null;
}

interface Stats {
  totalVehicles: number;
  totalCars: number;
  totalTwoWheelers: number;
  totalFlatsWithVehicles: number;
}

export default function Vehicles() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [flat, setFlat] = useState<{ block: number; flatNumber: string } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/vehicles", { token });
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles ?? []);
        setFlat(data.flat ?? null);
        setStats(data.stats ?? null);
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

  const cars = vehicles.filter((v) => v.vehicleType === "Car");
  const twoWheelers = vehicles.filter((v) => v.vehicleType === "Two Wheeler");

  return (
    <div className="flex flex-1 flex-col bg-[#0B1120] px-4 pt-[env(safe-area-inset-top,0px)] pb-24">
      {/* Header */}
      <header className="flex items-center gap-3 py-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 active:bg-white/20"
        >
          <ChevronLeft className="text-white" size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Car className="text-blue-400" size={20} />
          <h1 className="text-lg font-semibold text-white">My Vehicles</h1>
        </div>
      </header>

      {flat && (
        <p className="text-[13px] text-gray-400 -mt-2 mb-4 ml-11">
          Block {flat.block}, Flat {flat.flatNumber}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-blue-400" />
        </div>
      ) : vehicles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Car className="h-12 w-12 text-gray-600 mb-3" />
          <p className="text-base font-semibold text-gray-300 mb-1">
            No vehicles registered
          </p>
          <p className="text-[13px] text-gray-500 max-w-[260px]">
            Register your vehicles on the MyGate app to see them here.
          </p>
        </div>
      ) : (
        <>
          {/* Vehicle Cards */}
          <div className="flex flex-col gap-3 mb-6">
            {vehicles.map((v) => (
              <div
                key={v.id}
                className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-4 flex items-start gap-3"
              >
                <div
                  className={`flex items-center justify-center w-11 h-11 rounded-xl ${
                    v.vehicleType === "Car"
                      ? "bg-blue-500/20"
                      : "bg-orange-500/20"
                  }`}
                >
                  {v.vehicleType === "Car" ? (
                    <Car className="h-5 w-5 text-blue-400" />
                  ) : (
                    <Bike className="h-5 w-5 text-orange-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-bold tracking-wider text-white font-mono">
                      {v.vehicleNumber}
                    </span>
                    {v.isEV && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/20 text-green-400">
                        <Zap className="h-2.5 w-2.5" />
                        EV
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-gray-400 mt-0.5">
                    {v.vehicleType}
                  </p>
                  {v.parkingName && (
                    <div className="flex items-center gap-1 mt-1.5 text-[11px] text-gray-500">
                      <ParkingCircle className="h-3 w-3" />
                      <span>Parking: {v.parkingName}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Your Summary */}
          <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-4 mb-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Your Summary
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-bold text-white">{vehicles.length}</p>
                <p className="text-[11px] text-gray-500">Total</p>
              </div>
              <div>
                <p className="text-xl font-bold text-blue-400">{cars.length}</p>
                <p className="text-[11px] text-gray-500">Cars</p>
              </div>
              <div>
                <p className="text-xl font-bold text-orange-400">
                  {twoWheelers.length}
                </p>
                <p className="text-[11px] text-gray-500">Two Wheelers</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Society Stats */}
      {stats && (
        <div className="bg-white/[0.03] rounded-xl border border-white/5 p-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Society Overview
          </p>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-base font-bold text-white">
                {stats.totalVehicles}
              </p>
              <p className="text-[10px] text-gray-500">Vehicles</p>
            </div>
            <div>
              <p className="text-base font-bold text-blue-400">
                {stats.totalCars}
              </p>
              <p className="text-[10px] text-gray-500">Cars</p>
            </div>
            <div>
              <p className="text-base font-bold text-orange-400">
                {stats.totalTwoWheelers}
              </p>
              <p className="text-[10px] text-gray-500">2 Wheelers</p>
            </div>
            <div>
              <p className="text-base font-bold text-green-400">
                {stats.totalFlatsWithVehicles}
              </p>
              <p className="text-[10px] text-gray-500">Flats</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
