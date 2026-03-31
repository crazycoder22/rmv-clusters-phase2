export function getNotificationUrl(
  announcementId: string | null,
  visitorId: string | null,
  issueId?: string | null,
  taskId?: string | null,
  postId?: string | null,
  reviewDocId?: string | null,
  pollId?: string | null,
  surveyId?: string | null,
  marketplaceListingId?: string | null
): string {
  if (marketplaceListingId) {
    return `/marketplace/${marketplaceListingId}`;
  }
  if (surveyId) {
    return `/surveys/${surveyId}`;
  }
  if (pollId) {
    return `/polls/${pollId}`;
  }
  if (reviewDocId) {
    return `/review-docs/${reviewDocId}`;
  }
  if (postId) {
    return "/community";
  }
  if (taskId) {
    return "/tasks";
  }
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
    task: "bg-teal-100 text-teal-700",
    community: "bg-emerald-100 text-emerald-700",
    review: "bg-indigo-100 text-indigo-700",
    poll: "bg-violet-100 text-violet-700",
    marketplace: "bg-emerald-100 text-emerald-700",
  };
  return colors[category] || "bg-gray-100 text-gray-700";
}
