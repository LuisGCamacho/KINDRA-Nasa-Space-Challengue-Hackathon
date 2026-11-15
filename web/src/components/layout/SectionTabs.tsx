"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/explorar", label: "Lupa" },
  { href: "/camaras", label: "Cámaras" },
  { href: "/calendario", label: "Calendario" },
  { href: "/armonizacion", label: "Armonización" },
  { href: "/proximas-24h", label: "Próximas 24 h" },
  { href: "/alertas", label: "Alertas" },
  { href: "/reportes", label: "Reportes" },
  { href: "/ajustes", label: "Ajustes" },
] as const;

/** Secciones en una píldora de vidrio; la activa se marca con vidrio más claro. */
export function SectionTabs({ alertCount }: { alertCount: number }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones de KINDRA" className="glass inline-flex items-center gap-0.5 rounded-full p-1">
      {SECTIONS.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] ${
              active ? "bg-glass-strong text-heading" : "text-muted hover:text-heading"
            }`}
          >
            {label}
            {href === "/alertas" && alertCount > 0 && <AlertCount count={alertCount} />}
          </Link>
        );
      })}
    </nav>
  );
}

function AlertCount({ count }: { count: number }) {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-inverse px-1.5 text-[11px] font-medium tabular-nums text-inverse-fg">
      <span className="sr-only">Alertas activas: </span>
      {count}
    </span>
  );
}
