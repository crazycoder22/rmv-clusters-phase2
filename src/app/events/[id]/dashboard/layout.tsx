import type { Metadata } from "next";

// Server layout purely to attach step-up-themed share metadata to the (client)
// dashboard page. The sibling opengraph-image.tsx supplies the preview image.
export const metadata: Metadata = {
  title: "Step-Up Challenge",
  description: "Live community step challenge — total steps, goal progress, and the leaderboard.",
  openGraph: {
    title: "Step-Up Challenge · RMV Clusters Phase 2",
    description: "Live community step challenge — total steps, goal progress, and the leaderboard.",
  },
};

export default function StepDashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
