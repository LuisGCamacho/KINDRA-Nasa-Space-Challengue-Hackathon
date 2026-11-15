import type { ReactNode } from "react";

/** Título y bajada de una pantalla, con un lugar a la derecha para controles. */
export function ScreenHeader({ title, lead, actions }: { title: string; lead: string; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="mb-1 text-[22px] font-medium tracking-[-0.02em]">{title}</h1>
        <p className="max-w-2xl text-[13px] text-muted">{lead}</p>
      </div>
      {actions}
    </header>
  );
}

/** Texto de estado (cargando, error, vacío) con el mismo estilo en todas las pantallas. */
export function StatusText({ children }: { children: ReactNode }) {
  return <p className="text-[13px] text-muted">{children}</p>;
}
