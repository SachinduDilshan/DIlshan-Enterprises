import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "info" | "success" | "warning" | "danger" | "purple";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  default: "bg-gray-100 text-gray-600",
  info:    "bg-blue-50 text-blue-800",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger:  "bg-danger-50 text-danger-700",
  purple:  "bg-brand-50 text-brand-700",
};

interface BadgeProps {
  variant?:   BadgeVariant;
  children:   React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium",
      VARIANT_STYLES[variant],
      className
    )}>
      {children}
    </span>
  );
}