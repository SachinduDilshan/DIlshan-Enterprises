import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "info" | "success" | "warning" | "danger" | "purple";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  default: "bg-gray-100 text-gray-700 ring-gray-200",
  info:    "bg-blue-50 text-blue-800 ring-blue-200",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warning: "bg-amber-50 text-amber-900 ring-amber-200",
  danger:  "bg-red-50 text-red-800 ring-red-200",
  purple:  "bg-brand-50 text-brand-700 ring-brand-200",
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium leading-4 ring-1 ring-inset",
        VARIANT_STYLES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}