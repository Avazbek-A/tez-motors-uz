"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// "Cinematic Showroom" buttons: sharp corners, uppercase mono-tracked labels,
// platinum-accent fills, hairline outlines, soft ambient lift (no neon glow).
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-none font-semibold uppercase tracking-[0.12em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-1)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[var(--accent-bright)] hover:-translate-y-px hover:shadow-[0_14px_40px_rgba(150,165,188,0.20)]",
        secondary:
          "bg-[var(--bg-3)] text-[var(--fg-1)] border border-[var(--line-2)] hover:border-[var(--line-3)]",
        outline:
          "border border-[var(--line-3)] text-[var(--fg-1)] bg-transparent hover:border-[var(--fg-1)]",
        outlineLight:
          "border border-white/25 text-white bg-transparent hover:bg-white/5 hover:border-white/60",
        ghost: "text-[var(--fg-2)] bg-transparent hover:text-[var(--accent)]",
        link: "text-[var(--accent)] normal-case tracking-normal underline-offset-4 hover:underline",
        destructive: "bg-[var(--danger)] text-white hover:opacity-90",
        cyber:
          "bg-transparent border border-[var(--accent-line)] text-[var(--accent)] font-mono hover:bg-[var(--accent-tint)] hover:border-[var(--accent)]",
      },
      size: {
        default: "h-11 px-6 py-2 text-[13px]",
        sm: "h-9 px-4 text-[11px]",
        lg: "h-13 px-8 text-[13px]",
        xl: "h-14 px-10 text-sm",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
