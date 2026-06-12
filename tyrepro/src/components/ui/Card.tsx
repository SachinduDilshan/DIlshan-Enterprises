import { cn } from "@/lib/utils";

interface CardProps {
  children:  React.ReactNode;
  className?: string;
  padding?:  boolean;
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div className={cn(
      "rounded-2xl border border-gray-100 bg-white",
      padding && "p-4",
      className
    )}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title:    string;
  subtitle?: string;
  action?:  React.ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}