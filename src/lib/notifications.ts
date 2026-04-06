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
    urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    maintenance: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    event: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    sports: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    general: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    visitor: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    issue: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    task: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
    community: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    review: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    poll: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    marketplace: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  };
  return colors[category] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
}
