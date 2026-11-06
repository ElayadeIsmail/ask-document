import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("block text-sm", className)} {...props} />;
}

function FieldCaption({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("text-[11px] uppercase tracking-[0.14em] text-muted", className)}
      {...props}
    />
  );
}

export { FieldCaption, Label };
