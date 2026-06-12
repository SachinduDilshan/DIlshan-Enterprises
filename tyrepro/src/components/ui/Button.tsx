import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "danger";
type ButtonSize    = "sm" | "md" | "lg";

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:   "bg-brand-600 text-white hover:bg-brand-700",
  secondary: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50",
  danger:    "bg-danger-500 text-white hover:bg-red-600",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?:    ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        className
      )}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}