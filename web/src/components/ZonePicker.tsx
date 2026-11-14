"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ChevronDown, MapPin } from "lucide-react";
import type { Zone } from "@/lib/types";
import { cx } from "@/lib/cx";
import { btn, LABEL } from "./ui";

/** Selector de zona + mes elegido. La zona vive en la URL: /explorar?zona=chilecito&mes=2026-07 */
export function ZonePicker({ zones, zonaId, mes, mesLabel }: { zones: Zone[]; zonaId: string; mes: string; mesLabel: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <>
      <div ref={box} className="relative">
        <button type="button" className={btn.secondary} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <MapPin size={16} strokeWidth={1.75} aria-hidden />
          {zones.find((z) => z.id === zonaId)?.name}
          <ChevronDown size={14} strokeWidth={1.75} aria-hidden />
        </button>
        {open && (
          <ul role="listbox" aria-label="Zona" className="absolute left-0 top-10 z-20 w-64 rounded-md border border-border bg-background p-1 shadow-md">
            <li className={cx(LABEL, "px-2 py-1.5")}>Zona</li>
            {zones.map((z) => (
              <li key={z.id} role="option" aria-selected={z.id === zonaId}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(`/explorar?zona=${z.id}&mes=${mes}`);
                  }}
                  className={cx(
                    "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left hover:bg-hover",
                    z.id === zonaId && "outline outline-1 outline-foreground",
                  )}
                >
                  <span>
                    <span className="block">{z.name}</span>
                    <span className="block text-xs text-muted-foreground">{z.province}</span>
                  </span>
                  {z.id === zonaId && <Check size={14} aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* El mes se elige con un clic en el calendario; aquí solo se muestra */}
      <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[13px] font-medium">
        <CalendarDays size={16} strokeWidth={1.75} aria-hidden /> {mesLabel}
      </span>
    </>
  );
}
