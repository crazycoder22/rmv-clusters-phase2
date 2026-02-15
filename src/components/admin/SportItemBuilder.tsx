"use client";

import type { SportItemFormEntry } from "@/types";

interface SportItemBuilderProps {
  items: SportItemFormEntry[];
  onChange: (items: SportItemFormEntry[]) => void;
}

export default function SportItemBuilder({ items, onChange }: SportItemBuilderProps) {
  const addItem = () => {
    onChange([...items, { tempId: crypto.randomUUID(), name: "" }]);
  };

  const removeItem = (tempId: string) => {
    onChange(items.filter((item) => item.tempId !== tempId));
  };

  const updateItem = (tempId: string, value: string) => {
    onChange(
      items.map((item) =>
        item.tempId === tempId ? { ...item, name: value } : item
      )
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Sports
        </label>
        <button
          type="button"
          onClick={addItem}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          + Add Sport
        </button>
      </div>

      {items.length === 0 && (
        <p className="text-sm text-gray-400 italic">
          No sports added. Click &quot;+ Add Sport&quot; to start.
        </p>
      )}

      {items.map((item, index) => (
        <div key={item.tempId} className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-5 shrink-0">{index + 1}.</span>
          <input
            type="text"
            value={item.name}
            onChange={(e) => updateItem(item.tempId, e.target.value)}
            placeholder="Sport name (e.g., Cricket)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <button
            type="button"
            onClick={() => removeItem(item.tempId)}
            className="text-red-400 hover:text-red-600 text-lg font-bold shrink-0"
            title="Remove sport"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
