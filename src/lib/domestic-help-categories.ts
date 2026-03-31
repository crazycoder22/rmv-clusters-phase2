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

export type DomesticHelpCategory =
  (typeof DOMESTIC_HELP_CATEGORIES)[number]["value"];

export function getCategoryLabel(value: string): string {
  return (
    DOMESTIC_HELP_CATEGORIES.find((c) => c.value === value)?.label ?? value
  );
}

export function getCategoryBadgeColor(value: string): string {
  const colors: Record<string, string> = {
    MAID: "bg-pink-100 text-pink-700",
    COOK: "bg-orange-100 text-orange-700",
    DRIVER: "bg-blue-100 text-blue-700",
    PLUMBER: "bg-cyan-100 text-cyan-700",
    ELECTRICIAN: "bg-yellow-100 text-yellow-700",
    CARPENTER: "bg-amber-100 text-amber-700",
    GARDENER: "bg-green-100 text-green-700",
    PAINTER: "bg-purple-100 text-purple-700",
    CLEANER: "bg-teal-100 text-teal-700",
    OTHER: "bg-gray-100 text-gray-700",
  };
  return colors[value] ?? "bg-gray-100 text-gray-700";
}
