export function getNotificationUrl(
  category: string,
  announcementId: string
): string {
  switch (category) {
    case "event":
      return `/events/${announcementId}/rsvp`;
    case "sports":
      return `/events/${announcementId}/sports`;
    default:
      return `/news/${announcementId}`;
  }
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    urgent: "bg-red-100 text-red-700",
    maintenance: "bg-yellow-100 text-yellow-700",
    event: "bg-blue-100 text-blue-700",
    sports: "bg-orange-100 text-orange-700",
    general: "bg-gray-100 text-gray-700",
  };
  return colors[category] || "bg-gray-100 text-gray-700";
}
