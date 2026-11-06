import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

const textareaVariants = cva("w-full outline-none disabled:cursor-not-allowed", {
  variants: {
    tone: {
      plain:
        "max-h-32 min-h-11 resize-none bg-transparent px-3 py-2.5 text-sm leading-6 disabled:text-muted",
      field: "rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-muted",
    },
  },
  defaultVariants: {
    tone: "plain",
  },
});

type TextareaProps = ComponentProps<"textarea"> & VariantProps<typeof textareaVariants>;

function Textarea({ className, tone, ...props }: TextareaProps) {
  return <textarea className={cn(textareaVariants({ tone }), className)} {...props} />;
}

export { Textarea, textareaVariants };
