import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export function EditButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      title="Edit"
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-colors",
        className
      )}
    >
      <Pencil className="h-3.5 w-3.5 text-gray-400 hover:text-brand-600" />
    </button>
  );
}