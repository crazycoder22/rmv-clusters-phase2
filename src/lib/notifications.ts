export function getNotificationUrl(
  announcementId: string | null,
  visitorId: string | null,
  issueId?: string | null
): string {
  if (issueId) {
    return "/issues";
  }
  if (visitorId) {
    return `/visitors/${visitorId}`;
  }
  if (announcementId) {
    return `/news/${announcementId}`;
  }
  return "/";
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    urgent: "bg-red-100 text-red-700",
    maintenance: "bg-yellow-100 text-yellow-700",
    event: "bg-blue-100 text-blue-700",
    sports: "bg-orange-100 text-orange-700",
    general: "bg-gray-100 text-gray-700",
    visitor: "bg-purple-100 text-purple-700",
    issue: "bg-orange-100 text-orange-700",
  };
  return colors[category] || "bg-gray-100 text-gray-700";
}
