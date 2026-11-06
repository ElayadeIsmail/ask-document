import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 transition disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "rounded-xl bg-ink text-paper hover:bg-ink/90 disabled:cursor-wait disabled:opacity-60",
        clay: "rounded-md bg-clay text-white disabled:opacity-40",
        outline: "rounded-xl border border-line bg-paper text-ink hover:border-moss/40",
        ghost: "rounded-lg text-ink hover:bg-paper-2 disabled:cursor-wait",
        "ghost-dark":
          "rounded-lg text-[#f6f1e8] hover:bg-white/5 data-[active=true]:bg-white/10",
        dropzone:
          "justify-start rounded-xl border border-dashed border-line bg-paper text-left hover:border-moss/40 disabled:cursor-wait data-[dragging=true]:border-moss data-[dragging=true]:bg-moss/5",
        link: "bg-transparent text-moss hover:underline",
        "link-dark": "bg-transparent text-moss-2 hover:underline",
        "link-muted": "bg-transparent text-white/50 hover:underline",
        "link-quiet": "bg-transparent font-medium text-muted hover:text-ink",
        "link-danger": "bg-transparent font-medium text-clay hover:text-ink",
        "icon-ghost": "rounded text-muted hover:text-clay",
        "icon-dark": "rounded text-white/70 hover:bg-white/10 hover:text-white",
        unstyled: "bg-transparent",
      },
      size: {
        xs: "text-[11px]",
        sm: "px-3 py-2 text-sm",
        md: "px-4 py-2.5 text-sm",
        lg: "px-4 py-3 text-sm",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    compoundVariants: [
      {
        variant: ["link", "link-dark", "link-muted", "link-quiet", "link-danger", "unstyled"],
        class: "h-auto p-0",
      },
      {
        variant: "unstyled",
        class: "text-[length:inherit]",
      },
      {
        variant: "dropzone",
        class: "px-4 py-5",
      },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    active?: boolean;
  };

function Button({ className, variant, size, active, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      data-active={active ? "true" : undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
