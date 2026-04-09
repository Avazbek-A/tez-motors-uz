import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-neon-blue/15 text-neon-blue border border-neon-blue/20",
        secondary: "bg-neon-purple/15 text-neon-purple border border-neon-purple/20",
        outline: "border border-white/20 text-white/70",
        destructive: "bg-neon-pink/15 text-neon-pink border border-neon-pink/20",
        success: "bg-neon-green/15 text-neon-green border border-neon-green/20",
        warning: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20",
        info: "bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/20",
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
