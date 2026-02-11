export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    maintenance: "bg-blue-100 text-blue-800",
    event: "bg-green-100 text-green-800",
    general: "bg-gray-100 text-gray-800",
    urgent: "bg-red-100 text-red-800",
  };
  return colors[category] || colors.general;
}

export function getPriorityBorder(priority: string): string {
  const borders: Record<string, string> = {
    high: "border-l-4 border-l-red-500",
    normal: "border-l-4 border-l-blue-500",
    low: "border-l-4 border-l-gray-300",
  };
  return borders[priority] || borders.normal;
}
