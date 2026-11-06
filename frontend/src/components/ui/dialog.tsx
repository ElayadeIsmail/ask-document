import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type DialogProps = {
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

function Dialog({ onClose, children, className }: DialogProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <Button
        variant="unstyled"
        aria-label="Close dialog"
        className="absolute inset-0"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 w-full max-w-md rounded-3xl border border-line bg-[#fffdf8] p-6 shadow-[0_20px_50px_rgba(28,24,20,0.18)]",
          className,
        )}
      >
        {children}
      </section>
    </div>
  );
}

export { Dialog };
