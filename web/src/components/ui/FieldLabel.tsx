import type { ReactNode } from "react";

/** Etiqueta en mayúsculas de 10,5 px sobre un control. Sin `htmlFor`, es solo texto. */
export function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  const className = "mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted";
  return htmlFor ? (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ) : (
    <span className={className}>{children}</span>
  );
}
