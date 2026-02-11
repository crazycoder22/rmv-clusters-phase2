interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  centered?: boolean;
}

export default function SectionHeading({
  title,
  subtitle,
  centered = true,
}: SectionHeadingProps) {
  return (
    <div className={centered ? "text-center" : ""}>
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h2>
      {subtitle && (
        <p className="mt-2 text-gray-600 max-w-2xl mx-auto">{subtitle}</p>
      )}
      <div
        className={`mt-4 h-1 w-16 bg-primary-500 rounded ${centered ? "mx-auto" : ""}`}
      />
    </div>
  );
}
