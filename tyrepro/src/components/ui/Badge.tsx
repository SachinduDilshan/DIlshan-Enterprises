import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "purple";

const variants: Record<BadgeVariant, string> = {
  default:  "bg-gray-100 text-gray-700",
  success:  "bg-green-100 text-green-800",
  warning:  "bg-amber-100 text-amber-800",
  danger:   "bg-red-100 text-red-700",
  info:     "bg-blue-100 text-blue-800",
  purple:   "bg-brand-50 text-brand-800",
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
