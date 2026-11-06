import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

const inputVariants = cva("w-full border text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60", {
  variants: {
    tone: {
      default: "rounded-xl border-line bg-paper px-3 py-2.5 text-ink placeholder:text-muted",
      dark: "rounded-md border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/30",
    },
  },
  defaultVariants: {
    tone: "default",
  },
});

type InputProps = ComponentProps<"input"> & VariantProps<typeof inputVariants>;

function Input({ className, tone, ...props }: InputProps) {
  return <input className={cn(inputVariants({ tone }), className)} {...props} />;
}

export { Input, inputVariants };
