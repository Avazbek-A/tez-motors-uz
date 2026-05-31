import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[100px] w-full rounded-[2px] border border-[var(--line-2)] bg-[var(--bg-3)] px-4 py-3 text-sm text-[var(--fg-1)] placeholder:text-[var(--fg-4)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
