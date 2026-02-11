import clsx from "clsx";

interface BadgeProps {
  children: React.ReactNode;
  variant?: string;
}

export default function Badge({ children, variant = "general" }: BadgeProps) {
  const colors: Record<string, string> = {
    maintenance: "bg-blue-100 text-blue-800",
    event: "bg-green-100 text-green-800",
    general: "bg-gray-100 text-gray-800",
    urgent: "bg-red-100 text-red-800",
  };

  return (
    <span
      className={clsx(
        "inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize",
        colors[variant] || colors.general
      )}
    >
      {children}
    </span>
  );
}
