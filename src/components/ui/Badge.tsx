import clsx from "clsx";

interface BadgeProps {
  children: React.ReactNode;
  variant?: string;
}

export default function Badge({ children, variant = "general" }: BadgeProps) {
  const colors: Record<string, string> = {
    maintenance: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
    event: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
    general: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    urgent: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
    sports: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
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
