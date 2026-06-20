import { cn } from "@/lib/utils";

interface TabOption {
  key:   string;
  label: string;
}

interface TabsProps {
  options:    TabOption[];
  active:     string;
  onChange:   (key: string) => void;
  className?: string;
}

export function Tabs({ options, active, onChange, className }: TabsProps) {
  return (
    <div className={cn("flex gap-1.5 rounded-xl bg-gray-50 p-1", className)}>
      {options.map(opt => (
        <button key={opt.key} onClick={() => onChange(opt.key)}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-medium transition-colors border",
            active === opt.key
              ? "bg-white text-gray-900 border-brand-500"
              : "bg-transparent text-gray-500 border-transparent hover:text-gray-700"
          )}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}