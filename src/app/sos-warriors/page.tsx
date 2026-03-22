import type { Metadata } from "next";
import SOSWarriorsContent from "@/components/sos/SOSWarriorsContent";

export const metadata: Metadata = {
  title: "SOS Warriors – RMV Clusters",
  description:
    "Emergency response warriors and their contact details for RMV Clusters Phase II.",
};

export default function SOSWarriorsPage() {
  return <SOSWarriorsContent />;
}
