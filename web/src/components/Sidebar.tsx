"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Bell, Clock, Compass, FileText, Layers, Settings } from "lucide-react";
import { cx } from "@/lib/cx";

const NAV = [
  { href: "/explorar", label: "Explorar", Icon: Compass },
  { href: "/proximas-24h", label: "Próximas 24 h", Icon: Clock },
  { href: "/alertas", label: "Alertas", Icon: Bell, badge: true },
  { href: "/reportes", label: "Reportes", Icon: FileText },
  { href: "/armonizacion", label: "Armonización", Icon: Layers },
  { href: "/ajustes", label: "Ajustes", Icon: Settings },
];

export function Sidebar({ alertCount }: { alertCount: number }) {
  const path = usePathname();
  return (
    <aside className="flex shrink-0 flex-col border-b border-border md:w-[216px] md:border-r md:border-b-0">
      <Link href="/" className="hidden h-14 items-center gap-2 px-5 text-[15px] font-semibold tracking-[0.02em] md:flex">
        <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden /> KINDRA
      </Link>
      {/* En celular se vuelve una fila de pestañas que se desliza */}
      <nav aria-label="Principal" className="flex gap-1 overflow-x-auto p-2 md:flex-1 md:flex-col">
        {NAV.map(({ href, label, Icon, badge }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx("flex h-8 shrink-0 items-center gap-2.5 rounded-md px-3 text-[13px] hover:bg-hover", active && "bg-sel")}
            >
              <Icon size={16} strokeWidth={1.75} aria-hidden />
              {label}
              {badge && alertCount > 0 && (
                <span className="ml-auto rounded-sm bg-fire-soft px-1.5 text-[11px] text-fire-ink">{alertCount}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="hidden space-y-0.5 border-t border-border p-5 text-[11.5px] text-muted-foreground md:block">
        <p className="flex items-center gap-1.5 text-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden /> MODIS + VIIRS armonizados
        </p>
        <p>Fuente: NASA FIRMS</p>
        <p>Valores de esta demo: de ejemplo</p>
      </div>
    </aside>
  );
}
