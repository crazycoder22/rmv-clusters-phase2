"use client";

import { useState, useEffect, useCallback } from "react";
import { useRole } from "@/hooks/useRole";
import { Plus, Trash2, GripVertical, Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import clsx from "clsx";

interface ChecklistItem {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
}

export default function AdminChecklistPage() {
  const { canManageChecklist, isLoading: roleLoading } = useRole();

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/checklist-items");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManageChecklist()) fetchItems();
  }, [canManageChecklist, fetchItems]);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/admin/checklist-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        setNewName("");
        await fetchItems();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to add item");
      }
    } finally {
      setAdding(false);
    }
  };

  const updateItem = async (id: string, data: Partial<ChecklistItem>) => {
    const res = await fetch(`/api/admin/checklist-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) await fetchItems();
    return res.ok;
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    await updateItem(id, { name: editName.trim() });
    setEditingId(null);
  };

  const toggleActive = async (item: ChecklistItem) => {
    setTogglingId(item.id);
    await updateItem(item.id, { active: !item.active });
    setTogglingId(null);
  };

  const deleteItem = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/checklist-items/${id}`, {
        method: "DELETE",
      });
      if (res.ok) await fetchItems();
    } finally {
      setDeletingId(null);
    }
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }

  if (!canManageChecklist()) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-gray-500">
        You do not have permission to manage checklist items.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Manage Checklist Items</h1>
      <p className="text-sm text-gray-500 mb-6">
        Configure the cleaning/facility tasks that appear in the daily checklist. Facility managers will fill these in daily.
      </p>

      {/* Add new item */}
      <form onSubmit={addItem} className="flex gap-2 mb-6">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New checklist item name..."
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="flex items-center gap-1 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {adding ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Plus size={16} />
          )}
          Add
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-600 mb-4">{error}</p>
      )}

      {/* Items list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-primary-600" size={24} />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl">
          No checklist items yet. Add one above to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={clsx(
                "flex items-center gap-3 px-4 py-3 rounded-lg border",
                item.active
                  ? "bg-white border-gray-200"
                  : "bg-gray-50 border-gray-100 opacity-60"
              )}
            >
              <GripVertical size={16} className="text-gray-300 flex-shrink-0" />
              <span className="text-xs text-gray-400 w-6 text-center">{idx + 1}</span>

              {editingId === item.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => saveEdit(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(item.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 rounded border border-primary-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              ) : (
                <span
                  className="flex-1 text-sm text-gray-800 cursor-pointer hover:text-primary-700"
                  onClick={() => {
                    setEditingId(item.id);
                    setEditName(item.name);
                  }}
                  title="Click to edit name"
                >
                  {item.name}
                </span>
              )}

              <button
                onClick={() => toggleActive(item)}
                disabled={togglingId === item.id}
                className="p-1 text-gray-400 hover:text-gray-600"
                title={item.active ? "Deactivate" : "Activate"}
              >
                {togglingId === item.id ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : item.active ? (
                  <ToggleRight size={18} className="text-emerald-500" />
                ) : (
                  <ToggleLeft size={18} className="text-gray-400" />
                )}
              </button>

              <button
                onClick={() => deleteItem(item.id)}
                disabled={deletingId === item.id}
                className="p-1 text-gray-400 hover:text-red-500"
                title="Delete item"
              >
                {deletingId === item.id ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Trash2 size={16} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
