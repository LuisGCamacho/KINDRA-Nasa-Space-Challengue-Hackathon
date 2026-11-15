"use client";

import { useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { usePanelOpen } from "@/hooks/usePanelOpen";

interface GlassPanelProps {
  /** Clave para recordar si el panel quedó abierto o cerrado entre visitas. */
  id: string;
  title: string;
  /** Dato corto junto al título; se sigue viendo con el panel cerrado. */
  meta?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** Panel de vidrio que se despliega y se pliega desde su encabezado. */
export function GlassPanel({ id, title, meta, defaultOpen = true, children }: GlassPanelProps) {
  const [open, toggle] = usePanelOpen(id, defaultOpen);
  const bodyId = useId();

  return (
    <section className="glass rounded-[22px]">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex h-12 w-full items-center gap-3 pl-5 pr-3 text-left"
      >
        <span className="text-[13px] font-medium tracking-[-0.01em]">{title}</span>
        <span className="ml-auto truncate text-[12px] tabular-nums text-muted">{meta}</span>
        <ChevronDown
          aria-hidden
          className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div id={bodyId} className="panel-body" data-open={open}>
        <div className="overflow-hidden">
          <div className="px-5 pb-5 pt-1">{children}</div>
        </div>
      </div>
    </section>
  );
}
