"use client";

import type { MenuItemType } from "@/types";

interface RsvpSummaryProps {
  menuItems: MenuItemType[];
  plates: Record<string, number>;
  entranceFee?: number;
  entranceFeeLabel?: string;
}

export default function RsvpSummary({
  menuItems,
  plates,
  entranceFee = 0,
  entranceFeeLabel = "Entrance Fee",
}: RsvpSummaryProps) {
  const selectedItems = menuItems.filter((item) => (plates[item.id] || 0) > 0);
  const foodTotal = selectedItems.reduce(
    (sum, item) => sum + (plates[item.id] || 0) * item.pricePerPlate,
    0
  );
  const grandTotal = foodTotal + entranceFee;

  if (selectedItems.length === 0 && entranceFee <= 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">
          Select menu items above to see your order summary.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Order Summary</h3>
      <div className="space-y-2">
        {entranceFee > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">{entranceFeeLabel}</span>
            <span className="text-gray-800 dark:text-gray-200 font-medium">₹{entranceFee.toFixed(2)}</span>
          </div>
        )}
        {selectedItems.map((item) => {
          const count = plates[item.id] || 0;
          const lineTotal = count * item.pricePerPlate;
          return (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">{item.name} &times; {count}</span>
              <span className="text-gray-800 dark:text-gray-200 font-medium">₹{lineTotal.toFixed(2)}</span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-gray-300 dark:border-gray-600 mt-3 pt-3 flex justify-between">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Total</span>
        <span className="text-sm font-bold text-primary-700 dark:text-primary-400">₹{grandTotal.toFixed(2)}</span>
      </div>
    </div>
  );
}
