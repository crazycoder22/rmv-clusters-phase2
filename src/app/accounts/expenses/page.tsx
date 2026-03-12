"use client";

import { useState, useEffect, useCallback } from "react";
import { useRole } from "@/hooks/useRole";
import Link from "next/link";
import { Plus, Pencil, Trash2, X, ChevronDown } from "lucide-react";
import clsx from "clsx";
import {
  BLOCK_PERCENTAGES,
  DISTRIBUTION_LABELS,
  calculateBlockAmounts,
  formatCurrency,
  MONTH_NAMES,
  type DistributionType,
} from "@/lib/expenses";

interface ExpenseMonthSummary {
  id: string;
  month: number;
  year: number;
  notes: string | null;
  _count: { items: number };
}

interface ExpenseItemData {
  id: string;
  description: string;
  totalAmount: number;
  distributionType: string;
  targetBlock: number | null;
  block1Amount: number;
  block2Amount: number;
  block3Amount: number;
  block4Amount: number;
  sortOrder: number;
}

const DIST_BADGE_COLORS: Record<string, string> = {
  percentage: "bg-blue-100 text-blue-700",
  block_specific: "bg-purple-100 text-purple-700",
  custom: "bg-orange-100 text-orange-700",
  income: "bg-green-100 text-green-700",
};

