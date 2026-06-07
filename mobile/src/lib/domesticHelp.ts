// Mobile copy of domestic-help categories (mirrors src/lib/domestic-help-categories.ts).

export const DOMESTIC_HELP_CATEGORIES = [
  { value: "MAID", label: "Maid" },
  { value: "COOK", label: "Cook" },
  { value: "DRIVER", label: "Driver" },
  { value: "PLUMBER", label: "Plumber" },
  { value: "ELECTRICIAN", label: "Electrician" },
  { value: "CARPENTER", label: "Carpenter" },
  { value: "GARDENER", label: "Gardener" },
  { value: "PAINTER", label: "Painter" },
  { value: "CLEANER", label: "Deep Cleaner" },
  { value: "OTHER", label: "Other" },
] as const;

export function getCategoryLabel(value: string): string {
  return DOMESTIC_HELP_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

// Dark-theme badge colors.
export const CATEGORY_BADGE: Record<string, string> = {
  MAID: "bg-pink-500/20 text-pink-300",
  COOK: "bg-orange-500/20 text-orange-300",
  DRIVER: "bg-blue-500/20 text-blue-300",
  PLUMBER: "bg-cyan-500/20 text-cyan-300",
  ELECTRICIAN: "bg-yellow-500/20 text-yellow-300",
  CARPENTER: "bg-amber-500/20 text-amber-300",
  GARDENER: "bg-green-500/20 text-green-300",
  PAINTER: "bg-purple-500/20 text-purple-300",
  CLEANER: "bg-teal-500/20 text-teal-300",
  OTHER: "bg-slate-600/40 text-slate-300",
};
