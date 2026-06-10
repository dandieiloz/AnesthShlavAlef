import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-xs",
  lg: "h-11 w-11 text-sm",
} as const;

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  image,
  size = "md",
  className,
}: {
  name: string | null | undefined;
  image?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const base = cn(
    "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-border",
    SIZES[size],
    className
  );

  if (image) {
    return (
      <span className={base}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        base,
        "bg-gradient-to-br from-primary/20 to-accent/20 font-semibold text-primary"
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