export default function ExpenseCalculatorPage() {
  const { isAdmin, isSuperAdmin, canManageAnnouncements, isLoading: roleLoading } = useRole();
  const [months, setMonths] = useState<ExpenseMonthSummary[]>([]);
  const [selectedMonthId, setSelectedMonthId] = useState<string | null>(null);
  const [items, setItems] = useState<ExpenseItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);

  // New month form
  const [showNewMonth, setShowNewMonth] = useState(false);
  const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [creatingMonth, setCreatingMonth] = useState(false);

  // Add/Edit item form
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ExpenseItemData | null>(null);
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDistType, setFormDistType] = useState<DistributionType>("percentage");
  const [formTargetBlock, setFormTargetBlock] = useState("1");
  const [formCustom, setFormCustom] = useState({ block1: "", block2: "", block3: "", block4: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const hasAccess = canManageAnnouncements();

  const fetchMonths = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/expenses");
      if (res.ok) {
        const data = await res.json();
        setMonths(data.months || []);
        if (data.months.length > 0 && !selectedMonthId) {
          setSelectedMonthId(data.months[0].id);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedMonthId]);

  const fetchItems = useCallback(async (monthId: string) => {
    setLoadingItems(true);
    try {
      const res = await fetch(`/api/admin/expenses/${monthId}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.expenseMonth.items || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    if (!roleLoading && hasAccess) fetchMonths();
    else if (!roleLoading) setLoading(false);
  }, [roleLoading, hasAccess, fetchMonths]);

  useEffect(() => {
    if (selectedMonthId) fetchItems(selectedMonthId);
    else setItems([]);
  }, [selectedMonthId, fetchItems]);

  const resetForm = () => {
    setFormDescription("");
    setFormAmount("");
    setFormDistType("percentage");
    setFormTargetBlock("1");
    setFormCustom({ block1: "", block2: "", block3: "", block4: "" });
    setEditingItem(null);
    setFormError("");
  };

  const openEdit = (item: ExpenseItemData) => {
    setFormDescription(item.description);
    setFormAmount(String(item.totalAmount));
    setFormDistType(item.distributionType as DistributionType);
    setFormTargetBlock(String(item.targetBlock || 1));
    if (item.distributionType === "custom") {
      setFormCustom({
        block1: String(item.block1Amount),
        block2: String(item.block2Amount),
        block3: String(item.block3Amount),
        block4: String(item.block4Amount),
      });
    } else {
      setFormCustom({ block1: "", block2: "", block3: "", block4: "" });
    }
    setEditingItem(item);
    setShowForm(true);
    setFormError("");
  };

  const handleCreateMonth = async () => {
    setCreatingMonth(true);
    try {
      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: newMonth, year: newYear }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowNewMonth(false);
        await fetchMonths();
        setSelectedMonthId(data.expenseMonth.id);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create month");
      }
    } catch {
      alert("Failed to create month");
    } finally {
      setCreatingMonth(false);
    }
  };

  const handleDeleteMonth = async () => {
    if (!selectedMonthId) return;
    const selected = months.find((m) => m.id === selectedMonthId);
    if (!selected) return;
    if (!window.confirm(`Delete ${MONTH_NAMES[selected.month - 1]} ${selected.year} and all its expenses? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/admin/expenses/${selectedMonthId}`, { method: "DELETE" });
      if (res.ok) {
        setSelectedMonthId(null);
        setItems([]);
        fetchMonths();
      }
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDescription.trim()) {
      setFormError("Description is required");
      return;
    }
    if (!formAmount || isNaN(parseFloat(formAmount))) {
      setFormError("Valid amount is required");
      return;
    }
    setSaving(true);
    setFormError("");

    const totalAmount = parseFloat(formAmount);
    const payload = {
      description: formDescription,
      totalAmount: formDistType === "income" ? -Math.abs(totalAmount) : totalAmount,
      distributionType: formDistType,
      targetBlock: formDistType === "block_specific" ? parseInt(formTargetBlock) : null,
      customAmounts: formDistType === "custom" ? {
        block1: parseFloat(formCustom.block1 || "0"),
        block2: parseFloat(formCustom.block2 || "0"),
        block3: parseFloat(formCustom.block3 || "0"),
        block4: parseFloat(formCustom.block4 || "0"),
      } : undefined,
    };

    try {
      const url = editingItem
        ? `/api/admin/expenses/${selectedMonthId}/items/${editingItem.id}`
        : `/api/admin/expenses/${selectedMonthId}/items`;
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || "Failed to save");
        return;
      }

      resetForm();
      setShowForm(false);
      fetchItems(selectedMonthId!);
    } catch {
      setFormError("Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm("Delete this expense item?")) return;
    setDeletingId(itemId);
    try {
      const res = await fetch(`/api/admin/expenses/${selectedMonthId}/items/${itemId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
      }
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  };

  // Calculate live preview
  const previewAmount = parseFloat(formAmount || "0");
  const effectiveAmount = formDistType === "income" ? -Math.abs(previewAmount) : previewAmount;
  const preview = calculateBlockAmounts(
    effectiveAmount,
    formDistType,
    parseInt(formTargetBlock),
    {
      block1: parseFloat(formCustom.block1 || "0"),
      block2: parseFloat(formCustom.block2 || "0"),
      block3: parseFloat(formCustom.block3 || "0"),
      block4: parseFloat(formCustom.block4 || "0"),
    }
  );

  // Summary calculations
  const summary = {
    block1: items.reduce((s, i) => s + i.block1Amount, 0),
    block2: items.reduce((s, i) => s + i.block2Amount, 0),
    block3: items.reduce((s, i) => s + i.block3Amount, 0),
    block4: items.reduce((s, i) => s + i.block4Amount, 0),
    total: items.reduce((s, i) => s + i.totalAmount, 0),
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!isAdmin() && !isSuperAdmin()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-500">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-primary-600 hover:text-primary-700 font-medium mb-4 inline-block"
      >
        &larr; Back to Admin
      </Link>

      <h1 className="text-2xl font-bold text-primary-800 mb-1">Expense Calculator</h1>
      <p className="text-sm text-gray-500 mb-6">
        Track monthly common expenses and calculate per-block contributions
      </p>

      {/* Block Info Banner */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BLOCK_PERCENTAGES.map((b) => (
            <div key={b.block} className="text-center">
              <p className="text-xs font-semibold text-gray-600">{b.label}</p>
              <p className="text-sm text-gray-800">{b.sqft.toLocaleString("en-IN")} sq ft</p>
              <p className="text-xs text-primary-600 font-medium">{b.percentage.toFixed(2)}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative">
          <select
            value={selectedMonthId || ""}
            onChange={(e) => setSelectedMonthId(e.target.value || null)}
            className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">Select a month...</option>
            {months.map((m) => (
              <option key={m.id} value={m.id}>
                {MONTH_NAMES[m.month - 1]} {m.year} ({m._count.items} items)
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <button
          onClick={() => setShowNewMonth(!showNewMonth)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={16} />
          New Month
        </button>

        {selectedMonthId && (
          <button
            onClick={handleDeleteMonth}
            className="text-xs text-red-500 hover:text-red-700 transition-colors font-medium"
          >
            Delete Month
          </button>
        )}
      </div>

      {/* New Month Form */}
      {showNewMonth && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 max-w-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Create New Month</h3>
          <div className="flex gap-2 mb-3">
            <select
              value={newMonth}
              onChange={(e) => setNewMonth(parseInt(e.target.value))}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i} value={i + 1}>{name}</option>
              ))}
            </select>
            <input
              type="number"
              value={newYear}
              onChange={(e) => setNewYear(parseInt(e.target.value))}
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateMonth}
              disabled={creatingMonth}
              className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {creatingMonth ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => setShowNewMonth(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading...</p>
      ) : !selectedMonthId ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Select a month or create a new one to get started.</p>
        </div>
      ) : (
        <>
          {/* Action bar */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {(() => {
                const m = months.find((m) => m.id === selectedMonthId);
                return m ? `${MONTH_NAMES[m.month - 1]} ${m.year}` : "";
              })()}
            </h2>
            {!showForm && (
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus size={16} />
                Add Expense
              </button>
            )}
          </div>

          {/* Add/Edit Form */}
          {showForm && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-800">
                  {editingItem ? "Edit Expense" : "Add Expense"}
                </h3>
                <button
                  onClick={() => { resetForm(); setShowForm(false); }}
                  className="p-1 rounded hover:bg-gray-100 transition-colors"
                >
                  <X size={16} className="text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="e.g., Security Services"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {formDistType === "income" ? "Deduction Amount (₹)" : "Total Amount (₹)"}
                    </label>
                    <input
                      type="number"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      placeholder="0"
                      min="0"
                      step="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Distribution Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Distribution Type</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.entries(DISTRIBUTION_LABELS) as [DistributionType, string][]).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormDistType(key)}
                        className={clsx(
                          "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                          formDistType === key
                            ? "border-primary-500 bg-primary-50 text-primary-700"
                            : "border-gray-300 text-gray-600 hover:bg-gray-50"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Block-specific selector */}
                {formDistType === "block_specific" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Block</label>
                    <select
                      value={formTargetBlock}
                      onChange={(e) => setFormTargetBlock(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      {[1, 2, 3, 4].map((b) => (
                        <option key={b} value={b}>Block {b}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Custom split inputs */}
                {formDistType === "custom" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Per-Block Amounts (₹)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(["block1", "block2", "block3", "block4"] as const).map((key, i) => (
                        <div key={key}>
                          <label className="block text-xs text-gray-500 mb-1">Block {i + 1}</label>
                          <input
                            type="number"
                            value={formCustom[key]}
                            onChange={(e) => setFormCustom((prev) => ({ ...prev, [key]: e.target.value }))}
                            placeholder="0"
                            min="0"
                            step="1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live Preview */}
                {previewAmount > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">Preview — Per Block Split</p>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[preview.block1Amount, preview.block2Amount, preview.block3Amount, preview.block4Amount].map((amt, i) => (
                        <div key={i}>
                          <p className="text-xs text-gray-500">Block {i + 1}</p>
                          <p className={clsx("text-sm font-semibold", amt < 0 ? "text-green-700" : "text-gray-800")}>
                            {formatCurrency(Math.abs(amt))}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {formError && (
                  <p className="text-sm text-red-600">{formError}</p>
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Saving..." : editingItem ? "Update" : "Add Expense"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { resetForm(); setShowForm(false); }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Expense Items Table */}
          {loadingItems ? (
            <p className="text-gray-500 text-center py-8">Loading expenses...</p>
          ) : items.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-500">No expenses added yet.</p>
              <p className="text-sm text-gray-400 mt-1">Click &quot;Add Expense&quot; to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600">
                    <th className="pb-3 pr-3 font-medium w-8">#</th>
                    <th className="pb-3 pr-3 font-medium">Description</th>
                    <th className="pb-3 pr-3 font-medium">Type</th>
                    <th className="pb-3 pr-3 font-medium text-right">Total</th>
                    <th className="pb-3 pr-3 font-medium text-right">Block 1</th>
                    <th className="pb-3 pr-3 font-medium text-right">Block 2</th>
                    <th className="pb-3 pr-3 font-medium text-right">Block 3</th>
                    <th className="pb-3 pr-3 font-medium text-right">Block 4</th>
                    <th className="pb-3 font-medium w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const isIncome = item.distributionType === "income";
                    return (
                      <tr
                        key={item.id}
                        className={clsx(
                          "border-b border-gray-100 hover:bg-gray-50",
                          isIncome && "bg-green-50/50"
                        )}
                      >
                        <td className="py-3 pr-3 text-gray-400">{index + 1}</td>
                        <td className={clsx("py-3 pr-3 font-medium", isIncome ? "text-green-800 italic" : "text-gray-900")}>
                          {item.description}
                        </td>
                        <td className="py-3 pr-3">
                          <span className={clsx(
                            "inline-block px-2 py-0.5 text-[10px] font-medium rounded-full",
                            DIST_BADGE_COLORS[item.distributionType] || "bg-gray-100 text-gray-700"
                          )}>
                            {item.distributionType === "block_specific"
                              ? `B${item.targetBlock} Only`
                              : DISTRIBUTION_LABELS[item.distributionType as DistributionType] || item.distributionType}
                          </span>
                        </td>
                        <td className={clsx("py-3 pr-3 text-right font-medium", isIncome ? "text-green-700" : "text-gray-800")}>
                          {isIncome ? "−" : ""}{formatCurrency(Math.abs(item.totalAmount))}
                        </td>
                        <td className={clsx("py-3 pr-3 text-right", isIncome ? "text-green-700" : "text-gray-600")}>
                          {item.block1Amount !== 0 ? (isIncome ? "−" : "") + formatCurrency(Math.abs(item.block1Amount)) : "—"}
                        </td>
                        <td className={clsx("py-3 pr-3 text-right", isIncome ? "text-green-700" : "text-gray-600")}>
                          {item.block2Amount !== 0 ? (isIncome ? "−" : "") + formatCurrency(Math.abs(item.block2Amount)) : "—"}
                        </td>
                        <td className={clsx("py-3 pr-3 text-right", isIncome ? "text-green-700" : "text-gray-600")}>
                          {item.block3Amount !== 0 ? (isIncome ? "−" : "") + formatCurrency(Math.abs(item.block3Amount)) : "—"}
                        </td>
                        <td className={clsx("py-3 pr-3 text-right", isIncome ? "text-green-700" : "text-gray-600")}>
                          {item.block4Amount !== 0 ? (isIncome ? "−" : "") + formatCurrency(Math.abs(item.block4Amount)) : "—"}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEdit(item)}
                              className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-primary-600"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              disabled={deletingId === item.id}
                              className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-red-600 disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="border-t-2 border-gray-300 font-semibold">
                    <td className="py-3 pr-3"></td>
                    <td className="py-3 pr-3 text-gray-900">Total</td>
                    <td className="py-3 pr-3"></td>
                    <td className="py-3 pr-3 text-right text-gray-900">{formatCurrency(summary.total)}</td>
                    <td className="py-3 pr-3 text-right text-gray-900">{formatCurrency(summary.block1)}</td>
                    <td className="py-3 pr-3 text-right text-gray-900">{formatCurrency(summary.block2)}</td>
                    <td className="py-3 pr-3 text-right text-gray-900">{formatCurrency(summary.block3)}</td>
                    <td className="py-3 pr-3 text-right text-gray-900">{formatCurrency(summary.block4)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Summary Cards */}
          {items.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Per-Block Summary</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Block 1", amount: summary.block1 },
                  { label: "Block 2", amount: summary.block2 },
                  { label: "Block 3", amount: summary.block3 },
                  { label: "Block 4", amount: summary.block4 },
                ].map((block) => (
                  <div key={block.label} className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                    <p className="text-xs font-medium text-gray-500 mb-1">{block.label}</p>
                    <p className="text-xl font-bold text-primary-700">{formatCurrency(block.amount)}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {BLOCK_PERCENTAGES.find((b) => b.label === block.label)?.percentage.toFixed(2)}% contribution
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 bg-primary-50 rounded-lg border border-primary-200 p-4 text-center">
                <p className="text-xs font-medium text-primary-600 mb-1">Grand Total</p>
                <p className="text-2xl font-bold text-primary-800">{formatCurrency(summary.total)}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
