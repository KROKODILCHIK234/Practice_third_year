"use client";

/** Small "i" badge that reveals an explanation on hover (native tooltip). */
export function InfoTip({ text }: { text: string }) {
  return (
    <span
      title={text}
      role="img"
      aria-label={text}
      className="inline-flex items-center justify-center w-3.5 h-3.5 shrink-0 rounded-full border border-border text-text-dim text-[8px] font-semibold leading-none cursor-help select-none transition-colors hover:text-text hover:border-border-strong"
    >
      i
    </span>
  );
}

/** Context chip telling the user which data the panel currently reflects. */
export function ScopeChip({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 border tabular-nums whitespace-nowrap ${
        active
          ? "border-accent/40 bg-accent-soft text-accent"
          : "border-border bg-surface-2 text-text-muted"
      }`}
    >
      <span className={`w-1 h-1 rounded-full ${active ? "bg-accent" : "bg-text-dim"}`} />
      {label}
    </span>
  );
}
