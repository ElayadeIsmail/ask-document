type StatusDotProps = {
  ok: boolean;
  label: string;
};

export function StatusDot({ ok, label }: StatusDotProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-muted">
      <span
        className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-moss-2" : "bg-clay/80"}`}
      />
      {label}
    </span>
  );
}
