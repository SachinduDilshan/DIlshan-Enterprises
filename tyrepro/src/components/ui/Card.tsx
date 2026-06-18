import { cn } from "@/lib/utils";

interface CardProps {
  children:   React.ReactNode;
  className?: string;
  padding?:   boolean;
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div className={cn(
      "rounded-2xl border border-gray-100 bg-white w-full min-w-0 max-w-full",
      padding && "p-4",
      className
    )}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title:     string;
  subtitle?: string;
  action?:   React.ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-3 gap-2 min-w-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}