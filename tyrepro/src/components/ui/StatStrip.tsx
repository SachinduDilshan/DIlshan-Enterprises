import { cn } from "@/lib/utils";

export interface StatItem {
  label: string;
  value: string;
  hint?: React.ReactNode;
}

function Value({ value }: { value: string }) {
  const match = /^LKR\s+(.+)$/.exec(value);
  if (!match) return <>{value}</>;
  return (
    <>
      <span className="mr-1 text-xs font-medium text-gray-500">LKR</span>
      {match[1]}
    </>
  );
}

interface StatStripProps {
  items: StatItem[];
  loading?: boolean;
  className?: string;
}

export function StatStrip({ items, loading = false, className }: StatStripProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 lg:grid-cols-4",
        className
      )}
    >
      {items.map(item => (
        <div key={item.label} className="min-w-0 bg-white px-4 py-4 sm:px-5">
          <p className="truncate text-xs font-medium text-gray-500">{item.label}</p>
          {loading ? (
            <div className="mt-2 h-7 w-24 animate-pulse rounded bg-gray-100" />
          ) : (
            <p className="mt-1.5 truncate text-xl font-semibold tabular-nums tracking-tight text-gray-900 sm:text-2xl">
              <Value value={item.value} />
            </p>
          )}
          {item.hint && !loading && (
            <div className="mt-1 truncate text-xs text-gray-500">{item.hint}</div>
          )}
        </div>
      ))}
    </div>
  );
}