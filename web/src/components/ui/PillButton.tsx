import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "glass";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-inverse font-medium text-inverse-fg hover:bg-inverse-hover",
  glass: "glass text-heading hover:bg-glass-strong",
};

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/** Botón en píldora. `primary` (blanco) se usa una sola vez por panel. */
export function PillButton({ variant = "glass", className = "", ...props }: PillButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASS[variant]} ${className}`}
    />
  );
}
