"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRequireSignIn } from "@/hooks/useRequireSignIn";
import { Car, Bike, Zap, ParkingCircle, BarChart3, Loader2 } from "lucide-react";

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

export default function VehiclesPage() {
  const { status } = useSession();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [flat, setFlat] = useState<{ block: number; flatNumber: string } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useRequireSignIn(status);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vehicles");
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles ?? []);
        setFlat(data.flat ?? null);
        setStats(data.stats ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") void refresh();
  }, [status, refresh]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const cars = vehicles.filter((v) => v.vehicleType === "Car");
  const twoWheelers = vehicles.filter((v) => v.vehicleType === "Two Wheeler");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <Car className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              My Vehicles
            </h1>
            {flat && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Block {flat.block}, Flat {flat.flatNumber}
              </p>
            )}
          </div>
        </div>

        {/* My Vehicles */}
        {vehicles.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center mb-8">
            <Car className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              No vehicles registered
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your flat has no vehicles registered on MyGate. Please register
              your vehicles on the MyGate app to see them here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 mb-8">
            {vehicles.map((v) => (
              <div
                key={v.id}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4 transition-shadow hover:shadow-md"
              >
                {/* Icon */}
                <div
                  className={`flex items-center justify-center w-12 h-12 rounded-xl ${
                    v.vehicleType === "Car"
                      ? "bg-blue-100 dark:bg-blue-900/30"
                      : "bg-orange-100 dark:bg-orange-900/30"
                  }`}
                >
                  {v.vehicleType === "Car" ? (
                    <Car
                      className="h-6 w-6 text-blue-600 dark:text-blue-400"
                    />
                  ) : (
                    <Bike
                      className="h-6 w-6 text-orange-600 dark:text-orange-400"
                    />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold tracking-wider text-gray-900 dark:text-gray-100 font-mono">
                      {v.vehicleNumber}
                    </h3>
                    {v.isEV && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        <Zap className="h-3 w-3" />
                        EV
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {v.vehicleType}
                  </p>
                  {v.parkingName && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-400 dark:text-gray-500">
                      <ParkingCircle className="h-3.5 w-3.5" />
                      <span>Parking: {v.parkingName}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Your Summary
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {vehicles.length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Total
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {cars.length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Cars
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {twoWheelers.length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Two Wheelers
              </p>
            </div>
          </div>
        </div>

        {/* Society Stats */}
        {stats && (
          <div className="bg-gray-100 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Society Overview
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.totalVehicles}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Total Vehicles
                </p>
              </div>
              <div>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.totalCars}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Cars
                </p>
              </div>
              <div>
                <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  {stats.totalTwoWheelers}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Two Wheelers
                </p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  {stats.totalFlatsWithVehicles}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Flats Registered
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
