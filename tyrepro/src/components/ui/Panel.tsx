import { cn } from "@/lib/utils";

interface PanelProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Panel({ title, description, action, flush = false, className, children }: PanelProps) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-gray-200 bg-white", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="truncate text-sm font-semibold text-gray-900">{title}</h2>}
            {description && <p className="mt-0.5 truncate text-xs text-gray-500">{description}</p>}
          </div>
          {action && <div className="flex-shrink-0 text-sm">{action}</div>}
        </header>
      )}
      <div className={cn(!flush && "p-4")}>{children}</div>
    </section>
  );
}