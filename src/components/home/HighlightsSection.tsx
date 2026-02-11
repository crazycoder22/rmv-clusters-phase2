import {
  Shield,
  Car,
  TreePine,
  Zap,
  Building,
  Baby,
} from "lucide-react";
import SectionHeading from "@/components/ui/SectionHeading";

const amenities = [
  {
    icon: Shield,
    title: "24/7 Security",
    description:
      "Round-the-clock security with CCTV surveillance and trained security personnel at the gate.",
  },
  {
    icon: Car,
    title: "Covered Parking",
    description:
      "Designated covered parking spaces for residents with additional visitor parking area.",
  },
  {
    icon: TreePine,
    title: "Green Spaces",
    description:
      "Beautifully landscaped gardens and green areas for residents to relax and unwind.",
  },
  {
    icon: Zap,
    title: "Power Backup",
    description:
      "Generator backup for common areas, lifts, and water pumps ensuring uninterrupted service.",
  },
  {
    icon: Building,
    title: "Community Hall",
    description:
      "Spacious community hall available for events, meetings, and celebrations.",
  },
  {
    icon: Baby,
    title: "Children's Play Area",
    description:
      "Safe and well-equipped play area for children with modern play equipment.",
  },
];

export default function HighlightsSection() {
  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Community Amenities"
          subtitle="Everything you need for comfortable living, right at your doorstep"
        />
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {amenities.map((amenity, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center mb-4">
                <amenity.icon size={24} className="text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {amenity.title}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {amenity.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
