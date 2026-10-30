import { cn, formatLKR } from "@/lib/utils";

interface PaymentMixProps {
  cash: number;
  card: number;
  cheque: number;
  pending: number;
}

const SEGMENTS = [
  { key: "cash",    label: "Cash",    bar: "bg-emerald-600" },
  { key: "card",    label: "Card",    bar: "bg-sky-500"     },
  { key: "cheque",  label: "Cheque",  bar: "bg-amber-500"   },
  { key: "pending", label: "Pending", bar: "bg-gray-400"    },
] as const;

export function PaymentMix(props: PaymentMixProps) {
  const total = props.cash + props.card + props.cheque + props.pending;

  const summary = SEGMENTS.map(s => {
    const pct = total > 0 ? Math.round((props[s.key] / total) * 100) : 0;
    return `${s.label} ${pct}%`;
  }).join(", ");

  return (
    <div>
      <div
        role="img"
        aria-label={`Payment mix: ${summary}`}
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100"
      >
        {total > 0 &&
          SEGMENTS.map(s => {
            const value = props[s.key];
            if (value <= 0) return null;
            return (
              <div
                key={s.key}
                className={s.bar}
                style={{ width: `${(value / total) * 100}%` }}
              />
            );
          })}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {SEGMENTS.map(s => {
          const value = props[s.key];
          const pct = total > 0 ? Math.round((value / total) * 100) : 0;
          return (
            <div key={s.key} className="min-w-0">
              <dt className="flex items-center gap-2 text-xs text-gray-500">
                <span className={cn("h-2 w-2 rounded-sm", s.bar)} aria-hidden="true" />
                {s.label}
              </dt>
              <dd className="mt-1 truncate text-sm font-semibold tabular-nums text-gray-900">
                {formatLKR(value)}
              </dd>
              <dd className="text-xs tabular-nums text-gray-500">{pct}%</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}