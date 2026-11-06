import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

const badgeVariants = cva("inline-flex items-center rounded-full px-2 py-0.5 font-medium capitalize", {
  variants: {
    tone: {
      neutral: "bg-paper-2 text-muted",
      moss: "bg-moss/10 text-moss",
      amber: "bg-amber/10 text-amber",
      clay: "bg-clay/10 text-clay",
      line: "bg-line text-muted",
    },
    size: {
      sm: "text-[10px]",
      md: "text-[11px]",
    },
  },
  defaultVariants: {
    tone: "neutral",
    size: "md",
  },
});

type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
