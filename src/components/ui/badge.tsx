import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Mono, uppercase, wide-tracked, near-square tags with muted-semantic tints —
// the "engineered" label language. No neon.
const badgeVariants = cva(
  "inline-flex items-center rounded-[2px] px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[var(--accent-tint)] text-[var(--accent)] border border-[var(--accent-line)]",
        secondary: "bg-[var(--bg-3)] text-[var(--fg-2)] border border-[var(--line-2)]",
        outline: "border border-[var(--line-3)] text-[var(--fg-2)]",
        destructive: "bg-[rgba(192,106,92,0.14)] text-[var(--danger)] border border-[var(--danger)]",
        success: "bg-[rgba(111,169,135,0.14)] text-[var(--success)] border border-[var(--success)]",
        warning: "bg-[rgba(210,164,92,0.14)] text-[var(--warning)] border border-[var(--warning)]",
        info: "bg-[rgba(126,150,184,0.14)] text-[var(--info)] border border-[var(--info)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
