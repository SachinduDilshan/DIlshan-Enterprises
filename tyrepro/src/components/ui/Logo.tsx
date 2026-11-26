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
      <circle cx="100" cy="100" r="92" fill="none" stroke={fill} strokeWidth="14"
        strokeDasharray="17.23 5" strokeDashoffset="8.6" transform="rotate(-90 100 100)" />
      <circle cx="100" cy="100" r="78" fill="none" stroke={fill} strokeWidth="8" />
      <rect x="52" y="140" width="96" height="9" rx="1.8" fill={fill} />
      <path d="M56 140 A44 40 0 0 1 144 140 Z" fill={fill} />
      <rect x="91" y="87" width="18" height="13" fill={fill} />
      <path d="M93 87 L107 87 L101.7 58 L98.3 58 Z" fill={fill} />
      <rect x="89" y="78.6" width="22" height="2.8" rx="1.4" fill={fill} />
      <rect x="91.2" y="70.6" width="17.6" height="2.8" rx="1.4" fill={fill} />
      <rect x="93.2" y="62.6" width="13.6" height="2.8" rx="1.4" fill={fill} />
      <rect x="98.8" y="51" width="2.4" height="9" fill={fill} />
      <circle cx="100" cy="48" r="5.2" fill={accent} />
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