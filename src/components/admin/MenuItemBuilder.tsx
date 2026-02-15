"use client";

import type { MenuItemFormEntry } from "@/types";

interface MenuItemBuilderProps {
  items: MenuItemFormEntry[];
  onChange: (items: MenuItemFormEntry[]) => void;
}

export default function MenuItemBuilder({ items, onChange }: MenuItemBuilderProps) {
  const addItem = () => {
    onChange([
      ...items,
      { tempId: crypto.randomUUID(), name: "", pricePerPlate: "" },
    ]);
  };

  const removeItem = (tempId: string) => {
    onChange(items.filter((item) => item.tempId !== tempId));
  };

  const updateItem = (tempId: string, field: keyof MenuItemFormEntry, value: string) => {
    onChange(
      items.map((item) =>
        item.tempId === tempId ? { ...item, [field]: value } : item
      )
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Menu Items
        </label>
        <button
          type="button"
          onClick={addItem}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          + Add Item
        </button>
      </div>

      {items.length === 0 && (
        <p className="text-sm text-gray-400 italic">
          No menu items added. Click &quot;+ Add Item&quot; to start.
        </p>
      )}

      {items.map((item, index) => (
        <div key={item.tempId} className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-5 shrink-0">{index + 1}.</span>
          <input
            type="text"
            value={item.name}
            onChange={(e) => updateItem(item.tempId, "name", e.target.value)}
            placeholder="Item name (e.g., Veg Biryani)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
            <input
              type="number"
              value={item.pricePerPlate}
              onChange={(e) => updateItem(item.tempId, "pricePerPlate", e.target.value)}
              placeholder="Price"
              min="0"
              step="0.01"
              className="w-28 pl-7 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <button
            type="button"
            onClick={() => removeItem(item.tempId)}
            className="text-red-400 hover:text-red-600 text-lg font-bold shrink-0"
            title="Remove item"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
