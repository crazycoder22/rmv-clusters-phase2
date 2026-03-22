import type { Metadata } from "next";
import SOSGuidelinesContent from "@/components/sos/SOSGuidelinesContent";

export const metadata: Metadata = {
  title: "SOS Guidelines – RMV Clusters",
  description:
    "Emergency response WhatsApp group guidelines for RMV Clusters Phase II residents.",
};

export default function SOSGuidelinesPage() {
  return <SOSGuidelinesContent />;
}
