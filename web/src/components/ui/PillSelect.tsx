import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

/** Select nativo con forma de píldora de vidrio. Es accesible sin trabajo extra. */
export function PillSelect({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={`relative ${className}`}>
      <select
        {...props}
        className="glass h-9 w-full appearance-none rounded-full pl-4 pr-9 text-[13px] hover:border-white/30"
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
      />
    </div>
  );
}
