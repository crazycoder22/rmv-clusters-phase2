"use client";

import type { MenuItemType } from "@/types";

interface RsvpSummaryProps {
  menuItems: MenuItemType[];
  plates: Record<string, number>;
}

export default function RsvpSummary({ menuItems, plates }: RsvpSummaryProps) {
  const selectedItems = menuItems.filter((item) => (plates[item.id] || 0) > 0);
  const grandTotal = selectedItems.reduce(
    (sum, item) => sum + (plates[item.id] || 0) * item.pricePerPlate,
    0
  );

  if (selectedItems.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <p className="text-sm text-gray-400 italic">
          Select menu items above to see your order summary.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Order Summary</h3>
      <div className="space-y-2">
        {selectedItems.map((item) => {
          const count = plates[item.id] || 0;
          const lineTotal = count * item.pricePerPlate;
          return (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-gray-600">
                {item.name} &times; {count}
              </span>
              <span className="text-gray-800 font-medium">
                ₹{lineTotal.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-gray-300 mt-3 pt-3 flex justify-between">
        <span className="text-sm font-semibold text-gray-800">Total</span>
        <span className="text-sm font-bold text-primary-700">
          ₹{grandTotal.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
