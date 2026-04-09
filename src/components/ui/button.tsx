"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f] disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-neon-blue to-neon-cyan text-[#0a0a0f] font-bold hover:shadow-[0_0_20px_rgba(0,212,255,0.4)] hover:-translate-y-0.5",
        secondary: "bg-gradient-to-r from-neon-purple to-[#a78bfa] text-white hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:-translate-y-0.5",
        outline: "border border-neon-blue/50 text-neon-blue bg-transparent hover:bg-neon-blue/10 hover:shadow-[0_0_15px_rgba(0,212,255,0.2)]",
        outlineLight: "border border-white/20 text-white hover:bg-white/5 hover:border-neon-blue/50",
        ghost: "text-white/70 hover:bg-white/5 hover:text-white",
        link: "text-neon-blue underline-offset-4 hover:underline",
        destructive: "bg-gradient-to-r from-destructive to-neon-pink text-white hover:shadow-[0_0_20px_rgba(255,45,135,0.4)]",
        cyber: "bg-[#0a0a0f] border border-neon-green/50 text-neon-green font-mono uppercase tracking-wider hover:bg-neon-green/10 hover:shadow-[0_0_20px_rgba(34,255,136,0.3)] hover:border-neon-green",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-14 px-8 text-base",
        xl: "h-16 px-10 text-lg",
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
