import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-[2px] border border-[var(--line-2)] bg-[var(--bg-3)] px-4 py-2 text-sm text-[var(--fg-1)] placeholder:text-[var(--fg-4)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
