import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "color" | "white";
  size?: number;
  showName?: boolean;
  className?: string;
}

export function LogoMark({
  variant = "color",
  size = 40,
  className,
}: Pick<LogoProps, "variant" | "size" | "className">) {
  const fill = variant === "white" ? "#FFFFFF" : "#15136B";
  const accent = "#F28B4A";
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="100" cy="100" r="92" fill="none" stroke={fill} strokeWidth="14"
        strokeDasharray="17.23 5" strokeDashoffset="8.6" transform="rotate(-90 100 100)"
      />
      <circle cx="100" cy="100" r="78" fill="none" stroke={fill} strokeWidth="8" />
      <g transform="translate(100 100) scale(1.15) translate(-100 -100)">
        <path
          fillRule="evenodd"
          d="M63 58 H95 A42 42 0 0 1 95 142 H63 Z M85 78 H95 A22 22 0 0 1 95 122 H85 Z"
          fill={fill}
        />
        <circle cx="98.5" cy="100" r="8.5" fill={accent} />
      </g>
    </svg>
  );
}

export function Logo({ variant = "color", size = 40, showName = true, className }: LogoProps) {
  const light = variant === "white";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark variant={variant} size={size} />
      {showName && (
        <div className="min-w-0 leading-none">
          <p
            className={cn("font-bold tracking-tight", light ? "text-white" : "text-[#15136B]")}
            style={{ fontSize: Math.round(size * 0.48) }}
          >
            DILSHAN
          </p>
          <p
            className={cn(
              "mt-1 font-medium uppercase tracking-[0.28em]",
              light ? "text-white/85" : "text-[#15136B]/85"
            )}
            style={{ fontSize: Math.max(8, Math.round(size * 0.19)) }}
          >
            Enterprises
          </p>
        </div>
      )}
    </div>
  );
}