import type { ReactNode } from "react";

interface GlassTableProps {
  columns: string[];
  /** Filas `<tr>`; cada celda lleva `py-3 pr-4`. */
  children: ReactNode;
  caption?: string;
}

/** Tabla dentro de vidrio: solo una línea fina bajo el encabezado y entre filas. */
export function GlassTable({ columns, children, caption }: GlassTableProps) {
  return (
    <div className="glass overflow-x-auto rounded-[22px] px-5 py-2">
      <table className="w-full text-[13px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-line-soft text-left">
            {columns.map((column) => (
              <th key={column} scope="col" className="py-3 pr-4 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line-soft [&>tr:last-child]:border-0">{children}</tbody>
      </table>
    </div>
  );
}
